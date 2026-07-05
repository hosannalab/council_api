import { Module } from '@nestjs/common';
import { FinanceCategoriesService } from './finance-categories.service';
import { FinanceController } from './finance.controller';
import { FinanceScopeService } from './finance-scope.service';
import { FinanceTransactionsService } from './finance-transactions.service';

@Module({
  controllers: [FinanceController],
  providers: [
    FinanceScopeService,
    FinanceCategoriesService,
    FinanceTransactionsService,
  ],
  exports: [FinanceTransactionsService, FinanceScopeService],
})
export class FinanceModule {}
