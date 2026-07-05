import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { FinanceCategoriesService } from './finance-categories.service';
import { FinanceScopeService } from './finance-scope.service';
import { FinanceTransactionsService } from './finance-transactions.service';
import {
  CreateCategoryDto,
  ListCategoriesQueryDto,
  CreateTransactionDto,
  FinanceSummaryQueryDto,
  ListTransactionsQueryDto,
  UpdateCategoryDto,
  UpdateTransactionDto,
} from './dto/finance.dto';

@ApiTags('finance')
@ApiBearerAuth()
@UseGuards(PermissionsGuard)
@Controller('finance')
export class FinanceController {
  constructor(
    private readonly transactionsService: FinanceTransactionsService,
    private readonly categoriesService: FinanceCategoriesService,
    private readonly scopeService: FinanceScopeService,
  ) {}

  @Permissions('finance:read')
  @Get('scope')
  getScope(@CurrentUser() user: AuthUser) {
    return this.scopeService.resolveScope(user);
  }

  @Permissions('finance:read')
  @Get('summary')
  getSummary(@CurrentUser() user: AuthUser, @Query() query: FinanceSummaryQueryDto) {
    return this.transactionsService.getSummary(user, query);
  }

  @Permissions('finance:read')
  @Get('categories')
  listCategories(
    @CurrentUser() user: AuthUser,
    @Query() query: ListCategoriesQueryDto,
  ) {
    return this.categoriesService.findAll(user, query);
  }

  @Permissions('finance:write')
  @Post('categories')
  createCategory(@CurrentUser() user: AuthUser, @Body() dto: CreateCategoryDto) {
    return this.categoriesService.create(user, dto);
  }

  @Permissions('finance:write')
  @Patch('categories/:id')
  updateCategory(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.categoriesService.update(user, id, dto);
  }

  @Permissions('finance:read')
  @Get('transactions')
  listTransactions(
    @CurrentUser() user: AuthUser,
    @Query() query: ListTransactionsQueryDto,
  ) {
    return this.transactionsService.findAll(user, query);
  }

  @Permissions('finance:read')
  @Get('transactions/:id')
  getTransaction(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.transactionsService.findOne(user, id);
  }

  @Permissions('finance:write')
  @Post('transactions')
  createTransaction(@CurrentUser() user: AuthUser, @Body() dto: CreateTransactionDto) {
    return this.transactionsService.create(user, dto);
  }

  @Permissions('finance:write')
  @Patch('transactions/:id')
  updateTransaction(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateTransactionDto,
  ) {
    return this.transactionsService.update(user, id, dto);
  }
}
