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
  CreateDedicationDto,
  ListDedicationsQueryDto,
  UpdateDedicationDto,
} from './dto/dedication.dto';
import { SacramentScopeService } from './sacrament-scope.service';

const dedicationInclude = {
  church: { select: { id: true, name: true } },
  officiant: { select: { id: true, fullName: true, rank: true } },
} as const;

@Injectable()
export class DedicationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scopeService: SacramentScopeService,
  ) {}

  async findAll(actor: AuthUser, query: ListDedicationsQueryDto) {
    const scope = await this.scopeService.resolveScope(actor);
    const { skip, take, page, pageSize } = paginate(query.page, query.pageSize);
    const where = this.buildWhere(scope, query);

    const [items, total] = await Promise.all([
      this.prisma.childDedication.findMany({
        where,
        skip,
        take,
        include: dedicationInclude,
        orderBy: { date: 'desc' },
      }),
      this.prisma.childDedication.count({ where }),
    ]);

    return paginatedResult(
      items.map((d) => this.toResponse(d)),
      total,
      page,
      pageSize,
    );
  }

  async findOne(actor: AuthUser, id: string) {
    const dedication = await this.getScopedDedication(actor, id);
    return this.toResponse(dedication);
  }

  async create(actor: AuthUser, dto: CreateDedicationDto) {
    const scope = await this.scopeService.resolveScope(actor);
    this.scopeService.assertChurchInScope(scope, dto.churchId);
    await this.validateReferences(
      scope.tenantId,
      dto.churchId,
      dto.officiantId,
    );

    const dedication = await this.prisma.childDedication.create({
      data: {
        tenantId: scope.tenantId,
        churchId: dto.churchId,
        childName: dto.childName.trim(),
        parents: dto.parents?.trim(),
        godparents: dto.godparents?.trim(),
        place: dto.place?.trim(),
        date: new Date(dto.date),
        officiantId: dto.officiantId,
        notes: dto.notes?.trim(),
      },
      include: dedicationInclude,
    });

    return this.toResponse(dedication);
  }

  async update(actor: AuthUser, id: string, dto: UpdateDedicationDto) {
    const existing = await this.getScopedDedication(actor, id);

    if (dto.officiantId) {
      await this.validateOfficiant(existing.tenantId, dto.officiantId);
    }

    const dedication = await this.prisma.childDedication.update({
      where: { id },
      data: {
        childName: dto.childName?.trim(),
        parents: dto.parents?.trim(),
        godparents: dto.godparents?.trim(),
        place: dto.place?.trim(),
        date: dto.date ? new Date(dto.date) : undefined,
        officiantId: dto.officiantId,
        notes: dto.notes?.trim(),
      },
      include: dedicationInclude,
    });

    return this.toResponse(dedication);
  }

  private buildWhere(
    scope: { tenantId: string; churchId?: string },
    query: ListDedicationsQueryDto,
  ): Prisma.ChildDedicationWhereInput {
    const where: Prisma.ChildDedicationWhereInput = {
      tenantId: scope.tenantId,
    };

    if (scope.churchId) {
      where.churchId = scope.churchId;
    } else if (query.churchId) {
      where.churchId = query.churchId;
    }

    if (query.officiantId) where.officiantId = query.officiantId;

    if (query.search?.trim()) {
      where.childName = { contains: query.search.trim(), mode: 'insensitive' };
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
    officiantId?: string,
  ) {
    const church = await this.prisma.church.findFirst({
      where: { id: churchId, tenantId },
    });
    if (!church) throw new BadRequestException('Church not found');

    if (officiantId) {
      await this.validateOfficiant(tenantId, officiantId);
    }
  }

  private async validateOfficiant(tenantId: string, officiantId: string) {
    const minister = await this.prisma.minister.findFirst({
      where: { id: officiantId, tenantId, status: MinisterStatus.ACTIVE },
    });
    if (!minister) throw new BadRequestException('Officiant not found');
  }

  private async getScopedDedication(actor: AuthUser, id: string) {
    const dedication = await this.prisma.childDedication.findUnique({
      where: { id },
      include: dedicationInclude,
    });

    if (!dedication) throw new NotFoundException('Dedication not found');

    const scope = await this.scopeService.resolveScope(actor);
    if (!isSuperAdmin(actor) && dedication.tenantId !== scope.tenantId) {
      throw new NotFoundException('Dedication not found');
    }
    if (scope.churchId && dedication.churchId !== scope.churchId) {
      throw new ForbiddenException('Access denied to this dedication');
    }

    return dedication;
  }

  private toResponse(dedication: {
    id: string;
    tenantId: string;
    churchId: string;
    childName: string;
    parents: string | null;
    godparents: string | null;
    place: string | null;
    date: Date;
    officiantId: string | null;
    notes: string | null;
    createdAt: Date;
    church: { id: string; name: string };
    officiant: { id: string; fullName: string; rank: string } | null;
  }) {
    return {
      id: dedication.id,
      tenantId: dedication.tenantId,
      churchId: dedication.churchId,
      church: dedication.church,
      childName: dedication.childName,
      parents: dedication.parents,
      godparents: dedication.godparents,
      place: dedication.place,
      date: dedication.date,
      officiantId: dedication.officiantId,
      officiant: dedication.officiant,
      notes: dedication.notes,
      createdAt: dedication.createdAt,
    };
  }
}
