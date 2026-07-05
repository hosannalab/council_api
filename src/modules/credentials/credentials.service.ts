import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CredentialStatus, Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { AuthUser } from '../../common/decorators/current-user.decorator';
import { paginate, paginatedResult } from '../../common/dto/pagination-query.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { isSuperAdmin } from '../rbac/rbac.utils';
import {
  CreateCredentialDto,
  ListCredentialsQueryDto,
  RenewCredentialDto,
} from './dto/credentials.dto';

const credentialInclude = {
  minister: {
    select: {
      id: true,
      fullName: true,
      rank: true,
      status: true,
      assignments: {
        where: { endedAt: null },
        take: 1,
        include: {
          church: {
            select: {
              id: true,
              name: true,
              city: true,
            },
          },
        },
      },
    },
  },
  tenant: {
    select: {
      id: true,
      name: true,
      slug: true,
    },
  },
} as const;

@Injectable()
export class CredentialsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(actor: AuthUser, query: ListCredentialsQueryDto) {
    const tenantId = this.requireTenantId(actor);
    const { skip, take, page, pageSize } = paginate(query.page, query.pageSize);

    const where: Prisma.PastorCredentialWhereInput = { tenantId };

    const scopedMinisterId = await this.resolveListMinisterScope(actor, tenantId);
    if (scopedMinisterId) {
      where.ministerId = scopedMinisterId;
    } else if (query.ministerId) {
      where.ministerId = query.ministerId;
    }
    if (query.status) where.status = query.status;
    if (query.search?.trim()) {
      where.OR = [
        { credentialNo: { contains: query.search.trim(), mode: 'insensitive' } },
        {
          minister: {
            fullName: { contains: query.search.trim(), mode: 'insensitive' },
          },
        },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.pastorCredential.findMany({
        where,
        skip,
        take,
        include: credentialInclude,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.pastorCredential.count({ where }),
    ]);

    return paginatedResult(items, total, page, pageSize);
  }

  async findOne(actor: AuthUser, id: string) {
    return this.getScopedCredential(actor, id);
  }

  async findMine(actor: AuthUser) {
    const tenantId = this.requireTenantId(actor);

    const minister = await this.prisma.minister.findFirst({
      where: { userId: actor.id, tenantId },
    });
    if (!minister) {
      throw new NotFoundException(
        'No tiene un perfil de ministro vinculado a su usuario',
      );
    }

    const active = await this.prisma.pastorCredential.findFirst({
      where: {
        ministerId: minister.id,
        tenantId,
        status: CredentialStatus.ACTIVE,
      },
      include: credentialInclude,
      orderBy: { issuedAt: 'desc' },
    });
    if (active) {
      return active;
    }

    const latest = await this.prisma.pastorCredential.findFirst({
      where: { ministerId: minister.id, tenantId },
      include: credentialInclude,
      orderBy: { issuedAt: 'desc' },
    });
    if (!latest) {
      throw new NotFoundException(
        'Aún no tiene credencial emitida. Solicítela al concilio.',
      );
    }

    return latest;
  }

  async create(actor: AuthUser, dto: CreateCredentialDto) {
    const tenantId = this.requireTenantId(actor);

    // Verify minister exists and belongs to the same tenant
    const minister = await this.prisma.minister.findFirst({
      where: { id: dto.ministerId, tenantId },
    });
    if (!minister) {
      throw new NotFoundException('Ministerio no encontrado en este concilio');
    }

    // Suspend existing active credentials for this minister
    await this.prisma.pastorCredential.updateMany({
      where: { ministerId: dto.ministerId, tenantId, status: CredentialStatus.ACTIVE },
      data: { status: CredentialStatus.SUSPENDED },
    });

    // Handle credential number
    let credentialNo = dto.credentialNo?.trim();
    if (credentialNo) {
      const existing = await this.prisma.pastorCredential.findUnique({
        where: { credentialNo },
      });
      if (existing) {
        throw new BadRequestException(`El número de credencial "${credentialNo}" ya está registrado.`);
      }
    } else {
      const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
      const year = new Date().getFullYear();
      const rand = Math.floor(1000 + Math.random() * 9000);
      credentialNo = `CRE-${tenant?.slug.toUpperCase() || 'CON'}-${year}-${rand}`;
    }

    const verifyToken = randomUUID();

    const credential = await this.prisma.pastorCredential.create({
      data: {
        tenantId,
        ministerId: dto.ministerId,
        credentialNo,
        photoUrl: dto.photoUrl?.trim() || null,
        issuedAt: new Date(),
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        status: CredentialStatus.ACTIVE,
        verifyToken,
        createdById: actor.id,
      },
      include: credentialInclude,
    });

    // Write audit log
    await this.prisma.auditLog.create({
      data: {
        tenantId,
        actorId: actor.id,
        action: 'CREDENTIAL_CREATE',
        entity: 'PastorCredential',
        entityId: credential.id,
        before: Prisma.DbNull,
        after: credential as any,
      },
    });

    return credential;
  }

  async renew(actor: AuthUser, id: string, dto: RenewCredentialDto) {
    const prev = await this.getScopedCredential(actor, id);

    const updated = await this.prisma.pastorCredential.update({
      where: { id },
      data: {
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        status: CredentialStatus.ACTIVE, // Reactivates if suspended or expired
      },
      include: credentialInclude,
    });

    // Write audit log
    await this.prisma.auditLog.create({
      data: {
        tenantId: prev.tenantId,
        actorId: actor.id,
        action: 'CREDENTIAL_RENEW',
        entity: 'PastorCredential',
        entityId: id,
        before: prev as any,
        after: updated as any,
      },
    });

    return updated;
  }

  async suspend(actor: AuthUser, id: string) {
    const prev = await this.getScopedCredential(actor, id);

    const updated = await this.prisma.pastorCredential.update({
      where: { id },
      data: { status: CredentialStatus.SUSPENDED },
      include: credentialInclude,
    });

    // Write audit log
    await this.prisma.auditLog.create({
      data: {
        tenantId: prev.tenantId,
        actorId: actor.id,
        action: 'CREDENTIAL_SUSPEND',
        entity: 'PastorCredential',
        entityId: id,
        before: prev as any,
        after: updated as any,
      },
    });

    return updated;
  }

  async revoke(actor: AuthUser, id: string) {
    const prev = await this.getScopedCredential(actor, id);

    const updated = await this.prisma.pastorCredential.update({
      where: { id },
      data: { status: CredentialStatus.REVOKED },
      include: credentialInclude,
    });

    // Write audit log
    await this.prisma.auditLog.create({
      data: {
        tenantId: prev.tenantId,
        actorId: actor.id,
        action: 'CREDENTIAL_REVOKE',
        entity: 'PastorCredential',
        entityId: id,
        before: prev as any,
        after: updated as any,
      },
    });

    return updated;
  }

  async verify(token: string) {
    const credential = await this.prisma.pastorCredential.findUnique({
      where: { verifyToken: token },
      include: credentialInclude,
    });

    if (!credential) {
      throw new NotFoundException('Credencial no encontrada o inválida');
    }

    // Determine effective status based on expiration
    let status = credential.status;
    if (status === CredentialStatus.ACTIVE && credential.expiresAt && new Date(credential.expiresAt) < new Date()) {
      status = CredentialStatus.EXPIRED;
    }

    const activeAssignment = credential.minister.assignments[0];

    return {
      credentialNo: credential.credentialNo,
      fullName: credential.minister.fullName,
      rank: credential.minister.rank,
      status,
      photoUrl: credential.photoUrl,
      issuedAt: credential.issuedAt,
      expiresAt: credential.expiresAt,
      tenantName: credential.tenant.name,
      currentChurchName: activeAssignment?.church?.name ?? null,
      currentChurchCity: activeAssignment?.church?.city ?? null,
    };
  }

  private async resolveListMinisterScope(
    actor: AuthUser,
    tenantId: string,
  ): Promise<string | null> {
    if (
      actor.roles.includes('Council Admin') ||
      actor.permissions.includes('churches:write') ||
      actor.permissions.includes('credentials:write')
    ) {
      return null;
    }

    const minister = await this.prisma.minister.findFirst({
      where: { userId: actor.id, tenantId },
      select: { id: true },
    });

    return minister?.id ?? null;
  }

  private async assertOwnCredentialAccess(
    actor: AuthUser,
    ministerId: string,
    tenantId: string,
  ) {
    if (
      isSuperAdmin(actor) ||
      actor.roles.includes('Council Admin') ||
      actor.permissions.includes('churches:write') ||
      actor.permissions.includes('credentials:write')
    ) {
      return;
    }

    const minister = await this.prisma.minister.findFirst({
      where: { userId: actor.id, tenantId },
      select: { id: true },
    });

    if (!minister || minister.id !== ministerId) {
      throw new ForbiddenException('No tiene acceso a esta credencial');
    }
  }

  private requireTenantId(actor: AuthUser): string {
    if (isSuperAdmin(actor)) {
      throw new BadRequestException('Super Admin must operate within a tenant context for credentials');
    }
    if (!actor.tenantId) {
      throw new ForbiddenException('Tenant context required');
    }
    return actor.tenantId;
  }

  private async getScopedCredential(actor: AuthUser, id: string) {
    const credential = await this.prisma.pastorCredential.findUnique({
      where: { id },
      include: credentialInclude,
    });

    if (!credential) {
      throw new NotFoundException('Credencial no encontrada');
    }

    if (!isSuperAdmin(actor) && credential.tenantId !== actor.tenantId) {
      throw new ForbiddenException('No tiene acceso a esta credencial');
    }

    await this.assertOwnCredentialAccess(
      actor,
      credential.ministerId,
      credential.tenantId,
    );

    return credential;
  }
}
