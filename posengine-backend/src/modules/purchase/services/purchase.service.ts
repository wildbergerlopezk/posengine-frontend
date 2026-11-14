import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common'

import { PrismaService } from '../../../prisma/prisma.service'
import { CreatePurchaseDto } from '../dto/create-purchase.dto'
import { PurchaseFilterDto } from '../dto/purchase-filter.dto'
import { PurchaseStatus } from '../../../generated/prisma/enums'
import { Prisma } from '../../../generated/prisma/client'
import { StockMovementService } from '../../stock-movement/stock-movement.service'
import { PurchaseValidationService } from './purchase-validation.service'
import { PurchaseDebtService } from './purchase-debt.service'
import { CommercialOperationPolicy } from '../../../common/commercial-operation-policy'
import { CancelPurchaseDto } from '../dto/cancel-purchase.dto'

@Injectable()
export class PurchaseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stockMovementService: StockMovementService,
    private readonly purchaseValidationService: PurchaseValidationService,
    private readonly purchaseDebtService: PurchaseDebtService,
  ) {}

  async generateInvoiceNumber(tenantId: string): Promise<{ invoiceNumber: string }> {
    let invoiceNumber: string
    let isUnique = false

    do {
      const randomNumber = Math.floor(Math.random() * 9_999_999) + 1
      const paddedNumber = String(randomNumber).padStart(7, '0')
      invoiceNumber = `001-001-${paddedNumber}`

      const existing = await this.prisma.purchase.findUnique({
        where: {
          invoiceNumber_tenantId: {
            invoiceNumber,
            tenantId,
          },
        },
      })

      isUnique = !existing
    } while (!isUnique)

    return { invoiceNumber }
  }

  async create(tenantId: string, cashSessionId: string, dto: CreatePurchaseDto) {
    // 1. Validar reglas de negocio utilizando el validador
    const productIds = await this.purchaseValidationService.validateCreatePurchase(tenantId, dto)

    // 2. Ordenar items para evitar deadlocks
    const sortedItems = [...dto.items].sort((a, b) => a.productId.localeCompare(b.productId))

    return this.prisma.$transaction(async (tx) => {
      const openSession = await tx.cashSession.updateMany({
        where: { id: cashSessionId, tenantId, status: 'OPEN' },
        data: { totalSales: { increment: 0 } },
      })
      if (openSession.count !== 1) {
        throw new ConflictException('La sesión de caja indicada no existe, no pertenece a este negocio o ya está cerrada.')
      }

      const purchase = await tx.purchase.create({
        data: {
          tenantId,
          cashSessionId,
          supplierId: dto.supplierId,
          invoiceNumber: dto.invoiceNumber,
          purchaseDate: new Date(dto.purchaseDate),
          paymentType: dto.paymentType,
          total: dto.total,
          notes: dto.notes,
          status: PurchaseStatus.RECEIVED,
        },
      })

      if (dto.paymentType === 'CREDIT') {
        await this.purchaseDebtService.createForPurchase(tx, tenantId, purchase.id, dto.total, dto.debt!)
      }

      const productStocks = await tx.product.findMany({
        where: { id: { in: productIds }, tenantId },
        select: { id: true, stock: true },
      })
      const stockMap = new Map(productStocks.map((product) => [product.id, product.stock]))

      // Process items sequentially to ensure deterministic execution order
      for (const item of sortedItems) {
        const before = stockMap.get(item.productId) ?? 0
        const after = before + item.quantity
        stockMap.set(item.productId, after)

        const purchaseItem = await tx.purchaseItem.create({
          data: {
            purchaseId: purchase.id,
            productId: item.productId,
            quantity: item.quantity,
            unitCost: item.unitCost,
            total: item.quantity * item.unitCost,
          },
        })

        await tx.stockMovement.create({
          data: {
            tenantId,
            productId: item.productId,
            type: 'PURCHASE',
            quantity: item.quantity,
            before,
            after,
            referenceId: purchaseItem.id,
            notes: 'Ingreso por compra',
            sourceType: 'PURCHASE',
          },
        })

        await tx.product.update({
          where: { id: item.productId },
          data: { stock: after },
        })
      }

      return tx.purchase.findUnique({
        where: { id: purchase.id },
        include: {
          supplier: true,
          items: true,
          debt: true,
        },
      })
    }, {
      timeout: 30_000,
      maxWait: 5_000,
    })
  }

  async findAll(tenantId: string, query: PurchaseFilterDto) {
    const { limit, skip, search, status, paymentType, dateFrom, dateTo, supplierId } = query

    const where: Prisma.PurchaseWhereInput = {
      tenantId,
      ...(status && { status }),
      ...(paymentType && { paymentType }),
      ...(supplierId && { supplierId }),
      ...(search && {
        OR: [
          {
            invoiceNumber: {
              contains: search,
              mode: Prisma.QueryMode.insensitive,
            },
          },
          {
            supplier: {
              name: { contains: search, mode: Prisma.QueryMode.insensitive },
            },
          },
          {
            supplier: {
              RUC: { contains: search, mode: Prisma.QueryMode.insensitive },
            },
          },
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
    ])

    return { items, total, page: query.page, limit: query.limit }
  }

  async findOne(id: string, tenantId: string) {
    const purchase = await this.prisma.purchase.findFirst({
      where: { id, tenantId },
      include: {
        supplier: true,
        items: {
          include: {
            returnItems: {
              select: { quantity: true },
              where: { purchaseReturn: { status: 'CONFIRMED' } }
            },
            product: {
              select: { id: true, name: true, barcode: true, sku: true, stock: true }
            }
          }
        },
        debt: {
          include: {
            installments: {
              orderBy: { number: 'asc' },
              include: {
                adjustments: { select: { amount: true } },
                creditApplications: { select: { amount: true } },
              },
            },
            payments: { orderBy: { paymentDate: 'desc' } },
          },
        },
      },
    })

    if (!purchase) {
      throw new NotFoundException(`Compra con id "${id}" no encontrada`)
    }

    return purchase
  }
  
  async cancel(id: string, tenantId: string, actorId: string, dto: CancelPurchaseDto) {
    CommercialOperationPolicy.assertEnabled('PURCHASE_CANCELLATIONS')
    if (dto.supplierReceivedNothing !== true) {
      throw new BadRequestException('Solo se puede cancelar una compra errónea cuando el proveedor confirma que no recibió el pago.')
    }
    if (!dto.reason?.trim() || dto.reason.trim().length < 5) {
      throw new BadRequestException('Indicá un motivo de corrección de al menos cinco caracteres.')
    }
    return this.prisma.$transaction(async (tx) => {
      const lockedPurchase = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id"
        FROM "purchases"
        WHERE "id" = ${id} AND "tenantId" = ${tenantId}
        FOR UPDATE
      `
      if (lockedPurchase.length === 0) {
        throw new NotFoundException(`Compra con id "${id}" no encontrada`)
      }

      const purchase = await tx.purchase.findFirst({
        where: { id, tenantId },
        include: {
          items: true,
          returns: true,
          cashSession: true,
          debt: { include: { payments: true, adjustments: true, installments: true } },
        },
      })
      if (!purchase) throw new NotFoundException(`Compra con id "${id}" no encontrada`)
      if (purchase.status === PurchaseStatus.CANCELLED) {
        throw new ConflictException('La compra ya está cancelada')
      }
      if (purchase.status !== PurchaseStatus.RECEIVED) {
        throw new BadRequestException('Solo se pueden cancelar compras en estado RECEIVED')
      }
      if (purchase.paymentType === 'CASH') {
        throw new ConflictException('Una compra al contado representa efectivo ya entregado; registrá el reembolso mediante una devolución del proveedor.')
      }
      if (!purchase.debt) {
        throw new ConflictException('No se puede cancelar una compra a crédito sin su registro de deuda vinculado.')
      }
      if (purchase.cashSession.status !== 'OPEN') {
        throw new ConflictException('No se puede modificar una compra vinculada a una sesión de caja cerrada.')
      }
      const sessionLock = await tx.cashSession.updateMany({
        where: { id: purchase.cashSessionId, tenantId, status: 'OPEN' },
        data: { totalPurchases: { increment: 0 } },
      })
      if (sessionLock.count !== 1) throw new ConflictException('La sesión de caja se cerró durante la anulación.')
      if (purchase.debt) {
        const debtLock = await tx.$queryRaw<Array<{ id: string }>>`
          SELECT "id" FROM "purchase_debts" WHERE "id" = ${purchase.debt.id} AND "tenantId" = ${tenantId} FOR UPDATE
        `
        if (debtLock.length !== 1) throw new ConflictException('La deuda de la compra cambió durante la anulación.')
      }
      const currentDebt = purchase.debt
        ? await tx.purchaseDebt.findFirst({
            where: { id: purchase.debt.id, tenantId },
            include: { payments: true, adjustments: true, installments: true },
          })
        : null
      if (purchase.returns.length > 0) {
        throw new BadRequestException('No se puede cancelar una compra que tiene devoluciones registradas')
      }
      if (currentDebt && (Number(currentDebt.paidAmount) > 0 || currentDebt.payments.length > 0)) {
        throw new BadRequestException('No se puede cancelar una compra a crédito que ya tiene pagos registrados')
      }
      if (currentDebt?.adjustments.length) {
        throw new BadRequestException('No se puede cancelar una compra cuyo saldo ya fue ajustado; corregila con una operación vinculada.')
      }
      if (currentDebt?.installments.length) {
        throw new BadRequestException('No se puede cancelar una compra con cuotas programadas; el calendario requiere una corrección específica.')
      }

      const sortedItems = [...purchase.items].sort((a, b) => a.productId.localeCompare(b.productId))
      // Validate stock availability using the validation service
      await this.purchaseValidationService.validateCancelStockAvailability(tx, purchase, tenantId)

      // Revert stock for each item sequentially in sorted order
      for (const item of sortedItems) {
        await this.stockMovementService.registerPurchaseCancellation(
          tenantId,
          item.productId,
          item.quantity,
          item.id,
          tx,
        )
      }

      const statusUpdate = await tx.purchase.updateMany({
        where: { id, tenantId, status: PurchaseStatus.RECEIVED },
        data: { status: PurchaseStatus.CANCELLED },
      })
      if (statusUpdate.count !== 1) {
        throw new ConflictException('La compra cambió durante la anulación')
      }
      if (currentDebt) {
        await tx.purchaseDebt.update({
          where: { purchaseId: purchase.id },
          data: { balance: 0, status: 'CANCELLED' },
        })
      }
      await tx.purchaseLifecycleEvent.create({
        data: { tenantId, purchaseId: id, actorId, action: 'CANCEL', reason: dto.reason.trim() },
      })

      return tx.purchase.findFirst({
        where: { id, tenantId },
        include: { supplier: true },
      })
    }, { timeout: 15_000 })
  }
}
