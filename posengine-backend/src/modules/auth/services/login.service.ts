import { Injectable, UnauthorizedException } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import * as bcrypt from 'bcrypt';
import { UserService } from '../../user/user.service';
import { TokenService } from './token.service';
import { LoginDto } from '../dto/login.dto';

const INVALID_CREDENTIALS_MESSAGE = 'Credenciales inválidas';
const DUMMY_PASSWORD_HASH = bcrypt.hash(randomBytes(32).toString('hex'), 10);

@Injectable()
export class LoginService {
  constructor(
    private readonly userService: UserService,
    private readonly tokenService: TokenService,
  ) {}

  async login(dto: LoginDto) {
    const user = await this.userService.findByEmail(dto.email);
    if (!user) {
      await bcrypt.compare(dto.password, await DUMMY_PASSWORD_HASH);
      throw new UnauthorizedException(INVALID_CREDENTIALS_MESSAGE);
    }

    const passwordMatches = await bcrypt.compare(dto.password, user.password);
    if (!passwordMatches) throw new UnauthorizedException(INVALID_CREDENTIALS_MESSAGE);

    if (!user.active) throw new UnauthorizedException(INVALID_CREDENTIALS_MESSAGE);

    const refreshToken = await this.tokenService.issueRefreshToken(user.id, dto.isRemember);
    const accessToken = this.tokenService.signAccessToken(user, refreshToken);

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        tenantId: user.tenantId,
        tenantName: user.tenant?.name ?? null,
        emailVerified: user.emailVerified,
        role: user.role,
      },
    };
  }
}
