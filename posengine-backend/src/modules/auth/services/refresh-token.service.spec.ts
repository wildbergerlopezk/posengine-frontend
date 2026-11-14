jest.mock('../../../prisma/prisma.service', () => ({ PrismaService: class PrismaService {} }));

import { UnauthorizedException } from '@nestjs/common';
import { RefreshTokenService } from './refresh-token.service';

describe('RefreshTokenService', () => {
  const rawToken = 'a'.repeat(64);
  const now = new Date();
  const stored = {
    id: 'refresh-1',
    userId: 'user-1',
    tokenHash: 'unused-in-mock',
    expiresAt: new Date(now.getTime() + 60_000),
    revokedAt: null,
  };

  it('claims the active token and creates its replacement in the same transaction', async () => {
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ id: 'user-1' }]),
      refreshToken: {
        findUnique: jest.fn().mockResolvedValue(stored),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        create: jest.fn().mockResolvedValue({}),
      },
      user: { findUnique: jest.fn().mockResolvedValue({ id: 'user-1', active: true }) },
    };
    const prisma = {
      refreshToken: { findUnique: jest.fn().mockResolvedValue(stored) },
      $transaction: jest.fn((callback) => callback(tx)),
    };
    const tokenService = { signAccessToken: jest.fn().mockReturnValue('access') };
    const service = new RefreshTokenService(prisma as any, tokenService as any);

    await expect(service.refresh({ refreshToken: rawToken })).resolves.toMatchObject({
      accessToken: 'access',
      refreshToken: expect.any(String),
    });
    expect(tx.refreshToken.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: stored.id, revokedAt: null, expiresAt: { gt: expect.any(Date) } }),
    }));
    expect(tx.refreshToken.create).toHaveBeenCalledTimes(1);
  });

  it('does not create a descendant when another request already claimed the token', async () => {
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      refreshToken: { findUnique: jest.fn().mockResolvedValue(stored) },
      user: { findUnique: jest.fn().mockResolvedValue({ id: 'user-1', active: true }) },
    };
    tx.refreshToken.updateMany = jest.fn().mockResolvedValue({ count: 0 });
    tx.refreshToken.create = jest.fn();
    const prisma = {
      refreshToken: { findUnique: jest.fn().mockResolvedValue(stored) },
      $transaction: jest.fn((callback) => callback(tx)),
    };
    const service = new RefreshTokenService(prisma as any, { signAccessToken: jest.fn() } as any);

    await expect(service.refresh({ refreshToken: rawToken })).rejects.toBeInstanceOf(UnauthorizedException);
    expect(tx.refreshToken.create).not.toHaveBeenCalled();
  });

  it('does not mutate an already revoked token or revoke other sessions on replay', async () => {
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      refreshToken: {
        findUnique: jest.fn().mockResolvedValue({ ...stored, revokedAt: now }),
        updateMany: jest.fn(),
        create: jest.fn(),
      },
      user: { findUnique: jest.fn() },
    };
    const prisma = {
      refreshToken: { findUnique: jest.fn().mockResolvedValue({ ...stored, revokedAt: now }) },
      $transaction: jest.fn((callback) => callback(tx)),
    };
    const service = new RefreshTokenService(prisma as any, { signAccessToken: jest.fn() } as any);

    await expect(service.refresh({ refreshToken: rawToken })).rejects.toBeInstanceOf(UnauthorizedException);
    expect(tx.refreshToken.updateMany).not.toHaveBeenCalled();
    expect(tx.refreshToken.create).not.toHaveBeenCalled();
  });
});
