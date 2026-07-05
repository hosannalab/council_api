import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ActivityScope, ActivityStatus, Prisma } from '@prisma/client';
import { AuthUser } from '../../common/decorators/current-user.decorator';
import {
  paginate,
  paginatedResult,
} from '../../common/dto/pagination-query.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { isSuperAdmin } from '../rbac/rbac.utils';
import { ActivitiesScopeService } from './activities-scope.service';
import {
  CreateActivityDto,
  ListActivitiesQueryDto,
  UpdateActivityDto,
} from './dto/activity.dto';

const activityInclude = {
  church: { select: { id: true, name: true, city: true } },
} as const;

@Injectable()
export class ActivitiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scopeService: ActivitiesScopeService,
  ) {}

  async findAll(actor: AuthUser, query: ListActivitiesQueryDto) {
    const scope = await this.scopeService.resolveScope(actor);
    const { skip, take, page, pageSize } = paginate(query.page, query.pageSize);
    const where = this.buildWhere(actor, scope, query);

    const [items, total] = await Promise.all([
      this.prisma.activity.findMany({
        where,
        skip,
        take,
        include: activityInclude,
        orderBy: { startAt: 'asc' },
      }),
      this.prisma.activity.count({ where }),
    ]);

    return paginatedResult(
      items.map((item) => this.toResponse(item)),
      total,
      page,
      pageSize,
    );
  }

  async findOne(actor: AuthUser, id: string) {
    const activity = await this.getScopedActivity(actor, id);
    return this.toResponse(activity);
  }

  async create(actor: AuthUser, dto: CreateActivityDto) {
    const scope = await this.scopeService.resolveScope(actor);
    this.assertCanManageScope(actor, dto.scope, dto.churchId);
    this.validateScopePayload(dto.scope, dto.churchId);
    if (dto.churchId) {
      await this.validateChurch(scope.tenantId, dto.churchId);
      if (scope.churchId && scope.churchId !== dto.churchId) {
        throw new ForbiddenException('You can only create activities for your assigned church');
      }
    }

    const activity = await this.prisma.activity.create({
      data: {
        tenantId: scope.tenantId,
        scope: dto.scope,
        churchId: dto.scope === ActivityScope.CHURCH ? dto.churchId : null,
        title: dto.title.trim(),
        description: dto.description?.trim(),
        location: dto.location?.trim(),
        startAt: new Date(dto.startAt),
        endAt: dto.endAt ? new Date(dto.endAt) : null,
        status: dto.status ?? ActivityStatus.SCHEDULED,
        audience: dto.audience ?? 'ALL',
        notifyByEmail: dto.notifyByEmail ?? false,
      },
      include: activityInclude,
    });

    return this.toResponse(activity);
  }

  async update(actor: AuthUser, id: string, dto: UpdateActivityDto) {
    const existing = await this.getScopedActivity(actor, id);
    const nextScope = dto.scope ?? existing.scope;
    const nextChurchId =
      dto.churchId !== undefined
        ? dto.churchId
        : existing.churchId;

    this.assertCanManageScope(actor, nextScope, nextChurchId ?? undefined);
    this.validateScopePayload(nextScope, nextChurchId ?? undefined);

    if (nextChurchId) {
      await this.validateChurch(existing.tenantId, nextChurchId);
    }

    const activity = await this.prisma.activity.update({
      where: { id },
      data: {
        scope: dto.scope,
        churchId:
          nextScope === ActivityScope.CHURCH ? nextChurchId : null,
        title: dto.title?.trim(),
        description: dto.description?.trim(),
        location: dto.location?.trim(),
        startAt: dto.startAt ? new Date(dto.startAt) : undefined,
        endAt: dto.endAt === null ? null : dto.endAt ? new Date(dto.endAt) : undefined,
        status: dto.status,
        audience: dto.audience,
        notifyByEmail: dto.notifyByEmail,
      },
      include: activityInclude,
    });

    return this.toResponse(activity);
  }

  private buildWhere(
    actor: AuthUser,
    scope: { tenantId: string; churchId?: string },
    query: ListActivitiesQueryDto,
  ): Prisma.ActivityWhereInput {
    const where: Prisma.ActivityWhereInput = { tenantId: scope.tenantId };

    if (scope.churchId) {
      where.OR = [
        { scope: ActivityScope.COUNCIL, audience: { in: ['ALL', 'PASTORS_ONLY'] } },
        { scope: ActivityScope.CHURCH, churchId: scope.churchId },
      ];
    }

    if (query.scope) where.scope = query.scope;
    if (query.status) where.status = query.status;

    if (query.churchId && !scope.churchId) {
      where.churchId = query.churchId;
    }

    if (query.search?.trim()) {
      where.title = { contains: query.search.trim(), mode: 'insensitive' };
    }

    if (query.dateFrom || query.dateTo) {
      where.startAt = {};
      if (query.dateFrom) where.startAt.gte = new Date(query.dateFrom);
      if (query.dateTo) where.startAt.lte = new Date(query.dateTo);
    }

    return where;
  }

  private async getScopedActivity(actor: AuthUser, id: string) {
    const activity = await this.prisma.activity.findUnique({
      where: { id },
      include: activityInclude,
    });

    if (!activity) {
      throw new NotFoundException('Activity not found');
    }

    const scope = await this.scopeService.resolveScope(actor);

    if (!isSuperAdmin(actor) && activity.tenantId !== scope.tenantId) {
      throw new ForbiddenException('Access denied');
    }

    if (scope.churchId) {
      const allowed =
        (activity.scope === ActivityScope.COUNCIL && ['ALL', 'PASTORS_ONLY'].includes(activity.audience)) ||
        activity.churchId === scope.churchId;
      if (!allowed) {
        throw new ForbiddenException('Access denied to this activity');
      }
    }

    return activity;
  }

  private assertCanManageScope(
    actor: AuthUser,
    activityScope: ActivityScope,
    churchId?: string,
  ) {
    const isCouncil =
      actor.roles.includes('Council Admin') ||
      actor.permissions.includes('churches:write');

    if (activityScope === ActivityScope.COUNCIL && !isCouncil) {
      throw new ForbiddenException('Only council admins can manage council-wide activities');
    }

    if (
      activityScope === ActivityScope.CHURCH &&
      churchId &&
      actor.permissions.includes('activities:write') &&
      !isCouncil
    ) {
      return;
    }
  }

  private validateScopePayload(scope: ActivityScope, churchId?: string) {
    if (scope === ActivityScope.CHURCH && !churchId) {
      throw new BadRequestException('churchId is required for church-scoped activities');
    }
    if (scope === ActivityScope.COUNCIL && churchId) {
      throw new BadRequestException('churchId must be empty for council-scoped activities');
    }
  }

  private async validateChurch(tenantId: string, churchId: string) {
    const church = await this.prisma.church.findFirst({
      where: { id: churchId, tenantId },
    });
    if (!church) {
      throw new BadRequestException('Church not found');
    }
  }

  private toResponse(activity: {
    id: string;
    tenantId: string;
    scope: ActivityScope;
    churchId: string | null;
    title: string;
    description: string | null;
    location: string | null;
    startAt: Date;
    endAt: Date | null;
    status: ActivityStatus;
    notifyByEmail: boolean;
    createdAt: Date;
    updatedAt: Date;
    church: { id: string; name: string; city: string | null } | null;
  }) {
    return {
      id: activity.id,
      tenantId: activity.tenantId,
      scope: activity.scope,
      churchId: activity.churchId,
      title: activity.title,
      description: activity.description,
      location: activity.location,
      startAt: activity.startAt.toISOString(),
      endAt: activity.endAt?.toISOString() ?? null,
      status: activity.status,
      notifyByEmail: activity.notifyByEmail,
      createdAt: activity.createdAt.toISOString(),
      updatedAt: activity.updatedAt.toISOString(),
      church: activity.church,
    };
  }
}
