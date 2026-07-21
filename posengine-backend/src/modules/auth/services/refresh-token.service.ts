import { Injectable, UnauthorizedException } from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../../../prisma/prisma.service';
import { TokenService } from './token.service';
import { RefreshTokenDto } from '../dto/refresh-token.dto';
import { hashToken } from '../utils/hash-token.util';
import { REFRESH_TOKEN_BYTES } from '../constants/auth.constants';

@Injectable()
export class RefreshTokenService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokenService: TokenService,
  ) {}

  async refresh(dto: RefreshTokenDto) {
    const tokenHash = hashToken(dto.refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });

    if (!stored) {
      throw new UnauthorizedException('Refresh token inválido');
    }

    if (stored.revokedAt) {
      await this.prisma.refreshToken.updateMany({
        where: { userId: stored.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException('Refresh token inválido — todas las sesiones fueron cerradas por seguridad');
    }

    if (stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token expirado');
    }

    const user = await this.prisma.user.findUnique({ where: { id: stored.userId } });
    if (!user || !user.active) throw new UnauthorizedException('Cuenta inválida');

    const remainingMs = stored.expiresAt.getTime() - Date.now();
    const rawRefreshToken = crypto.randomBytes(REFRESH_TOKEN_BYTES).toString('hex');
    const newTokenHash = hashToken(rawRefreshToken);

    await this.prisma.$transaction([
      this.prisma.refreshToken.update({
        where: { id: stored.id },
        data: { revokedAt: new Date(), replacedBy: newTokenHash },
      }),
      this.prisma.refreshToken.create({
        data: {
          userId: user.id,
          tokenHash: newTokenHash,
          expiresAt: new Date(Date.now() + remainingMs),
        },
      }),
    ]);

    return {
      accessToken: this.tokenService.signAccessToken(user),
      refreshToken: rawRefreshToken,
    };
  }
}
