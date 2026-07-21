import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../../prisma/prisma.service';
import * as crypto from 'crypto';
import { hashToken } from '../utils/hash-token.util';
import {
  ACCESS_TOKEN_TTL,
  REFRESH_TOKEN_TTL_DAYS,
  REFRESH_TOKEN_TTL_DAYS_REMEMBER,
  REFRESH_TOKEN_BYTES,
} from '../constants/auth.constants';

@Injectable()
export class TokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  signAccessToken(user: { id: string; email: string; tenantId: string | null }): string {
    return this.jwtService.sign(
      { sub: user.id, email: user.email, tenantId: user.tenantId },
      { expiresIn: ACCESS_TOKEN_TTL },
    );
  }

  async issueRefreshToken(userId: string, isRemember?: boolean): Promise<string> {
    const rawToken = crypto.randomBytes(REFRESH_TOKEN_BYTES).toString('hex');
    const tokenHash = hashToken(rawToken);
    const ttlDays = isRemember ? REFRESH_TOKEN_TTL_DAYS_REMEMBER : REFRESH_TOKEN_TTL_DAYS;
    const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);

    await this.prisma.refreshToken.create({
      data: { userId, tokenHash, expiresAt },
    });

    return rawToken;
  }
}
