import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { CashSessionStatus, PaymentStatus, PaymentMethod } from '../../generated/prisma/enums'
import { Prisma } from '../../generated/prisma/client'
import { CreateCustomerPaymentDto } from './dto/create-customer-payment.dto'
import { CustomerPaymentFilterDto } from './dto/customer-payment-filter.dto'
import { PayToAccountDto } from './dto/pay-to-account.dto'
import { VoidPaymentDto } from './dto/void-payment.dto'
import { claimIdempotency, completeIdempotency, findIdempotencyReplay, requireIdempotencyResource } from '../../common/idempotency'

@Injectable()
export class CustomerPaymentService {
  constructor(private readonly prisma: PrismaService) {}

  private async lockOpenCashSession(
    tx: Prisma.TransactionClient,
    tenantId: string,
    required: boolean,
  ): Promise<string | null> {
    const sessions = await tx.cashSession.findMany({
      where: { tenantId, status: CashSessionStatus.OPEN },
      select: { id: true },
      take: 2,
    })
    if (sessions.length > 1) {
      throw new ConflictException('Hay más de una caja abierta; no se puede atribuir el cobro con seguridad.')
    }
    if (required && sessions.length === 0) {
      throw new BadRequestException('Abrí una caja antes de registrar un cobro en efectivo.')
    }
    if (sessions.length === 0) return null
    const sessionId = sessions[0].id
    const locked = await tx.cashSession.updateMany({
      where: { id: sessionId, tenantId, status: CashSessionStatus.OPEN },
      data: { totalSales: { increment: 0 } },
    })
    if (locked.count !== 1) {
      throw new ConflictException('La sesión de caja se cerró antes de registrar el pago.')
    }
    return sessionId
  }

