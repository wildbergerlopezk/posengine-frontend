import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { UserService } from '../user/user.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { MailService } from '../../common/mail/mail.service';
import { ResetPasswordDto } from './dto/reset-password.dto';
import slugify from 'slugify';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

const ACCESS_TOKEN_TTL = '15m';
const REFRESH_TOKEN_TTL_DAYS = 7;
const REFRESH_TOKEN_TTL_DAYS_REMEMBER = 30;

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
  ) { }

  private signAccessToken(user: { id: string; email: string; tenantId: string | null }) {
    return this.jwtService.sign(
      { sub: user.id, email: user.email, tenantId: user.tenantId },
      { expiresIn: ACCESS_TOKEN_TTL },
    );
  }

  private async issueRefreshToken(userId: string, isRemember?: boolean) {
    const rawToken = crypto.randomBytes(40).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const ttlDays = isRemember ? REFRESH_TOKEN_TTL_DAYS_REMEMBER : REFRESH_TOKEN_TTL_DAYS;
    const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);

    await this.prisma.refreshToken.create({
      data: { userId, tokenHash, expiresAt },
    });

    return rawToken;
  }

  async login(dto: LoginDto) {
    const user = await this.userService.findByEmail(dto.email);
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const passwordMatches = await bcrypt.compare(dto.password, user.password);
    if (!passwordMatches) throw new UnauthorizedException('Invalid credentials');

    if (!user.active) throw new UnauthorizedException('Account is disabled');

    const accessToken = this.signAccessToken(user);
    const refreshToken = await this.issueRefreshToken(user.id, dto.isRemember);

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        tenantId: user.tenantId,
        tenantName: user.tenant?.name ?? null,
      },
    };
  }

  async register(dto: RegisterDto) {
    const existingUser = await this.userService.findByEmail(dto.email);
    if (existingUser) throw new ConflictException('Email already registered');

    const baseSlug = slugify(dto.tenantName, {
      lower: true,
      strict: true,
    });

    let slug = baseSlug;
    let counter = 1;

    while (await this.prisma.tenant.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${counter++}`;
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const tenant = await this.prisma.tenant.create({
      data: {
        name: dto.tenantName,
        slug,
      },
    });

    const user = await this.prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email.toLowerCase(),
        password: passwordHash,
        tenantId: tenant.id,
        active: true,
      },
    });

    const accessToken = this.signAccessToken(user);
    const refreshToken = await this.issueRefreshToken(user.id);

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        tenantId: user.tenantId,
        tenantName: tenant.name,
      },
    };
  }

  async refreshToken(dto: RefreshTokenDto) {
    const tokenHash = crypto.createHash('sha256').update(dto.refreshToken).digest('hex');
    const stored = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });

    if (!stored) {
      throw new UnauthorizedException('Refresh token inválido');
    }

    if (stored.revokedAt) {
      await this.prisma.refreshToken.updateMany({
        where: { userId: stored.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException('Refresh token inválido — todas las sesiones fueron cerradas por seguridad');
    }

    if (stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token expirado');
    }

    const user = await this.prisma.user.findUnique({ where: { id: stored.userId } });
    if (!user || !user.active) throw new UnauthorizedException('Cuenta inválida');

    const remainingMs = stored.expiresAt.getTime() - Date.now();
    const rawRefreshToken = crypto.randomBytes(40).toString('hex');
    const newTokenHash = crypto.createHash('sha256').update(rawRefreshToken).digest('hex');

    await this.prisma.$transaction([
      this.prisma.refreshToken.update({
        where: { id: stored.id },
        data: { revokedAt: new Date(), replacedBy: newTokenHash },
      }),
      this.prisma.refreshToken.create({
        data: {
          userId: user.id,
          tokenHash: newTokenHash,
          expiresAt: new Date(Date.now() + remainingMs),
        },
      }),
    ]);

    return {
      accessToken: this.signAccessToken(user),
      refreshToken: rawRefreshToken,
    };
  }

  async logout(dto: RefreshTokenDto) {
    const tokenHash = crypto.createHash('sha256').update(dto.refreshToken).digest('hex');

    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    return { message: 'Sesión cerrada correctamente' };
  }

  async forgotPassword(email: string) {
    const user = await this.userService.findByEmail(email);

    if (!user) {
      return {
        message:
          'Si el correo existe recibirás instrucciones'
      };
    }


    const rawToken =
      crypto.randomBytes(32).toString('hex');


    const tokenHash =
      crypto
        .createHash('sha256')
        .update(rawToken)
        .digest('hex');


    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt:
          new Date(Date.now() + 30 * 60 * 1000)
      }
    });


    await this.mailService.sendPasswordReset(
      user.email,
      rawToken,
      user.tenant?.name
    );


    return {
      message:
        'Si el correo existe recibirás instrucciones'
    };
  }

  async resetPassword(dto: ResetPasswordDto) {

    const tokenHash =
      crypto
        .createHash('sha256')
        .update(dto.token)
        .digest('hex');


    const resetToken =
      await this.prisma.passwordResetToken.findUnique({
        where: {
          tokenHash
        }
      });


    if (!resetToken) {
      throw new UnauthorizedException(
        'Token inválido'
      );
    }


    if (resetToken.usedAt) {
      throw new UnauthorizedException(
        'Token utilizado'
      );
    }


    if (resetToken.expiresAt < new Date()) {
      throw new UnauthorizedException(
        'Token expirado'
      );
    }

    const passwordHash =
      await bcrypt.hash(dto.password, 10);

    await this.prisma.user.update({
      where: {
        id: resetToken.userId
      },
      data: {
        password: passwordHash
      }
    });


    await this.prisma.passwordResetToken.update({
      where: {
        id: resetToken.id
      },
      data: {
        usedAt: new Date()
      }
    });

    return {
      message:
        'Contraseña actualizada correctamente'
    };
  }
}