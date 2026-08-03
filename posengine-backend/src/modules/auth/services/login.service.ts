import { Injectable, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { UserService } from '../../user/user.service';
import { TokenService } from './token.service';
import { LoginDto } from '../dto/login.dto';

@Injectable()
export class LoginService {
  constructor(
    private readonly userService: UserService,
    private readonly tokenService: TokenService,
  ) {}

  async login(dto: LoginDto) {
    const user = await this.userService.findByEmail(dto.email);
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const passwordMatches = await bcrypt.compare(dto.password, user.password);
    if (!passwordMatches) throw new UnauthorizedException('Invalid credentials');

    if (!user.active) throw new UnauthorizedException('Account is disabled');

    const accessToken = this.tokenService.signAccessToken(user);
    const refreshToken = await this.tokenService.issueRefreshToken(user.id, dto.isRemember);

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
