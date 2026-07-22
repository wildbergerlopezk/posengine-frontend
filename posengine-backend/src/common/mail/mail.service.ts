import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter | null = null;

  constructor(private readonly config: ConfigService) {
    const host = this.config.get<string>('SMTP_HOST');
    const user = this.config.get<string>('SMTP_USER');
    const pass = this.config.get<string>('SMTP_PASS');

    if (host && user && pass) {
      this.transporter = nodemailer.createTransport({
        host,
        port: this.config.get<number>('SMTP_PORT'),
        secure: false,
        auth: { user, pass },
      });
    } else {
      this.logger.warn('SMTP no configurado — los correos se logueando en consola');
    }
  }

  async sendPasswordReset(email: string, rawToken: string, tenantName?: string | null) {
    const frontendUrl = this.config.get<string>('FRONTEND_URL');
    const resetLink = `${frontendUrl}/reset-password?token=${rawToken}`;

    if (!this.transporter) {
      this.logger.log(
        `[DEV] Reset link para ${email}${tenantName ? ` (tenant: ${tenantName})` : ''}: ${resetLink}`,
      );
      return;
    }

    await this.transporter.sendMail({
      from: this.config.get<string>('MAIL_FROM'),
      to: email,
      subject: 'Recuperación de contraseña — PosEngine',
      html: `
        <p>Hola,</p>
        <p>Recibimos una solicitud para restablecer tu contraseña${
          tenantName ? ` en <strong>${tenantName}</strong>` : ''
        }.</p>
        <p><a href="${resetLink}">Hacer clic aquí para restablecer tu contraseña</a></p>
        <p>Este enlace expira en 30 minutos. Si no solicitaste esto, ignorá este correo.</p>
      `,
    });
  }

  async sendVerificationEmail(email: string, rawToken: string, tenantName?: string | null) {
    const frontendUrl = this.config.get<string>('FRONTEND_URL');
    const verificationLink = `${frontendUrl}/auth/verify-email?token=${rawToken}`;

    if (!this.transporter) {
      this.logger.log(
        `[DEV] Verification link para ${email}${tenantName ? ` (tenant: ${tenantName})` : ''}: ${verificationLink}`,
      );
      return;
    }

    await this.transporter.sendMail({
      from: this.config.get<string>('MAIL_FROM'),
      to: email,
      subject: 'Verifica tu correo — PosEngine',
      html: `
        <p>Hola,</p>
        <p>Gracias por registrarte${tenantName ? ` en <strong>${tenantName}</strong>` : ''}.</p>
        <p><a href="${verificationLink}">Confirma tu cuenta aquí</a></p>
        <p>Este enlace expira en 24 horas.</p>
      `,
    });
  }
}