import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserRole } from '../../generated/prisma/enums';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';

const USER_MANAGEMENT_ROLES = [UserRole.ADMIN, UserRole.SUPERADMIN];
const USER_SELECT = {
  id: true,
  name: true,
  email: true,
  tenantId: true,
  active: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) { }

  async findById(id: string, actor: AuthenticatedUser) {
    const tenantId = this.requireTenantId(actor);
    const user = await this.prisma.user.findFirst({
      where: { id, tenantId },
      select: USER_SELECT,
    });

    if (!user) throw new NotFoundException(`User with id "${id}" not found`);

    return user;
  }

  async findByEmail(email: string) {
    return this.prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  async update(id: string, dto: UpdateUserDto, actor: AuthenticatedUser) {
    const tenantId = this.requireTenantId(actor);
    try {
      return await this.prisma.user.update({
        where: { id, tenantId },
        data: { name: dto.name },
        select: USER_SELECT,
      });
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException(`User with id "${id}" not found`);
      }
      throw error;
    }
  }

  async assignTenant(
    userId: string,
    destinationTenantId: string,
    actor: AuthenticatedUser,
  ) {
    const actorTenantId = this.requireTenantId(actor);
    if (destinationTenantId !== actorTenantId) {
      throw new ForbiddenException('No se permite reasignar usuarios a otro tenant.');
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: destinationTenantId },
      select: { id: true },
    });
    if (!tenant) {
      throw new NotFoundException(`Tenant with id "${destinationTenantId}" not found`);
    }

    try {
      return await this.prisma.user.update({
        where: { id: userId, tenantId: actorTenantId },
        data: { tenantId: actorTenantId },
        select: USER_SELECT,
      });
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException(`User with id "${userId}" not found`);
      }
      throw error;
    }
  }

  async deactivate(id: string, actor: AuthenticatedUser) {
    const tenantId = this.requireTenantId(actor);
    if (id === actor.id) {
      throw new ConflictException('No podés desactivar tu propio usuario.');
    }

    return this.prisma.$transaction(async (tx) => {
      const target = await tx.user.findFirst({
        where: { id, tenantId },
        select: { id: true, active: true, role: true },
      });

      if (!target) {
        throw new NotFoundException(`User with id "${id}" not found`);
      }

      if (target.active && USER_MANAGEMENT_ROLES.includes(target.role)) {
        const activeAdministrators = await tx.user.count({
          where: {
            tenantId,
            active: true,
            role: { in: USER_MANAGEMENT_ROLES },
          },
        });

        if (activeAdministrators <= 1) {
          throw new ConflictException(
            'No se puede desactivar el último administrador activo del negocio.',
          );
        }
      }

      const updateResult = await tx.user.updateMany({
        where: { id, tenantId, active: true },
        data: { active: false },
      });

      if (updateResult.count === 0) {
        throw new ConflictException('El usuario ya fue desactivado.');
      }

      await tx.refreshToken.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await tx.quickPinDevice.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      });

      const updatedUser = await tx.user.findFirst({
        where: { id, tenantId },
        select: USER_SELECT,
      });

      if (!updatedUser) {
        throw new NotFoundException(`User with id "${id}" not found`);
      }

      return updatedUser;
    }, {
      isolationLevel: 'Serializable',
    });
  }

  private requireTenantId(actor: AuthenticatedUser): string {
    if (!USER_MANAGEMENT_ROLES.includes(actor.role)) {
      throw new ForbiddenException('No tenés permisos para administrar usuarios.');
    }
    if (!actor.tenantId) {
      throw new ForbiddenException('El usuario no tiene un tenant válido asignado.');
    }
    return actor.tenantId;
  }
}
