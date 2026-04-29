import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreatePurchaseDto } from '../dto/purchase/create-purchase.dto';
import { UpdatePurchaseDto } from '../dto/purchase/update-purchase.dto';
import { PurchaseFilterDto } from '../dto/purchase/purchase-filter.dto';
import { PurchaseStatus } from '../../../generated/prisma/enums';
import { Prisma } from '../../../generated/prisma/client';
import { StockMovementService } from '../../../stock-movement/stock-movement.service';

@Injectable()
export class PurchaseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stockMovementService: StockMovementService,
  ) { }

  async generateInvoiceNumber(tenantId: string): Promise<{ invoiceNumber: string }> {
    let invoiceNumber: string;
    let isUnique = false;

    do {
      const randomNumber = Math.floor(Math.random() * 9_999_999) + 1;
      const paddedNumber = String(randomNumber).padStart(7, '0');
      invoiceNumber = `001-001-${paddedNumber}`;

      const existing = await this.prisma.purchase.findUnique({
        where: { invoiceNumber_tenantId: { invoiceNumber, tenantId } },
      });

      isUnique = !existing;
    } while (!isUnique);

    return { invoiceNumber };
  }

  async create(tenantId: string, dto: CreatePurchaseDto) {
    const existing = await this.prisma.purchase.findUnique({
      where: { invoiceNumber_tenantId: { invoiceNumber: dto.invoiceNumber, tenantId } },
    });

    if (existing) {
      throw new ConflictException(`Ya existe una compra con el número de factura "${dto.invoiceNumber}"`);
    }

    return this.prisma.$transaction(async (tx) => {
      const purchase = await tx.purchase.create({
        data: {
          tenantId,
          supplierId: dto.supplierId,
          invoiceNumber: dto.invoiceNumber,
          purchaseDate: new Date(dto.purchaseDate),
          paymentType: dto.paymentType,
          total: dto.total,
          notes: dto.notes,
          status: PurchaseStatus.RECEIVED, // ← siempre RECEIVED
        },
        include: { supplier: true },
      });

      // Los items se crean y el stock se registra en el mismo acto
      for (const item of dto.items) {
        const purchaseItem = await tx.purchaseItem.create({
          data: {
            purchaseId: purchase.id,
            productId: item.productId,
            quantity: item.quantity,
            unitCost: item.unitCost,
            total: item.quantity * item.unitCost,
          },
        });

        await this.stockMovementService.registerPurchase(
          tenantId,
          item.productId,
          item.quantity,
          purchaseItem.id,
          tx,
        );
      }

      return purchase;
    });
  }

  async findAll(tenantId: string, query: PurchaseFilterDto) {
    const { limit, skip, search, status, paymentType, dateFrom, dateTo } = query;

    const where: Prisma.PurchaseWhereInput = {
      tenantId,
      ...(status && { status }),
      ...(paymentType && { paymentType }),
      ...(search && {
        OR: [
          { invoiceNumber: { contains: search, mode: Prisma.QueryMode.insensitive } },
          { supplier: { name: { contains: search, mode: Prisma.QueryMode.insensitive } } },
          { supplier: { RUC: { contains: search, mode: Prisma.QueryMode.insensitive } } },
        ],
      }),
      ...((dateFrom || dateTo) && {
        purchaseDate: {
          ...(dateFrom && { gte: new Date(dateFrom) }),
          ...(dateTo && { lte: new Date(`${dateTo}T23:59:59.999Z`) }),
        },
      }),
    }

    const [items, total] = await Promise.all([
      this.prisma.purchase.findMany({
        where,
        include: { supplier: true },
        orderBy: { purchaseDate: 'desc' },
        take: limit,
        skip,
      }),
      this.prisma.purchase.count({ where }),
    ]);

    return { items, total, page: query.page, limit: query.limit };
  }

  async findOne(id: string, tenantId: string) {
    const purchase = await this.prisma.purchase.findFirst({
      where: { id, tenantId },
      include: {
        supplier: true,
      },
    });

    if (!purchase) {
      throw new NotFoundException(`Compra con id "${id}" no encontrada`);
    }

    return purchase;
  }

  async update(id: string, tenantId: string, dto: UpdatePurchaseDto) {
    const purchase = await this.findOne(id, tenantId);

    if (purchase.status === PurchaseStatus.CANCELLED) {
      throw new BadRequestException(
        'No se puede modificar una compra cancelada',
      );
    }

    if (dto.invoiceNumber && dto.invoiceNumber !== purchase.invoiceNumber) {
      const conflict = await this.prisma.purchase.findFirst({
        where: {
          invoiceNumber: dto.invoiceNumber,
          tenantId,
          NOT: { id },
        },
      });

      if (conflict) {
        throw new ConflictException(
          `Ya existe una compra con el número de factura "${dto.invoiceNumber}"`,
        );
      }
    }

    return this.prisma.purchase.update({
      where: { id },
      data: {
        ...(dto.invoiceNumber !== undefined && { invoiceNumber: dto.invoiceNumber }),
        ...(dto.supplierId !== undefined && { supplierId: dto.supplierId }),
        ...(dto.purchaseDate && { purchaseDate: new Date(dto.purchaseDate) }),
        ...(dto.paymentType !== undefined && { paymentType: dto.paymentType }),
        ...(dto.total !== undefined && { total: dto.total }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
      },
      include: {
        supplier: true,
      },
    });
  }

  async remove(id: string, tenantId: string) {
    const purchase = await this.findOne(id, tenantId);

    if (purchase.status !== PurchaseStatus.PENDING) {
      throw new BadRequestException(
        'Solo se pueden eliminar compras en estado PENDING',
      );
    }

    await this.prisma.purchase.delete({ where: { id } });

    return { message: 'Compra eliminada correctamente' };
  }

  async markAsReceived(id: string, tenantId: string) {
    const purchase = await this.findOne(id, tenantId);

    if (purchase.status !== PurchaseStatus.PENDING) {
      throw new BadRequestException(
        'Solo se pueden recibir compras en estado PENDING',
      );
    }

    const items = await this.prisma.purchaseItem.findMany({
      where: { purchaseId: id },
    });

    if (items.length === 0) {
      throw new BadRequestException(
        'No se puede recibir una compra sin items',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      for (const item of items) {
        await this.stockMovementService.registerPurchase(
          tenantId,
          item.productId,
          item.quantity,
          item.id,
          tx,
        );
      }

      return tx.purchase.update({
        where: { id },
        data: { status: PurchaseStatus.RECEIVED },
        include: { supplier: true },
      });
    });
  }

  async cancel(id: string, tenantId: string) {
    const purchase = await this.findOne(id, tenantId);

    if (purchase.status === PurchaseStatus.CANCELLED) {
      throw new ConflictException('La compra ya está cancelada');
    }

    return this.prisma.purchase.update({
      where: { id },
      data: { status: PurchaseStatus.CANCELLED },
      include: { supplier: true },
    });
  }
}