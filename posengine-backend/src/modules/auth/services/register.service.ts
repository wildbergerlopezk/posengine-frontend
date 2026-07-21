import { Injectable, ConflictException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import slugify from 'slugify';
import { PrismaService } from '../../../prisma/prisma.service';
import { UserService } from '../../user/user.service';
import { TokenService } from './token.service';
import { RegisterDto } from '../dto/register.dto';
import { BCRYPT_SALT_ROUNDS } from '../constants/auth.constants';

@Injectable()
export class RegisterService {
  constructor(
    private readonly userService: UserService,
    private readonly prisma: PrismaService,
    private readonly tokenService: TokenService,
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
      },
    };
  }
}
