import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

import { PaginationQueryDto } from '../common/dto/pagination-query.dto';

@Injectable()
export class CategoryService {
  constructor(private readonly prisma: PrismaService) { }

  async create(tenantId: string, dto: CreateCategoryDto) {
    const existing = await this.prisma.category.findUnique({
      where: { name_tenantId: { name: dto.name, tenantId } },
    });

    if (existing) {
      throw new ConflictException(
        `Ya existe una categoría con el nombre "${dto.name}"`,
      );
    }

    return this.prisma.category.create({
      data: { name: dto.name, tenantId },
      include: { subcategories: true },
    });
  }

  async findAll(tenantId: string, query: PaginationQueryDto) {
    const { limit, skip } = query;

    const [items, total] = await Promise.all([
      this.prisma.category.findMany({
        where: { tenantId },
        include: { subcategories: true },
        orderBy: { name: 'asc' },
        take: limit,
        skip: skip,
      }),
      this.prisma.category.count({ where: { tenantId } }),
    ]);

    return {
      items,
      total,
      page: query.page,
      limit: query.limit,
    };
  }

  async findOne(id: string, tenantId: string) {
    const category = await this.prisma.category.findFirst({
      where: { id, tenantId },
      include: { subcategories: true, products: true },
    });

    if (!category) {
      throw new NotFoundException(`Categoría con id "${id}" no encontrada`);
    }

    return category;
  }

  async update(id: string, tenantId: string, dto: UpdateCategoryDto) {
    await this.findOne(id, tenantId);

    if (dto.name) {
      const conflict = await this.prisma.category.findFirst({
        where: {
          name: dto.name,
          tenantId,
          NOT: { id },
        },
      });

      if (conflict) {
        throw new ConflictException(
          `Ya existe una categoría con el nombre "${dto.name}"`,
        );
      }
    }

    return this.prisma.category.update({
      where: { id },
      data: { name: dto.name },
      include: { subcategories: true },
    });
  }

  async remove(id: string, tenantId: string) {
    const category = await this.findOne(id, tenantId);

    if (category.subcategories.length > 0) {
      throw new ConflictException(
        'No se puede eliminar una categoría que tiene subcategorías asociadas',
      );
    }

    if (category.products && category.products.length > 0) {
      throw new ConflictException(
        'No se puede eliminar una categoría que tiene productos asociados',
      );
    }

    await this.prisma.category.delete({ where: { id } });

    return { message: 'Categoría eliminada correctamente' };
  }
}