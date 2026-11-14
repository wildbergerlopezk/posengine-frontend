import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common'
import { PurchaseReturnStatus, PurchaseStatus } from '../../../generated/prisma/enums'
import { CommercialOperationPolicy } from '../../../common/commercial-operation-policy'
import { PrismaService } from '../../../prisma/prisma.service'
import {
  ApplyPurchaseReturnCreditDto,
  ConfirmPurchaseReturnDto,
  CreatePurchaseReturnDto,
  SettlePurchaseReturnRefundDto,
} from '../dto/create-purchase-return.dto'

@Injectable()
export class PurchaseReturnService {
  constructor(private readonly prisma: PrismaService) {}

  async create(tenantId: string, dto: CreatePurchaseReturnDto, actorId?: string) {
    CommercialOperationPolicy.assertEnabled('PURCHASE_RETURNS')

    if (!dto.items?.length) {
      throw new BadRequestException('La devolución debe incluir al menos un ítem.')
    }
    if (!Number.isFinite(new Date(dto.returnDate).getTime())) {
      throw new BadRequestException('La fecha de devolución no es válida.')
    }

    const requestedItemIds = dto.items.map((item) => item.purchaseItemId)
    if (new Set(requestedItemIds).size !== requestedItemIds.length) {
      throw new BadRequestException('No puede repetirse un ítem original dentro de la misma devolución.')
    }
    if (dto.items.some((item) => !Number.isFinite(item.quantity) || item.quantity <= 0)) {
      throw new BadRequestException('Las cantidades de devolución deben ser números positivos y válidos.')
    }

    return this.prisma.$transaction(async (tx) => {
      const lockedPurchase = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id"
        FROM "purchases"
        WHERE "id" = ${dto.purchaseId} AND "tenantId" = ${tenantId}
        FOR UPDATE
      `
      if (lockedPurchase.length === 0) {
        throw new NotFoundException(`Compra con id "${dto.purchaseId}" no encontrada`)
      }

      const purchase = await tx.purchase.findFirst({
        where: { id: dto.purchaseId, tenantId },
        include: {
          items: {
            include: {
              product: { select: { id: true, name: true, stock: true, unitType: true } },
              returnItems: {
                where: { purchaseReturn: { status: PurchaseReturnStatus.CONFIRMED } },
              },
            },
          },
        },
      })
      if (!purchase) {
        throw new NotFoundException(`Compra con id "${dto.purchaseId}" no encontrada`)
      }
      if (purchase.status !== PurchaseStatus.RECEIVED) {
        throw new BadRequestException('Solo se pueden devolver compras en estado RECEIVED')
      }

      const purchaseItemsById = new Map(purchase.items.map((item) => [item.id, item]))
      const returnItemsData: Array<{
        purchaseItemId: string
        productId: string
        quantity: number
        unitCost: number
        total: number
      }> = []
      const requestedByProduct = new Map<string, number>()
      let returnTotal = 0

      for (const dtoItem of dto.items) {
        const purchaseItem = purchaseItemsById.get(dtoItem.purchaseItemId)
        if (!purchaseItem) {
          throw new NotFoundException(`El ítem "${dtoItem.purchaseItemId}" no pertenece a esta compra`)
        }
        if (purchaseItem.product.unitType === 'UNIT' && !Number.isInteger(dtoItem.quantity)) {
          throw new BadRequestException(
            `"${purchaseItem.product.name}" usa unidades y no admite cantidades decimales.`,
          )
        }

        const alreadyReturned = purchaseItem.returnItems.reduce((sum, item) => sum + item.quantity, 0)
        const availableToReturn = purchaseItem.quantity - alreadyReturned
        if (dtoItem.quantity > availableToReturn) {
          throw new BadRequestException(
            `Solo quedan ${availableToReturn} unidades disponibles para devolver de "${purchaseItem.product.name}"`,
          )
        }

        requestedByProduct.set(
          purchaseItem.productId,
          (requestedByProduct.get(purchaseItem.productId) ?? 0) + dtoItem.quantity,
        )
        const itemTotal = Math.round(dtoItem.quantity * Number(purchaseItem.unitCost) * 100) / 100
        returnTotal = Math.round((returnTotal + itemTotal) * 100) / 100
        returnItemsData.push({
          purchaseItemId: purchaseItem.id,
          productId: purchaseItem.productId,
          quantity: dtoItem.quantity,
          unitCost: Number(purchaseItem.unitCost),
          total: itemTotal,
        })
      }

      const stockByProduct = new Map(purchase.items.map((item) => [item.productId, item.product.stock]))
      for (const [productId, quantity] of requestedByProduct) {
        const available = stockByProduct.get(productId) ?? 0
        if (available < quantity) {
          const product = purchase.items.find((item) => item.productId === productId)?.product
          throw new BadRequestException(
            `No se puede devolver ${quantity} unidad/es de "${product?.name ?? productId}". ` +
            `El stock actual es ${available}; parte de la mercadería ya no está disponible.`,
          )
        }
      }

      return tx.purchaseReturn.create({
        data: {
          tenantId,
          purchaseId: dto.purchaseId,
          createdByUserId: actorId,
          returnDate: new Date(dto.returnDate),
          reason: dto.reason,
          creditNoteNumber: dto.creditNoteNumber,
          total: returnTotal,
          status: PurchaseReturnStatus.PENDING,
          items: { create: returnItemsData },
        },
        include: {
          items: { include: { product: { select: { id: true, name: true } } } },
        },
      })
    }, { timeout: 15_000 })
  }

  async confirm(returnId: string, tenantId: string, dto: ConfirmPurchaseReturnDto = {}, actorId?: string) {
    CommercialOperationPolicy.assertEnabled('PURCHASE_RETURNS')
    const dispositions = ['REFUND_PENDING', 'REFUND_CASH', 'REFUND_TRANSFER', 'SUPPLIER_CREDIT']
    if (dto.settlementDisposition && !dispositions.includes(dto.settlementDisposition)) {
      throw new BadRequestException('La resolución financiera indicada no es válida.')
    }
    // A pending refund records the amount owed without receiving money or
    // applying supplier credit. Keep that path available independently of
    // the settlement operations that move cash or create supplier credit.
    if (dto.settlementDisposition && dto.settlementDisposition !== 'REFUND_PENDING') {
      CommercialOperationPolicy.assertEnabled('PURCHASE_RETURN_SETTLEMENTS')
    }

    return this.prisma.$transaction(async (tx) => {
      const returnReference = await tx.purchaseReturn.findFirst({
        where: { id: returnId, tenantId },
        select: { purchaseId: true },
      })
      if (!returnReference) {
        throw new NotFoundException(`Devolución con id "${returnId}" no encontrada`)
      }

      // Serializes different return documents for the same purchase.
      const lockedPurchase = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id"
        FROM "purchases"
        WHERE "id" = ${returnReference.purchaseId} AND "tenantId" = ${tenantId}
        FOR UPDATE
      `
      if (lockedPurchase.length === 0) {
        throw new NotFoundException(`Compra con id "${returnReference.purchaseId}" no encontrada`)
      }

      const purchaseReturn = await tx.purchaseReturn.findFirst({
        where: { id: returnId, tenantId },
        include: {
          items: { include: { product: { select: { id: true, name: true } } } },
          purchase: true,
        },
      })
      if (!purchaseReturn) {
        throw new NotFoundException(`Devolución con id "${returnId}" no encontrada`)
      }
      if (purchaseReturn.status !== PurchaseReturnStatus.PENDING) {
        throw new ConflictException('Solo se pueden confirmar devoluciones en estado PENDING')
      }
      if (purchaseReturn.purchase.status !== PurchaseStatus.RECEIVED) {
        throw new ConflictException('La compra ya no está disponible para devoluciones')
      }

      const purchaseItems = await tx.purchaseItem.findMany({
        where: { purchaseId: purchaseReturn.purchaseId },
        include: {
          returnItems: {
            where: { purchaseReturn: { status: PurchaseReturnStatus.CONFIRMED } },
          },
        },
      })
      const originalQuantityByItem = new Map(purchaseItems.map((item) => [item.id, item.quantity]))
      const returnedQuantityByItem = new Map<string, number>()
      for (const purchaseItem of purchaseItems) {
        returnedQuantityByItem.set(
          purchaseItem.id,
          purchaseItem.returnItems.reduce((sum, item) => sum + item.quantity, 0),
        )
      }

      const quantityByProduct = new Map<string, number>()
      const itemNames = new Map<string, string>()
      for (const item of purchaseReturn.items) {
        const originalQuantity = originalQuantityByItem.get(item.purchaseItemId)
        if (originalQuantity === undefined) {
          throw new ConflictException('La devolución contiene un ítem que ya no pertenece a la compra original')
        }
        const alreadyReturned = returnedQuantityByItem.get(item.purchaseItemId) ?? 0
        if (alreadyReturned + item.quantity > originalQuantity) {
          throw new ConflictException('La cantidad acumulada devuelta supera la cantidad comprada')
        }
        quantityByProduct.set(item.productId, (quantityByProduct.get(item.productId) ?? 0) + item.quantity)
        itemNames.set(item.productId, item.product.name)
        returnedQuantityByItem.set(item.purchaseItemId, alreadyReturned + item.quantity)
      }

      // Product ids are ordered so returns touching overlapping products lock consistently.
      for (const [productId, quantity] of [...quantityByProduct].sort(([a], [b]) => a.localeCompare(b))) {
        const updated = await tx.$queryRaw<Array<{ stock: number }>>`
          UPDATE "products"
          SET "stock" = "stock" - ${quantity}, "updatedAt" = CURRENT_TIMESTAMP
          WHERE "id" = ${productId}
            AND "tenantId" = ${tenantId}
            AND "stock" >= ${quantity}
          RETURNING "stock"
        `
        if (updated.length === 0) {
          const current = await tx.product.findFirst({
            where: { id: productId, tenantId },
            select: { stock: true },
          })
          if (!current) throw new NotFoundException(`Producto "${productId}" no encontrado`)
          throw new BadRequestException(
            `No se puede confirmar la devolución. "${itemNames.get(productId)}" tiene stock actual de ${current.stock}, pero se intentan devolver ${quantity} unidades.`,
          )
        }

        const after = Number(updated[0].stock)
        await tx.stockMovement.create({
          data: {
            tenantId,
            productId,
            type: 'MANUAL',
            sourceType: 'RETURN',
            quantity: -quantity,
            before: after + quantity,
            after,
            referenceId: returnId,
            notes: `Devolución de compra #${purchaseReturn.purchase.invoiceNumber}`,
          },
        })
      }

      const purchaseDebt = await tx.purchaseDebt.findFirst({
        where: { purchaseId: purchaseReturn.purchaseId, tenantId, status: { in: ['PENDING', 'PARTIAL'] } },
        include: {
          installments: {
            orderBy: [{ dueDate: 'asc' }, { number: 'asc' }],
            include: {
              adjustments: { select: { amount: true } },
              creditApplications: { select: { amount: true } },
            },
          },
        },
      })
      const returnValue = Math.round(Number(purchaseReturn.total) * 100) / 100
      const debtOffset = purchaseDebt
        ? Math.min(returnValue, Math.max(0, Number(purchaseDebt.balance)))
        : 0
      const excess = Math.round((returnValue - debtOffset) * 100) / 100

      if (excess > 0.01 && !dto.settlementDisposition) {
        throw new BadRequestException(
          `La devolución excede la deuda pendiente por Gs. ${excess.toLocaleString('es-PY')}. Elegí reembolso pendiente, efectivo recibido, transferencia recibida o crédito del proveedor.`,
        )
      }
      if (purchaseDebt && debtOffset > 0) {
        let amountToAllocate = debtOffset
        for (const installment of purchaseDebt.installments) {
          if (amountToAllocate <= 0.01) break
          const adjusted = installment.adjustments.reduce((sum, row) => sum + Number(row.amount), 0) +
            installment.creditApplications.reduce((sum, row) => sum + Number(row.amount), 0)
          const unpaid = Math.max(0, Number(installment.amount) - Number(installment.paidAmount) - adjusted)
          const applied = Math.min(unpaid, amountToAllocate)
          if (applied <= 0.01) continue
          await tx.purchaseDebtAdjustment.create({
            data: {
              tenantId,
              purchaseDebtId: purchaseDebt.id,
              installmentId: installment.id,
              purchaseReturnId: returnId,
              amount: applied,
            },
          })
          const totalAdjusted = adjusted + applied
          const dueAfterAdjustment = Number(installment.amount) - Number(installment.paidAmount) - totalAdjusted
          await tx.purchaseDebtInstallment.update({
            where: { id: installment.id },
            data: { status: dueAfterAdjustment <= 0.01 ? 'PAID' : Number(installment.paidAmount) > 0 ? 'PARTIAL' : 'PENDING' },
          })
          amountToAllocate -= applied
        }

        // A schedule can be incomplete or absent; keep the remainder traceable at debt level.
        if (amountToAllocate > 0.01) {
          await tx.purchaseDebtAdjustment.create({
            data: {
              tenantId,
              purchaseDebtId: purchaseDebt.id,
              purchaseReturnId: returnId,
              amount: amountToAllocate,
            },
          })
        }

        const newBalance = Math.max(0, Number(purchaseDebt.balance) - debtOffset)
        await tx.purchaseDebt.update({
          where: { id: purchaseDebt.id },
          data: { balance: newBalance, status: newBalance <= 0.01 ? 'PAID' : 'PARTIAL' },
        })
      }

      if (excess > 0.01) {
        const disposition = dto.settlementDisposition!
        const isRefund = disposition.startsWith('REFUND_')
        const settled = disposition === 'REFUND_CASH' || disposition === 'REFUND_TRANSFER'
        let cashSessionId: string | undefined
        if (disposition === 'REFUND_CASH') {
          const openSessions = await tx.cashSession.findMany({
            where: { tenantId, status: 'OPEN' }, orderBy: { openedAt: 'desc' }, take: 2, select: { id: true },
          })
          if (openSessions.length !== 1) {
            throw new ConflictException('Para registrar un reembolso en efectivo debe existir exactamente una caja abierta.')
          }
          cashSessionId = openSessions[0].id
          const sessionLock = await tx.cashSession.updateMany({
            where: { id: cashSessionId, tenantId, status: 'OPEN' },
            data: { totalSales: { increment: 0 } },
          })
          if (sessionLock.count !== 1) {
            throw new ConflictException('La caja se cerró antes de registrar el reembolso.')
          }
        }
        const settlement = await tx.purchaseReturnSettlement.create({
          data: {
            tenantId,
            purchaseReturnId: returnId,
            type: isRefund ? 'REFUND' : 'SUPPLIER_CREDIT',
            status: 'PENDING',
            amount: excess,
          },
        })
        if (settled) {
          const effectiveAt = new Date()
          const paymentMethod = disposition === 'REFUND_CASH' ? 'CASH' : 'TRANSFER'
          await tx.purchaseReturnRefundReceipt.create({
            data: { tenantId, settlementId: settlement.id, createdByUserId: actorId, amount: excess, paymentMethod, effectiveAt, cashSessionId },
          })
          await tx.purchaseReturnSettlement.update({
            where: { id: settlement.id },
            data: { status: 'SETTLED', paymentMethod, cashSessionId, settledAt: effectiveAt },
          })
        }
        if (disposition === 'REFUND_CASH') {
          await tx.cashMovement.create({
            data: {
              tenantId,
              cashSessionId: cashSessionId!,
              amount: excess,
              type: 'IN',
              description: `Reembolso de proveedor — devolución ${returnId} (liquidación ${settlement.id})`,
            },
          })
        }
      }

      const statusUpdate = await tx.purchaseReturn.updateMany({
        where: { id: returnId, tenantId, status: PurchaseReturnStatus.PENDING },
        data: { status: PurchaseReturnStatus.CONFIRMED },
      })
      if (statusUpdate.count !== 1) {
        throw new ConflictException('La devolución cambió durante la confirmación')
      }

      const fullyReturned = [...originalQuantityByItem].every(([itemId, quantity]) =>
        (returnedQuantityByItem.get(itemId) ?? 0) >= quantity,
      )
      if (fullyReturned) {
        await tx.purchase.updateMany({
          where: { id: purchaseReturn.purchaseId, tenantId, status: PurchaseStatus.RECEIVED },
          data: { status: PurchaseStatus.FULLY_RETURNED },
        })
      }

      return tx.purchaseReturn.findFirst({
        where: { id: returnId, tenantId },
        include: {
          items: { include: { product: { select: { id: true, name: true } } } },
          settlements: { include: { receipts: { orderBy: { effectiveAt: 'asc' } }, applications: true } },
          debtAdjustments: true,
          purchase: { select: { invoiceNumber: true, status: true } },
        },
      })
    }, { timeout: 15_000 })
  }

