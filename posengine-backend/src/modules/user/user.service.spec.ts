import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { UserRole } from '../../generated/prisma/enums';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { UpdateUserDto } from './dto/update-user.dto';
jest.mock('../../prisma/prisma.service', () => ({ PrismaService: class PrismaService {} }));
import { UserService } from './user.service';

describe('UserService authorization and tenant isolation', () => {
  const admin: AuthenticatedUser = {
    id: 'admin-1',
    email: 'admin@example.test',
    tenantId: 'tenant-1',
    role: UserRole.ADMIN,
    name: 'Admin',
    emailVerified: true,
    sessionId: 'session-admin',
  };

  const superadmin: AuthenticatedUser = {
    ...admin,
    id: 'superadmin-1',
    role: UserRole.SUPERADMIN,
  };

  let prisma: any;
  let service: UserService;
  let tx: any;

  beforeEach(() => {
    tx = {
      user: {
        findFirst: jest.fn(),
        count: jest.fn(),
        updateMany: jest.fn(),
      },
      refreshToken: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
      quickPinDevice: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
    };

    prisma = {
      user: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      tenant: {
        findUnique: jest.fn(),
      },
      $transaction: jest.fn(async (callback: (client: any) => unknown) => callback(tx)),
    };

    service = new UserService(prisma);
  });

  it('requires an allowed role and a tenant before reading a user', async () => {
    await expect(service.findById('user-2', { ...admin, tenantId: null })).rejects.toThrow(
      ForbiddenException,
    );
    await expect(
      service.findById('user-2', { ...admin, role: 'NO_PRIVILEGE' as UserRole }),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.user.findFirst).not.toHaveBeenCalled();
  });

  it('scopes reads to the actor tenant and returns not found across tenants', async () => {
    prisma.user.findFirst.mockResolvedValue(null);

    await expect(service.findById('user-other-tenant', admin)).rejects.toThrow(
      NotFoundException,
    );
    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: { id: 'user-other-tenant', tenantId: 'tenant-1' },
      select: expect.objectContaining({ id: true, tenantId: true }),
    });
  });

  it('scopes the update itself to the actor tenant', async () => {
    const updatedUser = { id: 'user-2', tenantId: 'tenant-1', name: 'Updated' };
    const dto = Object.assign(new UpdateUserDto(), { name: 'Updated' });
    prisma.user.update.mockResolvedValue(updatedUser);

    await expect(service.update('user-2', dto, admin)).resolves.toBe(updatedUser);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-2', tenantId: 'tenant-1' },
      data: { name: 'Updated' },
      select: expect.objectContaining({ id: true, tenantId: true }),
    });
  });

  it('preserves not-found behavior when a scoped update matches no user', async () => {
    prisma.user.update.mockRejectedValue({ code: 'P2025' });

    await expect(
      service.update('user-other-tenant', new UpdateUserDto(), admin),
    ).rejects.toThrow(NotFoundException);
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'user-other-tenant', tenantId: 'tenant-1' } }),
    );
  });

  it('does not grant SUPERADMIN cross-tenant access without an explicit tenant scope', async () => {
    await expect(service.findById('user-2', { ...superadmin, tenantId: null })).rejects.toThrow(
      ForbiddenException,
    );
    expect(prisma.user.findFirst).not.toHaveBeenCalled();
  });

  it('validates the destination tenant and blocks cross-tenant reassignment', async () => {
    await expect(service.assignTenant('user-2', 'tenant-2', admin)).rejects.toThrow(
      ForbiddenException,
    );
    expect(prisma.tenant.findUnique).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('returns not found for a nonexistent reassignment destination', async () => {
    prisma.tenant.findUnique.mockResolvedValue(null);

    await expect(
      service.assignTenant('user-2', 'tenant-2', { ...admin, tenantId: 'tenant-2' }),
    ).rejects.toThrow(
      NotFoundException,
    );
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('returns not found when the scoped reassignment target is missing', async () => {
    prisma.tenant.findUnique.mockResolvedValue({ id: 'tenant-1' });
    prisma.user.update.mockRejectedValue({ code: 'P2025' });

    await expect(service.assignTenant('missing-user', 'tenant-1', admin)).rejects.toThrow(
      NotFoundException,
    );
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'missing-user', tenantId: 'tenant-1' } }),
    );
  });

  it('keeps any permitted tenant assignment scoped to the actor tenant', async () => {
    prisma.tenant.findUnique.mockResolvedValue({ id: 'tenant-1' });
    const updatedUser = { id: 'user-2', tenantId: 'tenant-1' };
    prisma.user.update.mockResolvedValue(updatedUser);

    await expect(service.assignTenant('user-2', 'tenant-1', admin)).resolves.toBe(updatedUser);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-2', tenantId: 'tenant-1' },
      data: { tenantId: 'tenant-1' },
      select: expect.objectContaining({ id: true, tenantId: true }),
    });
  });

  it('prevents self-deactivation', async () => {
    await expect(service.deactivate(admin.id, admin)).rejects.toThrow(ConflictException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('prevents deactivation of the last active administrator', async () => {
    tx.user.findFirst.mockResolvedValue({ id: 'user-2', active: true, role: UserRole.ADMIN });
    tx.user.count.mockResolvedValue(1);

    await expect(service.deactivate('user-2', admin)).rejects.toThrow(ConflictException);
    expect(tx.user.count).toHaveBeenCalledWith({
      where: {
        tenantId: 'tenant-1',
        active: true,
        role: { in: [UserRole.ADMIN, UserRole.SUPERADMIN] },
      },
    });
    expect(tx.user.updateMany).not.toHaveBeenCalled();
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: 'Serializable',
    });
  });

  it('deactivates a same-tenant user with the tenant filter on the write', async () => {
    tx.user.findFirst
      .mockResolvedValueOnce({ id: 'user-2', active: true, role: UserRole.ADMIN })
      .mockResolvedValueOnce({ id: 'user-2', tenantId: 'tenant-1', active: false });
    tx.user.count.mockResolvedValue(2);
    tx.user.updateMany.mockResolvedValue({ count: 1 });

    const result = await service.deactivate('user-2', admin);

    expect(tx.user.updateMany).toHaveBeenCalledWith({
      where: { id: 'user-2', tenantId: 'tenant-1', active: true },
      data: { active: false },
    });
    expect(tx.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-2', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
    expect(tx.quickPinDevice.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-2', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
    expect(result).toEqual({ id: 'user-2', tenantId: 'tenant-1', active: false });
  });

  it('allows deactivating a non-admin while only one administrator remains', async () => {
    tx.user.findFirst
      .mockResolvedValueOnce({ id: 'user-2', active: true, role: 'CASHIER' })
      .mockResolvedValueOnce({ id: 'user-2', tenantId: 'tenant-1', active: false });
    tx.user.updateMany.mockResolvedValue({ count: 1 });

    await expect(service.deactivate('user-2', admin)).resolves.toEqual({
      id: 'user-2', tenantId: 'tenant-1', active: false,
    });
    expect(tx.user.count).not.toHaveBeenCalled();
  });
});
