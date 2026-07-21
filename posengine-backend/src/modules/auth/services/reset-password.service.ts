import { Injectable, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../../prisma/prisma.service';
import { ResetPasswordDto } from '../dto/reset-password.dto';
import { hashToken } from '../utils/hash-token.util';
import { BCRYPT_SALT_ROUNDS } from '../constants/auth.constants';

@Injectable()
export class ResetPasswordService {
  constructor(private readonly prisma: PrismaService) {}

  async resetPassword(dto: ResetPasswordDto) {
    const tokenHash = hashToken(dto.token);

    const resetToken = await this.prisma.passwordResetToken.findUnique({
      where: {
        tokenHash,
      },
    });

    if (!resetToken) {
      throw new UnauthorizedException('Token inválido');
    }

    if (resetToken.usedAt) {
      throw new UnauthorizedException('Token utilizado');
    }

    if (resetToken.expiresAt < new Date()) {
      throw new UnauthorizedException('Token expirado');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_SALT_ROUNDS);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: {
          id: resetToken.userId,
        },
        data: {
          password: passwordHash,
        },
      }),
      this.prisma.refreshToken.updateMany({
        where: {
          userId: resetToken.userId,
          revokedAt: null,
        },
        data: {
          revokedAt: new Date(),
        },
      }),
      this.prisma.passwordResetToken.update({
        where: {
          id: resetToken.id,
        },
        data: {
          usedAt: new Date(),
        },
      }),
    ]);

    return {
      message: 'Contraseña actualizada correctamente',
    };
  }
}
