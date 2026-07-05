import {
  BadRequestException,
  ConflictException,
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
import { isSuperAdmin } from '../rbac/rbac.utils';
import {
  CreateTenantDto,
  ListTenantsQueryDto,
  UpdateTenantDto,
} from './dto/tenant.dto';

@Injectable()
export class TenantsService {
  constructor(private readonly prisma: PrismaService) {}

  private assertSuperAdmin(actor: AuthUser) {
    if (!isSuperAdmin(actor)) {
      throw new BadRequestException('Only Super Admin can manage tenants');
    }
  }

  async findAll(actor: AuthUser, query: ListTenantsQueryDto) {
    this.assertSuperAdmin(actor);
    const { skip, take, page, pageSize } = paginate(query.page, query.pageSize);

    const where: Prisma.TenantWhereInput = {};
    if (query.status) where.status = query.status;
    if (query.search?.trim()) {
      where.OR = [
        { name: { contains: query.search.trim(), mode: 'insensitive' } },
        { slug: { contains: query.search.trim(), mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.tenant.findMany({
        where,
        skip,
        take,
        orderBy: { name: 'asc' },
        include: { _count: { select: { churches: true, users: true } } },
      }),
      this.prisma.tenant.count({ where }),
    ]);

    return paginatedResult(
      items.map((tenant) => ({
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        status: tenant.status,
        churchCount: tenant._count.churches,
        userCount: tenant._count.users,
        createdAt: tenant.createdAt,
        updatedAt: tenant.updatedAt,
      })),
      total,
      page,
      pageSize,
    );
  }

  async findOne(actor: AuthUser, id: string) {
    this.assertSuperAdmin(actor);

    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      include: { _count: { select: { churches: true, users: true } } },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    return {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      status: tenant.status,
      churchCount: tenant._count.churches,
      userCount: tenant._count.users,
      createdAt: tenant.createdAt,
      updatedAt: tenant.updatedAt,
    };
  }

  async create(actor: AuthUser, dto: CreateTenantDto) {
    this.assertSuperAdmin(actor);

    const slug = dto.slug.toLowerCase().trim();
    const existing = await this.prisma.tenant.findUnique({ where: { slug } });
    if (existing) {
      throw new ConflictException('Slug already in use');
    }

    const tenant = await this.prisma.tenant.create({
      data: { name: dto.name.trim(), slug },
    });

    return tenant;
  }

  async update(actor: AuthUser, id: string, dto: UpdateTenantDto) {
    this.assertSuperAdmin(actor);

    if (dto.slug) {
      const slug = dto.slug.toLowerCase().trim();
      const duplicate = await this.prisma.tenant.findFirst({
        where: { slug, NOT: { id } },
      });
      if (duplicate) {
        throw new ConflictException('Slug already in use');
      }
    }

    try {
      return await this.prisma.tenant.update({
        where: { id },
        data: {
          name: dto.name?.trim(),
          slug: dto.slug?.toLowerCase().trim(),
          status: dto.status,
        },
      });
    } catch {
      throw new NotFoundException('Tenant not found');
    }
  }
}
