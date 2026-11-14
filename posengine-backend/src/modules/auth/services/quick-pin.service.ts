import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from '../../../prisma/prisma.service';
import { hashToken } from '../utils/hash-token.util';
import { BCRYPT_SALT_ROUNDS, REFRESH_TOKEN_BYTES, REFRESH_TOKEN_TTL_DAYS } from '../constants/auth.constants';
import { TokenService } from './token.service';
import { DisableQuickPinDto, LoginQuickPinDto, SetupQuickPinDto } from '../dto/quick-pin.dto';

export const QUICK_PIN_COOKIE = 'posengine_quick_device';
const DEVICE_TTL_DAYS = 30;
const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

@Injectable()
export class QuickPinService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokenService: TokenService,
  ) {}

  private async validatePassword(userId: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.active || !(await bcrypt.compare(password, user.password))) {
      throw new UnauthorizedException('Contraseña incorrecta.');
    }
    return user;
  }

  async status(userId: string, rawToken?: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { quickPinHash: true },
    });
    const device = rawToken ? await this.prisma.quickPinDevice.findUnique({
      where: { tokenHash: hashToken(rawToken) }, select: { userId: true, revokedAt: true, expiresAt: true },
    }) : null;
    return {
      enabled: Boolean(user?.quickPinHash),
      deviceAuthorized: Boolean(device && device.userId === userId && !device.revokedAt && device.expiresAt > new Date()),
      deviceAuthorizationDays: DEVICE_TTL_DAYS,
    };
  }

  async deviceStatus(rawToken?: string) {
    if (!rawToken) return { enabled: false };
    const device = await this.prisma.quickPinDevice.findUnique({
      where: { tokenHash: hashToken(rawToken) },
      include: { user: { select: { id: true, name: true, active: true, quickPinHash: true } } },
    });
    if (!device || device.revokedAt || device.expiresAt <= new Date() || !device.user.active || !device.user.quickPinHash) {
      return { enabled: false };
    }
    return { enabled: true, userName: device.user.name };
  }

  async setup(userId: string, dto: SetupQuickPinDto) {
    if (dto.pin !== dto.confirmPin) throw new BadRequestException('Los códigos PIN no coinciden.');
    await this.validatePassword(userId, dto.password);
    const pinHash = await bcrypt.hash(dto.pin, BCRYPT_SALT_ROUNDS);
    const rawToken = crypto.randomBytes(32).toString('hex');
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: userId }, data: { quickPinHash: pinHash } });
      await tx.quickPinDevice.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: now },
      });
      await tx.quickPinDevice.create({
        data: {
          userId,
          tokenHash: hashToken(rawToken),
          expiresAt: new Date(now.getTime() + DEVICE_TTL_DAYS * 24 * 60 * 60 * 1000),
        },
      });
    });
    return { enabled: true, deviceToken: rawToken };
  }

  async login(rawToken: string | undefined, dto: LoginQuickPinDto) {
    if (!rawToken) throw new UnauthorizedException('Este dispositivo no está autorizado.');
    const tokenHash = hashToken(rawToken);
    let device = await this.prisma.quickPinDevice.findUnique({
      where: { tokenHash },
      include: { user: { include: { tenant: true } } },
    });
    const now = new Date();
    if (!device || device.revokedAt || device.expiresAt <= now || !device.user.active || !device.user.quickPinHash) {
      throw new UnauthorizedException('Acceso rápido no disponible. Ingresá con correo y contraseña.');
    }
    if (device.lockedUntil && device.lockedUntil > now) {
      throw new UnauthorizedException('Acceso rápido bloqueado temporalmente. Ingresá con correo y contraseña.');
    }
    if (device.lockedUntil && device.lockedUntil <= now) {
      await this.prisma.quickPinDevice.updateMany({
        where: { id: device.id, lockedUntil: { lte: now } },
        data: { failedAttempts: 0, lockedUntil: null },
      });
      device = await this.prisma.quickPinDevice.findUnique({
        where: { tokenHash },
        include: { user: { include: { tenant: true } } },
      });
      if (!device || device.revokedAt || !device.user.active || !device.user.quickPinHash) {
        throw new UnauthorizedException('Acceso rápido no disponible.');
      }
    }

    const attemptNumber = device.failedAttempts + 1;
    const attempt = await this.prisma.quickPinDevice.updateMany({
      where: { id: device.id, revokedAt: null, failedAttempts: { lt: MAX_ATTEMPTS }, lockedUntil: null },
      data: { failedAttempts: { increment: 1 } },
    });
    if (!attempt.count) throw new UnauthorizedException('Acceso rápido bloqueado. Ingresá con correo y contraseña.');

    const valid = await bcrypt.compare(dto.pin, device.user.quickPinHash);
    if (!valid) {
      const afterAttempt = await this.prisma.quickPinDevice.findUnique({ where: { id: device.id } });
      if (afterAttempt && afterAttempt.failedAttempts >= MAX_ATTEMPTS) {
        await this.prisma.quickPinDevice.updateMany({
          where: { id: device.id, revokedAt: null, failedAttempts: { gte: MAX_ATTEMPTS }, lockedUntil: null },
          data: { lockedUntil: new Date(Date.now() + LOCK_MINUTES * 60 * 1000) },
        });
      }
      throw new UnauthorizedException('Código PIN incorrecto.');
    }

    const refreshToken = crypto.randomBytes(REFRESH_TOKEN_BYTES).toString('hex');
    const issued = await this.prisma.$transaction(async (tx) => {
      const claim = await tx.quickPinDevice.updateMany({
        where: {
          id: device.id,
          revokedAt: null,
          expiresAt: { gt: new Date() },
          failedAttempts: attemptNumber,
          lockedUntil: null,
        },
        data: { failedAttempts: 0 },
      });
      if (!claim.count) return false;

      const currentUser = await tx.user.findUnique({
        where: { id: device.userId },
        select: { active: true, quickPinHash: true },
      });
      if (!currentUser?.active || !currentUser.quickPinHash || !(await bcrypt.compare(dto.pin, currentUser.quickPinHash))) {
        return false;
      }

      await tx.refreshToken.create({
        data: {
          userId: device.userId,
          tokenHash: hashToken(refreshToken),
          expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000),
        },
      });
      return true;
    });
    if (!issued) throw new UnauthorizedException('El dispositivo ya no está autorizado. Ingresá con correo y contraseña.');
    return {
      accessToken: this.tokenService.signAccessToken(device.user, refreshToken),
      refreshToken,
      user: {
        id: device.user.id,
        name: device.user.name,
        email: device.user.email,
        tenantId: device.user.tenantId,
        tenantName: device.user.tenant?.name ?? null,
        emailVerified: device.user.emailVerified,
        role: device.user.role,
      },
    };
  }

  async disable(userId: string, dto: DisableQuickPinDto) {
    await this.validatePassword(userId, dto.password);
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: userId }, data: { quickPinHash: null } }),
      this.prisma.quickPinDevice.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: now } }),
    ]);
    return { enabled: false };
  }

  async revokeCurrentDevice(rawToken: string | undefined, userId: string) {
    if (!rawToken) return;
    await this.prisma.quickPinDevice.updateMany({
      where: { userId, tokenHash: hashToken(rawToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAll(userId: string) {
    await this.prisma.quickPinDevice.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { revoked: true };
  }
}