  // ── Create ──────────────────────────────────────────────────────────────────
  async create(tenantId: string, dto: CreateCustomerPaymentDto, idempotencyKey?: string) {
    const payload = { customerPayment: dto }
    const replay = await findIdempotencyReplay(this.prisma, tenantId, 'CUSTOMER_PAYMENT_CREATE', idempotencyKey, payload)
    if (replay) {
      const id = requireIdempotencyResource(replay, 'CUSTOMER_PAYMENT')
      const existing = await this.findPaymentResult(this.prisma, tenantId, id)
      if (!existing) throw new NotFoundException('El pago original ya no está disponible.')
      return existing
    }
    try {
    const customer = await this.prisma.customer.findFirst({
      where: { id: dto.customerId, tenantId },
    })
    if (!customer) {
      throw new NotFoundException(`Cliente con id "${dto.customerId}" no encontrado`)
    }

    if (Number(customer.currentDebt) <= 0) {
      throw new BadRequestException('Este cliente no tiene deuda pendiente.')
    }

    if (dto.amount > Number(customer.currentDebt)) {
      throw new BadRequestException(
        `El pago (Gs. ${dto.amount.toLocaleString('es-PY')}) supera la deuda actual del cliente (Gs. ${Number(customer.currentDebt).toLocaleString('es-PY')}).`,
      )
    }

    let sale: Awaited<ReturnType<typeof this.prisma.sale.findFirst>> | null = null
    if (dto.saleId) {
      sale = await this.prisma.sale.findFirst({
        where: { id: dto.saleId, tenantId, customerId: dto.customerId },
      })
      if (!sale) {
        throw new NotFoundException(
          `Venta "${dto.saleId}" no encontrada o no pertenece a este cliente`,
        )
      }
      if (Number(sale.remainingBalance) <= 0) {
        throw new BadRequestException('Esta venta ya está totalmente paga.')
      }
      if (dto.amount > Number(sale.remainingBalance)) {
        throw new BadRequestException(
          `El pago (Gs. ${dto.amount.toLocaleString('es-PY')}) supera el saldo pendiente de esta venta (Gs. ${Number(sale.remainingBalance).toLocaleString('es-PY')}).`,
        )
      }
    }

    const paymentMethod = dto.paymentMethod ?? PaymentMethod.CASH
    return this.prisma.$transaction(async (tx) => {
      const claim = await claimIdempotency(tx, tenantId, 'CUSTOMER_PAYMENT_CREATE', idempotencyKey, payload)
      if (claim && !claim.created) {
        const id = requireIdempotencyResource(claim, 'CUSTOMER_PAYMENT')
        const existing = await this.findPaymentResult(tx, tenantId, id)
        if (!existing) throw new NotFoundException('El pago original ya no está disponible.')
        return existing
      }

      const customerLock = await tx.customer.updateMany({
        where: { id: dto.customerId, tenantId }, data: { currentDebt: { increment: 0 } },
      })
      if (customerLock.count !== 1) throw new NotFoundException(`Cliente con id "${dto.customerId}" no encontrado`)
      const lockedCustomer = await tx.customer.findFirst({ where: { id: dto.customerId, tenantId } })
      if (!lockedCustomer || dto.amount > Number(lockedCustomer.currentDebt) + 0.001) {
        throw new ConflictException('La deuda del cliente cambió antes de registrar el pago.')
      }

      if (dto.saleId) {
        await tx.$queryRaw<Array<{ id: string }>>`
          SELECT "id" FROM "sales" WHERE "id" = ${dto.saleId} AND "tenantId" = ${tenantId} FOR UPDATE
        `
        sale = await tx.sale.findFirst({ where: { id: dto.saleId, tenantId, customerId: dto.customerId, status: 'COMPLETED' } })
        if (!sale || Number(sale.remainingBalance) <= 0 || dto.amount > Number(sale.remainingBalance) + 0.001) {
          throw new ConflictException('El saldo de la venta cambió antes de registrar el pago.')
        }
      }

      const cashSessionId = await this.lockOpenCashSession(tx, tenantId, paymentMethod === PaymentMethod.CASH)
      const paymentDate = new Date()
      const payment = await tx.customerPayment.create({
        data: {
          tenantId,
          customerId: dto.customerId,
          saleId: dto.saleId,
          amount: dto.amount,
          paymentMethod,
          cashSessionId,
          paymentDate,
          notes: dto.notes,
        },
      })

      await tx.customer.update({
        where: { id: dto.customerId },
        data: { currentDebt: { decrement: dto.amount } },
      })

      if (sale) {
        const newRemaining = Number(sale.remainingBalance) - dto.amount
        await tx.sale.update({
          where: { id: sale.id },
          data: {
            remainingBalance: newRemaining,
            paymentStatus: newRemaining <= 0 ? PaymentStatus.PAID : PaymentStatus.PARTIAL,
          },
        })
      }

      const result = await tx.customerPayment.findFirst({
        where: { id: payment.id, tenantId },
        include: {
          customer: { select: { id: true, name: true } },
          sale: { select: { id: true, saleDate: true, total: true, remainingBalance: true } },
        },
      })
      await completeIdempotency(tx, tenantId, claim, 'CUSTOMER_PAYMENT', [payment.id])
      return result
    })
    } catch (error) {
      const validationReplay = await findIdempotencyReplay(this.prisma, tenantId, 'CUSTOMER_PAYMENT_CREATE', idempotencyKey, payload)
      if (validationReplay) {
        const id = requireIdempotencyResource(validationReplay, 'CUSTOMER_PAYMENT')
        const existing = await this.findPaymentResult(this.prisma, tenantId, id)
        if (existing) return existing
      }
      throw error
    }
  }

  private findPaymentResult(client: Prisma.TransactionClient | PrismaService, tenantId: string, id: string) {
    return client.customerPayment.findFirst({
      where: { id, tenantId },
      include: {
        customer: { select: { id: true, name: true } },
        sale: { select: { id: true, saleDate: true, total: true, remainingBalance: true } },
      },
    })
  }

