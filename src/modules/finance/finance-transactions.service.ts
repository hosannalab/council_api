import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { FinanceType, Prisma } from '@prisma/client';
import { AuthUser } from '../../common/decorators/current-user.decorator';
import {
  paginate,
  paginatedResult,
} from '../../common/dto/pagination-query.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { isSuperAdmin } from '../rbac/rbac.utils';
import {
  CreateTransactionDto,
  FinanceSummaryQueryDto,
  INCOME_TYPES,
  ListTransactionsQueryDto,
  UpdateTransactionDto,
} from './dto/finance.dto';
import { FinanceScopeService } from './finance-scope.service';

const txInclude = {
  church: { select: { id: true, name: true } },
  category: { select: { id: true, name: true, kind: true } },
  createdBy: { select: { id: true, fullName: true } },
} as const;

@Injectable()
export class FinanceTransactionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scopeService: FinanceScopeService,
  ) {}

  async findAll(actor: AuthUser, query: ListTransactionsQueryDto) {
    const scope = await this.scopeService.resolveScope(actor);
    const { skip, take, page, pageSize } = paginate(query.page, query.pageSize);
    const where = this.buildWhere(scope, query);

    const [items, total] = await Promise.all([
      this.prisma.financeTransaction.findMany({
        where,
        skip,
        take,
        include: txInclude,
        orderBy: { date: 'desc' },
      }),
      this.prisma.financeTransaction.count({ where }),
    ]);

    return paginatedResult(
      items.map((t) => this.toResponse(t)),
      total,
      page,
      pageSize,
    );
  }

  async findOne(actor: AuthUser, id: string) {
    const tx = await this.getScopedTransaction(actor, id);
    return this.toResponse(tx);
  }

  async create(actor: AuthUser, dto: CreateTransactionDto) {
    const scope = await this.scopeService.resolveScope(actor);
    this.scopeService.assertChurchInScope(scope, dto.churchId);
    this.validateTransaction(dto.type, dto.justification);

    await this.validateChurchAndCategory(scope.tenantId, dto.churchId, dto.categoryId);

    const tx = await this.prisma.financeTransaction.create({
      data: {
        tenantId: scope.tenantId,
        churchId: dto.churchId,
        type: dto.type,
        amount: dto.amount,
        date: new Date(dto.date),
        categoryId: dto.categoryId,
        description: dto.description,
        justification: dto.type === FinanceType.EXPENSE ? dto.justification : null,
        createdById: actor.id,
      },
      include: txInclude,
    });

    return this.toResponse(tx);
  }

  async update(actor: AuthUser, id: string, dto: UpdateTransactionDto) {
    const existing = await this.getScopedTransaction(actor, id);
    const type = dto.type ?? existing.type;
    const justification = dto.justification ?? existing.justification ?? undefined;

    this.validateTransaction(type, justification);

    if (dto.categoryId) {
      await this.validateChurchAndCategory(
        existing.tenantId,
        existing.churchId,
        dto.categoryId,
      );
    }

    const tx = await this.prisma.financeTransaction.update({
      where: { id },
      data: {
        type: dto.type,
        amount: dto.amount,
        date: dto.date ? new Date(dto.date) : undefined,
        categoryId: dto.categoryId,
        description: dto.description,
        justification: type === FinanceType.EXPENSE ? justification : null,
      },
      include: txInclude,
    });

    return this.toResponse(tx);
  }

  async getSummary(actor: AuthUser, query: FinanceSummaryQueryDto) {
    const scope = await this.scopeService.resolveScope(actor);
    const where: Prisma.FinanceTransactionWhereInput = {
      tenantId: scope.tenantId,
    };

    if (scope.churchId) {
      where.churchId = scope.churchId;
    } else if (query.churchId) {
      where.churchId = query.churchId;
    }

    if (query.dateFrom || query.dateTo) {
      where.date = {};
      if (query.dateFrom) where.date.gte = new Date(query.dateFrom);
      if (query.dateTo) where.date.lte = new Date(query.dateTo);
    }

    const transactions = await this.prisma.financeTransaction.findMany({
      where,
      select: { type: true, amount: true, churchId: true },
    });

    let totalIncome = 0;
    let totalExpense = 0;
    const byType: Record<string, number> = {};
    const byChurch: Record<string, { churchId: string; income: number; expense: number }> = {};

    for (const t of transactions) {
      const amount = Number(t.amount);
      byType[t.type] = (byType[t.type] ?? 0) + amount;

      if (!byChurch[t.churchId]) {
        byChurch[t.churchId] = { churchId: t.churchId, income: 0, expense: 0 };
      }

      if (INCOME_TYPES.includes(t.type)) {
        totalIncome += amount;
        byChurch[t.churchId].income += amount;
      } else {
        totalExpense += amount;
        byChurch[t.churchId].expense += amount;
      }
    }

    const churchIds = Object.keys(byChurch);
    const churches =
      churchIds.length > 0
        ? await this.prisma.church.findMany({
            where: { id: { in: churchIds } },
            select: { id: true, name: true },
          })
        : [];

    const churchMap = Object.fromEntries(churches.map((c) => [c.id, c.name]));

    return {
      totalIncome,
      totalExpense,
      balance: totalIncome - totalExpense,
      byType,
      byChurch: Object.values(byChurch).map((c) => ({
        churchId: c.churchId,
        churchName: churchMap[c.churchId] ?? c.churchId,
        income: c.income,
        expense: c.expense,
        balance: c.income - c.expense,
      })),
      transactionCount: transactions.length,
      isConsolidated: !scope.churchId && !query.churchId,
    };
  }

  private buildWhere(
    scope: { tenantId: string; churchId?: string },
    query: ListTransactionsQueryDto,
  ): Prisma.FinanceTransactionWhereInput {
    const where: Prisma.FinanceTransactionWhereInput = { tenantId: scope.tenantId };

    if (scope.churchId) {
      where.churchId = scope.churchId;
    } else if (query.churchId) {
      where.churchId = query.churchId;
    }

    if (query.type) where.type = query.type;
    if (query.categoryId) where.categoryId = query.categoryId;

    if (query.dateFrom || query.dateTo) {
      where.date = {};
      if (query.dateFrom) where.date.gte = new Date(query.dateFrom);
      if (query.dateTo) where.date.lte = new Date(query.dateTo);
    }

    return where;
  }

  private validateTransaction(type: FinanceType, justification?: string) {
    if (type === FinanceType.EXPENSE) {
      if (!justification?.trim()) {
        throw new BadRequestException('Expense transactions require justification');
      }
    }
  }

  private async validateChurchAndCategory(
    tenantId: string,
    churchId: string,
    categoryId?: string,
  ) {
    const church = await this.prisma.church.findFirst({
      where: { id: churchId, tenantId },
    });
    if (!church) throw new BadRequestException('Church not found');

    if (categoryId) {
      const category = await this.prisma.financeCategory.findFirst({
        where: { id: categoryId, tenantId },
      });
      if (!category) throw new BadRequestException('Category not found');
    }
  }

  private async getScopedTransaction(actor: AuthUser, id: string) {
    const tx = await this.prisma.financeTransaction.findUnique({
      where: { id },
      include: txInclude,
    });

    if (!tx) throw new NotFoundException('Transaction not found');

    const scope = await this.scopeService.resolveScope(actor);
    if (!isSuperAdmin(actor) && tx.tenantId !== scope.tenantId) {
      throw new NotFoundException('Transaction not found');
    }
    if (scope.churchId && tx.churchId !== scope.churchId) {
      throw new NotFoundException('Transaction not found');
    }

    return tx;
  }

  private toResponse(tx: {
    id: string;
    tenantId: string;
    churchId: string;
    type: FinanceType;
    amount: Prisma.Decimal;
    date: Date;
    categoryId: string | null;
    description: string | null;
    justification: string | null;
    createdAt: Date;
    church: { id: string; name: string };
    category: { id: string; name: string; kind: string } | null;
    createdBy: { id: string; fullName: string };
  }) {
    return {
      id: tx.id,
      tenantId: tx.tenantId,
      churchId: tx.churchId,
      church: tx.church,
      type: tx.type,
      amount: Number(tx.amount),
      date: tx.date,
      categoryId: tx.categoryId,
      category: tx.category,
      description: tx.description,
      justification: tx.justification,
      createdBy: tx.createdBy,
      createdAt: tx.createdAt,
    };
  }
}
