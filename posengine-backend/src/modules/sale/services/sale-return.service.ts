import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { CommercialOperationPolicy } from '../../../common/commercial-operation-policy'
import { PrismaService } from '../../../prisma/prisma.service'
import { CreateSaleReturnDto, ConfirmSaleReturnDto, SettleSaleReturnRefundDto } from '../dto/create-sale-return.dto'
import { claimIdempotency, completeIdempotency, findIdempotencyReplay, requireIdempotencyResource } from '../../../common/idempotency'
import type { Prisma } from '../../../generated/prisma/client'

@Injectable()
export class SaleReturnService {
  constructor(private readonly prisma: PrismaService) {}

  async create(tenantId: string, actorId: string, dto: CreateSaleReturnDto, idempotencyKey?: string) {
    CommercialOperationPolicy.assertEnabled('SALE_RETURNS')
    const payload = { saleReturn: dto }
    const replay = await findIdempotencyReplay(this.prisma, tenantId, 'SALE_RETURN_CREATE', idempotencyKey, payload)
    if (replay) return this.replayCreatedReturn(this.prisma, tenantId, replay)
    if (!dto.items?.length) throw new BadRequestException('La devolución debe incluir al menos un ítem.')
    if (!Number.isFinite(new Date(dto.returnDate).getTime())) throw new BadRequestException('La fecha de devolución no es válida.')
    if (new Set(dto.items.map((item) => item.saleItemId)).size !== dto.items.length) {
      throw new BadRequestException('No se puede repetir un ítem original dentro de la misma devolución.')
    }

    return this.prisma.$transaction(async (tx) => {
      const claim = await claimIdempotency(tx, tenantId, 'SALE_RETURN_CREATE', idempotencyKey, payload)
      if (claim && !claim.created) return this.replayCreatedReturn(tx, tenantId, claim)

      const reference = await tx.sale.findFirst({
        where: { id: dto.saleId, tenantId }, select: { id: true, customerId: true, paymentMethod: true },
      })
      if (!reference) throw new NotFoundException('Venta no encontrada')
      if (reference.customerId && reference.paymentMethod === 'CREDIT') {
        const customerLock = await tx.customer.updateMany({
          where: { id: reference.customerId, tenantId }, data: { currentDebt: { increment: 0 } },
        })
        if (customerLock.count !== 1) throw new NotFoundException('Cliente de la venta no encontrado')
      }
      const locked = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "sales" WHERE "id" = ${dto.saleId} AND "tenantId" = ${tenantId} FOR UPDATE
      `
      if (locked.length !== 1) throw new NotFoundException('Venta no encontrada')
      const sale = await tx.sale.findFirst({
        where: { id: dto.saleId, tenantId },
        include: { items: { include: { product: { select: { id: true, name: true, unitType: true } }, returnItems: { where: { saleReturn: { status: 'CONFIRMED' } } } } } },
      })
      if (!sale || sale.status !== 'COMPLETED') throw new ConflictException('Solo se pueden devolver ventas completadas.')
      const itemById = new Map(sale.items.map((item) => [item.id, item]))
      const itemData = [] as Array<{ saleItemId: string; productId: string; quantity: number; unitPrice: number; total: number; disposition: 'RESTOCKABLE' | 'DAMAGED' }>
      let total = 0
      for (const requested of dto.items) {
        if (!Number.isFinite(requested.quantity) || requested.quantity <= 0) throw new BadRequestException('Las cantidades deben ser positivas.')
        const original = itemById.get(requested.saleItemId)
        if (!original) throw new NotFoundException('El ítem no pertenece a la venta indicada.')
        if (original.product.unitType === 'UNIT' && !Number.isInteger(requested.quantity)) {
          throw new BadRequestException(`"${original.product.name}" se vende por unidad y no admite devoluciones fraccionarias.`)
        }
        const alreadyReturned = original.returnItems.reduce((sum, row) => sum + row.quantity, 0)
        if (alreadyReturned + requested.quantity > original.quantity + 0.000001) {
          throw new BadRequestException(`La cantidad devuelta supera lo vendido de "${original.product.name}".`)
        }
        const value = Math.round(requested.quantity * Number(original.unitPrice) * 100) / 100
        total = Math.round((total + value) * 100) / 100
        itemData.push({
          saleItemId: original.id, productId: original.productId, quantity: requested.quantity,
          unitPrice: Number(original.unitPrice), total: value, disposition: requested.disposition,
        })
      }
      const created = await tx.saleReturn.create({
        data: {
          tenantId, saleId: sale.id, createdByUserId: actorId, returnDate: new Date(dto.returnDate),
          reason: dto.reason?.trim(), total,
          items: { create: itemData },
        },
        include: { items: true },
      })
      await completeIdempotency(tx, tenantId, claim, 'SALE_RETURN', [created.id])
      return created
    }, { timeout: 15_000 })
  }

  private async replayCreatedReturn(client: Prisma.TransactionClient | PrismaService, tenantId: string, claim: NonNullable<Awaited<ReturnType<typeof findIdempotencyReplay>>>) {
    const id = requireIdempotencyResource(claim, 'SALE_RETURN')
    const returned = await client.saleReturn.findFirst({ where: { id, tenantId }, include: { items: true } })
    if (!returned) throw new NotFoundException('La devolución original ya no está disponible.')
    return returned
  }

  async confirm(returnId: string, tenantId: string, actorId: string, dto: ConfirmSaleReturnDto = {}) {
    CommercialOperationPolicy.assertEnabled('SALE_RETURNS')
    const dispositions = ['REFUND_PENDING', 'REFUND_CASH', 'REFUND_TRANSFER']
    if (dto.settlementDisposition && !dispositions.includes(dto.settlementDisposition)) {
      throw new BadRequestException('El destino del excedente no es válido.')
    }
    if (dto.settlementDisposition === 'REFUND_CASH' || dto.settlementDisposition === 'REFUND_TRANSFER') {
      CommercialOperationPolicy.assertEnabled('SALE_RETURN_REFUNDS')
    }
    return this.prisma.$transaction(async (tx) => {
      const reference = await tx.saleReturn.findFirst({ where: { id: returnId, tenantId }, select: { saleId: true } })
      if (!reference) throw new NotFoundException('Devolución de venta no encontrada')
      const saleReference = await tx.sale.findFirst({ where: { id: reference.saleId, tenantId }, select: { customerId: true, paymentMethod: true } })
      if (saleReference?.customerId && saleReference.paymentMethod === 'CREDIT') {
        const lockedCustomer = await tx.customer.updateMany({
          where: { id: saleReference.customerId, tenantId }, data: { currentDebt: { increment: 0 } },
        })
        if (lockedCustomer.count !== 1) throw new NotFoundException('Cliente de la venta no encontrado')
      }
      const saleLock = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "sales" WHERE "id" = ${reference.saleId} AND "tenantId" = ${tenantId} FOR UPDATE
      `
      if (saleLock.length !== 1) throw new NotFoundException('Venta original no encontrada')
      const saleReturn = await tx.saleReturn.findFirst({
        where: { id: returnId, tenantId },
        include: { items: { include: { product: { select: { name: true } } } }, sale: { include: { items: true } } },
      })
      if (!saleReturn) throw new NotFoundException('Devolución de venta no encontrada')
      if (saleReturn.status !== 'PENDING') throw new ConflictException('Solo se puede confirmar una devolución pendiente.')
      if (saleReturn.sale.status !== 'COMPLETED') throw new ConflictException('La venta ya no está disponible para devolución.')

      const soldItems = await tx.saleItem.findMany({
        where: { saleId: saleReturn.saleId },
        include: { returnItems: { where: { saleReturn: { status: 'CONFIRMED' } } } },
      })
      const soldById = new Map(soldItems.map((item) => [item.id, item]))
      const stockByProduct = new Map<string, number>()
      const namesByProduct = new Map<string, string>()
      for (const item of saleReturn.items) {
        const original = soldById.get(item.saleItemId)
        if (!original || original.productId !== item.productId) throw new ConflictException('La línea no pertenece a la venta original.')
        const returned = original.returnItems.reduce((sum, row) => sum + row.quantity, 0)
        if (returned + item.quantity > original.quantity + 0.000001) throw new ConflictException('La cantidad devuelta acumulada supera la cantidad vendida.')
        if (item.disposition === 'RESTOCKABLE') {
          stockByProduct.set(item.productId, (stockByProduct.get(item.productId) ?? 0) + item.quantity)
          namesByProduct.set(item.productId, item.product.name)
        }
      }
      for (const [productId, quantity] of [...stockByProduct].sort(([a], [b]) => a.localeCompare(b))) {
        const changed = await tx.$queryRaw<Array<{ stock: number }>>`
          UPDATE "products" SET "stock" = "stock" + ${quantity}, "updatedAt" = CURRENT_TIMESTAMP
          WHERE "id" = ${productId} AND "tenantId" = ${tenantId} RETURNING "stock"
        `
        if (!changed.length) throw new NotFoundException(`Producto "${productId}" no encontrado`)
        const after = Number(changed[0].stock)
        await tx.stockMovement.create({
          data: {
            tenantId, productId, type: 'MANUAL', sourceType: 'RETURN', quantity,
            before: after - quantity, after, referenceId: returnId,
            notes: `Devolución de venta ${saleReturn.saleId}; ${namesByProduct.get(productId)}`,
          },
        })
      }

      const debtOffset = Math.min(Number(saleReturn.total), Math.max(0, Number(saleReturn.sale.remainingBalance)))
      const refundAmount = Math.round((Number(saleReturn.total) - debtOffset) * 100) / 100
      if (refundAmount > 0.01 && !dto.settlementDisposition) {
        throw new BadRequestException(`Queda un excedente de Gs. ${refundAmount.toLocaleString('es-PY')}; elegí un reembolso pendiente, efectivo o transferencia.`)
      }
      if (debtOffset > 0.01) {
        if (!saleReturn.sale.customerId) throw new ConflictException('No se puede compensar deuda sin cliente asociado.')
        const customerUpdate = await tx.customer.updateMany({
          where: { id: saleReturn.sale.customerId, tenantId, currentDebt: { gte: debtOffset } },
          data: { currentDebt: { decrement: debtOffset } },
        })
        if (customerUpdate.count !== 1) throw new ConflictException('La deuda consolidada del cliente no coincide con el saldo de esta venta.')
        const newBalance = Math.max(0, Number(saleReturn.sale.remainingBalance) - debtOffset)
        await tx.sale.update({ where: { id: saleReturn.saleId }, data: {
          remainingBalance: newBalance, paymentStatus: newBalance <= 0.01 ? 'PAID' : 'PARTIAL',
        } })
        await tx.saleReturnDebtAdjustment.create({
          data: { tenantId, saleId: saleReturn.saleId, saleReturnId: returnId, amount: debtOffset },
        })
      }

      if (refundAmount > 0.01) {
        const activePayments = saleReturn.sale.paymentMethod === 'CREDIT'
          ? await tx.customerPayment.aggregate({ where: { tenantId, saleId: saleReturn.saleId, isVoided: false }, _sum: { amount: true } })
          : null
        const collected = saleReturn.sale.paymentMethod === 'CREDIT'
          ? Number(activePayments?._sum.amount ?? 0)
          : Number(saleReturn.sale.total)
        const previousSettlements = await tx.saleReturnSettlement.aggregate({
          where: { tenantId, saleReturn: { saleId: saleReturn.saleId, status: 'CONFIRMED' } }, _sum: { amount: true },
        })
        const alreadyOwed = Number(previousSettlements._sum.amount ?? 0)
        const availableToRefund = Math.max(0, collected - alreadyOwed)
        if (refundAmount > availableToRefund + 0.01) {
          throw new ConflictException(`El excedente supera lo efectivamente cobrado y aún no comprometido: Gs. ${availableToRefund.toLocaleString('es-PY')}.`)
        }
        const disposition = dto.settlementDisposition!
        let cashSessionId: string | undefined
        if (disposition === 'REFUND_CASH') {
          const sessions = await tx.cashSession.findMany({ where: { tenantId, status: 'OPEN' }, take: 2, select: { id: true } })
          if (sessions.length !== 1) throw new ConflictException('Para reembolsar en efectivo debe existir exactamente una caja abierta.')
          cashSessionId = sessions[0].id
          const sessionLock = await tx.cashSession.updateMany({
            where: { id: cashSessionId, tenantId, status: 'OPEN' }, data: { totalSales: { increment: 0 } },
          })
          if (sessionLock.count !== 1) throw new ConflictException('La caja se cerró antes de registrar el reembolso.')
        }
        const settlement = await tx.saleReturnSettlement.create({ data: { tenantId, saleReturnId: returnId, amount: refundAmount } })
        if (disposition === 'REFUND_CASH' || disposition === 'REFUND_TRANSFER') {
          const effectiveAt = new Date()
          const method = disposition === 'REFUND_CASH' ? 'CASH' : 'TRANSFER'
          await tx.saleReturnRefundReceipt.create({
            data: { tenantId, settlementId: settlement.id, createdByUserId: actorId, amount: refundAmount, paymentMethod: method, effectiveAt, cashSessionId },
          })
          await tx.saleReturnSettlement.update({ where: { id: settlement.id }, data: { status: 'SETTLED', settledAt: effectiveAt } })
          if (method === 'CASH') await tx.cashMovement.create({
            data: { tenantId, cashSessionId: cashSessionId!, amount: refundAmount, type: 'OUT', description: `Reembolso de cliente — devolución ${returnId}` },
          })
        }
      }

      const updated = await tx.saleReturn.updateMany({
        where: { id: returnId, tenantId, status: 'PENDING' },
        data: { status: 'CONFIRMED', debtOffsetAmount: debtOffset, confirmedAt: new Date() },
      })
      if (updated.count !== 1) throw new ConflictException('La devolución cambió durante la confirmación.')
      return tx.saleReturn.findFirst({
        where: { id: returnId, tenantId },
        include: { items: true, debtAdjustment: true, settlements: { include: { receipts: true } } },
      })
    }, { timeout: 15_000 })
  }

