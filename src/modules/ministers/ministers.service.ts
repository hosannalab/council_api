import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MinisterRank, Prisma } from '@prisma/client';
import { AuthUser } from '../../common/decorators/current-user.decorator';
import {
  paginate,
  paginatedResult,
} from '../../common/dto/pagination-query.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { isSuperAdmin } from '../rbac/rbac.utils';
import {
  AssignMinisterDto,
  CreateMinisterCommentDto,
  CreateMinisterDto,
  ListMinistersQueryDto,
  UpdateMinisterDto,
} from './dto/minister.dto';

const ministerInclude = {
  assignments: {
    where: { endedAt: null },
    take: 1,
    include: {
      church: { select: { id: true, name: true, city: true } },
    },
  },
} as const;

@Injectable()
export class MinistersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(actor: AuthUser, query: ListMinistersQueryDto) {
    const tenantId = this.requireTenantId(actor);
    const { skip, take, page, pageSize } = paginate(query.page, query.pageSize);

    const where: Prisma.MinisterWhereInput = { tenantId };

    if (query.rank) where.rank = query.rank;
    if (query.status) where.status = query.status;
    if (query.search?.trim()) {
      where.fullName = { contains: query.search.trim(), mode: 'insensitive' };
    }
    if (query.churchId) {
      where.assignments = {
        some: { churchId: query.churchId, endedAt: null },
      };
    }
    if (query.unlinkedOnly) {
      where.userId = null;
    }

    const [items, total] = await Promise.all([
      this.prisma.minister.findMany({
        where,
        skip,
        take,
        include: ministerInclude,
        orderBy: { fullName: 'asc' },
      }),
      this.prisma.minister.count({ where }),
    ]);

