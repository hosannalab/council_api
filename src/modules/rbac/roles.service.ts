import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuthUser } from '../../common/decorators/current-user.decorator';
import {
  paginate,
  paginatedResult,
} from '../../common/dto/pagination-query.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateRoleDto, ListRolesQueryDto, UpdateRoleDto } from './dto/create-role.dto';
import { isSuperAdmin, SYSTEM_ROLE_NAMES } from './rbac.utils';

const roleInclude = {
  permissions: {
    include: { permission: true },
  },
  _count: { select: { users: true } },
} as const;

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(actor: AuthUser, query: ListRolesQueryDto) {
    const where = this.buildRoleScope(actor);
    if (query.search?.trim()) {
      Object.assign(where, {
        name: { contains: query.search.trim(), mode: 'insensitive' as const },
      });
    }

    const { skip, take, page, pageSize } = paginate(query.page, query.pageSize);

    const [roles, total] = await Promise.all([
      this.prisma.role.findMany({
        where,
        include: roleInclude,
        orderBy: { name: 'asc' },
        skip,
        take,
      }),
      this.prisma.role.count({ where }),
    ]);

    return paginatedResult(
      roles.map((role) => this.toRoleResponse(role)),
      total,
      page,
      pageSize,
    );
  }

  async findOne(actor: AuthUser, id: string) {
    const role = await this.getScopedRole(actor, id);
    return this.toRoleResponse(role);
  }

  async create(actor: AuthUser, dto: CreateRoleDto) {
    const tenantId = this.resolveTenantId(actor);
    await this.validatePermissionsExist(dto.permissionIds);

    const existing = await this.prisma.role.findFirst({
      where: { tenantId, name: dto.name },
    });
    if (existing) {
      throw new BadRequestException('A role with this name already exists');
    }

    const role = await this.prisma.role.create({
      data: {
        tenantId,
        name: dto.name,
        description: dto.description,
        permissions: {
          create: dto.permissionIds.map((permissionId) => ({ permissionId })),
        },
      },
      include: roleInclude,
    });

    return this.toRoleResponse(role);
  }

  async update(actor: AuthUser, id: string, dto: UpdateRoleDto) {
    const role = await this.getScopedRole(actor, id);
    this.assertMutableRole(role.name, role.tenantId);

    if (dto.name && dto.name !== role.name) {
      const duplicate = await this.prisma.role.findFirst({
        where: {
          tenantId: role.tenantId,
          name: dto.name,
          NOT: { id },
        },
      });
      if (duplicate) {
        throw new BadRequestException('A role with this name already exists');
      }
    }

    if (dto.permissionIds) {
      await this.validatePermissionsExist(dto.permissionIds);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      if (dto.permissionIds) {
        await tx.rolePermission.deleteMany({ where: { roleId: id } });
        await tx.rolePermission.createMany({
          data: dto.permissionIds.map((permissionId) => ({
            roleId: id,
            permissionId,
          })),
        });
      }

      return tx.role.update({
        where: { id },
        data: {
          name: dto.name,
          description: dto.description,
        },
        include: roleInclude,
      });
    });

    return this.toRoleResponse(updated);
  }

  async remove(actor: AuthUser, id: string) {
    const role = await this.getScopedRole(actor, id);
    this.assertMutableRole(role.name, role.tenantId);

    if (role._count.users > 0) {
      throw new BadRequestException('Cannot delete a role assigned to users');
    }

    await this.prisma.role.delete({ where: { id } });
    return { message: 'Role deleted successfully' };
  }

  private buildRoleScope(actor: AuthUser) {
    if (isSuperAdmin(actor)) {
      return {};
    }
    if (!actor.tenantId) {
      throw new ForbiddenException('Tenant context required');
    }
    return { tenantId: actor.tenantId };
  }

  private resolveTenantId(actor: AuthUser): string | null {
    if (isSuperAdmin(actor)) {
      throw new BadRequestException(
        'Super Admin must use tenant-scoped endpoints via a tenant user',
      );
    }
    if (!actor.tenantId) {
      throw new ForbiddenException('Tenant context required');
    }
    return actor.tenantId;
  }

  private async getScopedRole(actor: AuthUser, id: string) {
    const role = await this.prisma.role.findUnique({
      where: { id },
      include: roleInclude,
    });
    if (!role) {
      throw new NotFoundException('Role not found');
    }

    if (!isSuperAdmin(actor)) {
      if (role.tenantId !== actor.tenantId) {
        throw new ForbiddenException('Access denied to this role');
      }
    }

    return role;
  }

  private assertMutableRole(name: string, tenantId: string | null) {
    if (
      tenantId === null &&
      SYSTEM_ROLE_NAMES.includes(name as (typeof SYSTEM_ROLE_NAMES)[number])
    ) {
      throw new BadRequestException('System roles cannot be modified');
    }
  }

  private async validatePermissionsExist(permissionIds: string[]) {
    const count = await this.prisma.permission.count({
      where: { id: { in: permissionIds } },
    });
    if (count !== permissionIds.length) {
      throw new BadRequestException('One or more permissions are invalid');
    }
  }

  private toRoleResponse(role: {
    id: string;
    tenantId: string | null;
    name: string;
    description: string | null;
    permissions: Array<{ permission: { id: string; key: string; label: string } }>;
    _count: { users: number };
  }) {
    return {
      id: role.id,
      tenantId: role.tenantId,
      name: role.name,
      description: role.description,
      userCount: role._count.users,
      permissions: role.permissions.map((rp) => ({
        id: rp.permission.id,
        key: rp.permission.key,
        label: rp.permission.label,
      })),
      isSystem: role.tenantId === null,
    };
  }
}
