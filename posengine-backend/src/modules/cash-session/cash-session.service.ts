import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { OpenCashSessionDto } from './dto/open-cash-session.dto'
import { CloseCashSessionDto } from './dto/close-cash-session.dto'
import { CashSessionFilterDto } from './dto/cash-session-filter.dto'
import { CashSessionStatus, SaleStatus } from '../../generated/prisma/enums'

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

    const { totalSales, totalPurchases } = await this.calculateTotals(
      tenantId,
      session.id,
    )

    return {
      session: { ...session, totalSales, totalPurchases },
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
    return session
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
    const [salesResult, purchasesResult] = await Promise.all([
      this.prisma.sale.aggregate({
        where: {
          tenantId,
          cashSessionId: sessionId,
          status: SaleStatus.COMPLETED,
        },
        _sum: { total: true },
      }),
      this.prisma.purchase.aggregate({
        where: { tenantId, cashSessionId: sessionId }, _sum: { total: true } }),
    ])

    return {
      totalSales: salesResult._sum.total ?? 0,
      totalPurchases: purchasesResult._sum.total ?? 0,
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