  // ── FindAll ─────────────────────────────────────────────────────────────────
  async findAll(tenantId: string, filters: CustomerPaymentFilterDto) {
    const { customerId, saleId, dateFrom, dateTo, isVoided, page = 1, limit = 20 } = filters
    const skip = (page - 1) * limit

    const where: Prisma.CustomerPaymentWhereInput = {
      tenantId,
      isVoided: isVoided !== undefined ? isVoided : false,
      ...(customerId && { customerId }),
      ...(saleId && { saleId }),
      ...((dateFrom || dateTo) && {
        paymentDate: {
          ...(dateFrom && { gte: new Date(dateFrom) }),
          ...(dateTo && { lte: new Date(`${dateTo}T23:59:59.999Z`) }),
        },
      }),
    }

    const [items, total] = await Promise.all([
      this.prisma.customerPayment.findMany({
        where,
        include: {
          customer: { select: { id: true, name: true } },
          sale: { select: { id: true, saleDate: true, total: true } },
        },
        orderBy: { paymentDate: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.customerPayment.count({ where }),
    ])

    return { items, total, page, limit }
  }

  // ── FindOne ─────────────────────────────────────────────────────────────────
  async findOne(id: string, tenantId: string) {
    const payment = await this.prisma.customerPayment.findFirst({
      where: { id, tenantId },
      include: {
        customer: { select: { id: true, name: true } },
        sale: { select: { id: true, saleDate: true, total: true, remainingBalance: true } },
      },
    })
    if (!payment) {
      throw new NotFoundException(`Pago con id "${id}" no encontrado`)
    }
    return payment
  }

  // ── FindByCustomer (estado de cuenta) ────────────────────────────────────────
  async findByCustomer(customerId: string, tenantId: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, tenantId },
    })
    if (!customer) {
      throw new NotFoundException(`Cliente con id "${customerId}" no encontrado`)
    }

    const payments = await this.prisma.customerPayment.findMany({
      where: { customerId, tenantId },
      include: { sale: { select: { id: true, saleDate: true, total: true } } },
      orderBy: { paymentDate: 'desc' },
    })

    const pendingSales = await this.prisma.sale.findMany({
      where: { customerId, tenantId, remainingBalance: { gt: 0 } },
      orderBy: { saleDate: 'asc' },
    })

    return {
      customer: {
        id: customer.id,
        name: customer.name,
        creditLimit: customer.creditLimit,
        currentDebt: customer.currentDebt,
        creditAvailable: Math.max(0, Number(customer.creditLimit) - Number(customer.currentDebt)),
      },
      pendingSales,
      payments,
    }
  }

