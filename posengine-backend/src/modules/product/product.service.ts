import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductFilterDto } from './dto/product-filter.dto';
import { Prisma } from '../../generated/prisma/client';
import { StockMovementService } from '../stock-movement/stock-movement.service';
import { StockMovementType, UnitType } from '../../generated/prisma/enums';
import * as fs from 'fs'
import { join } from 'path'

@Injectable()
export class ProductService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stockMovementService: StockMovementService,
  ) { }

  // ── Validación de cantidad según unitType ────────────────────────────────
  // Se exporta como método público para que SaleService y PurchaseService
  // puedan reutilizarlo sin duplicar lógica
  validateQuantity(quantity: number, unitType: UnitType, productName: string) {
    this.validateQuantityForUnit(quantity, unitType, productName, 'La cantidad', false)
  }

  validateStockQuantity(
    quantity: number,
    unitType: UnitType,
    productName: string,
    fieldLabel: string,
  ) {
    this.validateQuantityForUnit(quantity, unitType, productName, fieldLabel, true)
  }

  private validateQuantityForUnit(
    quantity: number,
    unitType: UnitType,
    productName: string,
    fieldLabel: string,
    allowZero: boolean,
  ) {
    if (!Number.isFinite(quantity)) {
      throw new BadRequestException(
        `${fieldLabel} de "${productName}" debe ser un número válido`,
      )
    }

    if (quantity < 0 || (!allowZero && quantity === 0)) {
      const suffix = allowZero ? 'no puede ser negativo' : 'debe ser mayor a 0'
      throw new BadRequestException(`${fieldLabel} de "${productName}" ${suffix}`)
    }

    if (unitType === UnitType.UNIT && !Number.isInteger(quantity)) {
      throw new BadRequestException(
        `"${productName}" usa unidades. ${fieldLabel} no permite decimales (recibido: ${quantity})`,
      )
    }
  }

  // ── SKU generator ────────────────────────────────────────────────────────
  private async generateSku(tenantId: string, categoryId: string): Promise<string> {
    const category = await this.prisma.category.findUnique({
      where: { id: categoryId },
      select: { name: true },
    });

    const prefix = (category?.name ?? 'PRD')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z]/g, '')
      .slice(0, 3)
      .toUpperCase();

    const count = await this.prisma.product.count({ where: { tenantId } });
    const sequential = String(count + 1).padStart(5, '0');

    return `${prefix}-${sequential}`;
  }

  // ── Create ───────────────────────────────────────────────────────────────
  async create(tenantId: string, dto: CreateProductDto) {
    // Validate category
    const category = await this.prisma.category.findFirst({
      where: { id: dto.categoryId, tenantId },
    });
    if (!category) {
      throw new NotFoundException(`Categoría con id "${dto.categoryId}" no encontrada`);
    }

    // Validate subcategory
    if (dto.subcategoryId) {
      const subcategory = await this.prisma.subcategory.findFirst({
        where: { id: dto.subcategoryId, categoryId: dto.categoryId },
      });
      if (!subcategory) {
        throw new NotFoundException(`Subcategoría con id "${dto.subcategoryId}" no encontrada`);
      }
    }

    // Validate supplier
    if (dto.supplierId) {
      const supplier = await this.prisma.supplier.findFirst({
        where: { id: dto.supplierId, tenantId },
      });
      if (!supplier) {
        throw new NotFoundException(`Proveedor con id "${dto.supplierId}" no encontrado`);
      }
    }

    // Unique checks
    const nameConflict = await this.prisma.product.findFirst({
      where: { name: dto.name, tenantId },
    });
    if (nameConflict) {
      throw new ConflictException(`Ya existe un producto con el nombre "${dto.name}"`);
    }

    if (dto.barcode) {
      const barcodeConflict = await this.prisma.product.findFirst({
        where: { barcode: dto.barcode, tenantId },
      });
      if (barcodeConflict) {
        throw new ConflictException(`Ya existe un producto con el código de barras "${dto.barcode}"`);
      }
    }

    const sku = dto.sku ?? (await this.generateSku(tenantId, dto.categoryId));

    if (dto.sku) {
      const skuConflict = await this.prisma.product.findFirst({
        where: { sku, tenantId },
      });
      if (skuConflict) {
        throw new ConflictException(`Ya existe un producto con el SKU "${sku}"`);
      }
    }

    // Validar stock inicial según unitType
    const unitType = dto.unitType ?? UnitType.UNIT
    const initialStock = dto.stock ?? 0
    const stockMinimum = dto.stockMinimum ?? 0
    this.validateStockQuantity(initialStock, unitType, dto.name, 'El stock inicial')
    this.validateStockQuantity(stockMinimum, unitType, dto.name, 'El stock mínimo')

    // Create product
    const product = await this.prisma.product.create({
      data: {
        tenantId,
        categoryId: dto.categoryId,
        subcategoryId: dto.subcategoryId,
        supplierId: dto.supplierId,
        name: dto.name,
        description: dto.description,
        sku,
        barcode: dto.barcode,
        imageUrl: dto.imageUrl,
        price: dto.price,
        wholesalePrice: dto.wholesalePrice ?? 0,
        cost: dto.cost ?? 0,
        stock: initialStock,
        unitType,
        stockMinimum,
        isActive: dto.isActive ?? true,
      },
    });

    await this.stockMovementService.registerInitial(tenantId, product.id, initialStock);

    return this.prisma.product.findUnique({
      where: { id: product.id },
      include: {
        category: { select: { id: true, name: true } },
        subcategory: { select: { id: true, name: true } },
        supplier: { select: { id: true, name: true } },
      },
    });
  }

  // ── FindAll ──────────────────────────────────────────────────────────────
  async findAll(tenantId: string, query: ProductFilterDto) {
    const { search, categoryId, subcategoryId, isActive, lowStock, limit, skip, page } = query;

    const where: Prisma.ProductWhereInput = {
      tenantId,
      ...(isActive !== undefined && { isActive }),
      ...(categoryId && { categoryId }),
      ...(subcategoryId && { subcategoryId }),
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
          supplier: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip,
      }),
      this.prisma.product.count({ where }),
    ]);

    // lowStock: stock <= stockMinimum — filtrado en memoria porque Prisma no soporta
    // comparación entre dos columnas del mismo modelo sin raw queries
    const data = lowStock ? items.filter((p) => p.stock <= p.stockMinimum) : items;

    return {
      items: data,
      total: lowStock ? data.length : total,
      page,
      limit,
    };
  }

  // ── FindOne ──────────────────────────────────────────────────────────────
  async findOne(id: string, tenantId: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, tenantId },
      include: {
        category: { select: { id: true, name: true } },
        subcategory: { select: { id: true, name: true } },
        supplier: { select: { id: true, name: true } },
      },
    });

    if (!product) {
      throw new NotFoundException(`Producto con id "${id}" no encontrado`);
    }

    return product;
  }

  // ── FindByBarcode ────────────────────────────────────────────────────────
  async findByBarcode(barcode: string, tenantId: string) {
    const product = await this.prisma.product.findFirst({
      where: { barcode, tenantId, isActive: true },
      include: {
        category: { select: { id: true, name: true } },
        subcategory: { select: { id: true, name: true } },
        supplier: { select: { id: true, name: true } },
      },
    });

    if (!product) {
      throw new NotFoundException(`Producto con código de barras "${barcode}" no encontrado`);
    }

    return product;
  }

  // ── GetPriceHistory ──────────────────────────────────────────────────────
  async getPriceHistory(productId: string, tenantId: string, page = 1, limit = 10) {
    await this.findOne(productId, tenantId);

    const skip = (page - 1) * limit;

    const where: Prisma.PurchaseItemWhereInput = {
      productId,
      purchase: { tenantId, status: 'RECEIVED' },
    };

    const [items, total] = await Promise.all([
      this.prisma.purchaseItem.findMany({
        where,
        include: {
          purchase: {
            select: {
              invoiceNumber: true,
              purchaseDate: true,
              supplier: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: { purchase: { purchaseDate: 'desc' } },
        take: limit,
        skip,
      }),
      this.prisma.purchaseItem.count({ where }),
    ]);

    return {
      items: items.map((item) => ({
        date: item.purchase.purchaseDate,
        invoiceNumber: item.purchase.invoiceNumber,
        supplier: item.purchase.supplier,
        quantity: item.quantity,
        unitCost: item.unitCost,
      })),
      total,
      page,
      limit,
    };
  }

  // ── Update ───────────────────────────────────────────────────────────────
  async update(
    id: string,
    tenantId: string,
    dto: UpdateProductDto,
    stockNotes?: string,
  ) {
    const current = await this.findOne(id, tenantId)

    // ── UNIQUE VALIDATIONS ────────────────────────────────────────────────
    if (dto.name) {
      const conflict = await this.prisma.product.findFirst({
        where: { name: dto.name, tenantId, NOT: { id } },
      })
      if (conflict) {
        throw new ConflictException(`Ya existe otro producto con el nombre "${dto.name}"`)
      }
    }

    if (dto.barcode) {
      const conflict = await this.prisma.product.findFirst({
        where: { barcode: dto.barcode, tenantId, NOT: { id } },
      })
      if (conflict) {
        throw new ConflictException(`Ya existe otro producto con el código de barras "${dto.barcode}"`)
      }
    }

    if (dto.sku) {
      const conflict = await this.prisma.product.findFirst({
        where: { sku: dto.sku, tenantId, NOT: { id } },
      })
      if (conflict) {
        throw new ConflictException(`Ya existe otro producto con el SKU "${dto.sku}"`)
      }
    }

    if (dto.supplierId) {
      const supplier = await this.prisma.supplier.findFirst({
        where: { id: dto.supplierId, tenantId },
      })
      if (!supplier) {
        throw new NotFoundException(`Proveedor con id "${dto.supplierId}" no encontrado`)
      }
    }

    // ── VALIDACIÓN STOCK ──────────────────────────────────────────────────
    const effectiveUnitType = dto.unitType ?? current.unitType
    const effectiveName = dto.name ?? current.name
    const effectiveStock = dto.stock ?? current.stock
    const effectiveStockMinimum = dto.stockMinimum ?? current.stockMinimum

    this.validateStockQuantity(effectiveStock, effectiveUnitType, effectiveName, 'El stock')
    this.validateStockQuantity(
      effectiveStockMinimum,
      effectiveUnitType,
      effectiveName,
      'El stock mínimo',
    )

    if (dto.imageUrl && current.imageUrl && dto.imageUrl !== current.imageUrl) {
      const oldFilename = current.imageUrl.split('/uploads/')[1]

      if (oldFilename) {
        const filePath = join(process.cwd(), 'uploads', oldFilename)

        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath)
        }
      }
    }

    // ── STOCK CHANGE LOGIC ────────────────────────────────────────────────
    if (dto.stock !== undefined && dto.stock !== current.stock) {
      const delta = dto.stock - current.stock

      await this.stockMovementService.registerManual(tenantId, {
        productId: id,
        type: StockMovementType.MANUAL,
        quantity: delta,
        notes: stockNotes?.trim() || 'Ajuste manual desde edición de producto',
      })

      const { stock: _stock, ...restDto } = dto

      return this.prisma.product.update({
        where: { id },
        data: {
          ...(restDto.categoryId && { categoryId: restDto.categoryId }),
          ...(restDto.subcategoryId !== undefined && {
            subcategoryId: restDto.subcategoryId,
          }),
          supplierId: restDto.supplierId !== undefined ? restDto.supplierId : undefined,
          ...(restDto.name && { name: restDto.name }),
          ...(restDto.description !== undefined && {
            description: restDto.description,
          }),
          ...(restDto.sku && { sku: restDto.sku }),
          ...(restDto.barcode !== undefined && { barcode: restDto.barcode }),
          ...(restDto.imageUrl !== undefined && { imageUrl: restDto.imageUrl }),
          ...(restDto.price !== undefined && { price: restDto.price }),
          ...(restDto.wholesalePrice !== undefined && { wholesalePrice: restDto.wholesalePrice }),
          ...(restDto.cost !== undefined && { cost: restDto.cost }),
          ...(restDto.unitType !== undefined && { unitType: restDto.unitType }),
          ...(restDto.stockMinimum !== undefined && {
            stockMinimum: restDto.stockMinimum,
          }),
          ...(restDto.isActive !== undefined && { isActive: restDto.isActive }),
        },
        include: {
          category: { select: { id: true, name: true } },
          subcategory: { select: { id: true, name: true } },
          supplier: { select: { id: true, name: true } },
        },
      })
    }

    // ── UPDATE NORMAL ─────────────────────────────────────────────────────
    return this.prisma.product.update({
      where: { id },
      data: {
        ...(dto.categoryId && { categoryId: dto.categoryId }),
        ...(dto.subcategoryId !== undefined && {
          subcategoryId: dto.subcategoryId,
        }),
        supplierId: dto.supplierId !== undefined ? dto.supplierId : undefined,
        ...(dto.name && { name: dto.name }),
        ...(dto.description !== undefined && {
          description: dto.description,
        }),
        ...(dto.sku && { sku: dto.sku }),
        ...(dto.barcode !== undefined && { barcode: dto.barcode }),
        ...(dto.imageUrl !== undefined && { imageUrl: dto.imageUrl }),
        ...(dto.price !== undefined && { price: dto.price }),
        ...(dto.wholesalePrice !== undefined && { wholesalePrice: dto.wholesalePrice }),
        ...(dto.cost !== undefined && { cost: dto.cost }),
        ...(dto.unitType !== undefined && { unitType: dto.unitType }),
        ...(dto.stock !== undefined && { stock: dto.stock }),
        ...(dto.stockMinimum !== undefined && {
          stockMinimum: dto.stockMinimum,
        }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
      include: {
        category: { select: { id: true, name: true } },
        subcategory: { select: { id: true, name: true } },
        supplier: { select: { id: true, name: true } },
      },
    })
  }

  // ── Deactivate ───────────────────────────────────────────────────────────
  async deactivate(id: string, tenantId: string) {
    await this.findOne(id, tenantId);

    return this.prisma.product.update({
      where: { id },
      data: { isActive: false },
      select: { id: true, name: true, isActive: true },
    });
  }

  // ── Activate ─────────────────────────────────────────────────────────────
  async activate(id: string, tenantId: string) {
    await this.findOne(id, tenantId);

    return this.prisma.product.update({
      where: { id },
      data: { isActive: true },
      select: { id: true, name: true, isActive: true },
    });
  }

  // ── Remove ───────────────────────────────────────────────────────────────
  async remove(id: string, tenantId: string) {
    await this.findOne(id, tenantId);

    await this.prisma.product.delete({ where: { id } });

    return { message: 'Producto eliminado correctamente' };
  }
}
