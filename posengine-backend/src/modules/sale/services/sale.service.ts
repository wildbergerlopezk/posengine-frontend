// src/sales/sale.service.ts
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { PrismaService } from '../../../prisma/prisma.service'
import { StockMovementService } from '../../stock-movement/stock-movement.service'
import { SaleValidationService } from './sale-validation.service'
import { SaleCreditService } from './sale-credit.service'
import { CreateSaleDto } from './../dto/create-sale.dto'
import { SaleFilterDto } from './../dto/sale-filter.dto'
import { CashSessionStatus, SaleStatus, PriceType, PaymentStatus, PaymentMethod } from '../../../generated/prisma/enums'
import { Prisma } from '../../../generated/prisma/client'

@Injectable()
export class SaleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stockMovementService: StockMovementService,
    private readonly saleValidationService: SaleValidationService,
    private readonly saleCreditService: SaleCreditService,
  ) {}

  // ── Create ───────────────────────────────────────────────────────────────
  async create(tenantId: string, cashSessionId: string, dto: CreateSaleDto) {
    // 1. Validar que no haya productId duplicado en el mismo request
    const productIds = dto.items.map((i) => i.productId)
    const uniqueIds = new Set(productIds)
    if (uniqueIds.size !== productIds.length) {
      throw new BadRequestException(
        'No puede haber productos duplicados en la misma venta. Sumá las cantidades en un solo item.',
      )
    }

    // 2. Cargar todos los productos de una sola consulta y validar
    const products = await this.saleValidationService.validateAndFetchProducts(tenantId, dto.items)

    // 3. Calcular total de la venta
    const total = dto.items.reduce(
      (sum, item) => sum + item.quantity * item.unitPrice,
      0,
    )

    // 4. Validar crédito si corresponde
    const customer = await this.saleCreditService.validateCreditLimit(tenantId, dto, total)

    // 5. Ejecutar la transacción
    return this.executeSaleTransaction(tenantId, cashSessionId, dto, products, customer, total)
  }

  private async executeSaleTransaction(
    tenantId: string,
    cashSessionId: string,
    dto: CreateSaleDto,
    products: any[],
    customer: any,
    total: number,
  ) {
    const paymentMethod = dto.paymentMethod ?? PaymentMethod.CASH
    const amountPaid = dto.amountPaid ?? 0
    const remainingBalance = Math.max(0, total - amountPaid)

    const paymentStatus =
      remainingBalance <= 0
        ? PaymentStatus.PAID
        : amountPaid > 0
          ? PaymentStatus.PARTIAL
          : PaymentStatus.PENDING

    // Sort items by productId to prevent deadlocks
    const sortedItems = [...dto.items].sort((a, b) => a.productId.localeCompare(b.productId))

    return this.prisma.$transaction(async (tx) => {
      const sale = await tx.sale.create({
        data: {
          tenantId,
          cashSessionId,
          customerId: customer?.id,
          total,
          paymentMethod,
          paymentStatus,
          remainingBalance,
        },
      })

      for (const item of sortedItems) {
        const saleItem = await tx.saleItem.create({
          data: {
            saleId: sale.id,
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            priceType: item.priceType ?? PriceType.PUBLIC,
            total: item.quantity * item.unitPrice,
          },
        })

        // Descontar stock y registrar movimiento
        await this.stockMovementService.registerSale(
          tenantId,
          item.productId,
          item.quantity,
          saleItem.id,
          tx,
        )
      }

      // Solo lo cobrado en el momento entra a totalSales de la caja
      await tx.cashSession.update({
        where: { id: cashSessionId },
        data: { totalSales: { increment: total - remainingBalance } },
      })

      // Registrar deuda y señas/entregas del cliente
      await this.saleCreditService.processCreditDebtAndPayments(
        tx,
        tenantId,
        sale.id,
        customer,
        remainingBalance,
        amountPaid,
        paymentMethod,
      )

      return tx.sale.findUnique({
        where: { id: sale.id },
        include: {
          customer: { select: { id: true, name: true } },
          items: {
            include: {
              product: { select: { id: true, name: true, sku: true, unitType: true } },
            },
          },
        },
      })
    })
  }

  // ── FindAll ──────────────────────────────────────────────────────────────
  async findAll(tenantId: string, query: SaleFilterDto) {
    const { status, dateFrom, dateTo, cashSessionId, page = 1, limit = 20 } = query
    const skip = (page - 1) * limit

    const where: Prisma.SaleWhereInput = {
      tenantId,
      ...(status && { status }),
      ...(cashSessionId && { cashSessionId }),
      ...((dateFrom || dateTo) && {
        saleDate: {
          ...(dateFrom && { gte: new Date(dateFrom) }),
          ...(dateTo && { lte: new Date(`${dateTo}T23:59:59.999Z`) }),
        },
      }),
    }

    const [items, total] = await Promise.all([
      this.prisma.sale.findMany({
        where,
        include: {
          customer: { select: { id: true, name: true, documentNumber: true, taxId: true } },
          items: {
            include: {
              product: { select: { id: true, name: true, sku: true, unitType: true } },
            },
          },
        },
        orderBy: { saleDate: 'desc' },
        take: limit,
        skip,
      }),
      this.prisma.sale.count({ where }),
    ])

    return { items, total, page, limit }
  }

  // ── FindOne ──────────────────────────────────────────────────────────────
  async findOne(id: string, tenantId: string) {
    const sale = await this.prisma.sale.findFirst({
      where: { id, tenantId },
      include: {
        customer: true,
        cashSession: {
          select: { id: true, openedAt: true, closedAt: true, status: true },
        },
        items: {
          include: {
            product: {
              select: { id: true, name: true, sku: true, barcode: true, unitType: true },
            },
          },
        },
      },
    })

    if (!sale) {
      throw new NotFoundException(`Venta con id "${id}" no encontrada`)
    }

    return sale
  }

  // ── Cancel ───────────────────────────────────────────────────────────────
  async cancel(id: string, tenantId: string) {
    return this.prisma.$transaction(async (tx) => {
      const sale = await tx.sale.findFirst({
        where: { id, tenantId },
        include: {
          cashSession: true,
          items: true,
        },
      })

      if (!sale) {
        throw new NotFoundException(`Venta con id "${id}" no encontrada`)
      }

      if (sale.status === SaleStatus.CANCELLED) {
        throw new ConflictException('La venta ya está anulada')
      }

      // Validar inmutabilidad de sesión de caja cerrada
      if (sale.cashSession.status === CashSessionStatus.CLOSED) {
        throw new BadRequestException('No se puede anular una venta de una sesión de caja ya cerrada.')
      }

      const statusUpdate = await tx.sale.updateMany({
        where: { id, tenantId, status: SaleStatus.COMPLETED },
        data: { status: SaleStatus.CANCELLED },
      })

      if (statusUpdate.count === 0) {
        throw new ConflictException('La venta ya está anulada')
      }

      // Prevent deadlocks by sorting items deterministically
      const sortedItems = [...sale.items].sort((a, b) => a.productId.localeCompare(b.productId))

      for (const item of sortedItems) {
        await this.stockMovementService.registerSaleCancellation(
          tenantId,
          item.productId,
          item.quantity,
          item.id,
          tx,
        )
      }

      // Revertir deuda de cliente y anular pagos
      await this.saleCreditService.revertCreditDebtAndPayments(tx, tenantId, sale)

      const collectedAmount = Number(sale.total) - Number(sale.remainingBalance)
      const adjustedTotalSales = Math.max(0, Number(sale.cashSession.totalSales) - collectedAmount)
      const cashSessionUpdate: Prisma.CashSessionUpdateInput = {
        totalSales: adjustedTotalSales,
      }

      if (sale.cashSession.closingAmount !== null) {
        const expectedAmount =
          Number(sale.cashSession.openingAmount) +
          adjustedTotalSales -
          Number(sale.cashSession.totalPurchases)

        cashSessionUpdate.expectedAmount = expectedAmount
        cashSessionUpdate.difference =
          Number(sale.cashSession.closingAmount) - expectedAmount
      }

      await tx.cashSession.update({
        where: { id: sale.cashSessionId },
        data: cashSessionUpdate,
      })

      return tx.sale.findUnique({
        where: { id },
        include: {
          cashSession: {
            select: { id: true, openedAt: true, closedAt: true, status: true },
          },
          items: {
            include: {
              product: {
                select: { id: true, name: true, sku: true, barcode: true, unitType: true },
              },
            },
          },
        },
      })
    })
  }

  // ── Uncancel / Restore Sale ──────────────────────────────────────────────
  async uncancel(id: string, tenantId: string) {
    return this.prisma.$transaction(async (tx) => {
      const sale = await tx.sale.findFirst({
        where: { id, tenantId },
        include: {
          cashSession: true,
          items: {
            include: {
              product: true,
            },
          },
        },
      })

      if (!sale) {
        throw new NotFoundException(`Venta con id "${id}" no encontrada`)
      }

      if (sale.status !== SaleStatus.CANCELLED) {
        throw new ConflictException('La venta no está anulada')
      }

      // Validar inmutabilidad de sesión de caja cerrada
      if (sale.cashSession.status === CashSessionStatus.CLOSED) {
        throw new BadRequestException('No se puede restaurar una venta de una sesión de caja ya cerrada.')
      }

      // 1. Validar stock suficiente y que el producto esté activo
      this.saleValidationService.validateStockAndActiveState(sale.items)

      // 2. Restaurar límite de crédito del cliente e incrementar deuda
      await this.saleCreditService.restoreCreditDebtAndPayments(tx, tenantId, sale)

      // 3. Cambiar estado a COMPLETED
      const statusUpdate = await tx.sale.updateMany({
        where: { id, tenantId, status: SaleStatus.CANCELLED },
        data: { status: SaleStatus.COMPLETED },
      })

      if (statusUpdate.count === 0) {
        throw new ConflictException('La venta no está anulada o ya fue modificada')
      }

      // Sort items to prevent deadlocks
      const sortedItems = [...sale.items].sort((a, b) => a.productId.localeCompare(b.productId))

      // 4. Descontar stock y registrar movimientos
      for (const item of sortedItems) {
        await this.stockMovementService.registerSale(
          tenantId,
          item.productId,
          item.quantity,
          item.id,
          tx,
        )
      }

      // 5. Ajustar ventas de la sesión de caja
      const collectedAmount = Number(sale.total) - Number(sale.remainingBalance)
      const adjustedTotalSales = Number(sale.cashSession.totalSales) + collectedAmount
      const cashSessionUpdate: Prisma.CashSessionUpdateInput = {
        totalSales: adjustedTotalSales,
      }

      if (sale.cashSession.closingAmount !== null) {
        const expectedAmount =
          Number(sale.cashSession.openingAmount) +
          adjustedTotalSales -
          Number(sale.cashSession.totalPurchases)

        cashSessionUpdate.expectedAmount = expectedAmount
        cashSessionUpdate.difference =
          Number(sale.cashSession.closingAmount) - expectedAmount
      }

      await tx.cashSession.update({
        where: { id: sale.cashSessionId },
        data: cashSessionUpdate,
      })

      return tx.sale.findUnique({
        where: { id },
        include: {
          cashSession: {
            select: { id: true, openedAt: true, closedAt: true, status: true },
          },
          items: {
            include: {
              product: {
                select: { id: true, name: true, sku: true, barcode: true, unitType: true },
              },
            },
          },
        },
      })
    })
  }

  // ── FindByCashSession ────────────────────────────────────────────────────
  // Útil para mostrar las ventas del día en el resumen de cierre
  async findByCashSession(cashSessionId: string, tenantId: string) {
    const session = await this.prisma.cashSession.findFirst({
      where: { id: cashSessionId, tenantId },
    })
    if (!session) {
      throw new NotFoundException(`Sesión de caja "${cashSessionId}" no encontrada`)
    }

    return this.prisma.sale.findMany({
      where: { cashSessionId, tenantId },
      include: {
        items: {
          include: {
            product: { select: { id: true, name: true, sku: true, unitType: true } },
          },
        },
      },
      orderBy: { saleDate: 'desc' },
    })
  }
}
