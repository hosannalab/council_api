import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MinisterStatus, Prisma } from '@prisma/client';
import { AuthUser } from '../../common/decorators/current-user.decorator';
import {
  paginate,
  paginatedResult,
} from '../../common/dto/pagination-query.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { isSuperAdmin } from '../rbac/rbac.utils';
import {
  CreateBaptismDto,
  ListBaptismsQueryDto,
  UpdateBaptismDto,
} from './dto/baptism.dto';
import { SacramentScopeService } from './sacrament-scope.service';

const baptismInclude = {
  church: { select: { id: true, name: true } },
  member: { select: { id: true, fullName: true } },
  officiant: { select: { id: true, fullName: true, rank: true } },
} as const;

@Injectable()
export class BaptismsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scopeService: SacramentScopeService,
  ) {}

  async findAll(actor: AuthUser, query: ListBaptismsQueryDto) {
    const scope = await this.scopeService.resolveScope(actor);
    const { skip, take, page, pageSize } = paginate(query.page, query.pageSize);
    const where = this.buildWhere(scope, query);

    const [items, total] = await Promise.all([
      this.prisma.baptism.findMany({
        where,
        skip,
        take,
        include: baptismInclude,
        orderBy: { date: 'desc' },
      }),
      this.prisma.baptism.count({ where }),
    ]);

    return paginatedResult(
      items.map((b) => this.toResponse(b)),
      total,
      page,
      pageSize,
    );
  }

  async findOne(actor: AuthUser, id: string) {
    const baptism = await this.getScopedBaptism(actor, id);
    return this.toResponse(baptism);
  }

  async create(actor: AuthUser, dto: CreateBaptismDto) {
    const scope = await this.scopeService.resolveScope(actor);
    this.scopeService.assertChurchInScope(scope, dto.churchId);
    await this.validateReferences(scope.tenantId, dto.churchId, dto.memberId, dto.officiantId);

    const baptism = await this.prisma.baptism.create({
      data: {
        tenantId: scope.tenantId,
        churchId: dto.churchId,
        personName: dto.personName.trim(),
        memberId: dto.memberId,
        place: dto.place?.trim(),
        date: new Date(dto.date),
        officiantId: dto.officiantId,
        participants: dto.participants?.length ? dto.participants : undefined,
        notes: dto.notes?.trim(),
      },
      include: baptismInclude,
    });

    return this.toResponse(baptism);
  }

  async update(actor: AuthUser, id: string, dto: UpdateBaptismDto) {
    const existing = await this.getScopedBaptism(actor, id);

    if (dto.memberId) {
      await this.validateMember(existing.tenantId, existing.churchId, dto.memberId);
    }
    if (dto.officiantId) {
      await this.validateOfficiant(existing.tenantId, dto.officiantId);
    }

    const baptism = await this.prisma.baptism.update({
      where: { id },
      data: {
        personName: dto.personName?.trim(),
        memberId: dto.memberId,
        place: dto.place?.trim(),
        date: dto.date ? new Date(dto.date) : undefined,
        officiantId: dto.officiantId,
        participants: dto.participants,
        notes: dto.notes?.trim(),
      },
      include: baptismInclude,
    });

    return this.toResponse(baptism);
  }

  private buildWhere(
    scope: { tenantId: string; churchId?: string },
    query: ListBaptismsQueryDto,
  ): Prisma.BaptismWhereInput {
    const where: Prisma.BaptismWhereInput = { tenantId: scope.tenantId };

    if (scope.churchId) {
      where.churchId = scope.churchId;
    } else if (query.churchId) {
      where.churchId = query.churchId;
    }

    if (query.officiantId) where.officiantId = query.officiantId;

    if (query.search?.trim()) {
      where.personName = { contains: query.search!.trim(), mode: 'insensitive' };
    }

    if (query.dateFrom || query.dateTo) {
      where.date = {};
      if (query.dateFrom) where.date.gte = new Date(query.dateFrom);
      if (query.dateTo) where.date.lte = new Date(query.dateTo);
    }

    return where;
  }

  private async validateReferences(
    tenantId: string,
    churchId: string,
    memberId?: string,
    officiantId?: string,
  ) {
    const church = await this.prisma.church.findFirst({
      where: { id: churchId, tenantId },
    });
    if (!church) throw new BadRequestException('Church not found');

    if (memberId) {
      await this.validateMember(tenantId, churchId, memberId);
    }
    if (officiantId) {
      await this.validateOfficiant(tenantId, officiantId);
    }
  }

  private async validateMember(tenantId: string, churchId: string, memberId: string) {
    const member = await this.prisma.member.findFirst({
      where: { id: memberId, tenantId, churchId },
    });
    if (!member) throw new BadRequestException('Member not found in this church');
  }

  private async validateOfficiant(tenantId: string, officiantId: string) {
    const minister = await this.prisma.minister.findFirst({
      where: { id: officiantId, tenantId, status: MinisterStatus.ACTIVE },
    });
    if (!minister) throw new BadRequestException('Officiant not found');
  }

  private async getScopedBaptism(actor: AuthUser, id: string) {
    const baptism = await this.prisma.baptism.findUnique({
      where: { id },
      include: baptismInclude,
    });

    if (!baptism) throw new NotFoundException('Baptism not found');

    const scope = await this.scopeService.resolveScope(actor);
    if (!isSuperAdmin(actor) && baptism.tenantId !== scope.tenantId) {
      throw new NotFoundException('Baptism not found');
    }
    if (scope.churchId && baptism.churchId !== scope.churchId) {
      throw new ForbiddenException('Access denied to this baptism');
    }

    return baptism;
  }

  private toResponse(baptism: {
    id: string;
    tenantId: string;
    churchId: string;
    personName: string;
    memberId: string | null;
    place: string | null;
    date: Date;
    officiantId: string | null;
    participants: Prisma.JsonValue;
    notes: string | null;
    createdAt: Date;
    church: { id: string; name: string };
    member: { id: string; fullName: string } | null;
    officiant: { id: string; fullName: string; rank: string } | null;
  }) {
    return {
      id: baptism.id,
      tenantId: baptism.tenantId,
      churchId: baptism.churchId,
      church: baptism.church,
      personName: baptism.personName,
      memberId: baptism.memberId,
      member: baptism.member,
      place: baptism.place,
      date: baptism.date,
      officiantId: baptism.officiantId,
      officiant: baptism.officiant,
      participants: Array.isArray(baptism.participants)
        ? baptism.participants
        : [],
      notes: baptism.notes,
      createdAt: baptism.createdAt,
    };
  }
}
