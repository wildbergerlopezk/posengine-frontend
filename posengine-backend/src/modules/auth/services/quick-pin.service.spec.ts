import { UnauthorizedException } from '@nestjs/common';

jest.mock('bcrypt', () => ({ compare: jest.fn(), hash: jest.fn() }));
jest.mock('../../../prisma/prisma.service', () => ({ PrismaService: class PrismaService {} }));
jest.mock('./token.service', () => ({ TokenService: class TokenService {} }));

import * as bcrypt from 'bcrypt';
import { QuickPinService } from './quick-pin.service';

describe('QuickPinService', () => {
  let prisma: any;
  let tokens: any;
  let service: QuickPinService;
  const device = {
    id: 'device-1', userId: 'user-1', failedAttempts: 0, lockedUntil: null,
    revokedAt: null, expiresAt: new Date(Date.now() + 60_000),
    user: {
      id: 'user-1', name: 'Test', email: 'user@example.com', password: 'password-hash',
      quickPinHash: 'pin-hash', active: true, tenantId: 'tenant-1', tenant: { name: 'Shop' },
      emailVerified: true, role: 'ADMIN',
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    const quickPinDevice = {
      findUnique: jest.fn().mockResolvedValue(device),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    };
    const user = { findUnique: jest.fn().mockResolvedValue(device.user) };
    const refreshToken = { create: jest.fn().mockResolvedValue({ id: 'refresh-1' }) };
    prisma = {
      quickPinDevice,
      user,
      refreshToken,
      $transaction: jest.fn(async (callback: (tx: any) => unknown) => callback({ quickPinDevice, user, refreshToken })),
    };
    tokens = {
      signAccessToken: jest.fn().mockReturnValue('access-token'),
    };
    service = new QuickPinService(prisma, tokens);
  });

  it('refuses PIN attempts without the HttpOnly device credential', async () => {
    await expect(service.login(undefined, { pin: '123456' })).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.quickPinDevice.findUnique).not.toHaveBeenCalled();
  });

  it('requires an atomic attempt slot before checking a PIN', async () => {
    prisma.quickPinDevice.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(service.login('device-secret', { pin: '123456' })).rejects.toBeInstanceOf(UnauthorizedException);
    expect(bcrypt.compare).not.toHaveBeenCalled();
  });

  it('rejects an incorrect PIN and preserves the attempt counter', async () => {
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);
    prisma.quickPinDevice.findUnique.mockResolvedValueOnce(device).mockResolvedValueOnce({ ...device, failedAttempts: 1 });
    await expect(service.login('device-secret', { pin: '000000' })).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.quickPinDevice.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: 'device-1', failedAttempts: { lt: 5 } }),
    }));
  });

  it('issues the normal role and tenant session after a valid device PIN', async () => {
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    prisma.quickPinDevice.findUnique.mockResolvedValueOnce(device);
    const result = await service.login('device-secret', { pin: '123456' });
    expect(result).toMatchObject({
      accessToken: 'access-token',
      user: { id: 'user-1', tenantId: 'tenant-1', role: 'ADMIN' },
    });
    expect(result.refreshToken).toEqual(expect.any(String));
    expect(prisma.refreshToken.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ userId: 'user-1', tokenHash: expect.any(String), expiresAt: expect.any(Date) }),
    }));
    expect(prisma.quickPinDevice.updateMany).toHaveBeenLastCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: 'device-1', failedAttempts: 1, revokedAt: null }),
      data: { failedAttempts: 0 },
    }));
  });

  it('does not issue a session if the device is revoked while the PIN is being checked', async () => {
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    prisma.quickPinDevice.findUnique.mockResolvedValueOnce(device);
    prisma.quickPinDevice.updateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });
    await expect(service.login('device-secret', { pin: '123456' })).rejects.toThrow('ya no está autorizado');
    expect(prisma.refreshToken.create).not.toHaveBeenCalled();
  });
});
