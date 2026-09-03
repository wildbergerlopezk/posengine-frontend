import { Controller, Post, Body, HttpCode, HttpStatus, Get, Query } from '@nestjs/common';
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

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
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
  @ApiBearerAuth('access-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout and revoke refresh token' })
  @ApiBody({ type: RefreshTokenDto })
  @ApiResponse({ status: 200, description: 'Session closed' })
  logout(@Body() dto: RefreshTokenDto) {
    return this.authService.logout(dto);
  }

  @Post('logout-all')
  @ApiBearerAuth('access-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout from all devices by revoking every active refresh token for the current user' })
  @ApiResponse({ status: 200, description: 'All sessions closed' })
  logoutAll(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.logoutAll(user.id);
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
  @ApiOperation({ summary: 'Report error from frontend' })
  async reportFrontendError(
    @Body() body: { errorMsg: string; stack?: string; url?: string; user?: string; userAgent?: string }
  ) {
    const { errorMsg, stack, url, user, userAgent } = body;
    const html = `
      <h3>🚨 Error no controlado en el Frontend (Next.js)</h3>
      <p><strong>Mensaje:</strong> ${errorMsg}</p>
      <p><strong>URL de pantalla:</strong> ${url || 'Desconocida'}</p>
      <p><strong>Usuario Activo:</strong> ${user || 'Invitado/No logueado'}</p>
      <p><strong>Navegador (User-Agent):</strong> ${userAgent || 'Desconocido'}</p>
      <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
      <h4>Stack Trace (Detalle técnico):</h4>
      <pre style="background: #f4f4f4; padding: 10px; border: 1px solid #ddd; overflow: auto; max-height: 400px; font-family: monospace;">${stack || 'Sin stack trace disponible'}</pre>
    `;
    await this.mailService.sendErrorAlert(`Error en pantalla: ${errorMsg}`, html);
    return { success: true };
  }
}