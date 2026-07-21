import { Injectable } from '@nestjs/common';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { LoginService } from './services/login.service';
import { RegisterService } from './services/register.service';
import { RefreshTokenService } from './services/refresh-token.service';
import { LogoutService } from './services/logout.service';
import { ForgotPasswordService } from './services/forgot-password.service';
import { ResetPasswordService } from './services/reset-password.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly loginService: LoginService,
    private readonly registerService: RegisterService,
    private readonly refreshTokenService: RefreshTokenService,
    private readonly logoutService: LogoutService,
    private readonly forgotPasswordService: ForgotPasswordService,
    private readonly resetPasswordService: ResetPasswordService,
  ) {}

  async login(dto: LoginDto) {
    return this.loginService.login(dto);
  }

  async register(dto: RegisterDto) {
    return this.registerService.register(dto);
  }

  async refreshToken(dto: RefreshTokenDto) {
    return this.refreshTokenService.refresh(dto);
  }

  async logout(dto: RefreshTokenDto) {
    return this.logoutService.logout(dto);
  }

  async logoutAll(userId: string) {
    return this.logoutService.logoutAll(userId);
  }

  async forgotPassword(email: string) {
    return this.forgotPasswordService.forgotPassword(email);
  }

  async resetPassword(dto: ResetPasswordDto) {
    return this.resetPasswordService.resetPassword(dto);
  }
}
