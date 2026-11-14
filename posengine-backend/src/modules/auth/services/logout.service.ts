import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class LogoutService {
  constructor(private readonly prisma: PrismaService) {}

  async logout(userId: string, sessionId: string) {
    if (!sessionId) throw new UnauthorizedException('Sesión inválida.');
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: sessionId, userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    return { message: 'Sesión cerrada correctamente' };
  }

  async logoutAll(userId: string) {
    await this.prisma.refreshToken.updateMany({
      where: {
        userId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });

    return {
      message: 'Todas las sesiones fueron cerradas correctamente',
    };
  }
}