  // ── Pago a cuenta con distribución FIFO ─────────────────────────────────────
  async payToAccount(tenantId: string, dto: PayToAccountDto, idempotencyKey?: string) {
    const payload = { payToAccount: dto }
    const replay = await findIdempotencyReplay(this.prisma, tenantId, 'CUSTOMER_PAY_TO_ACCOUNT', idempotencyKey, payload)
    if (replay) return this.replayAccountPayment(this.prisma, tenantId, dto.amount, replay)
    try {
    const customer = await this.prisma.customer.findFirst({
      where: { id: dto.customerId, tenantId },
    })
    if (!customer) {
      throw new NotFoundException(`Cliente con id "${dto.customerId}" no encontrado`)
    }
    if (Number(customer.currentDebt) <= 0) {
      throw new BadRequestException('Este cliente no tiene deuda pendiente.')
    }
    if (dto.amount > Number(customer.currentDebt)) {
      throw new BadRequestException(
        `El pago (Gs. ${dto.amount.toLocaleString('es-PY')}) supera la deuda actual del cliente (Gs. ${Number(customer.currentDebt).toLocaleString('es-PY')}).`,
      )
    }

    // Ventas con saldo pendiente, de la más vieja a la más nueva (FIFO)
    const pendingSales = await this.prisma.sale.findMany({
      where: { tenantId, customerId: dto.customerId, remainingBalance: { gt: 0 } },
      orderBy: { saleDate: 'asc' },
    })

    return this.prisma.$transaction(async (tx) => {
      const claim = await claimIdempotency(tx, tenantId, 'CUSTOMER_PAY_TO_ACCOUNT', idempotencyKey, payload)
      if (claim && !claim.created) return this.replayAccountPayment(tx, tenantId, dto.amount, claim)

      const customerLock = await tx.customer.updateMany({
        where: { id: dto.customerId, tenantId }, data: { currentDebt: { increment: 0 } },
      })
      if (customerLock.count !== 1) throw new NotFoundException(`Cliente con id "${dto.customerId}" no encontrado`)
      const lockedCustomer = await tx.customer.findFirst({ where: { id: dto.customerId, tenantId } })
      if (!lockedCustomer || dto.amount > Number(lockedCustomer.currentDebt) + 0.001) {
        throw new ConflictException('La deuda del cliente cambió antes de registrar el pago.')
      }
      const pendingSales = await tx.sale.findMany({
        where: { tenantId, customerId: dto.customerId, status: 'COMPLETED', remainingBalance: { gt: 0 } },
        orderBy: { saleDate: 'asc' },
      })
      for (const saleId of pendingSales.map((sale) => sale.id).sort()) {
        await tx.$queryRaw<Array<{ id: string }>>`
          SELECT "id" FROM "sales" WHERE "id" = ${saleId} AND "tenantId" = ${tenantId} FOR UPDATE
        `
      }
      const currentPendingSales = await tx.sale.findMany({
        where: { tenantId, customerId: dto.customerId, status: 'COMPLETED', remainingBalance: { gt: 0 } },
        orderBy: [{ saleDate: 'asc' }, { id: 'asc' }],
      })
      const cashSessionId = await this.lockOpenCashSession(tx, tenantId, dto.paymentMethod === PaymentMethod.CASH)
      const paymentDate = new Date()
      let remainingToDistribute = dto.amount
      const paymentsCreated: any[] = []

      for (const sale of currentPendingSales) {
        if (remainingToDistribute <= 0) break

        const appliedAmount = Math.min(Number(sale.remainingBalance), remainingToDistribute)

        const payment = await tx.customerPayment.create({
          data: {
            tenantId,
            customerId: dto.customerId,
            saleId: sale.id,
            amount: appliedAmount,
            paymentMethod: dto.paymentMethod,
            cashSessionId,
            paymentDate,
            notes: dto.notes,
          },
        })
        paymentsCreated.push(payment)

        const newRemaining = Number(sale.remainingBalance) - appliedAmount
        await tx.sale.update({
          where: { id: sale.id },
          data: {
            remainingBalance: newRemaining,
            paymentStatus: newRemaining <= 0 ? PaymentStatus.PAID : PaymentStatus.PARTIAL,
          },
        })

        remainingToDistribute -= appliedAmount
      }

      // Caso borde: excedente sin venta asociada
      if (remainingToDistribute > 0) {
        const payment = await tx.customerPayment.create({
          data: {
            tenantId,
            customerId: dto.customerId,
            saleId: null,
            amount: remainingToDistribute,
            paymentMethod: dto.paymentMethod,
            cashSessionId,
            paymentDate,
            notes: dto.notes ? `${dto.notes} (excedente sin venta asociada)` : 'Excedente sin venta asociada',
          },
        })
        paymentsCreated.push(payment)
      }

      await tx.customer.update({
        where: { id: dto.customerId },
        data: { currentDebt: { decrement: dto.amount } },
      })

      const result = {
        totalApplied: dto.amount,
        salesAffected: paymentsCreated.length,
        payments: paymentsCreated,
      }
      await completeIdempotency(tx, tenantId, claim, 'CUSTOMER_PAYMENT_BATCH', paymentsCreated.map((payment) => payment.id))
      return result
    })
    } catch (error) {
      const validationReplay = await findIdempotencyReplay(this.prisma, tenantId, 'CUSTOMER_PAY_TO_ACCOUNT', idempotencyKey, payload)
      if (validationReplay) return this.replayAccountPayment(this.prisma, tenantId, dto.amount, validationReplay)
      throw error
    }
  }

  private async replayAccountPayment(
    client: Prisma.TransactionClient | PrismaService,
    tenantId: string,
    amount: number,
    claim: NonNullable<Awaited<ReturnType<typeof findIdempotencyReplay>>>,
  ) {
    if (claim.resourceType !== 'CUSTOMER_PAYMENT_BATCH' || !claim.resourceIds.length) {
      throw new ConflictException('El resultado original del pago a cuenta no está disponible.')
    }
    const rows = await client.customerPayment.findMany({
      where: { id: { in: claim.resourceIds }, tenantId },
    })
    const byId = new Map(rows.map((row) => [row.id, row]))
    const payments = claim.resourceIds.map((id) => byId.get(id))
    if (payments.some((payment) => !payment)) throw new NotFoundException('El pago original ya no está disponible.')
    return { totalApplied: amount, salesAffected: payments.length, payments }
  }

