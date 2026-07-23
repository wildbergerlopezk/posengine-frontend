import { Injectable, ConflictException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import slugify from 'slugify';
import { PrismaService } from '../../../prisma/prisma.service';
import { UserService } from '../../user/user.service';
import { TokenService } from './token.service';
import { EmailVerificationService } from './email-verification.service';
import { RegisterDto } from '../dto/register.dto';
import { BCRYPT_SALT_ROUNDS } from '../constants/auth.constants';

@Injectable()
export class RegisterService {
  constructor(
    private readonly userService: UserService,
    private readonly prisma: PrismaService,
    private readonly tokenService: TokenService,
    private readonly emailVerificationService: EmailVerificationService,
  ) {}

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

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_SALT_ROUNDS);

    const { tenant, user } = await this.prisma.$transaction(async (tx) => {
      // SAAS BILLING HOOK:
      // This is the place to attach a new tenant to a paid plan, trial period,
      // or initial billing setup when subscription payments are implemented.
      // Buscar o crear plan "free" de manera robusta
      let freePlan = await tx.plan.findUnique({
        where: { slug: 'free' },
      });

      if (!freePlan) {
        freePlan = await tx.plan.create({
          data: {
            name: 'Free Plan',
            slug: 'free',
            price: 0,
          },
        });
      }

      const createdTenant = await tx.tenant.create({
        data: {
          name: dto.tenantName,
          slug,
          subscription: {
            create: {
              planId: freePlan.id,
              status: 'ACTIVE',
            },
          },
        },
      });

      const createdUser = await tx.user.create({
        data: {
          name: dto.name,
          email: dto.email.toLowerCase(),
          password: passwordHash,
          tenantId: createdTenant.id,
          active: true,
          emailVerified: false,
        },
      });

      return { tenant: createdTenant, user: createdUser };
    });

    await this.emailVerificationService.sendVerificationEmail(user.id);

    const accessToken = this.tokenService.signAccessToken(user);
    const refreshToken = await this.tokenService.issueRefreshToken(user.id);

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        tenantId: user.tenantId,
        tenantName: tenant.name,
        emailVerified: user.emailVerified,
      },
    };
  }
}
