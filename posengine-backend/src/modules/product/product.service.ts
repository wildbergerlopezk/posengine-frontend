import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductFilterDto } from './dto/product-filter.dto';
import { Prisma } from '../../generated/prisma/client';

@Injectable()
export class ProductService {
  constructor(private readonly prisma: PrismaService) { }
  
  private async generateSku(tenantId: string, categoryId: string): Promise<string> {
    const category = await this.prisma.category.findUnique({
      where: { id: categoryId },
      select: { name: true },
    });

    const prefix = (category?.name ?? 'PRD')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // quita tildes
      .replace(/[^a-zA-Z]/g, '')
      .slice(0, 3)
      .toUpperCase();

    const count = await this.prisma.product.count({ where: { tenantId } });
    const sequential = String(count + 1).padStart(5, '0');

    return `${prefix}-${sequential}`;
  }

  async create(tenantId: string, dto: CreateProductDto) {
    // Verificar que la categoría pertenezca al tenant
    const category = await this.prisma.category.findFirst({
      where: { id: dto.categoryId, tenantId },
    });
    if (!category) {
      throw new NotFoundException(`Categoría con id "${dto.categoryId}" no encontrada`);
    }

    // Verificar subcategoría si se provee
    if (dto.subcategoryId) {
      const subcategory = await this.prisma.subcategory.findFirst({
        where: { id: dto.subcategoryId, categoryId: dto.categoryId },
      });
      if (!subcategory) {
        throw new NotFoundException(`Subcategoría con id "${dto.subcategoryId}" no encontrada`);
      }
    }

    // Verificar unicidad de nombre
    const nameConflict = await this.prisma.product.findFirst({
      where: { name: dto.name, tenantId },
    });
    if (nameConflict) {
      throw new ConflictException(`Ya existe un producto con el nombre "${dto.name}"`);
    }

    // Verificar unicidad de barcode si se provee
    if (dto.barcode) {
      const barcodeConflict = await this.prisma.product.findFirst({
        where: { barcode: dto.barcode, tenantId },
      });
      if (barcodeConflict) {
        throw new ConflictException(`Ya existe un producto con el código de barras "${dto.barcode}"`);
      }
    }

    // Generar o validar SKU
    const sku = dto.sku ?? (await this.generateSku(tenantId, dto.categoryId));

    if (dto.sku) {
      const skuConflict = await this.prisma.product.findFirst({
        where: { sku, tenantId },
      });
      if (skuConflict) {
        throw new ConflictException(`Ya existe un producto con el SKU "${sku}"`);
      }
    }

    return this.prisma.product.create({
      data: {
        tenantId,
        categoryId: dto.categoryId,
        subcategoryId: dto.subcategoryId,
        name: dto.name,
        description: dto.description,
        sku,
        barcode: dto.barcode,
        imageUrl: dto.imageUrl,
        price: dto.price,
        cost: dto.cost,
        taxRate: dto.taxRate ?? 0,
        stock: dto.stock ?? 0,
        stockMinimum: dto.stockMinimum ?? 0,
        unit: dto.unit,
        isActive: dto.isActive ?? true,
      },
      include: {
        category: { select: { id: true, name: true } },
        subcategory: { select: { id: true, name: true } },
      },
    });
  }

