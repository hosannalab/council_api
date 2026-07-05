import { FinanceKind, FinanceType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { IsEntityId } from '../../../common/validators/is-entity-id.decorator';

export class ListCategoriesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: FinanceKind })
  @IsOptional()
  @IsEnum(FinanceKind)
  kind?: FinanceKind;
}

export class ListTransactionsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: FinanceType })
  @IsOptional()
  @IsEnum(FinanceType)
  type?: FinanceType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEntityId()
  churchId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEntityId()
  categoryId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dateTo?: string;
}

export class FinanceSummaryQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsEntityId()
  churchId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dateTo?: string;
}

export class CreateTransactionDto {
  @ApiProperty()
  @IsEntityId()
  churchId: string;

  @ApiProperty({ enum: FinanceType })
  @IsEnum(FinanceType)
  type: FinanceType;

  @ApiProperty({ example: 1500.5 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount: number;

  @ApiProperty()
  @IsDateString()
  date: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEntityId()
  categoryId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ description: 'Obligatorio cuando type = EXPENSE' })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  justification?: string;
}

export class UpdateTransactionDto {
  @ApiPropertyOptional({ enum: FinanceType })
  @IsOptional()
  @IsEnum(FinanceType)
  type?: FinanceType;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEntityId()
  categoryId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  justification?: string;
}

export class CreateCategoryDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name: string;

  @ApiProperty({ enum: FinanceKind })
  @IsEnum(FinanceKind)
  kind: FinanceKind;
}

export class UpdateCategoryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name?: string;

  @ApiPropertyOptional({ enum: FinanceKind })
  @IsOptional()
  @IsEnum(FinanceKind)
  kind?: FinanceKind;
}

export const INCOME_TYPES: FinanceType[] = [
  FinanceType.TITHE,
  FinanceType.OFFERING,
  FinanceType.MISC_INCOME,
];
