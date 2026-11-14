// src/sales/sale.service.ts
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common'
import { performance } from 'node:perf_hooks'
import { PrismaService } from '../../../prisma/prisma.service'
import { StockMovementService } from '../../stock-movement/stock-movement.service'
import { SaleValidationService } from './sale-validation.service'
import { SaleCreditService } from './sale-credit.service'
import { CommercialOperationPolicy } from '../../../common/commercial-operation-policy'
import { CreateSaleDto } from './../dto/create-sale.dto'
import { SaleFilterDto } from './../dto/sale-filter.dto'
import { CashSessionStatus, SaleStatus, PriceType, PaymentStatus, PaymentMethod } from '../../../generated/prisma/enums'
import type { Prisma } from '../../../generated/prisma/client'
import { claimIdempotency, completeIdempotency, findIdempotencyReplay, requireIdempotencyResource } from '../../../common/idempotency'

@Injectable()
export class SaleService {
  private readonly logger = new Logger(SaleService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly stockMovementService: StockMovementService,
    private readonly saleValidationService: SaleValidationService,
    private readonly saleCreditService: SaleCreditService,
  ) {}

  // ── Create ───────────────────────────────────────────────────────────────
  async create(tenantId: string, cashSessionId: string, dto: CreateSaleDto, idempotencyKey?: string) {
    const idempotencyPayload = { cashSessionId, sale: dto }
    const replay = await findIdempotencyReplay(this.prisma, tenantId, 'SALE_CREATE', idempotencyKey, idempotencyPayload)
    if (replay) {
      const id = requireIdempotencyResource(replay, 'SALE')
      const existing = await this.findCreateResult(this.prisma, tenantId, id)
      if (!existing) throw new NotFoundException('La venta original ya no está disponible.')
      return existing
    }
    try {
    const salePaymentMethod = dto.paymentMethod ?? PaymentMethod.CASH
    const hasInitialPayment = (dto.amountPaid ?? 0) > 0
    const initialMethod = dto.initialPaymentMethod
    if (
      salePaymentMethod === PaymentMethod.CREDIT &&
      hasInitialPayment &&
      initialMethod !== PaymentMethod.CASH &&
      initialMethod !== PaymentMethod.TRANSFER
    ) {
      throw new BadRequestException('El abono inicial requiere seleccionar efectivo o transferencia.')
    }
    if (salePaymentMethod === PaymentMethod.CREDIT && !hasInitialPayment && initialMethod) {
      throw new BadRequestException('No se puede indicar un medio de cobro sin un abono inicial.')
    }
    if (salePaymentMethod !== PaymentMethod.CREDIT && initialMethod) {
      throw new BadRequestException('El medio del abono inicial solo aplica a ventas a crédito.')
    }

    // 1. Validar que no haya productId duplicado en el mismo request
    const productIds = dto.items.map((i) => i.productId)
    const uniqueIds = new Set(productIds)
    if (uniqueIds.size !== productIds.length) {
      throw new BadRequestException(
        'No puede haber productos duplicados en la misma venta. Sumá las cantidades en un solo item.',
      )
    }

    // 2. Cargar todos los productos de una sola consulta y validar
    await this.saleValidationService.validateAndFetchProducts(tenantId, dto.items)

    // 3. Calcular total de la venta
    const total = dto.items.reduce(
      (sum, item) => sum + item.quantity * item.unitPrice,
      0,
    )

    // 4. Validar crédito si corresponde
    const customer = await this.saleCreditService.validateCreditLimit(tenantId, dto, total)

    // 5. Ejecutar la transacción
    return this.executeSaleTransaction(tenantId, cashSessionId, dto, customer, total, idempotencyKey, idempotencyPayload)
    } catch (error) {
      const validationReplay = await findIdempotencyReplay(this.prisma, tenantId, 'SALE_CREATE', idempotencyKey, idempotencyPayload)
      if (validationReplay) {
        const id = requireIdempotencyResource(validationReplay, 'SALE')
        const existing = await this.findCreateResult(this.prisma, tenantId, id)
        if (existing) return existing
      }
      throw error
    }
  }

  private findCreateResult(client: Prisma.TransactionClient | PrismaService, tenantId: string, id: string) {
    return client.sale.findFirst({
      where: { id, tenantId },
      include: {
        customer: { select: { id: true, name: true } },
        items: { include: { product: { select: { id: true, name: true, sku: true, unitType: true } } } },
      },
    })
  }