  async findAll(tenantId: string, query: ProductFilterDto) {
    const { search, categoryId, subcategoryId, isActive, lowStock, unit, limit, skip, page } = query;

    const where: Prisma.ProductWhereInput = {
      tenantId,
      ...(isActive !== undefined && { isActive }),
      ...(categoryId && { categoryId }),
      ...(subcategoryId && { subcategoryId }),
      ...(unit && { unit }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: Prisma.QueryMode.insensitive } },
          { sku: { contains: search, mode: Prisma.QueryMode.insensitive } },
          { barcode: { contains: search, mode: Prisma.QueryMode.insensitive } },
          { description: { contains: search, mode: Prisma.QueryMode.insensitive } },
        ],
      }),
    };

    const [items, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        include: {
          category: { select: { id: true, name: true } },
          subcategory: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip,
      }),
      this.prisma.product.count({ where }),
    ]);

    // lowStock: stock <= stockMinimum — se filtra en memoria porque Prisma no soporta
    // comparación entre dos columnas en el mismo modelo sin raw queries
    const data = lowStock ? items.filter((p) => p.stock <= p.stockMinimum) : items;

    return {
      items: data,
      total: lowStock ? data.length : total,
      page,
      limit,
    };
  }

  async findOne(id: string, tenantId: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, tenantId },
      include: {
        category: { select: { id: true, name: true } },
        subcategory: { select: { id: true, name: true } },
      },
    });

    if (!product) {
      throw new NotFoundException(`Producto con id "${id}" no encontrado`);
    }

    return product;
  }

  async findByBarcode(barcode: string, tenantId: string) {
    const product = await this.prisma.product.findFirst({
      where: { barcode, tenantId, isActive: true },
      include: {
        category: { select: { id: true, name: true } },
        subcategory: { select: { id: true, name: true } },
      },
    });

    if (!product) {
      throw new NotFoundException(`Producto con código de barras "${barcode}" no encontrado`);
    }

    return product;
  }

  async update(id: string, tenantId: string, dto: UpdateProductDto) {
    await this.findOne(id, tenantId);

    if (dto.name) {
      const conflict = await this.prisma.product.findFirst({
        where: { name: dto.name, tenantId, NOT: { id } },
      });
      if (conflict) {
        throw new ConflictException(`Ya existe otro producto con el nombre "${dto.name}"`);
      }
    }

    if (dto.barcode) {
      const conflict = await this.prisma.product.findFirst({
        where: { barcode: dto.barcode, tenantId, NOT: { id } },
      });
      if (conflict) {
        throw new ConflictException(`Ya existe otro producto con el código de barras "${dto.barcode}"`);
      }
    }

    if (dto.sku) {
      const conflict = await this.prisma.product.findFirst({
        where: { sku: dto.sku, tenantId, NOT: { id } },
      });
      if (conflict) {
        throw new ConflictException(`Ya existe otro producto con el SKU "${dto.sku}"`);
      }
    }

    return this.prisma.product.update({
      where: { id },
      data: {
        ...(dto.categoryId && { categoryId: dto.categoryId }),
        ...(dto.subcategoryId !== undefined && { subcategoryId: dto.subcategoryId }),
        ...(dto.name && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.sku && { sku: dto.sku }),
        ...(dto.barcode !== undefined && { barcode: dto.barcode }),
        ...(dto.imageUrl !== undefined && { imageUrl: dto.imageUrl }),
        ...(dto.price !== undefined && { price: dto.price }),
        ...(dto.cost !== undefined && { cost: dto.cost }),
        ...(dto.taxRate !== undefined && { taxRate: dto.taxRate }),
        ...(dto.stock !== undefined && { stock: dto.stock }),
        ...(dto.stockMinimum !== undefined && { stockMinimum: dto.stockMinimum }),
        ...(dto.unit && { unit: dto.unit }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
      include: {
        category: { select: { id: true, name: true } },
        subcategory: { select: { id: true, name: true } },
      },
    });
  }

  async deactivate(id: string, tenantId: string) {
    await this.findOne(id, tenantId);

    return this.prisma.product.update({
      where: { id },
      data: { isActive: false },
      select: { id: true, name: true, isActive: true },
    });
  }

  async activate(id: string, tenantId: string) {
    await this.findOne(id, tenantId);

    return this.prisma.product.update({
      where: { id },
      data: { isActive: true },
      select: { id: true, name: true, isActive: true },
    });
  }

  async remove(id: string, tenantId: string) {
    await this.findOne(id, tenantId);

    await this.prisma.product.delete({ where: { id } });

    return { message: 'Producto eliminado correctamente' };
  }
}