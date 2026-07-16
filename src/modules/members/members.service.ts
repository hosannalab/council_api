import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuthUser } from '../../common/decorators/current-user.decorator';
import {
  paginate,
  paginatedResult,
} from '../../common/dto/pagination-query.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { resolveChurchScopeResponse } from '../../common/scope/church-scope';
import { isSuperAdmin } from '../rbac/rbac.utils';
import {
  CreateMemberCommentDto,
  CreateMemberDto,
  ListMembersQueryDto,
  MemberLogEvent,
  TransferMemberDto,
  UpdateMemberDto,
} from './dto/member.dto';

const memberInclude = {
  church: { select: { id: true, name: true, city: true } },
} as const;

export interface MemberScope {
  tenantId: string;
  churchId?: string;
}

@Injectable()
export class MembersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(actor: AuthUser, query: ListMembersQueryDto) {
    const scope = await this.resolveScope(actor);
    const { skip, take, page, pageSize } = paginate(query.page, query.pageSize);

    const where: Prisma.MemberWhereInput = { tenantId: scope.tenantId };

    if (scope.churchId) {
      where.churchId = scope.churchId;
    } else if (query.churchId) {
      where.churchId = query.churchId;
    }

    if (query.isActive !== undefined) where.isActive = query.isActive;
    if (query.search?.trim()) {
      where.fullName = { contains: query.search.trim(), mode: 'insensitive' };
    }
    if (query.createdFrom || query.createdTo) {
      where.createdAt = {};
      if (query.createdFrom) where.createdAt.gte = new Date(query.createdFrom);
      if (query.createdTo) where.createdAt.lte = new Date(query.createdTo);
    }

    const [items, total] = await Promise.all([
      this.prisma.member.findMany({
        where,
        skip,
        take,
        include: memberInclude,
        orderBy: { fullName: 'asc' },
      }),
      this.prisma.member.count({ where }),
    ]);

