import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { RefreshTokenDto } from '../dto/refresh-token.dto';
import { hashToken } from '../utils/hash-token.util';

@Injectable()
export class LogoutService {
  constructor(private readonly prisma: PrismaService) {}

  async logout(dto: RefreshTokenDto) {
    if (!dto.refreshToken) throw new UnauthorizedException('Sesión inválida.');
    const tokenHash = hashToken(dto.refreshToken);
    const observed = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });
    if (!observed) throw new UnauthorizedException('Sesión inválida.');

    await this.prisma.$transaction(async (tx) => {
      // Refresh and logout share this lock. If refresh wins first, follow its
      // replacement chain and revoke the descendant as part of the same logout.
      await tx.$queryRaw`SELECT "id" FROM "users" WHERE "id" = ${observed.userId} FOR UPDATE`;
      const sessionTokens = await tx.refreshToken.findMany({
        where: { userId: observed.userId },
        select: { id: true, tokenHash: true, replacedBy: true },
      });
      const tokenByHash = new Map(sessionTokens.map((token) => [token.tokenHash, token]));
      let currentHash: string | null = tokenHash;
      const visited = new Set<string>();
      const tokenIds: string[] = [];
      const now = new Date();

      while (currentHash && !visited.has(currentHash)) {
        visited.add(currentHash);
        const current = tokenByHash.get(currentHash);
        if (!current) break;
        tokenIds.push(current.id);
        currentHash = current.replacedBy;
      }

      if (tokenIds.length) {
        await tx.refreshToken.updateMany({
          where: { id: { in: tokenIds }, userId: observed.userId, revokedAt: null },
          data: { revokedAt: now },
        });
      }
    });

    return { message: 'Sesión cerrada correctamente' };
  }

  async logoutAll(userId: string) {
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "users" WHERE "id" = ${userId} FOR UPDATE`;
      await tx.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    });
    return { message: 'Todas las sesiones fueron cerradas correctamente' };
  }
}
