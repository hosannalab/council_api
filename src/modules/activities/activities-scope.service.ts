import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { AuthUser } from '../../common/decorators/current-user.decorator';
import { resolveChurchScopeResponse } from '../../common/scope/church-scope';
import { PrismaService } from '../../prisma/prisma.service';
import { isSuperAdmin } from '../rbac/rbac.utils';

@Injectable()
export class ActivitiesScopeService {
  constructor(private readonly prisma: PrismaService) {}

  async resolveScope(actor: AuthUser) {
    const tenantId = this.requireTenantId(actor);
    return resolveChurchScopeResponse(this.prisma, actor, tenantId);
  }

  requireTenantId(actor: AuthUser): string {
    if (isSuperAdmin(actor)) {
      throw new BadRequestException(
        'Super Admin must operate within a tenant context for activities',
      );
    }
    if (!actor.tenantId) {
      throw new ForbiddenException('Tenant context required');
    }
    return actor.tenantId;
  }
}
