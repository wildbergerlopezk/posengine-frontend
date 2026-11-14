import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService} from '../../prisma/prisma.service';
import { StockMovementType, StockMovementSourceType } from '../../../src/generated/prisma/enums';
import { CreateManualStockMovementDto } from './dto/create-stock-movement.dto';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { StockMovementFilterDto } from './dto/stock-movement-filter.dto';
import type { Prisma } from '../../generated/prisma/client';

@Injectable()
export class StockMovementService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Called internally when a product is created with initial stock ─────────
  async registerInitial(
    tenantId: string,
    productId: string,
    quantity: number,
  ) {
    if (quantity <= 0) return null;

    return this.prisma.stockMovement.create({
      data: {
        tenantId,
        productId,
        type: StockMovementType.INITIAL,
        quantity,
        before: 0,
        after: quantity,
        referenceId: null,
        notes: 'Stock inicial del producto',
        sourceType: StockMovementSourceType.MANUAL, // INITIAL movements use MANUAL as sourceType
      },
    });
  }

  // ── Called internally when a purchase is received ─────────────────────────
  async registerPurchase(
    tenantId: string,
    productId: string,
    quantity: number,
    referenceId: string,   // purchaseItemId
    tx?: Prisma.TransactionClient,
  ) {
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new BadRequestException(
        `Cantidad inválida para la compra del producto "${productId}"`,
      )
    }

    const prismaClient = tx ?? this.prisma;

    const updatedProducts = await prismaClient.$queryRaw<Array<{ stock: number }>>`
      UPDATE "products"
      SET "stock" = "stock" + ${quantity}, "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${productId} AND "tenantId" = ${tenantId}
      RETURNING "stock"
    `;
    if (updatedProducts.length === 0) throw new NotFoundException(`Producto "${productId}" no encontrado`);

    const after = Number(updatedProducts[0].stock);
    const before = after - quantity;

    const movement = await prismaClient.stockMovement.create({
      data: {
        tenantId,
        productId,
        type: StockMovementType.PURCHASE,
        quantity,
        before,
        after,
        referenceId,
        notes: 'Ingreso por compra',
        sourceType: StockMovementSourceType.PURCHASE,
      },
    });

    return movement;
  }

  // ── Called internally when a purchase is cancelled ────────────────────────
  async registerPurchaseCancellation(
    tenantId: string,
    productId: string,
    quantity: number,
    referenceId: string, // purchaseItemId
    tx?: Prisma.TransactionClient,
  ) {
    const prismaClient = tx ?? this.prisma;

    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new BadRequestException('La cantidad a revertir debe ser mayor a cero.');
    }

    const updatedProducts = await prismaClient.$queryRaw<Array<{ stock: number }>>`
      UPDATE "products"
      SET "stock" = "stock" - ${quantity}, "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${productId}
        AND "tenantId" = ${tenantId}
        AND "stock" >= ${quantity}
      RETURNING "stock"
    `;
    if (updatedProducts.length === 0) {
      const product = await prismaClient.product.findFirst({
        where: { id: productId, tenantId },
        select: { stock: true },
      });
      if (!product) throw new NotFoundException(`Producto "${productId}" no encontrado`);
      throw new BadRequestException(
        `No se puede cancelar la compra. Stock disponible: ${product.stock}, solicitado: ${quantity}.`,
      );
    }

    const after = Number(updatedProducts[0].stock);
    const before = after + quantity;

    const movement = await prismaClient.stockMovement.create({
      data: {
        tenantId,
        productId,
        type: StockMovementType.MANUAL,
        quantity: -quantity,
        before,
        after,
        referenceId,
        notes: 'Cancelación de compra',
        sourceType: StockMovementSourceType.MANUAL,
      },
    });

    return movement;
  }

  async registerSale(
    tenantId: string,
    productId: string,
    quantity: number,
    referenceId: string, // saleItemId
    tx?: Prisma.TransactionClient,
  ) {
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new BadRequestException('La cantidad a descontar debe ser mayor a cero.');
    }

    // Mantener atomicidad para llamadas directas; SaleService ya pasa su transacción.
    if (!tx) {
      return this.prisma.$transaction((transaction) =>
        this.registerSale(tenantId, productId, quantity, referenceId, transaction),
      );
    }

    // El descuento condicional serializa ventas concurrentes en PostgreSQL y
    // mantiene updatedAt sincronizado con las escrituras de Prisma.
    const updatedProducts = await tx.$queryRaw<Array<{ stock: number }>>`
      UPDATE "products"
      SET "stock" = "stock" - ${quantity}, "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${productId}
        AND "tenantId" = ${tenantId}
        AND "isActive" = TRUE
        AND "stock" >= ${quantity}
      RETURNING "stock"
    `;

    if (updatedProducts.length === 0) {
      const product = await tx.product.findFirst({
        where: { id: productId, tenantId },
        select: { stock: true, isActive: true, name: true },
      });
      if (!product) throw new NotFoundException(`Producto "${productId}" no encontrado`);
      if (!product.isActive) {
        throw new BadRequestException(`El producto "${product.name}" está inactivo y no puede venderse.`);
      }
      throw new BadRequestException(
        `Stock insuficiente para "${product.name}". Disponible: ${product.stock}, solicitado: ${quantity}.`,
      );
    }

    const after = Number(updatedProducts[0].stock);
    const before = after + quantity;

    const movement = await tx.stockMovement.create({
      data: {
        tenantId,
        productId,
        type: StockMovementType.SALE,
        quantity: -quantity,
        before,
        after,
        referenceId,
        notes: 'Venta',
        sourceType: StockMovementSourceType.SALE,
      },
    });

    return movement;
  }

  // ── Called internally when a sale is cancelled ────────────────────────────
  async registerSaleCancellation(
    tenantId: string,
    productId: string,
    quantity: number,
    referenceId: string, // saleItemId
    tx?: Prisma.TransactionClient,
  ) {
    const prismaClient = tx ?? this.prisma;

    const product = await prismaClient.product.findFirst({
      where: { id: productId, tenantId },
      select: { stock: true },
    });

    if (!product)
      throw new NotFoundException(`Producto "${productId}" no encontrado`);

    const before = product.stock;
    const after = before + quantity;

    const movement = await prismaClient.stockMovement.create({
      data: {
        tenantId,
        productId,
        type: StockMovementType.MANUAL,
        quantity,
        before,
        after,
        referenceId,
        notes: 'Cancelación de venta',
        sourceType: StockMovementSourceType.MANUAL,
      },
    });

    await prismaClient.product.update({
      where: { id: productId },
      data: { stock: after },
    });

    return movement;
  }

  // ── Manual adjustment (add or subtract) ───────────────────────────────────
  async registerManual(
    tenantId: string,
    dto: CreateManualStockMovementDto,
  ) {
    if (dto.type !== StockMovementType.MANUAL) {
      throw new BadRequestException(
        'Este endpoint solo acepta movimientos de tipo MANUAL',
      );
    }

    const product = await this.prisma.product.findFirst({
      where: { id: dto.productId, tenantId },
      select: { id: true, stock: true, name: true },
    });

    if (!product) {
      throw new NotFoundException(`Producto con id "${dto.productId}" no encontrado`);
    }

    const before = product.stock;
    const after = before + dto.quantity;

    if (after < 0) {
      throw new BadRequestException(
        `El ajuste dejaría el stock en ${after}. Stock actual: ${before}`,
      );
    }

    const [movement] = await this.prisma.$transaction([
      this.prisma.stockMovement.create({
        data: {
          tenantId,
          productId: dto.productId,
          type: StockMovementType.MANUAL,
          quantity: dto.quantity,
          before,
          after,
          referenceId: null,
          notes: dto.notes ?? 'Ajuste manual',
          sourceType: StockMovementSourceType.MANUAL,
        },
      }),
      this.prisma.product.update({
        where: { id: dto.productId },
        data: { stock: after },
      }),
    ]);

    return {
      ...movement,
      product: { id: product.id, name: product.name },
    };
  }

  // ── Get movements for a product ────────────────────────────────────────────
  async findByProduct(
    productId: string,
    tenantId: string,
    query: PaginationQueryDto,
  ) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, tenantId },
    });

    if (!product) {
      throw new NotFoundException(`Producto con id "${productId}" no encontrado`);
    }

    const { limit, skip, page } = query;

    const [items, total] = await Promise.all([
      this.prisma.stockMovement.findMany({
        where: { productId, tenantId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip,
      }),
      this.prisma.stockMovement.count({ where: { productId, tenantId } }),
    ]);

    return { items, total, page, limit };
  }

  // ── Get all movements for tenant ───────────────────────────────────────────
  async findAll(tenantId: string, query: StockMovementFilterDto) {
    const { limit, skip, page, search, type, dateFrom, dateTo } = query;

    const where: Prisma.StockMovementWhereInput = {
      tenantId,
      ...(type && { type }),
      ...(search && {
        OR: [
          { product: { name: { contains: search, mode: 'insensitive' } } },
          { product: { sku: { contains: search, mode: 'insensitive' } } },
          { notes: { contains: search, mode: 'insensitive' } },
        ],
      }),
      ...((dateFrom || dateTo) && {
        createdAt: {
          ...(dateFrom && { gte: new Date(dateFrom) }),
          ...(dateTo && { lte: new Date(`${dateTo}T23:59:59.999Z`) }),
        },
      }),
    };

    const [items, total] = await Promise.all([
      this.prisma.stockMovement.findMany({
        where,
        include: {
          product: { select: { id: true, name: true, sku: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip,
      }),
      this.prisma.stockMovement.count({ where }),
    ]);

    return { items, total, page, limit };
  }
}
