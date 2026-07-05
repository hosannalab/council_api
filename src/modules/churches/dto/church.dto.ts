import { ChurchStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { IsEntityId } from '../../../common/validators/is-entity-id.decorator';

export class ListChurchesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: ChurchStatus })
  @IsOptional()
  @IsEnum(ChurchStatus)
  status?: ChurchStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEntityId()
  currentPastorId?: string;
}

export class CreateChurchDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  city?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @ApiPropertyOptional({ enum: ChurchStatus })
  @IsOptional()
  @IsEnum(ChurchStatus)
  status?: ChurchStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEntityId()
  currentPastorId?: string;
}

export class UpdateChurchDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  city?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @ApiPropertyOptional({ enum: ChurchStatus })
  @IsOptional()
  @IsEnum(ChurchStatus)
  status?: ChurchStatus;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsEntityId()
  currentPastorId?: string | null;
}
