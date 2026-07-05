import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Prisma } from '@prisma/client';
import { AuthUser } from '../../common/decorators/current-user.decorator';
import {
  paginate,
  paginatedResult,
} from '../../common/dto/pagination-query.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateUserDto, ListUsersQueryDto, UpdateUserDto } from './dto/user.dto';
import { isSuperAdmin } from './rbac.utils';

const userInclude = {
  roles: {
    include: {
      role: {
        include: {
          permissions: { include: { permission: true } },
        },
      },
    },
  },
} as const;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(actor: AuthUser, query: ListUsersQueryDto) {
    const { skip, take, page, pageSize } = paginate(query.page, query.pageSize);
    const where = this.buildUserScope(actor);

    if (query.search?.trim()) {
      Object.assign(where, {
        OR: [
          { fullName: { contains: query.search.trim(), mode: 'insensitive' as const } },
          { email: { contains: query.search.trim(), mode: 'insensitive' as const } },
        ],
      });
    }

    if (query.isActive !== undefined) {
      Object.assign(where, { isActive: query.isActive });
    }

    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take,
        include: userInclude,
        orderBy: { fullName: 'asc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    const ministers = await this.prisma.minister.findMany({
      where: { userId: { in: items.map((u) => u.id) } },
      select: { id: true, userId: true },
    });
    const ministerByUser = new Map(
      ministers
        .filter((m) => m.userId)
        .map((m) => [m.userId!, m.id] as const),
    );

    return paginatedResult(
      items.map((user) =>
        this.toUserResponse(user, ministerByUser.get(user.id) ?? null),
      ),
      total,
      page,
      pageSize,
    );
  }

  async findOne(actor: AuthUser, id: string) {
    const user = await this.getScopedUser(actor, id);
    const ministerId = await this.getLinkedMinisterId(user.id, user.tenantId);
    return this.toUserResponse(user, ministerId);
  }

  async create(actor: AuthUser, dto: CreateUserDto) {
    const tenantId = this.resolveTenantId(actor);
    await this.validateRolesForTenant(actor, dto.roleIds, tenantId);

    if (dto.ministerId) {
      await this.validateMinisterForLink(tenantId, dto.ministerId);
    }

    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);

    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email: dto.email.toLowerCase(),
          fullName: dto.fullName,
          passwordHash,
          tenantId,
          roles: {
            create: dto.roleIds.map((roleId) => ({ roleId })),
          },
        },
      });

      if (dto.ministerId) {
        await this.linkMinister(tx, tenantId, dto.ministerId, created.id);
      }

      return tx.user.findUniqueOrThrow({
        where: { id: created.id },
        include: userInclude,
      });
    });

    return this.toUserResponse(user, dto.ministerId ?? null);
  }

  async update(actor: AuthUser, id: string, dto: UpdateUserDto) {
    const user = await this.getScopedUser(actor, id);
    this.assertNotSelfDeactivation(actor, user.id, dto.isActive);

    if (dto.roleIds) {
      await this.validateRolesForTenant(actor, dto.roleIds, user.tenantId);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      if (dto.roleIds) {
        await tx.userRole.deleteMany({ where: { userId: id } });
        await tx.userRole.createMany({
          data: dto.roleIds.map((roleId) => ({ userId: id, roleId })),
        });
      }

      if (dto.ministerId !== undefined) {
        if (dto.ministerId) {
          await this.validateMinisterForLink(user.tenantId!, dto.ministerId, id);
        }
        await this.unlinkMinisterFromUser(tx, user.tenantId!, id);
        if (dto.ministerId) {
          await this.linkMinister(tx, user.tenantId!, dto.ministerId, id);
        }
      }

      return tx.user.update({
        where: { id },
        data: {
          fullName: dto.fullName,
          isActive: dto.isActive,
        },
        include: userInclude,
      });
    });

    const ministerId =
      dto.ministerId !== undefined
        ? dto.ministerId
        : await this.getLinkedMinisterId(updated.id, updated.tenantId);

    return this.toUserResponse(updated, ministerId);
  }

  private buildUserScope(actor: AuthUser) {
    if (isSuperAdmin(actor)) {
      return {};
    }
    if (!actor.tenantId) {
      throw new ForbiddenException('Tenant context required');
    }
    return { tenantId: actor.tenantId };
  }

  private resolveTenantId(actor: AuthUser): string {
    if (isSuperAdmin(actor)) {
      throw new BadRequestException(
        'Super Admin cannot create tenant users directly from this endpoint',
      );
    }
    if (!actor.tenantId) {
      throw new ForbiddenException('Tenant context required');
    }
    return actor.tenantId;
  }

  private async getScopedUser(actor: AuthUser, id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: userInclude,
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!isSuperAdmin(actor) && user.tenantId !== actor.tenantId) {
      throw new ForbiddenException('Access denied to this user');
    }

    return user;
  }

  private async validateRolesForTenant(
    actor: AuthUser,
    roleIds: string[],
    tenantId: string | null,
  ) {
    const roles = await this.prisma.role.findMany({
      where: { id: { in: roleIds } },
    });

    if (roles.length !== roleIds.length) {
      throw new BadRequestException('One or more roles are invalid');
    }

    for (const role of roles) {
      if (role.tenantId === null) {
        if (!isSuperAdmin(actor)) {
          throw new ForbiddenException('Cannot assign system roles');
        }
        continue;
      }
      if (role.tenantId !== tenantId) {
        throw new ForbiddenException('Roles must belong to the same tenant');
      }
    }
  }

  private assertNotSelfDeactivation(
    actor: AuthUser,
    targetUserId: string,
    isActive?: boolean,
  ) {
    if (targetUserId === actor.id && isActive === false) {
      throw new BadRequestException('You cannot deactivate your own account');
    }
  }

  private async validateMinisterForLink(
    tenantId: string,
    ministerId: string,
    userId?: string,
  ) {
    const minister = await this.prisma.minister.findFirst({
      where: { id: ministerId, tenantId },
    });
    if (!minister) {
      throw new BadRequestException('Minister not found');
    }
    if (minister.userId && minister.userId !== userId) {
      throw new ConflictException('Minister is already linked to another user');
    }
  }

  private async unlinkMinisterFromUser(
    tx: Prisma.TransactionClient,
    tenantId: string,
    userId: string,
  ) {
    await tx.minister.updateMany({
      where: { userId, tenantId },
      data: { userId: null },
    });
  }

  private async linkMinister(
    tx: Prisma.TransactionClient,
    _tenantId: string,
    ministerId: string,
    userId: string,
  ) {
    await tx.minister.update({
      where: { id: ministerId },
      data: { userId },
    });
  }

  private async getLinkedMinisterId(userId: string, tenantId: string | null) {
    if (!tenantId) return null;
    const minister = await this.prisma.minister.findFirst({
      where: { userId, tenantId },
      select: { id: true },
    });
    return minister?.id ?? null;
  }

  private toUserResponse(
    user: {
      id: string;
      email: string;
      fullName: string;
      tenantId: string | null;
      isActive: boolean;
      createdAt: Date;
      roles: Array<{
        role: {
          id: string;
          name: string;
          permissions: Array<{ permission: { key: string } }>;
        };
      }>;
    },
    ministerId: string | null = null,
  ) {
    const permissions = [
      ...new Set(
        user.roles.flatMap((ur) =>
          ur.role.permissions.map((rp) => rp.permission.key),
        ),
      ),
    ];

    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      tenantId: user.tenantId,
      isActive: user.isActive,
      createdAt: user.createdAt,
      roles: user.roles.map((ur) => ({
        id: ur.role.id,
        name: ur.role.name,
      })),
      permissions,
      ministerId,
    };
  }
}