  // ── Anular un pago con reversión de deudas ───────────────────────────────────
  async voidPayment(id: string, tenantId: string, dto: VoidPaymentDto) {
    return this.prisma.$transaction(async (tx) => {
      const payment = await tx.customerPayment.findFirst({
        where: { id, tenantId },
      })
      if (!payment) {
        throw new NotFoundException(`Pago con id "${id}" no encontrado`)
      }
      if (payment.isVoided) {
        throw new BadRequestException('Este pago ya fue anulado.')
      }

      const customerLock = await tx.customer.updateMany({
        where: { id: payment.customerId, tenantId }, data: { currentDebt: { increment: 0 } },
      })
      if (customerLock.count !== 1) throw new NotFoundException('Cliente asociado al pago no encontrado')
      let sale: Awaited<ReturnType<typeof tx.sale.findFirst>> | null = null
      if (payment.saleId) {
        await tx.$queryRaw<Array<{ id: string }>>`
          SELECT "id" FROM "sales" WHERE "id" = ${payment.saleId} AND "tenantId" = ${tenantId} FOR UPDATE
        `
        sale = await tx.sale.findFirst({ where: { id: payment.saleId, tenantId } })
        if (!sale) throw new NotFoundException('Venta asociada al pago no encontrada')
        const priorReturns = await tx.saleReturn.count({ where: { tenantId, saleId: payment.saleId, status: 'CONFIRMED' } })
        if (priorReturns > 0) {
          throw new ConflictException('No se puede anular un pago de una venta devuelta; registrá una corrección financiera vinculada.')
        }
      }

      const paymentSessions = await tx.cashSession.findMany({
        where: payment.cashSessionId
          ? { id: payment.cashSessionId, tenantId }
          : {
              tenantId,
              openedAt: { lte: payment.paymentDate },
              OR: [
                { closedAt: { gt: payment.paymentDate } },
                { closedAt: null, status: CashSessionStatus.OPEN },
              ],
            },
        select: { id: true, status: true },
        take: 2,
      })
      if (paymentSessions.length > 1) {
        throw new ConflictException(
          'No se puede anular este pago porque no se puede asociar a una única sesión de caja.',
        )
      }
      if (paymentSessions[0]?.status === CashSessionStatus.CLOSED) {
        throw new ConflictException(
          'No se puede anular este pago porque pertenece a una caja cerrada. Usá el procedimiento de corrección o devolución correspondiente.',
        )
      }
      if (
        paymentSessions.length === 0 &&
        (payment.paymentMethod === PaymentMethod.CASH || payment.paymentMethod === PaymentMethod.CREDIT)
      ) {
        throw new ConflictException(
          'No se puede determinar la sesión de caja de este cobro; conciliá el registro antes de anularlo.',
        )
      }
      if (paymentSessions[0]?.status === CashSessionStatus.OPEN) {
        const lockedSession = await tx.cashSession.updateMany({
          where: {
            id: paymentSessions[0].id,
            tenantId,
            status: CashSessionStatus.OPEN,
          },
          data: { totalSales: { increment: 0 } },
        })
        if (lockedSession.count !== 1) {
          throw new ConflictException(
            'No se puede anular el pago porque la sesión de caja se cerró durante la operación.',
          )
        }
      }

      // Revertir la deuda del cliente
      await tx.customer.update({
        where: { id: payment.customerId },
        data: { currentDebt: { increment: payment.amount } },
      })

      // Revertir el saldo de la venta puntual, si el pago estaba asociado a una
      if (sale) {
        const newRemaining = Number(sale.remainingBalance) + Number(payment.amount)
        await tx.sale.update({
          where: { id: sale.id },
          data: {
            remainingBalance: newRemaining,
            paymentStatus: newRemaining >= Number(sale.total) ? PaymentStatus.PENDING : PaymentStatus.PARTIAL,
          },
        })
      }

      return tx.customerPayment.update({
        where: { id },
        data: {
          isVoided: true,
          voidedAt: new Date(),
          voidReason: dto.reason,
        },
        include: {
          customer: { select: { id: true, name: true } },
          sale: { select: { id: true, saleDate: true, total: true, remainingBalance: true } },
        },
      })
    })
  }
}
