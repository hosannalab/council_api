import { ActivityScope, ActivityStatus, ActivityAudience } from '@prisma/client';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { IsEntityId } from '../../../common/validators/is-entity-id.decorator';

export class ListActivitiesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: ActivityScope })
  @IsOptional()
  @IsEnum(ActivityScope)
  scope?: ActivityScope;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEntityId()
  churchId?: string;

  @ApiPropertyOptional({ enum: ActivityStatus })
  @IsOptional()
  @IsEnum(ActivityStatus)
  status?: ActivityStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dateTo?: string;
}

export class CreateActivityDto {
  @ApiProperty({ enum: ActivityScope })
  @IsEnum(ActivityScope)
  scope: ActivityScope;

  @ApiPropertyOptional()
  @ValidateIf((dto: CreateActivityDto) => dto.scope === ActivityScope.CHURCH)
  @IsEntityId()
  churchId?: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  location?: string;

  @ApiProperty()
  @IsDateString()
  startAt: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  endAt?: string;

  @ApiPropertyOptional({ enum: ActivityStatus })
  @IsOptional()
  @IsEnum(ActivityStatus)
  status?: ActivityStatus;

  @ApiPropertyOptional({ enum: ActivityAudience })
  @IsOptional()
  @IsEnum(ActivityAudience)
  audience?: ActivityAudience;

  @ApiPropertyOptional({ description: 'Stored for future email notifications' })
  @IsOptional()
  @IsBoolean()
  notifyByEmail?: boolean;
}

export class UpdateActivityDto {
  @ApiPropertyOptional({ enum: ActivityScope })
  @IsOptional()
  @IsEnum(ActivityScope)
  scope?: ActivityScope;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEntityId()
  churchId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  location?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  startAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  endAt?: string | null;

  @ApiPropertyOptional({ enum: ActivityStatus })
  @IsOptional()
  @IsEnum(ActivityStatus)
  status?: ActivityStatus;

  @ApiPropertyOptional({ enum: ActivityAudience })
  @IsOptional()
  @IsEnum(ActivityAudience)
  audience?: ActivityAudience;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  notifyByEmail?: boolean;
}
