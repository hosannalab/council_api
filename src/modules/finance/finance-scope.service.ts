import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { FinanceType, Prisma } from '@prisma/client';
import { AuthUser } from '../../common/decorators/current-user.decorator';
import {
  paginate,
  paginatedResult,
} from '../../common/dto/pagination-query.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { isSuperAdmin } from '../rbac/rbac.utils';
import { resolveChurchScopeResponse } from '../../common/scope/church-scope';

export interface FinanceScope {
  tenantId: string;
  churchId?: string;
}

@Injectable()
export class FinanceScopeService {
  constructor(private readonly prisma: PrismaService) {}

  async resolveScope(actor: AuthUser): Promise<FinanceScope> {
    const tenantId = this.requireTenantId(actor);
    return resolveChurchScopeResponse(this.prisma, actor, tenantId);
  }

  requireTenantId(actor: AuthUser): string {
    if (isSuperAdmin(actor)) {
      throw new BadRequestException(
        'Super Admin must operate within a tenant context for finance',
      );
    }
    if (!actor.tenantId) {
      throw new ForbiddenException('Tenant context required');
    }
    return actor.tenantId;
  }

  assertChurchInScope(scope: FinanceScope, churchId: string) {
    if (scope.churchId && scope.churchId !== churchId) {
      throw new ForbiddenException('You can only manage finances of your assigned church');
    }
  }
}
