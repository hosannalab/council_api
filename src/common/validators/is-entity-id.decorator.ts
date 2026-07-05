import { applyDecorators } from '@nestjs/common';
import {
  IsString,
  MaxLength,
  MinLength,
  ValidationOptions,
} from 'class-validator';

/** Validates Prisma cuid() ids and legacy seed ids (not UUID v4). */
export function IsEntityId(validationOptions?: ValidationOptions) {
  return applyDecorators(
    IsString(validationOptions),
    MinLength(1, validationOptions),
    MaxLength(36, validationOptions),
  );
}