    return paginatedResult(
      items.map((m) => this.toListResponse(m)),
      total,
      page,
      pageSize,
    );
  }

  async findOne(actor: AuthUser, id: string) {
    const member = await this.getScopedMember(actor, id);
    return this.toDetailResponse(member);
  }

  async create(actor: AuthUser, dto: CreateMemberDto) {
    const scope = await this.resolveScope(actor);
    this.assertChurchInScope(scope, dto.churchId);

    const church = await this.prisma.church.findFirst({
      where: { id: dto.churchId, tenantId: scope.tenantId },
    });
    if (!church) {
      throw new BadRequestException('Church not found');
    }

    type MemberWithChurch = Prisma.MemberGetPayload<{
      include: typeof memberInclude;
    }>;

    const member = await this.prisma.$transaction(async (tx) => {
      let created: MemberWithChurch;
      try {
        created = await tx.member.create({
          data: {
            tenantId: scope.tenantId,
            churchId: dto.churchId,
            ...this.memberCreateData(dto),
          },
          include: memberInclude,
        });
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
          throw new ConflictException('Identity document already registered');
        }
        throw error;
      }

      await tx.memberChurchHistory.create({
        data: {
          tenantId: scope.tenantId,
          memberId: created.id,
          churchId: dto.churchId,
          startedAt: new Date(),
        },
      });

      await this.writeLog(tx, {
        tenantId: scope.tenantId,
        memberId: created.id,
        event: MemberLogEvent.CREATED,
        detail: `Registered at ${church.name}`,
        actorId: actor.id,
      });

      return created;
    });

    return this.toDetailResponse(member);
  }

  async update(actor: AuthUser, id: string, dto: UpdateMemberDto) {
    const member = await this.getScopedMember(actor, id);

    if (dto.isActive === false && member.isActive) {
      return this.deactivate(actor, id);
    }

    if (dto.isActive === true && !member.isActive) {
      return this.reactivate(actor, id, dto);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.member.update({
        where: { id },
        data: this.memberUpdateData(dto),
        include: memberInclude,
      });

      await this.writeLog(tx, {
        tenantId: member.tenantId,
        memberId: id,
        event: MemberLogEvent.UPDATED,
        detail: 'Profile updated',
        actorId: actor.id,
      });

      return result;
    });

    return this.toDetailResponse(updated);
  }

  async deactivate(actor: AuthUser, id: string) {
    const member = await this.getScopedMember(actor, id);

    if (!member.isActive) {
      throw new BadRequestException('Member is already inactive');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.memberChurchHistory.updateMany({
        where: { memberId: id, endedAt: null },
        data: { endedAt: new Date(), reason: 'Deactivated' },
      });

      const result = await tx.member.update({
        where: { id },
        data: { isActive: false },
        include: memberInclude,
      });

      await this.writeLog(tx, {
        tenantId: member.tenantId,
        memberId: id,
        event: MemberLogEvent.DEACTIVATED,
        actorId: actor.id,
      });

      return result;
    });

    return this.toDetailResponse(updated);
  }

  async reactivate(actor: AuthUser, id: string, dto?: UpdateMemberDto) {
    const member = await this.getScopedMember(actor, id);

    if (member.isActive) {
      throw new BadRequestException('Member is already active');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.member.update({
        where: { id },
        data: {
          isActive: true,
          ...this.memberUpdateData(dto),
        },
        include: memberInclude,
      });

      await tx.memberChurchHistory.create({
        data: {
          tenantId: member.tenantId,
          memberId: id,
          churchId: member.churchId,
          startedAt: new Date(),
          reason: 'Reactivated',
        },
      });

      await this.writeLog(tx, {
        tenantId: member.tenantId,
        memberId: id,
        event: MemberLogEvent.ACTIVATED,
        actorId: actor.id,
      });

      return result;
    });

    return this.toDetailResponse(updated);
  }

  async transfer(actor: AuthUser, id: string, dto: TransferMemberDto) {
    const member = await this.getScopedMember(actor, id);
    const scope = await this.resolveScope(actor);

    if (!member.isActive) {
      throw new BadRequestException('Cannot transfer an inactive member');
    }

    if (member.churchId === dto.churchId) {
      throw new BadRequestException('Member is already in this church');
    }

    this.assertChurchInScope(scope, dto.churchId);

    const church = await this.prisma.church.findFirst({
      where: { id: dto.churchId, tenantId: member.tenantId },
    });
    if (!church) {
      throw new BadRequestException('Target church not found');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.memberChurchHistory.updateMany({
        where: { memberId: id, endedAt: null },
        data: { endedAt: new Date(), reason: dto.reason ?? 'Transferred' },
      });

      await tx.memberChurchHistory.create({
        data: {
          tenantId: member.tenantId,
          memberId: id,
          churchId: dto.churchId,
          startedAt: new Date(),
          reason: dto.reason,
        },
      });

      const result = await tx.member.update({
        where: { id },
        data: { churchId: dto.churchId },
        include: memberInclude,
      });

      await this.writeLog(tx, {
        tenantId: member.tenantId,
        memberId: id,
        event: MemberLogEvent.TRANSFERRED,
        detail: `Moved to ${church.name}`,
        actorId: actor.id,
      });

      return result;
    });

    return this.toDetailResponse(updated);
  }

  async getHistory(actor: AuthUser, id: string) {
    await this.getScopedMember(actor, id);

    const history = await this.prisma.memberChurchHistory.findMany({
      where: { memberId: id },
      include: { church: { select: { id: true, name: true, city: true } } },
      orderBy: { startedAt: 'desc' },
    });

    return history.map((h) => ({
      id: h.id,
      church: h.church,
      startedAt: h.startedAt,
      endedAt: h.endedAt,
      reason: h.reason,
      isCurrent: h.endedAt === null,
    }));
  }

  async getLogs(actor: AuthUser, id: string) {
    await this.getScopedMember(actor, id);

    const logs = await this.prisma.memberLog.findMany({
      where: { memberId: id },
      orderBy: { createdAt: 'desc' },
    });

    return logs;
  }

  async getComments(actor: AuthUser, id: string) {
    await this.getScopedMember(actor, id);

    const comments = await this.prisma.memberComment.findMany({
      where: { memberId: id },
      include: { author: { select: { id: true, fullName: true } } },
      orderBy: { createdAt: 'desc' },
    });

    return comments.map((c) => ({
      id: c.id,
      body: c.body,
      author: c.author,
      createdAt: c.createdAt,
    }));
  }

  async addComment(actor: AuthUser, id: string, dto: CreateMemberCommentDto) {
    const member = await this.getScopedMember(actor, id);

    const comment = await this.prisma.memberComment.create({
      data: {
        tenantId: member.tenantId,
        memberId: id,
        authorId: actor.id,
        body: dto.body.trim(),
      },
      include: { author: { select: { id: true, fullName: true } } },
    });

    await this.prisma.memberLog.create({
      data: {
        tenantId: member.tenantId,
        memberId: id,
        event: 'COMMENT_ADDED',
        detail: 'Comment added to member profile',
        actorId: actor.id,
      },
    });

    return {
      id: comment.id,
      body: comment.body,
      author: comment.author,
      createdAt: comment.createdAt,
    };
  }

  async resolveScope(actor: AuthUser): Promise<MemberScope> {
    const tenantId = this.requireTenantId(actor);
    return resolveChurchScopeResponse(this.prisma, actor, tenantId);
  }

  private requireTenantId(actor: AuthUser): string {
    if (isSuperAdmin(actor)) {
      throw new BadRequestException(
        'Super Admin must operate within a tenant context for members',
      );
    }
    if (!actor.tenantId) {
      throw new ForbiddenException('Tenant context required');
    }
    return actor.tenantId;
  }

  private assertChurchInScope(scope: MemberScope, churchId: string) {
    if (scope.churchId && scope.churchId !== churchId) {
      throw new ForbiddenException(
        'You can only manage members of your assigned church',
      );
    }
  }

  private async getScopedMember(actor: AuthUser, id: string) {
    const member = await this.prisma.member.findUnique({
      where: { id },
      include: memberInclude,
    });

    if (!member) {
      throw new NotFoundException('Member not found');
    }

    const scope = await this.resolveScope(actor);

    if (!isSuperAdmin(actor) && member.tenantId !== scope.tenantId) {
      throw new ForbiddenException('Access denied');
    }

    if (scope.churchId && member.churchId !== scope.churchId) {
      throw new ForbiddenException('Access denied to this member');
    }

    return member;
  }

  private async writeLog(
    tx: Prisma.TransactionClient,
    data: {
      tenantId: string;
      memberId: string;
      event: string;
      detail?: string;
      actorId?: string;
    },
  ) {
    await tx.memberLog.create({ data });
  }

  private text(value: string | undefined) {
    const trimmed = value?.trim();
    return trimmed ? trimmed : undefined;
  }

  private date(value: string | undefined) {
    return value ? new Date(value) : undefined;
  }

  private memberCreateData(dto: CreateMemberDto) {
    return {
      fullName: dto.fullName.trim(),
      firstName: this.text(dto.firstName),
      lastName: this.text(dto.lastName),
      identityDocument: dto.identityDocument.trim(),
      maritalStatus: dto.maritalStatus,
      profession: this.text(dto.profession),
      workplace: this.text(dto.workplace),
      addressLine: this.text(dto.addressLine),
      neighborhood: this.text(dto.neighborhood),
      sector: this.text(dto.sector),
      email: this.text(dto.email),
      birthDate: this.date(dto.birthDate),
      phone: this.text(dto.phone),
      mobilePhone: this.text(dto.mobilePhone),
      conversionDate: this.date(dto.conversionDate),
      baptismDate: this.date(dto.baptismDate),
      workGroup: this.text(dto.workGroup),
    };
  }

  private memberUpdateData(dto?: UpdateMemberDto): Prisma.MemberUpdateInput {
    return {
      fullName: dto?.fullName?.trim(),
      firstName: this.text(dto?.firstName),
      lastName: this.text(dto?.lastName),
      maritalStatus: dto?.maritalStatus,
      profession: this.text(dto?.profession),
      workplace: this.text(dto?.workplace),
      addressLine: this.text(dto?.addressLine),
      neighborhood: this.text(dto?.neighborhood),
      sector: this.text(dto?.sector),
      email: this.text(dto?.email),
      birthDate: this.date(dto?.birthDate),
      phone: this.text(dto?.phone),
      mobilePhone: this.text(dto?.mobilePhone),
      conversionDate: this.date(dto?.conversionDate),
      baptismDate: this.date(dto?.baptismDate),
      workGroup: this.text(dto?.workGroup),
    };
  }

  private toListResponse(member: {
    id: string;
    fullName: string;
    firstName: string | null;
    lastName: string | null;
    identityDocument: string;
    maritalStatus: string | null;
    email: string | null;
    phone: string | null;
    mobilePhone: string | null;
    isActive: boolean;
    createdAt: Date;
    church: { id: string; name: string; city: string | null };
  }) {
    return {
      id: member.id,
      fullName: member.fullName,
      firstName: member.firstName,
      lastName: member.lastName,
      identityDocument: member.identityDocument,
      maritalStatus: member.maritalStatus,
      email: member.email,
      phone: member.phone,
      mobilePhone: member.mobilePhone,
      isActive: member.isActive,
      church: member.church,
      createdAt: member.createdAt,
    };
  }

  private toDetailResponse(member: {
    id: string;
    tenantId: string;
    fullName: string;
    firstName: string | null;
    lastName: string | null;
    identityDocument: string;
    maritalStatus: string | null;
    profession: string | null;
    workplace: string | null;
    addressLine: string | null;
    neighborhood: string | null;
    sector: string | null;
    email: string | null;
    birthDate: Date | null;
    phone: string | null;
    mobilePhone: string | null;
    conversionDate: Date | null;
    baptismDate: Date | null;
    workGroup: string | null;
    isActive: boolean;
    churchId: string;
    createdAt: Date;
    updatedAt: Date;
    church: { id: string; name: string; city: string | null };
  }) {
    return {
      id: member.id,
      tenantId: member.tenantId,
      fullName: member.fullName,
      firstName: member.firstName,
      lastName: member.lastName,
      identityDocument: member.identityDocument,
      maritalStatus: member.maritalStatus,
      profession: member.profession,
      workplace: member.workplace,
      addressLine: member.addressLine,
      neighborhood: member.neighborhood,
      sector: member.sector,
      email: member.email,
      birthDate: member.birthDate,
      phone: member.phone,
      mobilePhone: member.mobilePhone,
      conversionDate: member.conversionDate,
      baptismDate: member.baptismDate,
      workGroup: member.workGroup,
      isActive: member.isActive,
      churchId: member.churchId,
      church: member.church,
      createdAt: member.createdAt,
      updatedAt: member.updatedAt,
    };
  }
}
