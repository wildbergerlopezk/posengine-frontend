jest.mock('../../../prisma/prisma.service', () => ({ PrismaService: class PrismaService {} }));

import { LogoutService } from './logout.service';
import { hashToken } from '../utils/hash-token.util';

describe('LogoutService', () => {
  it('revokes only the supplied session and descendants created during a refresh race', async () => {
    const root = { id: 'root', userId: 'user-1', tokenHash: hashToken('raw-refresh-token'), replacedBy: 'child-hash', revokedAt: new Date() };
    const child = { id: 'child', userId: 'user-1', tokenHash: 'child-hash', replacedBy: null, revokedAt: null };
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      refreshToken: {
        findMany: jest.fn().mockResolvedValue([root, child]),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const prisma = {
      refreshToken: { findUnique: jest.fn().mockResolvedValue(root) },
      $transaction: jest.fn((callback) => callback(tx)),
    };
    const service = new LogoutService(prisma as any);

    await expect(service.logout({ refreshToken: 'raw-refresh-token' }))
      .resolves.toEqual({ message: 'Sesión cerrada correctamente' });
    expect(tx.refreshToken.updateMany).toHaveBeenCalledTimes(1);
    expect(tx.refreshToken.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: { in: ['root', 'child'] }, userId: 'user-1', revokedAt: null }),
    }));
  });

  it('rejects an unknown refresh token', async () => {
    const prisma = { refreshToken: { findUnique: jest.fn().mockResolvedValue(null) }, $transaction: jest.fn() };
    const service = new LogoutService(prisma as any);
    await expect(service.logout({ refreshToken: 'unknown' })).rejects.toThrow('Sesión inválida');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('serializes logout-all with refresh before revoking active tokens', async () => {
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      refreshToken: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    };
    const prisma = { $transaction: jest.fn((callback) => callback(tx)) };
    const service = new LogoutService(prisma as any);

    await expect(service.logoutAll('user-1')).resolves.toEqual({
      message: 'Todas las sesiones fueron cerradas correctamente',
    });
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(tx.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });
});
