import { Controller, Post, Body, HttpCode, HttpStatus, Get, Query, Req, Res, Delete } from '@nestjs/common';
import type { Request, Response } from 'express';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser, type AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { MailService } from '../../common/mail/mail.service';
import { QuickPinService, QUICK_PIN_COOKIE } from './services/quick-pin.service';
import { DisableQuickPinDto, LoginQuickPinDto, SetupQuickPinDto } from './dto/quick-pin.dto';

function readQuickPinCookie(request: Request): string | undefined {
  const cookie = request.headers.cookie?.split(';').map((part) => part.trim())
    .find((part) => part.startsWith(`${QUICK_PIN_COOKIE}=`));
  if (!cookie) return undefined;
  try {
    return decodeURIComponent(cookie.slice(QUICK_PIN_COOKIE.length + 1));
  } catch {
    return undefined;
  }
}

function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character] as string);
}

function setQuickPinCookie(response: Response, token: string | null) {
  const production = process.env.NODE_ENV === 'production';
  response.cookie(QUICK_PIN_COOKIE, token ?? '', {
    httpOnly: true,
    secure: production,
    sameSite: production ? 'none' : 'lax',
    path: '/auth',
    maxAge: token ? 30 * 24 * 60 * 60 * 1000 : 0,
  });
}

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly quickPinService: QuickPinService,
    private readonly mailService: MailService,
  ) { }

  @Post('login')
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiBody({ type: LoginDto })
  @ApiResponse({ status: 200, description: 'Returns accessToken and user data' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('register')
  @Public()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register new user with tenant creation' })
  @ApiBody({ type: RegisterDto })
  @ApiResponse({ status: 201, description: 'User and tenant created successfully, returns accessToken and user data' })
  @ApiResponse({ status: 409, description: 'Email or tenant slug already in use' })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Get('verify-email')
  @Public()
  @ApiOperation({ summary: 'Verify user email' })
  verifyEmail(@Query('token') token: string) {
    return this.authService.verifyEmail(token);
  }

  @Post('resend-verification-email')
  @ApiBearerAuth('access-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resend verification email' })
  @ApiResponse({ status: 200, description: 'Verification email sent' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  resendVerificationEmail(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.resendVerificationEmail(user.id);
  }

  @Post('refresh')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token using a refresh token' })
  @ApiBody({ type: RefreshTokenDto })
  @ApiResponse({ status: 200, description: 'Returns new accessToken and refreshToken' })
  @ApiResponse({ status: 401, description: 'Invalid or expired refresh token' })
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshToken(dto);
  }

  @Post('logout')
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout and revoke the refresh token chain for this session' })
  @ApiBody({ type: RefreshTokenDto })
  @ApiResponse({ status: 200, description: 'Session closed' })
  async logout(@Body() dto: RefreshTokenDto) {
    return this.authService.logout(dto);
  }

  @Post('logout-all')
  @ApiBearerAuth('access-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout from all devices by revoking every active refresh token for the current user' })
  @ApiResponse({ status: 200, description: 'All sessions closed' })
  async logoutAll(@CurrentUser() user: AuthenticatedUser, @Res({ passthrough: true }) response: Response) {
    await this.quickPinService.revokeAll(user.id);
    setQuickPinCookie(response, null);
    return this.authService.logoutAll(user.id);
  }

  @Get('quick-pin/device')
  @Public()
  getQuickPinDevice(@Req() request: Request) {
    return this.quickPinService.deviceStatus(readQuickPinCookie(request));
  }

  @Get('quick-pin/status')
  getQuickPinStatus(@CurrentUser() user: AuthenticatedUser, @Req() request: Request) {
    return this.quickPinService.status(user.id, readQuickPinCookie(request));
  }

  @Post('quick-pin/setup')
  @HttpCode(HttpStatus.OK)
  async setupQuickPin(@CurrentUser() user: AuthenticatedUser, @Body() dto: SetupQuickPinDto, @Res({ passthrough: true }) response: Response) {
    const result = await this.quickPinService.setup(user.id, dto);
    setQuickPinCookie(response, result.deviceToken);
    return { enabled: result.enabled, deviceAuthorizationDays: 30 };
  }

  @Post('quick-pin/login')
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  loginQuickPin(@Req() request: Request, @Body() dto: LoginQuickPinDto) {
    return this.quickPinService.login(readQuickPinCookie(request), dto);
  }

  @Delete('quick-pin')
  @HttpCode(HttpStatus.OK)
  async disableQuickPin(@CurrentUser() user: AuthenticatedUser, @Body() dto: DisableQuickPinDto, @Res({ passthrough: true }) response: Response) {
    const result = await this.quickPinService.disable(user.id, dto);
    setQuickPinCookie(response, null);
    return result;
  }

  @Delete('quick-pin/device')
  @HttpCode(HttpStatus.OK)
  async revokeQuickPinDevice(@CurrentUser() user: AuthenticatedUser, @Req() request: Request, @Res({ passthrough: true }) response: Response) {
    await this.quickPinService.revokeCurrentDevice(readQuickPinCookie(request), user.id);
    setQuickPinCookie(response, null);
    return { revoked: true };
  }

  @Post('forgot-password')
  @Public()
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request password reset email' })
  @ApiBody({ type: ForgotPasswordDto })
  @ApiResponse({
    status: 200,
    description: 'If the email exists, reset instructions are sent',
  })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email);
  }

  @Post('reset-password')
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password using recovery token' })
  @ApiBody({ type: ResetPasswordDto })
  @ApiResponse({
    status: 200,
    description: 'Password updated successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid or expired token',
  })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @Get('profile')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: 200, description: 'Returns current user data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getProfile(@CurrentUser() user: AuthenticatedUser) {
    return user;
  }

  @Post('report-frontend-error')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Report an error from the frontend' })
  async reportFrontendError(
    @Body() body: { errorMsg?: string; stack?: string; url?: string; user?: string; userAgent?: string },
  ) {
    const errorMsg = escapeHtml(body.errorMsg?.slice(0, 1000) || 'Error no especificado');
    const stack = escapeHtml(body.stack?.slice(0, 8000) || 'Sin stack trace disponible');
    const url = escapeHtml(body.url?.slice(0, 1000) || 'Desconocida');
    const user = escapeHtml(body.user?.slice(0, 200) || 'Invitado/No logueado');
    const userAgent = escapeHtml(body.userAgent?.slice(0, 500) || 'Desconocido');
    const html = `
      <h3>Error no controlado en el Frontend</h3>
      <p><strong>Mensaje:</strong> ${errorMsg}</p>
      <p><strong>URL de pantalla:</strong> ${url}</p>
      <p><strong>Usuario activo:</strong> ${user}</p>
      <p><strong>Navegador:</strong> ${userAgent}</p>
      <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
      <h4>Detalle técnico:</h4><pre>${stack}</pre>
    `;
    await this.mailService.sendErrorAlert(`Error en pantalla: ${errorMsg}`, html);
    return { success: true };
  }

}
