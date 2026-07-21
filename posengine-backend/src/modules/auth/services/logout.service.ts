import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { RefreshTokenDto } from '../dto/refresh-token.dto';
import { hashToken } from '../utils/hash-token.util';

@Injectable()
export class LogoutService {
  constructor(private readonly prisma: PrismaService) {}

  async logout(dto: RefreshTokenDto) {
    const tokenHash = hashToken(dto.refreshToken);

    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
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
