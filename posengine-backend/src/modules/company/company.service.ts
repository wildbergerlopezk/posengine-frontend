import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

@Injectable()
export class CompanyService {
  constructor(private readonly prisma: PrismaService) { }

  async create(tenantId: string, dto: CreateCompanyDto) {
    const existingSlug = await this.prisma.company.findUnique({
      where: { slug: dto.slug },
    });
    if (existingSlug) {
      throw new ConflictException(`Ya existe una empresa con el slug "${dto.slug}"`);
    }

    const existingTaxId = await this.prisma.company.findUnique({
      where: { taxId: dto.taxId },
    });
    if (existingTaxId) {
      throw new ConflictException(
        `Ya existe una empresa con el RUC/identificación tributaria "${dto.taxId}"`,
      );
    }

    return this.prisma.company.create({
      data: {
        slug: dto.slug,
        active: dto.active ?? true,
        legalName: dto.legalName,
        tradeName: dto.tradeName,
        taxId: dto.taxId,
        address: dto.address,
        city: dto.city,
        state: dto.state,
        phone: dto.phone,
        email: dto.email,
        economicActivity: dto.economicActivity,
        emissionPoint: dto.emissionPoint ?? '001-001',
        logoUrl: dto.logoUrl,
        stampNumber: dto.stampNumber,
        stampStartDate: dto.stampStartDate ? new Date(dto.stampStartDate) : null,
        tenants: {
          connect: { id: tenantId },
        },
      },
    });
  }

  async findAll(tenantId: string, query: PaginationQueryDto) {
    const { limit = 20, skip = 0 } = query;

    const [items, total] = await Promise.all([
      this.prisma.company.findMany({
        where: {
          tenants: {
            some: { id: tenantId },
          },
        },
        take: limit,
        skip: skip,
      }),
      this.prisma.company.count({
        where: {
          tenants: {
            some: { id: tenantId },
          },
        },
      }),
    ]);

    return {
      items,
      total,
      page: query.page,
      limit: query.limit,
    };
  }

  async findOne(id: string, tenantId: string) {
    const company = await this.prisma.company.findFirst({
      where: {
        id,
        tenants: {
          some: { id: tenantId },
        },
      },
    });

    if (!company) {
      throw new NotFoundException(`Empresa con id "${id}" no encontrada o no pertenece al inquilino`);
    }

    return company;
  }

  async update(id: string, tenantId: string, dto: UpdateCompanyDto) {
    await this.findOne(id, tenantId);

    if (dto.slug) {
      const conflictSlug = await this.prisma.company.findFirst({
        where: {
          slug: dto.slug,
          NOT: { id },
        },
      });
      if (conflictSlug) {
        throw new ConflictException(`Ya existe una empresa con el slug "${dto.slug}"`);
      }
    }

    if (dto.taxId) {
      const conflictTaxId = await this.prisma.company.findFirst({
        where: {
          taxId: dto.taxId,
          NOT: { id },
        },
      });
      if (conflictTaxId) {
        throw new ConflictException(
          `Ya existe una empresa con el RUC/identificación tributaria "${dto.taxId}"`,
        );
      }
    }

    const updateData: any = { ...dto };
    if (dto.stampStartDate) {
      updateData.stampStartDate = new Date(dto.stampStartDate);
    }

    return this.prisma.company.update({
      where: { id },
      data: updateData,
    });
  }

  async remove(id: string, tenantId: string) {
    const company = await this.prisma.company.findFirst({
      where: {
        id,
        tenants: {
          some: { id: tenantId },
        },
      },
      include: {
        tenants: true,
      },
    });

    if (!company) {
      throw new NotFoundException(`Empresa con id "${id}" no encontrada o no pertenece al inquilino`);
    }

    // Disasociar la empresa del tenant actual
    await this.prisma.company.update({
      where: { id },
      data: {
        tenants: {
          disconnect: { id: tenantId },
        },
      },
    });

    // Si la empresa ya no está asociada a ningún otro tenant, podemos eliminarla
    if (company.tenants.length <= 1) {
      await this.prisma.company.delete({
        where: { id },
      });
    }

    return { message: 'Empresa eliminada correctamente' };
  }
}
