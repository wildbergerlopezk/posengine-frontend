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
    const observed = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });
    if (!observed) throw new UnauthorizedException('Refresh token inválido');

    const rawRefreshToken = crypto.randomBytes(REFRESH_TOKEN_BYTES).toString('hex');
    const newTokenHash = hashToken(rawRefreshToken);

    const issued = await this.prisma.$transaction(async (tx) => {
      // Serialize refresh and logout for this account. The token is re-read after
      // acquiring the lock so a request that waited cannot use a stale snapshot.
      await tx.$queryRaw`SELECT "id" FROM "users" WHERE "id" = ${observed.userId} FOR UPDATE`;
      const now = new Date();
      const stored = await tx.refreshToken.findUnique({ where: { tokenHash } });
      if (!stored || stored.revokedAt || stored.expiresAt <= now) {
        throw new UnauthorizedException('Refresh token inválido o expirado');
      }

      const currentUser = await tx.user.findUnique({ where: { id: stored.userId } });
      if (!currentUser || !currentUser.active) throw new UnauthorizedException('Cuenta inválida');

      const claim = await tx.refreshToken.updateMany({
        where: {
          id: stored.id,
          userId: stored.userId,
          tokenHash,
          revokedAt: null,
          expiresAt: { gt: now },
        },
        data: { revokedAt: now, replacedBy: newTokenHash },
      });
      if (claim.count !== 1) throw new UnauthorizedException('Refresh token inválido o expirado');

      await tx.refreshToken.create({
        data: {
          userId: currentUser.id,
          tokenHash: newTokenHash,
          expiresAt: stored.expiresAt,
        },
      });
      return {
        accessToken: this.tokenService.signAccessToken(currentUser, rawRefreshToken),
      };
    });

    return {
      accessToken: issued.accessToken,
      refreshToken: rawRefreshToken,
    };
  }
}
