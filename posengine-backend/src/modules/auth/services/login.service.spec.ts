import { UnauthorizedException } from '@nestjs/common';

jest.mock('../../user/user.service', () => ({ UserService: class UserService {} }));
jest.mock('./token.service', () => ({ TokenService: class TokenService {} }));
jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn().mockResolvedValue('dummy-hash'),
}));

import * as bcrypt from 'bcrypt';
import { LoginService } from './login.service';

describe('LoginService', () => {
  const invalidCredentials = { email: 'user@example.com', password: 'wrong-password' };
  let userService: { findByEmail: jest.Mock };
  let tokenService: { signAccessToken: jest.Mock; issueRefreshToken: jest.Mock };
  let service: LoginService;

  beforeEach(() => {
    jest.clearAllMocks();
    userService = { findByEmail: jest.fn() };
    tokenService = {
      signAccessToken: jest.fn().mockReturnValue('access-token'),
      issueRefreshToken: jest.fn().mockResolvedValue('refresh-token'),
    };
    service = new LoginService(userService as any, tokenService as any);
  });

  it.each([
    ['email does not exist', null, false],
    ['password is incorrect', { password: 'stored-hash', active: true }, false],
    ['account is inactive', { password: 'stored-hash', active: false }, true],
  ])('returns the same generic 401 when %s', async (_scenario, user, passwordMatches) => {
    userService.findByEmail.mockResolvedValue(user);
    (bcrypt.compare as jest.Mock).mockResolvedValue(passwordMatches);

    const error = await service.login(invalidCredentials as any).catch((caught) => caught);
    expect(error).toBeInstanceOf(UnauthorizedException);
    expect((error as UnauthorizedException).getStatus()).toBe(401);
    expect((error as UnauthorizedException).getResponse()).toMatchObject({
      message: 'Credenciales inválidas',
    });
    if (!user) {
      expect(bcrypt.compare).toHaveBeenCalledWith('wrong-password', 'dummy-hash');
    }
  });

  it('preserves the successful login and token flow', async () => {
    const user = {
      id: 'user-1',
      name: 'User',
      email: 'user@example.com',
      tenantId: 'tenant-1',
      tenant: { name: 'Business' },
      emailVerified: true,
      role: 'ADMIN',
      password: 'stored-hash',
      active: true,
    };
    userService.findByEmail.mockResolvedValue(user);
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);

    await expect(service.login({ ...invalidCredentials, isRemember: true } as any)).resolves.toMatchObject({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      user: { id: 'user-1', tenantId: 'tenant-1', email: 'user@example.com' },
    });
    expect(tokenService.issueRefreshToken).toHaveBeenCalledWith('user-1', true);
  });
});
