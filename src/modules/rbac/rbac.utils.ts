import type { AuthUser } from '../../common/decorators/current-user.decorator';

export const SYSTEM_ROLE_NAMES = ['Super Admin', 'Council Admin'] as const;

export function extractPermissions(
  userRoles: Array<{
    role: {
      name: string;
      permissions: Array<{ permission: { key: string } }>;
    };
  }>,
): { roles: string[]; permissions: string[] } {
  const roles = userRoles.map((ur) => ur.role.name);
  const permissions = [
    ...new Set(
      userRoles.flatMap((ur) =>
        ur.role.permissions.map((rp) => rp.permission.key),
      ),
    ),
  ];
  return { roles, permissions };
}

export function userHasPermissions(
  user: Pick<AuthUser, 'permissions'>,
  required: string[],
): boolean {
  return required.every((permission) => user.permissions.includes(permission));
}

export function isSuperAdmin(user: AuthUser): boolean {
  return user.tenantId === null && user.roles.includes('Super Admin');
}