  async cancel(returnId: string, tenantId: string) {
    const result = await this.prisma.purchaseReturn.updateMany({
      where: { id: returnId, tenantId, status: PurchaseReturnStatus.PENDING },
      data: { status: PurchaseReturnStatus.CANCELLED },
    })
    if (result.count === 1) {
      return this.prisma.purchaseReturn.findFirst({ where: { id: returnId, tenantId } })
    }

    const existing = await this.prisma.purchaseReturn.findFirst({
      where: { id: returnId, tenantId },
      select: { id: true },
    })
    if (!existing) throw new NotFoundException(`Devolución con id "${returnId}" no encontrada`)
    throw new ConflictException('Solo se pueden cancelar devoluciones en estado PENDING')
  }

  async settleRefund(settlementId: string, tenantId: string, dto: SettlePurchaseReturnRefundDto, actorId?: string) {
    CommercialOperationPolicy.assertEnabled('PURCHASE_RETURN_SETTLEMENTS')
    if (dto.paymentMethod !== 'CASH' && dto.paymentMethod !== 'TRANSFER') {
      throw new BadRequestException('El medio del reembolso debe ser CASH o TRANSFER.')
    }
    const amount = Math.round(dto.amount * 100) / 100
    if (!Number.isFinite(amount) || amount <= 0) throw new BadRequestException('El importe recibido debe ser positivo.')
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "purchase_return_settlements" WHERE "id" = ${settlementId} AND "tenantId" = ${tenantId} FOR UPDATE
      `
      const settlement = await tx.purchaseReturnSettlement.findFirst({
        where: { id: settlementId, tenantId },
        include: {
          purchaseReturn: { select: { status: true } },
          receipts: { select: { amount: true } },
        },
      })
      if (!settlement) throw new NotFoundException('Liquidación de devolución no encontrada')
      if (settlement.type !== 'REFUND' || !['PENDING', 'PARTIALLY_SETTLED'].includes(settlement.status) || settlement.purchaseReturn.status !== 'CONFIRMED') {
        throw new ConflictException('Solo se pueden liquidar reembolsos pendientes de devoluciones confirmadas.')
      }
      const alreadyReceived = settlement.receipts.reduce((sum, receipt) => sum + Number(receipt.amount), 0)
      const remaining = Math.round((Number(settlement.amount) - alreadyReceived) * 100) / 100
      if (amount > remaining + 0.001) {
        throw new BadRequestException(`El abono supera el saldo pendiente de Gs. ${remaining.toLocaleString('es-PY')}.`)
      }
      const effectiveAt = dto.effectiveAt ? new Date(dto.effectiveAt) : new Date()
      if (!Number.isFinite(effectiveAt.getTime()) || effectiveAt.getTime() > Date.now()) {
        throw new BadRequestException('La fecha efectiva del reembolso no es válida o es futura.')
      }

      let cashSessionId: string | undefined
      if (dto.paymentMethod === 'CASH') {
        const openSessions = await tx.cashSession.findMany({
          where: { tenantId, status: 'OPEN' }, orderBy: { openedAt: 'desc' }, take: 2, select: { id: true },
        })
        if (openSessions.length !== 1) {
          throw new ConflictException('Para registrar un reembolso en efectivo debe existir exactamente una caja abierta.')
        }
        cashSessionId = openSessions[0].id
        const openSession = await tx.cashSession.findFirst({
          where: { id: cashSessionId, tenantId, status: 'OPEN' },
          select: { openedAt: true },
        })
        if (!openSession || effectiveAt < openSession.openedAt) {
          throw new ConflictException('El reembolso en efectivo debe registrarse dentro de la caja abierta actual.')
        }
        const sessionLock = await tx.cashSession.updateMany({
          where: { id: cashSessionId, tenantId, status: 'OPEN' },
          data: { totalSales: { increment: 0 } },
        })
        if (sessionLock.count !== 1) {
          throw new ConflictException('La caja se cerró antes de registrar el reembolso.')
        }
      }

      await tx.purchaseReturnRefundReceipt.create({
        data: {
          tenantId,
          settlementId,
          createdByUserId: actorId,
          amount,
          paymentMethod: dto.paymentMethod,
          effectiveAt,
          cashSessionId,
          reference: dto.reference?.trim() || undefined,
          notes: dto.notes?.trim() || undefined,
        },
      })
      const fullReceived = amount >= remaining - 0.001
      await tx.purchaseReturnSettlement.update({
        where: { id: settlementId },
        data: {
          status: fullReceived ? 'SETTLED' : 'PARTIALLY_SETTLED',
          ...(fullReceived ? { settledAt: effectiveAt } : {}),
        },
      })
      if (dto.paymentMethod === 'CASH') {
        await tx.cashMovement.create({
          data: {
            tenantId,
            cashSessionId: cashSessionId!,
            amount,
            type: 'IN',
            description: `Reembolso de proveedor — liquidación ${settlementId}`,
          },
        })
      }
      return tx.purchaseReturnSettlement.findFirst({
        where: { id: settlementId, tenantId }, include: { receipts: { orderBy: { effectiveAt: 'asc' } } },
      })
    })
  }

  async applySupplierCredit(settlementId: string, tenantId: string, dto: ApplyPurchaseReturnCreditDto, actorId?: string) {
    CommercialOperationPolicy.assertEnabled('SUPPLIER_CREDIT_APPLICATIONS')
    if (!Number.isFinite(dto.amount) || dto.amount <= 0) {
      throw new BadRequestException('El importe del crédito debe ser positivo.')
    }
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "purchase_return_settlements" WHERE "id" = ${settlementId} AND "tenantId" = ${tenantId} FOR UPDATE
      `
      const settlement = await tx.purchaseReturnSettlement.findFirst({
        where: { id: settlementId, tenantId, type: 'SUPPLIER_CREDIT' },
        include: { purchaseReturn: { include: { purchase: { select: { supplierId: true } } } } },
      })
      if (!settlement) throw new NotFoundException('Crédito de proveedor no encontrado')
      if (settlement.purchaseReturn.status !== 'CONFIRMED') {
        throw new ConflictException('El crédito solo se puede usar después de confirmar la devolución.')
      }
      const purchaseLock = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "purchases" WHERE "id" = ${dto.purchaseId} AND "tenantId" = ${tenantId} FOR UPDATE
      `
      if (purchaseLock.length === 0) throw new NotFoundException('Compra destino no encontrada')
      const purchase = await tx.purchase.findFirst({
        where: { id: dto.purchaseId, tenantId },
        include: { supplier: { select: { id: true } }, debt: { include: {
          installments: { orderBy: [{ dueDate: 'asc' }, { number: 'asc' }], include: {
            adjustments: { select: { amount: true } },
            creditApplications: { select: { amount: true } },
          } },
        } } },
      })
      if (!purchase) throw new NotFoundException('Compra destino no encontrada')
      if (purchase.supplier.id !== settlement.purchaseReturn.purchase.supplierId) {
        throw new BadRequestException('El crédito solo puede aplicarse a una compra del mismo proveedor.')
      }
      if (!purchase.debt || !['PENDING', 'PARTIAL'].includes(purchase.debt.status)) {
        throw new ConflictException('El crédito solo se puede aplicar a una compra que todavía tenga deuda pendiente.')
      }
      const debtLock = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "purchase_debts" WHERE "id" = ${purchase.debt.id} FOR UPDATE
      `
      if (debtLock.length !== 1) throw new ConflictException('La deuda cambió durante la aplicación del crédito.')

      const availableCredit = Number(settlement.amount) - Number(settlement.appliedAmount)
      const amount = Math.round(dto.amount * 100) / 100
      if (amount > availableCredit + 0.01 || amount > Number(purchase.debt.balance) + 0.01) {
        throw new BadRequestException('El monto supera el crédito disponible o la deuda pendiente de la compra.')
      }

      let remaining = amount
      for (const installment of purchase.debt.installments) {
        if (remaining <= 0.01) break
        const offsets = installment.adjustments.reduce((sum, row) => sum + Number(row.amount), 0) +
          installment.creditApplications.reduce((sum, row) => sum + Number(row.amount), 0)
        const due = Math.max(0, Number(installment.amount) - Number(installment.paidAmount) - offsets)
        const applied = Math.min(due, remaining)
        if (applied <= 0.01) continue
        await tx.purchaseReturnCreditApplication.create({
          data: { tenantId, settlementId, purchaseId: purchase.id, installmentId: installment.id, createdByUserId: actorId, amount: applied },
        })
        const remainingDue = due - applied
        await tx.purchaseDebtInstallment.update({
          where: { id: installment.id },
          data: { status: remainingDue <= 0.01 ? 'PAID' : Number(installment.paidAmount) > 0 ? 'PARTIAL' : 'PENDING' },
        })
        remaining -= applied
      }
      if (remaining > 0.01) {
        await tx.purchaseReturnCreditApplication.create({
          data: { tenantId, settlementId, purchaseId: purchase.id, createdByUserId: actorId, amount: remaining },
        })
      }
      const newBalance = Math.max(0, Number(purchase.debt.balance) - amount)
      await tx.purchaseDebt.update({
        where: { id: purchase.debt.id },
        data: { balance: newBalance, status: newBalance <= 0.01 ? 'PAID' : 'PARTIAL' },
      })
      const newAppliedAmount = Number(settlement.appliedAmount) + amount
      await tx.purchaseReturnSettlement.update({
        where: { id: settlementId },
        data: {
          appliedAmount: newAppliedAmount,
          status: newAppliedAmount >= Number(settlement.amount) - 0.01 ? 'APPLIED' : 'PARTIALLY_APPLIED',
        },
      })
      return tx.purchaseReturnSettlement.findFirst({
        where: { id: settlementId, tenantId }, include: { applications: true },
      })
    }, { timeout: 15_000 })
  }

  async findAll(tenantId: string, purchaseId?: string, supplierId?: string) {
    return this.prisma.purchaseReturn.findMany({
      where: { tenantId, ...(purchaseId && { purchaseId }), ...(supplierId && { purchase: { supplierId } }) },
      include: {
        items: { include: { product: { select: { id: true, name: true, sku: true } } } },
        settlements: { include: { receipts: { orderBy: { effectiveAt: 'asc' } }, applications: true } },
        debtAdjustments: true,
        purchase: { select: { invoiceNumber: true, supplier: { select: { name: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    })
  }

  async findOne(returnId: string, tenantId: string) {
    const result = await this.prisma.purchaseReturn.findFirst({
      where: { id: returnId, tenantId },
      include: {
        settlements: { include: { receipts: { orderBy: { effectiveAt: 'asc' } }, applications: true } },
        debtAdjustments: true,
        items: {
          include: {
            product: { select: { id: true, name: true, sku: true, barcode: true } },
            purchaseItem: { select: { quantity: true, unitCost: true } },
          },
        },
        purchase: {
          select: {
            invoiceNumber: true,
            purchaseDate: true,
            supplier: { select: { name: true, RUC: true } },
          },
        },
      },
    })
    if (!result) throw new NotFoundException(`Devolución con id "${returnId}" no encontrada`)
    return result
  }
}
