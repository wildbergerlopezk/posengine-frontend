import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { SupplierFilterDto } from './dto/supplier-filter.dto';
import { Prisma } from '../../generated/prisma/client';

@Injectable()
export class SupplierService {
  constructor(private readonly prisma: PrismaService) {}

  async create(tenantId: string, dto: CreateSupplierDto) {
    const existing = await this.prisma.supplier.findFirst({
      where: { name: dto.name, tenantId },
    });

    if (existing) {
      throw new ConflictException(
        `Ya existe un proveedor con el nombre "${dto.name}"`,
      );
    }

    return this.prisma.supplier.create({
      data: {
        ...dto,
        tenantId,
      },
    });
  }

  async findAll(tenantId: string, query: SupplierFilterDto) {
    const { limit, skip, search } = query;

    const where: Prisma.SupplierWhereInput = {
      tenantId,
    };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { RUC: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
        { address: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.supplier.findMany({
        where,
        orderBy: { name: 'asc' },
        take: limit,
        skip: skip,
      }),
      this.prisma.supplier.count({ where }),
    ]);

    return {
      items,
      total,
      page: query.page,
      limit: query.limit,
    };
  }

  async findOne(id: string, tenantId: string) {
    const supplier = await this.prisma.supplier.findFirst({
      where: { id, tenantId },
    });

    if (!supplier) {
      throw new NotFoundException(`Proveedor con id "${id}" no encontrado`);
    }

    return supplier;
  }

  async update(id: string, tenantId: string, dto: UpdateSupplierDto) {
    await this.findOne(id, tenantId);

    if (dto.name) {
      const conflict = await this.prisma.supplier.findFirst({
        where: {
          name: dto.name,
          tenantId,
          NOT: { id },
        },
      });

      if (conflict) {
        throw new ConflictException(
          `Ya existe un proveedor con el nombre "${dto.name}"`,
        );
      }
    }

    return this.prisma.supplier.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: string, tenantId: string) {
    await this.findOne(id, tenantId);

    await this.prisma.supplier.delete({ where: { id } });

    return { message: 'Proveedor eliminado correctamente' };
  }
}
