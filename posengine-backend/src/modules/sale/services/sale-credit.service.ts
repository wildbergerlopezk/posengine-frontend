import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../../prisma/prisma.service'
import { CreateSaleDto } from '../dto/create-sale.dto'
import { PaymentMethod, PaymentStatus } from '../../../generated/prisma/enums'
import { Prisma } from '../../../generated/prisma/client'

@Injectable()
export class SaleCreditService {
  constructor(private readonly prisma: PrismaService) {}

  async validateCreditLimit(tenantId: string, dto: CreateSaleDto, total: number) {
    const paymentMethod = dto.paymentMethod ?? PaymentMethod.CASH
    const amountPaid = dto.amountPaid ?? 0
    const remainingBalance = Math.max(0, total - amountPaid)

    let customer: Awaited<ReturnType<typeof this.prisma.customer.findFirst>> | null = null

    if (paymentMethod === PaymentMethod.CREDIT) {
      if (!dto.customerId) {
        throw new BadRequestException('Las ventas a crédito requieren un cliente asociado.')
      }

      customer = await this.prisma.customer.findFirst({
        where: { id: dto.customerId, tenantId },
      })
      if (!customer) {
        throw new NotFoundException(`Cliente con id "${dto.customerId}" no encontrado`)
      }
      if (!customer.isActive) {
        throw new BadRequestException('El cliente está inactivo.')
      }
      if (!customer.creditEnabled) {
        throw new BadRequestException(`El cliente "${customer.name}" no tiene crédito habilitado.`)
      }
      if (amountPaid > total) {
        throw new BadRequestException('El monto abonado no puede superar el total de la venta.')
      }

      const projectedDebt = Number(customer.currentDebt) + remainingBalance
      if (remainingBalance > 0 && projectedDebt > Number(customer.creditLimit)) {
        const available = Math.max(0, Number(customer.creditLimit) - Number(customer.currentDebt))
        throw new BadRequestException(
          `El cliente "${customer.name}" no tiene crédito suficiente. Disponible: Gs. ${available.toLocaleString('es-PY')}, requerido: Gs. ${remainingBalance.toLocaleString('es-PY')}.`,
        )
      }
    } else if (dto.customerId) {
      customer = await this.prisma.customer.findFirst({
        where: { id: dto.customerId, tenantId },
      })
      if (!customer) {
        throw new NotFoundException(`Cliente con id "${dto.customerId}" no encontrado`)
      }
    }

    return customer
  }

  async processCreditDebtAndPayments(
    tx: Prisma.TransactionClient,
    tenantId: string,
    saleId: string,
    customer: any,
    remainingBalance: number,
    amountPaid: number,
    paymentMethod: PaymentMethod,
  ) {
    // Incrementar deuda del cliente si quedó saldo pendiente
    if (customer && remainingBalance > 0) {
      await tx.customer.update({
        where: { id: customer.id },
        data: { currentDebt: { increment: remainingBalance } },
      })
    }

    // Si hubo seña, dejamos registro como CustomerPayment
    if (customer && amountPaid > 0) {
      await tx.customerPayment.create({
        data: {
          tenantId,
          customerId: customer.id,
          saleId,
          amount: amountPaid,
          paymentMethod,
        },
      })
    }
  }

  async revertCreditDebtAndPayments(
    tx: Prisma.TransactionClient,
    tenantId: string,
    sale: any,
  ) {
    // Revertir deuda del cliente
    if (sale.customerId && sale.remainingBalance > 0) {
      await tx.customer.update({
        where: { id: sale.customerId },
        data: { currentDebt: { decrement: sale.remainingBalance } },
      })
    }

    // Anular cobros/señas registrados para esta venta
    await tx.customerPayment.updateMany({
      where: { saleId: sale.id, tenantId },
      data: {
        isVoided: true,
        voidedAt: new Date(),
        voidReason: 'Anulación automática por cancelación de venta',
      },
    })
  }

  async restoreCreditDebtAndPayments(
    tx: Prisma.TransactionClient,
    tenantId: string,
    sale: any,
  ) {
    // Validar límite de crédito del cliente si la venta es a crédito
    if (sale.customerId && sale.remainingBalance > 0) {
      const customer = await tx.customer.findFirst({
        where: { id: sale.customerId },
      })
      if (customer) {
        if (!customer.isActive) {
          throw new BadRequestException('El cliente asociado está inactivo.')
        }
        const projectedDebt = Number(customer.currentDebt) + Number(sale.remainingBalance)
        if (projectedDebt > Number(customer.creditLimit)) {
          const available = Math.max(0, Number(customer.creditLimit) - Number(customer.currentDebt))
          throw new BadRequestException(
            `El cliente "${customer.name}" no tiene crédito suficiente para restaurar la venta. Disponible: Gs. ${available.toLocaleString('es-PY')}, requerido: Gs. ${Number(sale.remainingBalance).toLocaleString('es-PY')}.`,
          )
        }
      }
    }

    // Incrementar deuda del cliente si corresponde
    if (sale.customerId && sale.remainingBalance > 0) {
      await tx.customer.update({
        where: { id: sale.customerId },
        data: { currentDebt: { increment: sale.remainingBalance } },
      })
    }

    // Restaurar cobros/señas registrados para esta venta
    await tx.customerPayment.updateMany({
      where: { saleId: sale.id, tenantId },
      data: {
        isVoided: false,
        voidedAt: null,
        voidReason: null,
      },
    })
  }
}
