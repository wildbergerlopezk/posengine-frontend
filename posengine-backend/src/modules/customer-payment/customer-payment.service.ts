import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { PaymentStatus, PaymentMethod } from '../../generated/prisma/enums'
import { Prisma } from '../../generated/prisma/client'
import { CreateCustomerPaymentDto } from './dto/create-customer-payment.dto'
import { CustomerPaymentFilterDto } from './dto/customer-payment-filter.dto'
import { PayToAccountDto } from './dto/pay-to-account.dto'
import { VoidPaymentDto } from './dto/void-payment.dto'

@Injectable()
export class CustomerPaymentService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Create ──────────────────────────────────────────────────────────────────
  async create(tenantId: string, dto: CreateCustomerPaymentDto) {
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

    return this.prisma.$transaction(async (tx) => {
      const payment = await tx.customerPayment.create({
        data: {
          tenantId,
          customerId: dto.customerId,
          saleId: dto.saleId,
          amount: dto.amount,
          paymentMethod: dto.paymentMethod ?? PaymentMethod.CASH,
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

      return tx.customerPayment.findUnique({
        where: { id: payment.id },
        include: {
          customer: { select: { id: true, name: true } },
          sale: { select: { id: true, saleDate: true, total: true, remainingBalance: true } },
        },
      })
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
  async payToAccount(tenantId: string, dto: PayToAccountDto) {
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
      let remainingToDistribute = dto.amount
      const paymentsCreated: any[] = []

      for (const sale of pendingSales) {
        if (remainingToDistribute <= 0) break

        const appliedAmount = Math.min(Number(sale.remainingBalance), remainingToDistribute)

        const payment = await tx.customerPayment.create({
          data: {
            tenantId,
            customerId: dto.customerId,
            saleId: sale.id,
            amount: appliedAmount,
            paymentMethod: dto.paymentMethod,
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
            notes: dto.notes ? `${dto.notes} (excedente sin venta asociada)` : 'Excedente sin venta asociada',
          },
        })
        paymentsCreated.push(payment)
      }

      await tx.customer.update({
        where: { id: dto.customerId },
        data: { currentDebt: { decrement: dto.amount } },
      })

      return {
        totalApplied: dto.amount,
        salesAffected: paymentsCreated.length,
        payments: paymentsCreated,
      }
    })
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

      // Revertir la deuda del cliente
      await tx.customer.update({
        where: { id: payment.customerId },
        data: { currentDebt: { increment: payment.amount } },
      })

      // Revertir el saldo de la venta puntual, si el pago estaba asociado a una
      if (payment.saleId) {
        const sale = await tx.sale.findUnique({ where: { id: payment.saleId } })
        if (sale) {
          const newRemaining = Number(sale.remainingBalance) + Number(payment.amount)
          await tx.sale.update({
            where: { id: sale.id },
            data: {
              remainingBalance: newRemaining,
              paymentStatus:
                newRemaining >= Number(sale.total)
                  ? PaymentStatus.PENDING
                  : PaymentStatus.PARTIAL,
            },
          })
        }
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
