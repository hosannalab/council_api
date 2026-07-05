import { MinisterRank, MinisterStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { IsEntityId } from '../../../common/validators/is-entity-id.decorator';

export class ListMinistersQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: MinisterRank })
  @IsOptional()
  @IsEnum(MinisterRank)
  rank?: MinisterRank;

  @ApiPropertyOptional({ enum: MinisterStatus })
  @IsOptional()
  @IsEnum(MinisterStatus)
  status?: MinisterStatus;

  @ApiPropertyOptional({ description: 'Filtrar por iglesia asignada actualmente' })
  @IsOptional()
  @IsEntityId()
  churchId?: string;

  @ApiPropertyOptional({ description: 'Solo ministros sin usuario vinculado' })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  unlinkedOnly?: boolean;
}

export class CreateMinisterDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  fullName: string;

  @ApiProperty({ description: 'Documento de identidad único en el concilio' })
  @IsString()
  @MinLength(3)
  @MaxLength(30)
  identityDocument: string;

  @ApiProperty({ enum: MinisterRank })
  @IsEnum(MinisterRank)
  rank: MinisterRank;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  ordinationAt?: string;

  @ApiPropertyOptional({ enum: MinisterStatus })
  @IsOptional()
  @IsEnum(MinisterStatus)
  status?: MinisterStatus;
}

export class UpdateMinisterDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  fullName?: string;

  @ApiPropertyOptional({ enum: MinisterRank })
  @IsOptional()
  @IsEnum(MinisterRank)
  rank?: MinisterRank;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  ordinationAt?: string;

  @ApiPropertyOptional({ enum: MinisterStatus })
  @IsOptional()
  @IsEnum(MinisterStatus)
  status?: MinisterStatus;
}

export class AssignMinisterDto {
  @ApiProperty()
  @IsEntityId()
  churchId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  startedAt?: string;
}

export class CreateMinisterCommentDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  body: string;
}
