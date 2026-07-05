import { Injectable } from '@nestjs/common';
import { PaginationQueryDto, paginate, paginatedResult } from '../../common/dto/pagination-query.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { extractPermissions } from './rbac.utils';

const userWithRolesInclude = {
  roles: {
    include: {
      role: {
        include: {
          permissions: {
            include: { permission: true },
          },
        },
      },
    },
  },
} as const;

@Injectable()
export class RbacService {
  constructor(private readonly prisma: PrismaService) {}

  async getUserAccess(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: userWithRolesInclude,
    });

    if (!user) {
      return { roles: [] as string[], permissions: [] as string[] };
    }

    return extractPermissions(user.roles);
  }

  async listPermissions(query: PaginationQueryDto = {}) {
    const { skip, take, page, pageSize } = paginate(query.page, query.pageSize);

    const where = query.search?.trim()
      ? {
          OR: [
            { key: { contains: query.search.trim(), mode: 'insensitive' as const } },
            { label: { contains: query.search.trim(), mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [items, total] = await Promise.all([
      this.prisma.permission.findMany({
        where,
        orderBy: { key: 'asc' },
        skip,
        take,
      }),
      this.prisma.permission.count({ where }),
    ]);

    return paginatedResult(items, total, page, pageSize);
  }
}
