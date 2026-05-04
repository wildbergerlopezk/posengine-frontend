import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { OpenCashSessionDto } from './dto/open-cash-session.dto'
import { CloseCashSessionDto } from './dto/close-cash-session.dto'
import { ForceCloseCashSessionDto } from './dto/force-close-cash-session.dto'
import { CashSessionFilterDto } from './dto/cash-session-filter.dto'
import { CashSessionStatus, SaleStatus } from '../../generated/prisma/enums'

const MIN_OPEN_MINUTES = 60

@Injectable()
export class CashSessionService {
  constructor(private readonly prisma: PrismaService) { }

  // ── Open ────────────────────────────────────────────────────────────────────
  async open(tenantId: string, userId: string, dto: OpenCashSessionDto) {
    // 1. Verificar si hay una sesión OPEN de un día anterior → cerrarla automáticamente
    const staleSession = await this.prisma.cashSession.findFirst({
      where: {
        tenantId,
        status: CashSessionStatus.OPEN,
        openedAt: { lt: this.getTodayRange().startOfDay },
      },
    })

    if (staleSession) {
      await this.autoCloseStaleSession(staleSession)
    }

    // 2. Si hay una sesión OPEN de HOY → error normal (el usuario debe cerrarla primero)
    const openTodaySession = await this.prisma.cashSession.findFirst({
      where: { tenantId, status: CashSessionStatus.OPEN },
    })
    if (openTodaySession) {
      throw new ConflictException(
        'Ya hay una caja abierta hoy. Cerrala antes de abrir una nueva.',
      )
    }

    // 3. Solo una sesión por día calendario
    const { startOfDay, endOfDay } = this.getTodayRange()
    const todaySession = await this.prisma.cashSession.findFirst({
      where: { tenantId, openedAt: { gte: startOfDay, lte: endOfDay } },
    })
    if (todaySession) {
      throw new ConflictException(
        'Ya se realizó una apertura de caja hoy. Solo se permite una por día.',
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

    // Si no hay sesión abierta, verificar si ya se cerró hoy
    if (!session) {
      const { startOfDay, endOfDay } = this.getTodayRange()
      const closedToday = await this.prisma.cashSession.findFirst({
        where: {
          tenantId,
          status: CashSessionStatus.CLOSED,
          openedAt: { gte: startOfDay, lte: endOfDay },
        },
      })
      return { session: null, closedToday: !!closedToday }
    }

    // ── NUEVO: sesión de un día anterior → cerrarla automáticamente ──────────
    const { startOfDay } = this.getTodayRange()
    if (session.openedAt < startOfDay) {
      await this.autoCloseStaleSession(session)
      return {
        session: null,
        closedToday: false,
        // El frontend puede mostrar un toast/banner si quiere
        autoClosedStale: true,
      }
    }

    // Calcular totales en tiempo real para mostrar en el frontend
    const { totalSales, totalPurchases } = await this.calculateTotals(
      tenantId,
      session.id,
    )
    const expectedAmount = session.openingAmount + totalSales - totalPurchases

    return {
      session: { ...session, totalSales, totalPurchases, expectedAmount },
      closedToday: false,
    }
  }

  // ── Close ───────────────────────────────────────────────────────────────────
  async close(tenantId: string, sessionId: string, dto: CloseCashSessionDto) {
    const session = await this.findOpenSession(tenantId, sessionId)

    // Validación 1: tiempo mínimo abierta
    this.assertMinimumTime(session.openedAt)

    // Validación 2: al menos una venta registrada
    await this.assertHasSales(tenantId, sessionId)

    return this.executeClose(session, dto.closingAmount, false)
  }

  // ── Force close ─────────────────────────────────────────────────────────────
  async forceClose(
    tenantId: string,
    sessionId: string,
    dto: ForceCloseCashSessionDto,
  ) {
    const session = await this.findOpenSession(tenantId, sessionId)

    // La confirmación escrita ya fue validada en el DTO (@Equals('CERRAR'))
    // Solo saltea las validaciones de tiempo y ventas, todo lo demás aplica igual
    return this.executeClose(session, dto.closingAmount, true)
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

  // ── GetHistory ───────────────────────────────────────────────────────────────
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

  // ── Helpers privados ────────────────────────────────────────────────────────

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

  private assertMinimumTime(openedAt: Date) {
    const minutesOpen = (Date.now() - openedAt.getTime()) / 1000 / 60
    if (minutesOpen < MIN_OPEN_MINUTES) {
      throw new BadRequestException(
        `La caja se abrió hace ${Math.floor(minutesOpen)} minutos. El mínimo para cerrar es ${MIN_OPEN_MINUTES} minutos.`,
      )
    }
  }

  private async assertHasSales(tenantId: string, sessionId: string) {
    const count = await this.prisma.sale.count({
      where: { tenantId, cashSessionId: sessionId, status: SaleStatus.COMPLETED },
    })
    if (count === 0) {
      throw new BadRequestException(
        'No se puede cerrar la caja sin haber registrado al menos una venta.',
      )
    }
  }

  private async calculateTotals(tenantId: string, sessionId: string) {
    const [salesResult, purchasesResult] = await Promise.all([
      this.prisma.sale.aggregate({
        where: { tenantId, cashSessionId: sessionId, status: SaleStatus.COMPLETED },
        _sum: { total: true },
      }),
      this.prisma.purchase.aggregate({
        where: { tenantId, cashSessionId: sessionId },
        _sum: { total: true },
      }),
    ])

    return {
      totalSales: salesResult._sum.total ?? 0,
      totalPurchases: purchasesResult._sum.total ?? 0,
    }
  }

  private async executeClose(
    session: any,
    closingAmount: number,
    forcedClose: boolean,
  ) {
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
        forcedClose,
      },
    })
  }

  // ── Auto-cierre de sesión de día anterior ────────────────────────────────────
  // Se dispara silenciosamente al abrir una nueva sesión.
  // Registra closingAmount = 0 y forcedClose = true para que quede auditado.
  private async autoCloseStaleSession(session: any) {
    const { totalSales, totalPurchases } = await this.calculateTotals(
      session.tenantId,
      session.id,
    )
    const expectedAmount = session.openingAmount + totalSales - totalPurchases

    await this.prisma.cashSession.update({
      where: { id: session.id },
      data: {
        status: CashSessionStatus.CLOSED,
        closedAt: new Date(),
        closingAmount: 0,
        expectedAmount,
        totalSales,
        totalPurchases,
        difference: 0 - expectedAmount,
        forcedClose: true,
      },
    })
  }

  private getTodayRange() {
    const startOfDay = new Date()
    startOfDay.setHours(0, 0, 0, 0)
    const endOfDay = new Date()
    endOfDay.setHours(23, 59, 59, 999)
    return { startOfDay, endOfDay }
  }
}
