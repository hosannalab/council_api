import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { CouncilJwtPayload } from './interfaces/jwt-payload.interface';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
      include: {
        roles: {
          include: {
            role: {
              include: {
                permissions: {
                  include: { permission: true },
                },
              },
            },
          },
        },
      },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const sessionId = randomUUID();

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        currentSessionId: sessionId,
        lastLoginAt: new Date(),
        tokenVersion: { increment: 1 },
      },
    });

    const tokens = await this.signTokens({
      sub: user.id,
      email: user.email,
      tenantId: user.tenantId,
      sessionId,
    });

    const permissions = [
      ...new Set(
        user.roles.flatMap((userRole) =>
          userRole.role.permissions.map((rp) => rp.permission.key),
        ),
      ),
    ];

    const minister = user.tenantId
      ? await this.prisma.minister.findFirst({
          where: { userId: user.id, tenantId: user.tenantId },
          select: { id: true },
        })
      : null;

    return {
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        tenantId: user.tenantId,
        roles: user.roles.map((ur) => ur.role.name),
        permissions,
        ministerId: minister?.id ?? null,
      },
      ...tokens,
    };
  }

  async refresh(refreshToken: string) {
    let payload: CouncilJwtPayload;

    try {
      payload = await this.jwtService.verifyAsync<CouncilJwtPayload>(
        refreshToken,
        {
          secret: this.configService.getOrThrow<string>('jwt.refreshSecret'),
        },
      );
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (payload.type !== 'refresh') {
      throw new UnauthorizedException('Invalid token type');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (
      !user ||
      !user.isActive ||
      user.currentSessionId !== payload.sessionId
    ) {
      throw new UnauthorizedException('Session expired or replaced');
    }

    return this.signTokens({
      sub: user.id,
      email: user.email,
      tenantId: user.tenantId,
      sessionId: payload.sessionId,
    });
  }

  async logout(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { currentSessionId: null },
    });

    return { message: 'Logged out successfully' };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        tenant: true,
        roles: {
          include: {
            role: {
              include: {
                permissions: { include: { permission: true } },
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const permissions = [
      ...new Set(
        user.roles.flatMap((userRole) =>
          userRole.role.permissions.map((rp) => rp.permission.key),
        ),
      ),
    ];

    const minister = user.tenantId
      ? await this.prisma.minister.findFirst({
          where: { userId: user.id, tenantId: user.tenantId },
          select: { id: true },
        })
      : null;

    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      tenantId: user.tenantId,
      tenant: user.tenant,
      roles: user.roles.map((ur) => ur.role.name),
      permissions,
      ministerId: minister?.id ?? null,
    };
  }

  private async signTokens(params: {
    sub: string;
    email: string;
    tenantId: string | null;
    sessionId: string;
  }) {
    const accessPayload: CouncilJwtPayload = { ...params, type: 'access' };
    const refreshPayload: CouncilJwtPayload = { ...params, type: 'refresh' };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(accessPayload, {
        secret: this.configService.getOrThrow<string>('jwt.accessSecret'),
        expiresIn: this.configService.getOrThrow<number>(
          'jwt.accessTtlSeconds',
        ),
      }),
      this.jwtService.signAsync(refreshPayload, {
        secret: this.configService.getOrThrow<string>('jwt.refreshSecret'),
        expiresIn: this.configService.getOrThrow<number>(
          'jwt.refreshTtlSeconds',
        ),
      }),
    ]);

    return { accessToken, refreshToken };
  }
}
