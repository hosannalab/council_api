import { CredentialStatus } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { IsEntityId } from '../../../common/validators/is-entity-id.decorator';

export class ListCredentialsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: CredentialStatus })
  @IsOptional()
  @IsEnum(CredentialStatus)
  status?: CredentialStatus;

  @ApiPropertyOptional({ description: 'Filtrar por ministro' })
  @IsOptional()
  @IsEntityId()
  ministerId?: string;
}

export class CreateCredentialDto {
  @ApiProperty({ description: 'ID del ministro' })
  @IsEntityId()
  @IsNotEmpty()
  ministerId: string;

  @ApiPropertyOptional({ description: 'Número de credencial (para legadas)' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  credentialNo?: string;

  @ApiPropertyOptional({ description: 'URL de la foto de perfil' })
  @IsOptional()
  @IsString()
  photoUrl?: string;

  @ApiPropertyOptional({ description: 'Fecha de expiración' })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}

export class RenewCredentialDto {
  @ApiPropertyOptional({ description: 'Nueva fecha de expiración' })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