  private async executeSaleTransaction(
    tenantId: string,
    cashSessionId: string,
    dto: CreateSaleDto,
    customer: any,
    total: number,
    idempotencyKey?: string,
    idempotencyPayload?: unknown,
  ) {
    const paymentMethod = dto.paymentMethod ?? PaymentMethod.CASH
    const isCreditSale = paymentMethod === PaymentMethod.CREDIT
    const amountPaid = isCreditSale ? (dto.amountPaid ?? 0) : total
    const remainingBalance = isCreditSale ? Math.max(0, total - amountPaid) : 0

    const paymentStatus =
      remainingBalance <= 0
        ? PaymentStatus.PAID
        : amountPaid > 0
          ? PaymentStatus.PARTIAL
          : PaymentStatus.PENDING

    // Sort items by productId to prevent deadlocks
    const sortedItems = [...dto.items].sort((a, b) => a.productId.localeCompare(b.productId))
    const logPerformance = process.env.POSENGINE_LOG_SALE_PERFORMANCE === 'true'
    const startedAt = logPerformance ? performance.now() : 0
    const stagesMs: Record<string, number> = {}

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const idempotencyClaim = await claimIdempotency(
          tx, tenantId, 'SALE_CREATE', idempotencyKey, idempotencyPayload,
        )
        if (idempotencyClaim && !idempotencyClaim.created) {
          const existingId = requireIdempotencyResource(idempotencyClaim, 'SALE')
          const existing = await this.findCreateResult(tx, tenantId, existingId)
          if (!existing) throw new NotFoundException('La venta original ya no está disponible.')
          return existing
        }

        let transactionCustomer = customer
        if (isCreditSale && customer?.id) {
          const customerLock = await tx.customer.updateMany({
            where: { id: customer.id, tenantId },
            data: { currentDebt: { increment: 0 } },
          })
          if (customerLock.count !== 1) throw new ConflictException('El cliente ya no está disponible para crédito.')
          transactionCustomer = await tx.customer.findFirst({ where: { id: customer.id, tenantId } })
          if (!transactionCustomer || !transactionCustomer.isActive || !transactionCustomer.creditEnabled) {
            throw new ConflictException('El cliente ya no está habilitado para crédito.')
          }
          if (Number(transactionCustomer.currentDebt) + remainingBalance > Number(transactionCustomer.creditLimit)) {
            throw new ConflictException('El límite de crédito disponible cambió; revisá el saldo del cliente antes de confirmar.')
          }
        }
        const activeSession = await tx.cashSession.updateMany({
          where: {
            id: cashSessionId,
            tenantId,
            status: CashSessionStatus.OPEN,
          },
          data: { totalSales: { increment: 0 } },
        })
        if (activeSession.count !== 1) {
          throw new ConflictException('La caja ya está cerrada o no pertenece al negocio actual.')
        }

        let stageStartedAt = logPerformance ? performance.now() : 0
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
        if (logPerformance) stagesMs.saleCreate = performance.now() - stageStartedAt

        if (logPerformance) stageStartedAt = performance.now()
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
        if (logPerformance) stagesMs.itemsAndStock = performance.now() - stageStartedAt

        // Solo lo cobrado en el momento entra a totalSales de la caja
        if (logPerformance) stageStartedAt = performance.now()
        await tx.cashSession.update({
          where: { id: cashSessionId },
          data: { totalSales: { increment: total - remainingBalance } },
        })
        if (logPerformance) stagesMs.cashUpdate = performance.now() - stageStartedAt

        // Registrar deuda y señas/entregas del cliente
        if (logPerformance) stageStartedAt = performance.now()
        await this.saleCreditService.processCreditDebtAndPayments(
          tx,
          tenantId,
          sale.id,
          transactionCustomer,
          remainingBalance,
          amountPaid,
          paymentMethod,
          cashSessionId,
          dto.initialPaymentMethod,
        )
        if (logPerformance) stagesMs.creditAccounting = performance.now() - stageStartedAt

        if (logPerformance) stageStartedAt = performance.now()
        const createdSale = await tx.sale.findUnique({
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
        if (logPerformance) stagesMs.resultRead = performance.now() - stageStartedAt
        await completeIdempotency(tx, tenantId, idempotencyClaim, 'SALE', [sale.id])
        return createdSale
      }, { timeout: 15_000 })
      if (logPerformance) {
        this.logger.log(JSON.stringify({
          event: 'sale.transaction.completed',
          outcome: 'success',
          itemCount: sortedItems.length,
          durationMs: Math.round(performance.now() - startedAt),
          stagesMs: Object.fromEntries(
            Object.entries(stagesMs).map(([stage, duration]) => [stage, Math.round(duration)]),
          ),
        }))
      }
      return result
    } catch (error) {
      this.logger.error(JSON.stringify({
        event: 'sale.transaction.failed',
        itemCount: sortedItems.length,
        errorType: error instanceof Error ? error.name : 'UnknownError',
      }))
      throw error
    }
  }

  // ── FindAll ──────────────────────────────────────────────────────────────
  async findAll(tenantId: string, query: SaleFilterDto) {
    const { search, status, dateFrom, dateTo, cashSessionId, page = 1, limit = 20 } = query
    const skip = (page - 1) * limit

    const where: Prisma.SaleWhereInput = {
      tenantId,
      ...(status && { status }),
      ...(cashSessionId && { cashSessionId }),
      ...(search && {
        OR: [
          { id: { contains: search, mode: 'insensitive' } },
          { customer: { is: { name: { contains: search, mode: 'insensitive' } } } },
        ],
      }),
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
        customerPayments: true,
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
  async cancel(id: string, tenantId: string, actorId: string, reason: string) {
    CommercialOperationPolicy.assertEnabled('SALE_CANCELLATIONS')
    if (!reason?.trim() || reason.trim().length < 5) {
      throw new BadRequestException('Indicá un motivo de corrección de al menos cinco caracteres.')
    }
    return this.prisma.$transaction(async (tx) => {
      const reference = await tx.sale.findFirst({ where: { id, tenantId }, select: { customerId: true } })
      if (!reference) throw new NotFoundException(`Venta con id "${id}" no encontrada`)
      if (reference.customerId) {
        const customerLock = await tx.customer.updateMany({
          where: { id: reference.customerId, tenantId }, data: { currentDebt: { increment: 0 } },
        })
        if (customerLock.count !== 1) throw new NotFoundException('Cliente asociado a la venta no encontrado')
      }
      const locked = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "sales" WHERE "id" = ${id} AND "tenantId" = ${tenantId} FOR UPDATE
      `
      if (locked.length !== 1) throw new NotFoundException(`Venta con id "${id}" no encontrada`)
      const sale = await tx.sale.findFirst({
        where: { id, tenantId },
        include: { cashSession: true, items: true, customerPayments: true, returns: true },
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
      if (sale.returns.length > 0) throw new ConflictException('Una venta con devoluciones debe corregirse mediante el flujo de devoluciones.')
      if (sale.customerPayments.length > 0) {
        throw new ConflictException('No se puede anular una venta con historial de pagos; registrá una devolución y su liquidación financiera.')
      }
      if (Number(sale.total) - Number(sale.remainingBalance) > 0.01) {
        throw new ConflictException('La venta registra dinero recibido. Usá una devolución con su liquidación financiera.')
      }
      const sessionLock = await tx.cashSession.updateMany({
        where: { id: sale.cashSessionId, tenantId, status: CashSessionStatus.OPEN },
        data: { totalSales: { increment: 0 } },
      })
      if (sessionLock.count !== 1) throw new ConflictException('La sesión de caja se cerró durante la anulación.')

      const statusUpdate = await tx.sale.updateMany({
        where: { id, tenantId, status: SaleStatus.COMPLETED },
        data: { status: SaleStatus.CANCELLED },
      })

      if (statusUpdate.count === 0) {
        throw new ConflictException('La venta ya está anulada')
      }
      await tx.saleLifecycleEvent.create({
        data: { tenantId, saleId: id, actorId, action: 'CANCEL', reason: reason.trim() },
      })

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
  async uncancel(id: string, tenantId: string, actorId: string, reason: string) {
    CommercialOperationPolicy.assertEnabled('SALE_RESTORATIONS')
    if (!reason?.trim() || reason.trim().length < 5) {
      throw new BadRequestException('Indicá un motivo de restauración de al menos cinco caracteres.')
    }
    return this.prisma.$transaction(async (tx) => {
      const reference = await tx.sale.findFirst({ where: { id, tenantId }, select: { customerId: true } })
      if (!reference) throw new NotFoundException(`Venta con id "${id}" no encontrada`)
      if (reference.customerId) {
        const customerLock = await tx.customer.updateMany({
          where: { id: reference.customerId, tenantId }, data: { currentDebt: { increment: 0 } },
        })
        if (customerLock.count !== 1) throw new NotFoundException('Cliente asociado a la venta no encontrado')
      }
      const locked = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "sales" WHERE "id" = ${id} AND "tenantId" = ${tenantId} FOR UPDATE
      `
      if (locked.length !== 1) throw new NotFoundException(`Venta con id "${id}" no encontrada`)
      const sale = await tx.sale.findFirst({
        where: { id, tenantId },
        include: {
          cashSession: true,
          returns: true,
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
      const latestEvent = await tx.saleLifecycleEvent.findFirst({
        where: { saleId: id, tenantId }, orderBy: { createdAt: 'desc' },
      })
      if (!latestEvent || latestEvent.action !== 'CANCEL') {
        throw new ConflictException('La venta no tiene una anulación auditable compatible con restauración directa.')
      }

      // Validar inmutabilidad de sesión de caja cerrada
      if (sale.cashSession.status === CashSessionStatus.CLOSED) {
        throw new BadRequestException('No se puede restaurar una venta de una sesión de caja ya cerrada.')
      }
      if (sale.returns.length > 0) throw new ConflictException('Una venta con devoluciones no puede restaurarse directamente.')
      const sessionLock = await tx.cashSession.updateMany({
        where: { id: sale.cashSessionId, tenantId, status: CashSessionStatus.OPEN },
        data: { totalSales: { increment: 0 } },
      })
      if (sessionLock.count !== 1) throw new ConflictException('La sesión de caja se cerró durante la restauración.')

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
      await tx.saleLifecycleEvent.create({
        data: { tenantId, saleId: id, actorId, action: 'RESTORE', reason: reason.trim() },
      })

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
