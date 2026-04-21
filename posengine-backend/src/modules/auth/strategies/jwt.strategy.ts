import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../prisma/prisma.service';
import { UserRole } from '../../../generated/prisma/enums';

export interface JwtPayload {
  sub: string;
  email: string;
  tenantId: string;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  tenantId: string | null;
  role: UserRole;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, tenantId: true, role: true, active: true },
    });

    if (!user) throw new UnauthorizedException('Credenciales inválidas');
    if (!user.active) throw new UnauthorizedException('Cuenta inactiva');

    return {
      id: user.id,
      email: user.email,
      tenantId: user.tenantId,
      role: user.role,
    };
  }
}