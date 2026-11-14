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
        installments: { orderBy: { number: 'asc' }, include: { adjustments: true, creditApplications: true } },
        payments: { orderBy: { paymentDate: 'desc' } },
        adjustments: { orderBy: { createdAt: 'asc' }, include: { purchaseReturn: { select: { id: true, returnDate: true, creditNoteNumber: true } } } },
      },
    })
    if (!debt) throw new NotFoundException('Esta compra no tiene deuda asociada')
    return debt
  }

  async registerPayment(tenantId: string, purchaseId: string, dto: CreatePurchaseDebtPaymentDto) {
    return this.prisma.$transaction(async (tx) => {
      if (!Number.isFinite(dto.amount) || dto.amount <= 0) {
        throw new BadRequestException('El importe del pago debe ser positivo.')
      }
      if (dto.paymentMethod !== 'CASH' && dto.paymentMethod !== 'TRANSFER') {
        throw new BadRequestException('El medio de pago debe ser CASH o TRANSFER.')
      }
      const paymentDate = dto.paymentDate ? new Date(dto.paymentDate) : new Date()
      if (!Number.isFinite(paymentDate.getTime())) {
        throw new BadRequestException('La fecha del pago no es válida.')
      }

      const existingDebt = await tx.purchaseDebt.findFirst({
        where: { purchaseId, tenantId },
        select: { id: true },
      })
      if (!existingDebt) throw new NotFoundException('Esta compra no tiene deuda asociada')

      let cashSessionId = dto.cashSessionId
      if (!cashSessionId) {
        const openSessions = await tx.cashSession.findMany({
          where: { tenantId, status: 'OPEN' },
          orderBy: { openedAt: 'desc' },
          take: 2,
          select: { id: true },
        })
        if (openSessions.length > 1) {
          throw new ConflictException('Hay más de una caja abierta; no se puede atribuir el pago con seguridad.')
        }
        if (openSessions.length === 1) {
          cashSessionId = openSessions[0].id
        } else if (dto.paymentMethod === 'CASH') {
          throw new ConflictException(
            'Para registrar un pago en efectivo debe existir una caja abierta.',
          )
        }
      }

      if (dto.paymentMethod === 'TRANSFER' && !cashSessionId) {
        const closedSession = await tx.cashSession.findFirst({
          where: {
            tenantId,
            status: 'CLOSED',
            openedAt: { lte: paymentDate },
            closedAt: { gte: paymentDate },
          },
          select: { id: true },
        })
        if (closedSession) {
          throw new ConflictException(
            'La fecha del pago corresponde a una caja cerrada. No se puede alterar ese reporte con un nuevo abono; utilizá el procedimiento de conciliación histórica.',
          )
        }
      }

      if (cashSessionId) {
        const openSession = await tx.cashSession.updateMany({
          where: {
            id: cashSessionId,
            tenantId,
            status: 'OPEN',
          },
          data: { totalSales: { increment: 0 } },
        })
        if (openSession.count !== 1) {
          throw new BadRequestException(
            'La sesión de caja indicada no existe, no pertenece a este negocio o ya está cerrada.',
          )
        }
      }

      // Lock the debt before re-reading its balance so concurrent payments cannot overpay it.
      const lockedDebt = await tx.purchaseDebt.updateMany({
        where: {
          id: existingDebt.id,
          tenantId,
          status: { in: ['PENDING', 'PARTIAL'] },
        },
        data: { paidAmount: { increment: 0 } },
      })
      if (lockedDebt.count !== 1) {
        const currentDebt = await tx.purchaseDebt.findFirst({
          where: { id: existingDebt.id, tenantId },
          select: { status: true },
        })
        if (!currentDebt) throw new NotFoundException('Esta compra no tiene deuda asociada')
        throw new ConflictException(
          currentDebt.status === 'CANCELLED'
            ? 'La deuda está cancelada'
            : 'La deuda ya está totalmente pagada',
        )
      }

      const debt = await tx.purchaseDebt.findFirst({
        where: { id: existingDebt.id, tenantId },
        include: { installments: { orderBy: [{ dueDate: 'asc' }, { number: 'asc' }], include: { adjustments: { select: { amount: true } }, creditApplications: { select: { amount: true } } } }, adjustments: { select: { amount: true } } },
      })
      if (!debt) throw new NotFoundException('Esta compra no tiene deuda asociada')
      if (dto.amount > Number(debt.balance) + 0.01) {
        throw new BadRequestException(
          `El pago (${dto.amount}) supera el saldo pendiente (${debt.balance})`,
        )
      }

      const targetInstallment = dto.installmentId
        ? debt.installments.find((installment) => installment.id === dto.installmentId)
        : undefined
      if (dto.installmentId && !targetInstallment) {
        throw new NotFoundException('Cuota no encontrada')
      }
      const installmentAdjusted = (installment: typeof debt.installments[number]) =>
        installment.adjustments.reduce((sum, adjustment) => sum + Number(adjustment.amount), 0) +
        installment.creditApplications.reduce((sum, application) => sum + Number(application.amount), 0)

      await tx.purchaseDebtPayment.create({
        data: {
          tenantId,
          purchaseDebtId: debt.id,
          installmentId: dto.installmentId,
          amount: dto.amount,
          paymentMethod: dto.paymentMethod,
          paymentDate,
          cashSessionId,
          notes: dto.notes,
        },
      })

      const newPaid = Number(debt.paidAmount) + dto.amount
      const newBalance = Math.max(0, Number(debt.balance) - dto.amount)

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
        const installment = targetInstallment!
        const instPaid = Number(installment.paidAmount) + dto.amount
        const amountDue = Number(installment.amount) - installmentAdjusted(installment)
        if (instPaid > amountDue + 0.01) {
          throw new BadRequestException('El pago supera el monto de la cuota seleccionada')
        }
        await tx.purchaseDebtInstallment.update({
          where: { id: installment.id },
          data: {
            paidAmount: instPaid,
            status: instPaid >= amountDue - 0.01 ? 'PAID' : 'PARTIAL',
          },
        })
      } else if (debt.installments.length) {
        // sin cuota puntual: se va completando en orden (FIFO)
        let remaining = dto.amount
        for (const inst of debt.installments) {
          if (remaining <= 0) break
          const adjusted = installmentAdjusted(inst)
          const pending = Number(inst.amount) - Number(inst.paidAmount) - adjusted
          if (pending <= 0) continue
          const applied = Math.min(pending, remaining)
          await tx.purchaseDebtInstallment.update({
            where: { id: inst.id },
            data: {
              paidAmount: Number(inst.paidAmount) + applied,
              status: Number(inst.paidAmount) + applied >= Number(inst.amount) - adjusted - 0.01 ? 'PAID' : 'PARTIAL',
            },
          })
          remaining -= applied
        }
      }

      return tx.purchaseDebt.findUnique({
        where: { id: debt.id },
        include: {
          installments: { orderBy: { number: 'asc' }, include: { adjustments: true, creditApplications: true } },
          payments: true,
          adjustments: { orderBy: { createdAt: 'asc' } },
        },
      })
    })
  }
}
