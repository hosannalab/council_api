import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthUser } from '../decorators/current-user.decorator';

export interface ChurchScope {
  tenantId: string;
  churchId?: string;
}

export interface ChurchScopeResponse extends ChurchScope {
  church?: { id: string; name: string; city: string | null } | null;
  minister?: { id: string; fullName: string } | null;
}

export async function resolveChurchScope(
  prisma: PrismaService,
  actor: AuthUser,
  tenantId: string,
): Promise<ChurchScope> {
  if (
    actor.roles.includes('Council Admin') ||
    actor.permissions.includes('churches:write')
  ) {
    return { tenantId };
  }

  const minister = await prisma.minister.findFirst({
    where: { userId: actor.id, tenantId },
    include: { assignments: { where: { endedAt: null }, take: 1 } },
  });

  if (minister) {
    const assignment = minister.assignments[0];
    if (!assignment) {
      throw new BadRequestException(
        'Your pastor profile has no church assignment. Ask a council admin to assign you from Ministers.',
      );
    }
    return { tenantId, churchId: assignment.churchId };
  }

  if (actor.roles.includes('Pastor')) {
    throw new BadRequestException(
      'Your user account is not linked to a minister profile. Ask a council admin to link it when creating or editing the user.',
    );
  }

  return { tenantId };
}

export async function resolveChurchScopeResponse(
  prisma: PrismaService,
  actor: AuthUser,
  tenantId: string,
): Promise<ChurchScopeResponse> {
  const scope = await resolveChurchScope(prisma, actor, tenantId);

  const minister = await prisma.minister.findFirst({
    where: { userId: actor.id, tenantId },
    select: { id: true, fullName: true },
  });

  let church: ChurchScopeResponse['church'] = null;
  if (scope.churchId) {
    church = await prisma.church.findFirst({
      where: { id: scope.churchId, tenantId },
      select: { id: true, name: true, city: true },
    });
  }

  return {
    ...scope,
    church,
    minister,
  };
}
