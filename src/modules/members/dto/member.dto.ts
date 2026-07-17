import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { MemberMaritalStatus } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { IsEntityId } from '../../../common/validators/is-entity-id.decorator';

export class ListMembersQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'Solo concilio; pastores ignoran y ven su iglesia',
  })
  @IsOptional()
  @IsEntityId()
  churchId?: string;

  @ApiPropertyOptional({
    description: 'Filtrar miembros creados desde (ISO date)',
  })
  @IsOptional()
  @IsDateString()
  createdFrom?: string;

  @ApiPropertyOptional({
    description: 'Filtrar miembros creados hasta (ISO date)',
  })
  @IsOptional()
  @IsDateString()
  createdTo?: string;
}

class MemberProfileFieldsDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  fullName: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  firstName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  lastName?: string;

  @ApiProperty({ description: 'Documento de identidad unico en el concilio' })
  @IsString()
  @MinLength(3)
  @MaxLength(30)
  identityDocument: string;

  @ApiPropertyOptional({ enum: MemberMaritalStatus })
  @IsOptional()
  @IsEnum(MemberMaritalStatus)
  maritalStatus?: MemberMaritalStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  profession?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  workplace?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(180)
  addressLine?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  neighborhood?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  sector?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  @MaxLength(160)
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  birthDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(30)
  mobilePhone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  conversionDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  baptismDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  workGroup?: string;
}

export class CreateMemberDto extends MemberProfileFieldsDto {
  @ApiProperty()
  @IsEntityId()
  churchId: string;
}

export class UpdateMemberDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  fullName?: string;

  @ApiPropertyOptional({ description: 'Documento de identidad unico en el concilio' })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(30)
  identityDocument?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  firstName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  lastName?: string;

  @ApiPropertyOptional({ enum: MemberMaritalStatus })
  @IsOptional()
  @IsEnum(MemberMaritalStatus)
  maritalStatus?: MemberMaritalStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  profession?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  workplace?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(180)
  addressLine?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  neighborhood?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  sector?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  @MaxLength(160)
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  birthDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(30)
  mobilePhone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  conversionDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  baptismDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  workGroup?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class TransferMemberDto {
  @ApiProperty()
  @IsEntityId()
  churchId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class CreateMemberCommentDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  body: string;
}

export const MemberLogEvent = {
  CREATED: 'CREATED',
  UPDATED: 'UPDATED',
  ACTIVATED: 'ACTIVATED',
  DEACTIVATED: 'DEACTIVATED',
  TRANSFERRED: 'TRANSFERRED',
  COMMENT_ADDED: 'COMMENT_ADDED',
} as const;