    return paginatedResult(
      items.map((m) => this.toListResponse(m)),
      total,
      page,
      pageSize,
    );
  }

  async findOne(actor: AuthUser, id: string) {
    const minister = await this.getScopedMinister(actor, id);
    return this.toDetailResponse(minister);
  }

  async create(actor: AuthUser, dto: CreateMinisterDto) {
    const tenantId = this.requireTenantId(actor);

    try {
      const minister = await this.prisma.minister.create({
        data: {
          tenantId,
          fullName: dto.fullName.trim(),
          identityDocument: dto.identityDocument.trim(),
          rank: dto.rank,
          ordinationAt: dto.ordinationAt ? new Date(dto.ordinationAt) : undefined,
          status: dto.status,
        },
        include: ministerInclude,
      });

      return this.toDetailResponse(minister);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Identity document already registered');
      }
      throw error;
    }
  }

  async update(actor: AuthUser, id: string, dto: UpdateMinisterDto) {
    await this.getScopedMinister(actor, id);

    const minister = await this.prisma.minister.update({
      where: { id },
      data: {
        fullName: dto.fullName?.trim(),
        rank: dto.rank,
        ordinationAt: dto.ordinationAt ? new Date(dto.ordinationAt) : undefined,
        status: dto.status,
      },
      include: ministerInclude,
    });

    return this.toDetailResponse(minister);
  }

  async deactivate(actor: AuthUser, id: string) {
    const minister = await this.getScopedMinister(actor, id);

    await this.prisma.$transaction(async (tx) => {
      await this.closeActiveAssignment(tx, minister.id, minister.tenantId, 'Deactivated');

      if (minister.rank === MinisterRank.PASTOR) {
        await tx.church.updateMany({
          where: { currentPastorId: minister.id },
          data: { currentPastorId: null },
        });
      }

      await tx.minister.update({
        where: { id },
        data: { status: 'INACTIVE' },
      });
    });

    return this.findOne(actor, id);
  }

  async getAssignments(actor: AuthUser, id: string) {
    await this.getScopedMinister(actor, id);

    const assignments = await this.prisma.ministerAssignment.findMany({
      where: { ministerId: id },
      include: {
        church: { select: { id: true, name: true, city: true } },
        createdBy: { select: { id: true, fullName: true } },
      },
      orderBy: { startedAt: 'desc' },
    });

    return assignments.map((a) => ({
      id: a.id,
      church: a.church,
      startedAt: a.startedAt,
      endedAt: a.endedAt,
      reason: a.reason,
      isActive: a.endedAt === null,
      createdBy: a.createdBy,
      createdAt: a.createdAt,
    }));
  }

  async assign(actor: AuthUser, id: string, dto: AssignMinisterDto) {
    const minister = await this.getScopedMinister(actor, id);

    if (minister.status !== 'ACTIVE') {
      throw new BadRequestException('Cannot assign an inactive minister');
    }

    const church = await this.prisma.church.findFirst({
      where: { id: dto.churchId, tenantId: minister.tenantId },
    });

    if (!church) {
      throw new BadRequestException('Church not found in this tenant');
    }

    const activeAssignment = minister.assignments[0];
    if (activeAssignment?.churchId === dto.churchId) {
      throw new BadRequestException('Minister is already assigned to this church');
    }

    const startedAt = dto.startedAt ? new Date(dto.startedAt) : new Date();

    await this.prisma.$transaction(async (tx) => {
      if (activeAssignment) {
        await tx.ministerAssignment.update({
          where: { id: activeAssignment.id },
          data: {
            endedAt: startedAt,
            reason: dto.reason ?? 'Transferred',
          },
        });

        if (minister.rank === MinisterRank.PASTOR) {
          await tx.church.updateMany({
            where: { id: activeAssignment.churchId, currentPastorId: minister.id },
            data: { currentPastorId: null },
          });
        }
      }

      await tx.ministerAssignment.create({
        data: {
          tenantId: minister.tenantId,
          ministerId: minister.id,
          churchId: dto.churchId,
          startedAt,
          reason: dto.reason,
          createdById: actor.id,
        },
      });

      if (minister.rank === MinisterRank.PASTOR) {
        const previousPastorId = church.currentPastorId;
        if (previousPastorId && previousPastorId !== minister.id) {
          await tx.ministerAssignment.updateMany({
            where: {
              ministerId: previousPastorId,
              churchId: dto.churchId,
              endedAt: null,
            },
            data: {
              endedAt: startedAt,
              reason: 'Replaced by new assignment',
            },
          });
        }

        await tx.church.update({
          where: { id: dto.churchId },
          data: { currentPastorId: minister.id },
        });
      }
    });

    return this.findOne(actor, id);
  }

  async getComments(actor: AuthUser, id: string) {
    await this.getScopedMinister(actor, id);

    const comments = await this.prisma.ministerComment.findMany({
      where: { ministerId: id },
      include: {
        author: { select: { id: true, fullName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return comments.map((c) => ({
      id: c.id,
      body: c.body,
      author: c.author,
      createdAt: c.createdAt,
    }));
  }

  async addComment(actor: AuthUser, id: string, dto: CreateMinisterCommentDto) {
    const minister = await this.getScopedMinister(actor, id);

    const comment = await this.prisma.ministerComment.create({
      data: {
        tenantId: minister.tenantId,
        ministerId: minister.id,
        authorId: actor.id,
        body: dto.body.trim(),
      },
      include: {
        author: { select: { id: true, fullName: true } },
      },
    });

    return {
      id: comment.id,
      body: comment.body,
      author: comment.author,
      createdAt: comment.createdAt,
    };
  }

  private requireTenantId(actor: AuthUser): string {
    if (isSuperAdmin(actor)) {
      throw new BadRequestException(
        'Super Admin must operate within a tenant context for ministers',
      );
    }
    if (!actor.tenantId) {
      throw new ForbiddenException('Tenant context required');
    }
    return actor.tenantId;
  }

  private async getScopedMinister(actor: AuthUser, id: string) {
    const minister = await this.prisma.minister.findUnique({
      where: { id },
      include: ministerInclude,
    });

    if (!minister) {
      throw new NotFoundException('Minister not found');
    }

    if (!isSuperAdmin(actor) && minister.tenantId !== actor.tenantId) {
      throw new ForbiddenException('Access denied to this minister');
    }

    return minister;
  }

  private async closeActiveAssignment(
    tx: Prisma.TransactionClient,
    ministerId: string,
    tenantId: string,
    reason: string,
  ) {
    await tx.ministerAssignment.updateMany({
      where: { ministerId, tenantId, endedAt: null },
      data: { endedAt: new Date(), reason },
    });
  }

  private toListResponse(minister: {
    id: string;
    fullName: string;
    identityDocument: string;
    rank: string;
    status: string;
    ordinationAt: Date | null;
    userId: string | null;
    assignments: Array<{
      church: { id: string; name: string; city: string | null };
    }>;
  }) {
    const active = minister.assignments[0];
    return {
      id: minister.id,
      fullName: minister.fullName,
      identityDocument: minister.identityDocument,
      rank: minister.rank,
      status: minister.status,
      ordinationAt: minister.ordinationAt,
      userId: minister.userId,
      currentChurch: active?.church ?? null,
    };
  }

  private toDetailResponse(minister: {
    id: string;
    tenantId: string;
    fullName: string;
    identityDocument: string;
    rank: string;
    status: string;
    ordinationAt: Date | null;
    userId: string | null;
    createdAt: Date;
    updatedAt: Date;
    assignments: Array<{
      id: string;
      startedAt: Date;
      church: { id: string; name: string; city: string | null };
    }>;
  }) {
    const active = minister.assignments[0];
    return {
      id: minister.id,
      tenantId: minister.tenantId,
      fullName: minister.fullName,
      identityDocument: minister.identityDocument,
      rank: minister.rank,
      status: minister.status,
      ordinationAt: minister.ordinationAt,
      userId: minister.userId,
      currentChurch: active?.church ?? null,
      currentAssignment: active
        ? { id: active.id, startedAt: active.startedAt }
        : null,
      createdAt: minister.createdAt,
      updatedAt: minister.updatedAt,
    };
  }
}
