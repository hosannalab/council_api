import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuthUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { isSuperAdmin } from '../rbac/rbac.utils';
import {
  paginate,
  paginatedResult,
} from '../../common/dto/pagination-query.dto';
import {
  CreateCategoryDto,
  ListCategoriesQueryDto,
  UpdateCategoryDto,
} from './dto/finance.dto';
import { FinanceScopeService } from './finance-scope.service';

@Injectable()
export class FinanceCategoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scopeService: FinanceScopeService,
  ) {}

  async findAll(actor: AuthUser, query: ListCategoriesQueryDto = {}) {
    const scope = await this.scopeService.resolveScope(actor);
    const { skip, take, page, pageSize } = paginate(query.page, query.pageSize);

    const where = {
      tenantId: scope.tenantId,
      ...(query.kind ? { kind: query.kind } : {}),
      ...(query.search?.trim()
        ? {
            name: {
              contains: query.search.trim(),
              mode: 'insensitive' as const,
            },
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.financeCategory.findMany({
        where,
        orderBy: [{ kind: 'asc' }, { name: 'asc' }],
        skip,
        take,
      }),
      this.prisma.financeCategory.count({ where }),
    ]);

    return paginatedResult(items, total, page, pageSize);
  }

  async create(actor: AuthUser, dto: CreateCategoryDto) {
    const tenantId = this.scopeService.requireTenantId(actor);

    try {
      return await this.prisma.financeCategory.create({
        data: { tenantId, name: dto.name.trim(), kind: dto.kind },
      });
    } catch {
      throw new ConflictException('Category name already exists');
    }
  }

  async update(actor: AuthUser, id: string, dto: UpdateCategoryDto) {
    const category = await this.getScopedCategory(actor, id);

    try {
      return await this.prisma.financeCategory.update({
        where: { id: category.id },
        data: {
          name: dto.name?.trim(),
          kind: dto.kind,
        },
      });
    } catch {
      throw new ConflictException('Category name already exists');
    }
  }

  private async getScopedCategory(actor: AuthUser, id: string) {
    const category = await this.prisma.financeCategory.findUnique({
      where: { id },
    });
    if (!category) throw new NotFoundException('Category not found');

    const scope = await this.scopeService.resolveScope(actor);
    if (!isSuperAdmin(actor) && category.tenantId !== scope.tenantId) {
      throw new NotFoundException('Category not found');
    }

    return category;
  }
}