  async settleRefund(settlementId: string, tenantId: string, actorId: string, dto: SettleSaleReturnRefundDto, idempotencyKey?: string) {
    CommercialOperationPolicy.assertEnabled('SALE_RETURN_REFUNDS')
    const payload = { settlementId, refundReceipt: dto }
    const replay = await findIdempotencyReplay(this.prisma, tenantId, 'SALE_RETURN_REFUND', idempotencyKey, payload)
    if (replay) return this.replaySettlement(this.prisma, tenantId, settlementId, replay)
    if (!Number.isFinite(dto.amount) || dto.amount <= 0) throw new BadRequestException('El reembolso debe ser positivo.')
    if (dto.paymentMethod !== 'CASH' && dto.paymentMethod !== 'TRANSFER') throw new BadRequestException('El medio debe ser efectivo o transferencia.')
    const amount = Math.round(dto.amount * 100) / 100
    return this.prisma.$transaction(async (tx) => {
      const claim = await claimIdempotency(tx, tenantId, 'SALE_RETURN_REFUND', idempotencyKey, payload)
      if (claim && !claim.created) return this.replaySettlement(tx, tenantId, settlementId, claim)

      await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "sale_return_settlements" WHERE "id" = ${settlementId} AND "tenantId" = ${tenantId} FOR UPDATE
      `
      const settlement = await tx.saleReturnSettlement.findFirst({
        where: { id: settlementId, tenantId }, include: { saleReturn: { select: { status: true } }, receipts: { select: { amount: true } } },
      })
      if (!settlement) throw new NotFoundException('Reembolso no encontrado')
      if (settlement.saleReturn.status !== 'CONFIRMED' || !['PENDING', 'PARTIALLY_SETTLED'].includes(settlement.status)) {
        throw new ConflictException('El reembolso ya no está pendiente.')
      }
      const received = settlement.receipts.reduce((sum, row) => sum + Number(row.amount), 0)
      const remaining = Math.round((Number(settlement.amount) - received) * 100) / 100
      if (amount > remaining + 0.001) throw new BadRequestException(`El monto supera el saldo pendiente de Gs. ${remaining.toLocaleString('es-PY')}.`)
      const effectiveAt = dto.effectiveAt ? new Date(dto.effectiveAt) : new Date()
      if (!Number.isFinite(effectiveAt.getTime()) || effectiveAt > new Date()) throw new BadRequestException('La fecha efectiva no es válida.')
      let cashSessionId: string | undefined
      if (dto.paymentMethod === 'CASH') {
        const sessions = await tx.cashSession.findMany({ where: { tenantId, status: 'OPEN' }, take: 2, select: { id: true, openedAt: true } })
        if (sessions.length !== 1 || effectiveAt < sessions[0].openedAt) throw new ConflictException('Para reembolsar en efectivo se requiere una caja abierta que cubra la fecha efectiva.')
        cashSessionId = sessions[0].id
        const locked = await tx.cashSession.updateMany({ where: { id: cashSessionId, tenantId, status: 'OPEN' }, data: { totalSales: { increment: 0 } } })
        if (locked.count !== 1) throw new ConflictException('La caja se cerró antes de registrar el reembolso.')
      }
      await tx.saleReturnRefundReceipt.create({
        data: { tenantId, settlementId, createdByUserId: actorId, amount, paymentMethod: dto.paymentMethod, effectiveAt, cashSessionId, reference: dto.reference?.trim(), notes: dto.notes?.trim() },
      })
      const complete = amount >= remaining - 0.001
      await tx.saleReturnSettlement.update({ where: { id: settlementId }, data: { status: complete ? 'SETTLED' : 'PARTIALLY_SETTLED', ...(complete ? { settledAt: effectiveAt } : {}) } })
      if (dto.paymentMethod === 'CASH') await tx.cashMovement.create({
        data: { tenantId, cashSessionId: cashSessionId!, amount, type: 'OUT', description: `Reembolso de cliente — settlement ${settlementId}` },
      })
      const result = await tx.saleReturnSettlement.findFirst({ where: { id: settlementId, tenantId }, include: { receipts: { orderBy: { effectiveAt: 'asc' } } } })
      await completeIdempotency(tx, tenantId, claim, 'SALE_RETURN_SETTLEMENT', [settlementId])
      return result
    })
  }

  private async replaySettlement(client: Prisma.TransactionClient | PrismaService, tenantId: string, settlementId: string, claim: NonNullable<Awaited<ReturnType<typeof findIdempotencyReplay>>>) {
    requireIdempotencyResource(claim, 'SALE_RETURN_SETTLEMENT')
    const settlement = await client.saleReturnSettlement.findFirst({
      where: { id: settlementId, tenantId },
      include: { receipts: { orderBy: { effectiveAt: 'asc' } } },
    })
    if (!settlement) throw new NotFoundException('El reembolso original ya no está disponible.')
    return settlement
  }

  async cancel(returnId: string, tenantId: string) {
    CommercialOperationPolicy.assertEnabled('SALE_RETURNS')
    const result = await this.prisma.saleReturn.updateMany({ where: { id: returnId, tenantId, status: 'PENDING' }, data: { status: 'CANCELLED' } })
    if (result.count === 1) return this.prisma.saleReturn.findFirst({ where: { id: returnId, tenantId } })
    const existing = await this.prisma.saleReturn.findFirst({ where: { id: returnId, tenantId }, select: { id: true } })
    if (!existing) throw new NotFoundException('Devolución de venta no encontrada')
    throw new ConflictException('Solo se pueden cancelar devoluciones pendientes.')
  }

  async findBySale(saleId: string, tenantId: string) {
    return this.prisma.saleReturn.findMany({
      where: { saleId, tenantId },
      include: { items: { include: { product: { select: { id: true, name: true, sku: true } }, saleItem: { select: { quantity: true, unitPrice: true, total: true } } } }, debtAdjustment: true, settlements: { include: { receipts: { orderBy: { effectiveAt: 'asc' } } } } },
      orderBy: { createdAt: 'desc' },
    })
  }
}
