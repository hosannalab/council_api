export interface CouncilJwtPayload {
  sub: string;
  email: string;
  tenantId: string | null;
  sessionId: string;
  type: 'access' | 'refresh';
}
