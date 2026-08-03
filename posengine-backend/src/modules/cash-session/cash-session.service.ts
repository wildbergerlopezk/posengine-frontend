import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { OpenCashSessionDto } from './dto/open-cash-session.dto'
import { CloseCashSessionDto } from './dto/close-cash-session.dto'
import { CashSessionFilterDto } from './dto/cash-session-filter.dto'
import { CashSessionStatus, SaleStatus, PaymentMethod } from '../../generated/prisma/enums'

@Injectable()
export class CashSessionService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Open ────────────────────────────────────────────────────────────────────
  async open(tenantId: string, userId: string, dto: OpenCashSessionDto) {
    const existingOpen = await this.prisma.cashSession.findFirst({
      where: { tenantId, status: CashSessionStatus.OPEN },
    })

    if (existingOpen) {
      throw new ConflictException(
        'Ya hay una caja abierta. Cerrála antes de abrir una nueva.',
      )
    }

    return this.prisma.cashSession.create({
      data: {
        tenantId,
        openedBy: userId,
        openingAmount: dto.openingAmount,
        status: CashSessionStatus.OPEN,
      },
    })
  }

  // ── Current ─────────────────────────────────────────────────────────────────
  async getCurrent(tenantId: string) {
    const session = await this.prisma.cashSession.findFirst({
      where: { tenantId, status: CashSessionStatus.OPEN },
    })

    if (!session) {
      return { session: null }
    }

    const { totalSales, totalPurchases, totalCreditSales, totalCashSales, totalDebtPayments } = await this.calculateTotals(
      tenantId,
      session.id,
    )

    return {
      session: { ...session, totalSales, totalPurchases, totalCreditSales, totalCashSales, totalDebtPayments },
    }
  }

  // ── Close ───────────────────────────────────────────────────────────────────
  async close(tenantId: string, sessionId: string, dto: CloseCashSessionDto) {
    const session = await this.findOpenSession(tenantId, sessionId)
    return this.executeClose(session, dto.closingAmount)
  }

  // ── FindAll ─────────────────────────────────────────────────────────────────
  async findAll(tenantId: string, filters: CashSessionFilterDto) {
    const { status, dateFrom, dateTo, page = 1, limit = 20 } = filters
    const skip = (page - 1) * limit

    const where: any = { tenantId }
    if (status) where.status = status
    if (dateFrom) where.openedAt = { ...where.openedAt, gte: new Date(dateFrom) }
    if (dateTo) {
      const end = new Date(dateTo)
      end.setHours(23, 59, 59, 999)
      where.openedAt = { ...where.openedAt, lte: end }
    }

    const [items, total] = await Promise.all([
      this.prisma.cashSession.findMany({
        where,
        skip,
        take: limit,
        orderBy: { openedAt: 'desc' },
      }),
      this.prisma.cashSession.count({ where }),
    ])

    return { items, total, page, limit }
  }

  // ── GetHistory ─────────────────────────────────────────────────────────────
  async getHistory(tenantId: string, year: number, month: number) {
    const startDate = new Date(year, month - 1, 1)
    const endDate = new Date(year, month, 0, 23, 59, 59, 999)

    return this.prisma.cashSession.findMany({
      where: {
        tenantId,
        openedAt: { gte: startDate, lte: endDate },
      },
      orderBy: { openedAt: 'desc' },
    })
  }

  // ── FindOne ─────────────────────────────────────────────────────────────────
  async findOne(tenantId: string, id: string) {
    const session = await this.prisma.cashSession.findFirst({
      where: { id, tenantId },
    })
    if (!session) {
      throw new NotFoundException(`Sesión de caja "${id}" no encontrada`)
    }
    const { totalCreditSales, totalCashSales, totalDebtPayments } = await this.calculateTotals(tenantId, id)
    return { ...session, totalCreditSales, totalCashSales, totalDebtPayments }
  }

  // ── Helpers privados ─────────────────────────────────────────────────────────
  private async findOpenSession(tenantId: string, sessionId: string) {
    const session = await this.prisma.cashSession.findFirst({
      where: { id: sessionId, tenantId, status: CashSessionStatus.OPEN },
    })
    if (!session) {
      throw new NotFoundException(
        'No se encontró una sesión de caja abierta con ese id.',
      )
    }
    return session
  }

  private async calculateTotals(tenantId: string, sessionId: string) {
    const session = await this.prisma.cashSession.findUnique({
      where: { id: sessionId },
      select: { openedAt: true, closedAt: true },
    })

    if (!session) {
      return { totalSales: 0, totalPurchases: 0, totalCreditSales: 0 }
    }

    const [salesResult, paymentsResult, purchasesResult, creditSalesResult] = await Promise.all([
      // 1. Solo ventas en efectivo/tarjeta/transferencia que pertenezcan a esta sesión
      this.prisma.sale.aggregate({
        where: {
          tenantId,
          cashSessionId: sessionId,
          status: SaleStatus.COMPLETED,
          paymentMethod: { in: [PaymentMethod.CASH, PaymentMethod.CARD, PaymentMethod.TRANSFER] },
        },
        _sum: { total: true },
      }),
      // 2. Todos los pagos recibidos (señas de créditos y cobros posteriores) dentro del rango de tiempo de la sesión
      this.prisma.customerPayment.aggregate({
        where: {
          tenantId,
          isVoided: false,
          paymentDate: {
            gte: session.openedAt,
            ...(session.closedAt && { lte: session.closedAt }),
          },
        },
        _sum: { amount: true },
      }),
      // 3. Compras registradas en la sesión
      this.prisma.purchase.aggregate({
        where: { tenantId, cashSessionId: sessionId },
        _sum: { total: true },
      }),
      // 4. Ventas a crédito de la sesión
      this.prisma.sale.aggregate({
        where: {
          tenantId,
          cashSessionId: sessionId,
          status: SaleStatus.COMPLETED,
          paymentMethod: PaymentMethod.CREDIT,
        },
        _sum: { remainingBalance: true },
      }),
    ])

    const totalCashSales = salesResult._sum.total ?? 0
    const totalDebtPayments = paymentsResult._sum.amount ?? 0
    const totalSales = totalCashSales + totalDebtPayments

    return {
      totalSales,
      totalPurchases: purchasesResult._sum.total ?? 0,
      totalCreditSales: creditSalesResult._sum.remainingBalance ?? 0,
      totalCashSales,
      totalDebtPayments,
    }
  }

  private async executeClose(session: any, closingAmount: number) {
    const { totalSales, totalPurchases } = await this.calculateTotals(
      session.tenantId,
      session.id,
    )
    const expectedAmount = session.openingAmount + totalSales - totalPurchases
    const difference = closingAmount - expectedAmount

    return this.prisma.cashSession.update({
      where: { id: session.id },
      data: {
        status: CashSessionStatus.CLOSED,
        closedAt: new Date(),
        closingAmount,
        expectedAmount,
        totalSales,
        totalPurchases,
        difference,
      },
    })
  }
}
