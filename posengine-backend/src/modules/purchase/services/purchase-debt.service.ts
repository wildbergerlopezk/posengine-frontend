import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common'
import { PrismaService } from '../../../prisma/prisma.service'
import { Prisma } from '../../../generated/prisma/client'
import { CreatePurchaseDebtDto } from '../dto/create-purchase-debt.dto'
import { CreatePurchaseDebtPaymentDto } from '../dto/create-purchase-debt-payment.dto'

@Injectable()
export class PurchaseDebtService {
  constructor(private readonly prisma: PrismaService) {}

  async createForPurchase(
    tx: Prisma.TransactionClient,
    tenantId: string,
    purchaseId: string,
    total: number,
    dto: CreatePurchaseDebtDto,
  ) {
    const debt = await tx.purchaseDebt.create({
      data: {
        tenantId,
        purchaseId,
        totalAmount: total,
        paidAmount: 0,
        balance: total,
        scheduleType: dto.scheduleType,
        dueDate: dto.scheduleType === 'NONE' ? new Date(dto.dueDate!) : null,
        status: 'PENDING',
      },
    })

    if (dto.scheduleType !== 'NONE' && dto.installments?.length) {
      await tx.purchaseDebtInstallment.createMany({
        data: dto.installments.map((i) => ({
          purchaseDebtId: debt.id,
          number: i.number,
          amount: i.amount,
          dueDate: new Date(i.dueDate),
        })),
      })
    }

    return debt
  }

  async findByPurchase(purchaseId: string, tenantId: string) {
    const debt = await this.prisma.purchaseDebt.findFirst({
      where: { purchaseId, tenantId },
      include: {
        installments: { orderBy: { number: 'asc' } },
        payments: { orderBy: { paymentDate: 'desc' } },
      },
    })
    if (!debt) throw new NotFoundException('Esta compra no tiene deuda asociada')
    return debt
  }

  async registerPayment(tenantId: string, purchaseId: string, dto: CreatePurchaseDebtPaymentDto) {
    return this.prisma.$transaction(async (tx) => {
      const debt = await tx.purchaseDebt.findFirst({
        where: { purchaseId, tenantId },
        include: { installments: { orderBy: { number: 'asc' } } },
      })
      if (!debt) throw new NotFoundException('Esta compra no tiene deuda asociada')
      if (debt.status === 'PAID') throw new ConflictException('La deuda ya está totalmente pagada')
      if (debt.status === 'CANCELLED') throw new ConflictException('La deuda está cancelada')
      if (dto.amount > Number(debt.balance) + 0.01) {
        throw new BadRequestException(
          `El pago (${dto.amount}) supera el saldo pendiente (${debt.balance})`,
        )
      }

      await tx.purchaseDebtPayment.create({
        data: {
          tenantId,
          purchaseDebtId: debt.id,
          installmentId: dto.installmentId,
          amount: dto.amount,
          paymentDate: dto.paymentDate ? new Date(dto.paymentDate) : new Date(),
          cashSessionId: dto.cashSessionId,
          notes: dto.notes,
        },
      })

      const newPaid = Number(debt.paidAmount) + dto.amount
      const newBalance = Number(debt.totalAmount) - newPaid

      await tx.purchaseDebt.update({
        where: { id: debt.id },
        data: {
          paidAmount: newPaid,
          balance: newBalance,
          status: newBalance <= 0.01 ? 'PAID' : 'PARTIAL',
        },
      })

      if (dto.installmentId) {
        // pago dirigido a una cuota puntual
        const installment = debt.installments.find((i) => i.id === dto.installmentId)
        if (!installment) throw new NotFoundException('Cuota no encontrada')
        const instPaid = Number(installment.paidAmount) + dto.amount
        if (instPaid > Number(installment.amount) + 0.01) {
          throw new BadRequestException('El pago supera el monto de la cuota seleccionada')
        }
        await tx.purchaseDebtInstallment.update({
          where: { id: installment.id },
          data: {
            paidAmount: instPaid,
            status: instPaid >= Number(installment.amount) - 0.01 ? 'PAID' : 'PARTIAL',
          },
        })
      } else if (debt.installments.length) {
        // sin cuota puntual: se va completando en orden (FIFO)
        let remaining = dto.amount
        for (const inst of debt.installments) {
          if (remaining <= 0) break
          const pending = Number(inst.amount) - Number(inst.paidAmount)
          if (pending <= 0) continue
          const applied = Math.min(pending, remaining)
          await tx.purchaseDebtInstallment.update({
            where: { id: inst.id },
            data: {
              paidAmount: Number(inst.paidAmount) + applied,
              status: Number(inst.paidAmount) + applied >= Number(inst.amount) - 0.01 ? 'PAID' : 'PARTIAL',
            },
          })
          remaining -= applied
        }
      }

      return tx.purchaseDebt.findUnique({
        where: { id: debt.id },
        include: { installments: { orderBy: { number: 'asc' } }, payments: true },
      })
    })
  }
}
