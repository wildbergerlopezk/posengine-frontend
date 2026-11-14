import { UnauthorizedException } from '@nestjs/common';
jest.mock('../../../prisma/prisma.service', () => ({ PrismaService: class PrismaService {} }));
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy session validation', () => {
  let prisma: any;
  let strategy: JwtStrategy;

  beforeEach(() => {
    prisma = { user: { findUnique: jest.fn() } };
    strategy = Object.create(JwtStrategy.prototype);
    (strategy as any).prisma = prisma;
  });

  it('rejects access tokens that do not identify an issued session', async () => {
    await expect(strategy.validate({ sub: 'user-1', email: 'u@example.test', tenantId: 't1' } as any))
      .rejects.toThrow(UnauthorizedException);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('rejects access tokens whose refresh session was revoked at logout', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1', email: 'u@example.test', tenantId: 't1', role: 'ADMIN',
      active: true, name: 'User', emailVerified: true, refreshTokens: [],
    });
    await expect(strategy.validate({
      sub: 'user-1', email: 'u@example.test', tenantId: 't1', sid: 'revoked-session-hash',
    })).rejects.toThrow(UnauthorizedException);
    expect(prisma.user.findUnique).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'user-1' },
      select: expect.objectContaining({
        refreshTokens: {
          where: { tokenHash: 'revoked-session-hash', revokedAt: null, expiresAt: { gt: expect.any(Date) } },
          select: { id: true },
        },
      }),
    }));
  });

  it('accepts a token tied to an active refresh session and returns the same tenant and role', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1', email: 'u@example.test', tenantId: 't1', role: 'ADMIN',
      active: true, name: 'User', emailVerified: true, refreshTokens: [{ id: 'refresh-1' }],
    });
    await expect(strategy.validate({
      sub: 'user-1', email: 'u@example.test', tenantId: 't1', sid: 'active-session-hash',
    })).resolves.toMatchObject({ id: 'user-1', tenantId: 't1', role: 'ADMIN' });
  });
});
