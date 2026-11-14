import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../../generated/prisma/enums';
import { RolesGuard } from '../auth/guards/roles.guard';
jest.mock('../../prisma/prisma.service', () => ({ PrismaService: class PrismaService {} }));
import { UserController } from './user.controller';

describe('UserController authorization', () => {
  const reflector = new Reflector();
  const guard = new RolesGuard(reflector);
  const handlers = [
    UserController.prototype.findOne,
    UserController.prototype.update,
    UserController.prototype.assignTenant,
    UserController.prototype.deactivate,
  ];

  function contextFor(handler: Function, role?: string): ExecutionContext {
    return {
      getHandler: () => handler,
      getClass: () => UserController,
      switchToHttp: () => ({
        getRequest: () => ({ user: role ? { role } : undefined }),
      }),
    } as unknown as ExecutionContext;
  }

  it.each(handlers)('permits ADMIN for %p', (handler) => {
    expect(guard.canActivate(contextFor(handler, UserRole.ADMIN))).toBe(true);
  });

  it.each(handlers)('permits SUPERADMIN for %p within service scope', (handler) => {
    expect(guard.canActivate(contextFor(handler, UserRole.SUPERADMIN))).toBe(true);
  });

  it.each(handlers)('rejects an authenticated role without user-management permission for %p', (handler) => {
    expect(() => guard.canActivate(contextFor(handler, 'NO_PRIVILEGE'))).toThrow(
      ForbiddenException,
    );
  });

  it.each(handlers)('rejects a missing authenticated user for %p', (handler) => {
    expect(() => guard.canActivate(contextFor(handler))).toThrow(ForbiddenException);
  });
});
