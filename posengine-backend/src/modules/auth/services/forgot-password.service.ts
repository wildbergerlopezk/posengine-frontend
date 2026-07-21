import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../../../prisma/prisma.service';
import { UserService } from '../../user/user.service';
import { MailService } from '../../../common/mail/mail.service';
import { hashToken } from '../utils/hash-token.util';
import {
  PASSWORD_RESET_TTL_MINUTES,
  PASSWORD_RESET_TOKEN_BYTES,
} from '../constants/auth.constants';

@Injectable()
export class ForgotPasswordService {
  constructor(
    private readonly userService: UserService,
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
  ) {}

  async forgotPassword(email: string) {
    const user = await this.userService.findByEmail(email);

    if (!user) {
      return {
        message: 'Si el correo existe recibirás instrucciones',
      };
    }

    const activeResetToken = await this.prisma.passwordResetToken.findFirst({
      where: {
        userId: user.id,
        usedAt: null,
        expiresAt: {
          gt: new Date(),
        },
      },
    });

    if (activeResetToken) {
      return {
        message: 'Si el correo existe recibirás instrucciones',
      };
    }

    await this.prisma.passwordResetToken.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });

    await this.prisma.passwordResetToken.deleteMany({
      where: {
        userId: user.id,
        usedAt: null,
      },
    });

    const rawToken = crypto.randomBytes(PASSWORD_RESET_TOKEN_BYTES).toString('hex');
    const tokenHash = hashToken(rawToken);

    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MINUTES * 60 * 1000),
      },
    });

    await this.mailService.sendPasswordReset(user.email, rawToken, user.tenant?.name);

    return {
      message: 'Si el correo existe recibirás instrucciones',
    };
  }
}
