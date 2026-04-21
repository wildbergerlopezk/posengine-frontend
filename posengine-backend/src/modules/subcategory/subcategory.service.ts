import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateSubcategoryDto } from './dto/create-subcategory.dto';
import { UpdateSubcategoryDto } from './dto/update-subcategory.dto';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

@Injectable()
export class SubcategoryService {
  constructor(private readonly prisma: PrismaService) { }

  async create(tenantId: string, dto: CreateSubcategoryDto) {
    const category = await this.prisma.category.findFirst({
      where: { id: dto.categoryId, tenantId },
    });

    if (!category) {
      throw new NotFoundException(
        `Categoría con id "${dto.categoryId}" no encontrada o no pertenece a este tenant`,
      );
    }

    const existing = await this.prisma.subcategory.findUnique({
      where: { name_tenantId: { name: dto.name, tenantId } },
    });

    if (existing) {
      throw new ConflictException(
        `Ya existe una subcategoría con el nombre "${dto.name}"`,
      );
    }

    return this.prisma.subcategory.create({
      data: {
        name: dto.name,
        categoryId: dto.categoryId,
        tenantId,
      },
    });
  }

  async findAll(tenantId: string, query: PaginationQueryDto) {
    const { limit, skip } = query;

    const [items, total] = await Promise.all([
      this.prisma.subcategory.findMany({
        where: { tenantId },
        include: { category: true },
        orderBy: { name: 'asc' },
        take: limit,
        skip: skip,
      }),
      this.prisma.subcategory.count({ where: { tenantId } }),
    ]);

    return {
      items,
      total,
      page: query.page,
      limit: query.limit,
    };
  }

  async findOne(id: string, tenantId: string) {
    const subcategory = await this.prisma.subcategory.findFirst({
      where: { id, tenantId },
      include: { category: true },
    });

    if (!subcategory) {
      throw new NotFoundException(`Subcategoría con id "${id}" no encontrada`);
    }

    return subcategory;
  }

  async update(id: string, tenantId: string, dto: UpdateSubcategoryDto) {
    const subcategory = await this.findOne(id, tenantId);

    if (dto.name) {
      const conflict = await this.prisma.subcategory.findFirst({
        where: {
          name: dto.name,
          tenantId,
          NOT: { id },
        },
      });

      if (conflict) {
        throw new ConflictException(
          `Ya existe una subcategoría con el nombre "${dto.name}"`,
        );
      }
    }

    if (dto.categoryId) {
      const category = await this.prisma.category.findFirst({
        where: { id: dto.categoryId, tenantId },
      });

      if (!category) {
        throw new NotFoundException(
          `Categoría con id "${dto.categoryId}" no encontrada`,
        );
      }
    }

    return this.prisma.subcategory.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: string, tenantId: string) {
    const subcategory = await this.findOne(id, tenantId);

    const productCount = await this.prisma.product.count({
      where: { subcategoryId: id },
    });

    if (productCount > 0) {
      throw new ConflictException(
        'No se puede eliminar una subcategoría que tiene productos asociados',
      );
    }

    await this.prisma.subcategory.delete({ where: { id } });

    return { message: 'Subcategoría eliminada correctamente' };
  }
}
