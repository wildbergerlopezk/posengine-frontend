import { Injectable, UnauthorizedException, NotFoundException } from '@nestjs/common';
import * as crypto from 'crypto';

import { PrismaService } from '../../../prisma/prisma.service';
import { MailService } from '../../../common/mail/mail.service';

import { hashToken } from '../utils/hash-token.util';

import {
  EMAIL_VERIFICATION_TOKEN_BYTES,
  EMAIL_VERIFICATION_TTL_MINUTES,
} from '../constants/auth.constants';

@Injectable()
export class EmailVerificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
  ) {}

  async sendVerificationEmail(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { tenant: true },
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    if (user.emailVerified) {
      return { message: 'El correo ya está verificado' };
    }

    // Eliminar tokens anteriores para evitar acumulación
    await this.prisma.emailVerificationToken.deleteMany({
      where: { userId },
    });

    const rawToken = crypto
      .randomBytes(EMAIL_VERIFICATION_TOKEN_BYTES)
      .toString('hex');

    const tokenHash = hashToken(rawToken);

    await this.prisma.emailVerificationToken.create({
      data: {
        userId,
        tokenHash,
        expiresAt: new Date(
          Date.now() + EMAIL_VERIFICATION_TTL_MINUTES * 60 * 1000,
        ),
      },
    });

    await this.mailService.sendVerificationEmail(
      user.email,
      rawToken,
      user.tenant?.name,
    );

    return { message: 'Correo de verificación enviado' };
  }

  async verifyEmail(token: string) {
    const tokenHash = hashToken(token);

    const verificationToken =
      await this.prisma.emailVerificationToken.findUnique({
        where: {
          tokenHash,
        },
      });

    if (!verificationToken) {
      throw new UnauthorizedException('Token inválido');
    }

    if (verificationToken.usedAt) {
      throw new UnauthorizedException('Token utilizado');
    }

    if (verificationToken.expiresAt < new Date()) {
      throw new UnauthorizedException('Token expirado');
    }

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: {
          id: verificationToken.userId,
        },
        data: {
          emailVerified: true,
          emailVerifiedAt: new Date(),
        },
      }),

      this.prisma.emailVerificationToken.update({
        where: {
          id: verificationToken.id,
        },
        data: {
          usedAt: new Date(),
        },
      }),
    ]);

    return {
      message: 'Correo verificado correctamente',
    };
  }
}
