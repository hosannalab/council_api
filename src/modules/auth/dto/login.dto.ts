import { Transform } from 'class-transformer';
import { IsEmail, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'admin@demo-concilio.local' })
  @Transform(({ value }): string =>
    typeof value === 'string'
      ? value.trim().toLowerCase()
      : String(value ?? ''),
  )
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Admin123!' })
  @IsString()
  @MinLength(8)
  password: string;
}
