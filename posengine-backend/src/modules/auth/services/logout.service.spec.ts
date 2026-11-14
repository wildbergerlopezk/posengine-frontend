jest.mock('../../../prisma/prisma.service', () => ({ PrismaService: class PrismaService {} }));

import { LogoutService } from './logout.service';

describe('LogoutService', () => {
  it('revokes only the session identified by the authenticated access token', async () => {
    const prisma = { refreshToken: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) } };
    const service = new LogoutService(prisma as any);

    const sessionId = 'session-hash-from-access-jwt';
    await expect(service.logout('user-1', sessionId))
      .resolves.toEqual({ message: 'Sesión cerrada correctamente' });
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { tokenHash: sessionId, userId: 'user-1', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it('rejects logout when the access token has no session id', async () => {
    const prisma = { refreshToken: { updateMany: jest.fn() } };
    const service = new LogoutService(prisma as any);
    await expect(service.logout('user-1', '')).rejects.toThrow('Sesión inválida');
    expect(prisma.refreshToken.updateMany).not.toHaveBeenCalled();
  });
});
