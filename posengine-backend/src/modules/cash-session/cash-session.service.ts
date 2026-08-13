import { ConflictException, Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { OpenCashSessionDto } from './dto/open-cash-session.dto'
import { CloseCashSessionDto } from './dto/close-cash-session.dto'
import { CashSessionFilterDto } from './dto/cash-session-filter.dto'
import { CreateCashMovementDto } from './dto/create-cash-movement.dto'
import { CashSessionStatus, SaleStatus, PaymentMethod, PurchaseStatus, PurchasePaymentType } from '../../generated/prisma/enums'

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

    const totals = await this.calculateTotals(
      tenantId,
      session.id,
    )

    return {
      session: { ...session, ...totals },
    }
  }

  // ── Close ───────────────────────────────────────────────────────────────────
  async close(tenantId: string, sessionId: string, dto: CloseCashSessionDto) {
    const session = await this.findOpenSession(tenantId, sessionId)
    return this.executeClose(session, dto.closingAmount)
  }

  // ── Manual Movements ────────────────────────────────────────────────────────
  async addMovement(tenantId: string, dto: CreateCashMovementDto) {
    const activeSession = await this.prisma.cashSession.findFirst({
      where: { tenantId, status: CashSessionStatus.OPEN },
    })

    if (!activeSession) {
      throw new BadRequestException('No hay una sesión de caja activa para registrar movimientos.')
    }

    return this.prisma.cashMovement.create({
      data: {
        tenantId,
        cashSessionId: activeSession.id,
        amount: dto.amount,
        type: dto.type,
        description: dto.description,
      },
    })
  }

  // ── Arqueo/Closing Report ──────────────────────────────────────────────────
  async getReport(tenantId: string, id: string) {
    const session = await this.prisma.cashSession.findFirst({
      where: { id, tenantId },
    })
    if (!session) {
      throw new NotFoundException(`Sesión de caja "${id}" no encontrada`)
    }
    const totals = await this.calculateTotals(tenantId, id)
    
    const user = await this.prisma.user.findUnique({
      where: { id: session.openedBy },
      select: { name: true },
    })

    return {
      session: {
        ...session,
        openedByName: user?.name || 'Usuario desconocido',
      },
      totals,
    }
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
    const totals = await this.calculateTotals(tenantId, id)
    return { ...session, ...totals }
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
      return {
        totalSales: 0,
        totalPurchases: 0,
        totalCreditSales: 0,
        totalCashSales: 0,
        totalDebtPayments: 0,
        totalCashPurchases: 0,
        totalCreditPurchases: 0,
        totalPurchaseDebtPayments: 0,
        totalManualInflows: 0,
        totalManualOutflows: 0,
        movements: [],
      }
    }

    const [
      salesResult,
      paymentsResult,
      cashPurchasesResult,
      creditPurchasesResult,
      creditSalesResult,
      purchasePaymentsResult,
      inflowsResult,
      outflowsResult,
      movementsList
    ] = await Promise.all([
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
      // 2. Todos los pagos recibidos de clientes (señas de créditos y cobros posteriores) dentro del rango de tiempo de la sesión
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
      // 3. Compras registradas al contado en la sesión
      this.prisma.purchase.aggregate({
        where: {
          tenantId,
          cashSessionId: sessionId,
          paymentType: PurchasePaymentType.CASH,
          status: { in: [PurchaseStatus.RECEIVED, PurchaseStatus.FULLY_RETURNED] },
        },
        _sum: { total: true },
      }),
      // 4. Compras registradas a crédito en la sesión
      this.prisma.purchase.aggregate({
        where: {
          tenantId,
          cashSessionId: sessionId,
          paymentType: PurchasePaymentType.CREDIT,
          status: { in: [PurchaseStatus.RECEIVED, PurchaseStatus.FULLY_RETURNED] },
        },
        _sum: { total: true },
      }),
      // 5. Ventas a crédito de la sesión
      this.prisma.sale.aggregate({
        where: {
          tenantId,
          cashSessionId: sessionId,
          status: SaleStatus.COMPLETED,
          paymentMethod: PaymentMethod.CREDIT,
        },
        _sum: { remainingBalance: true },
      }),
      // 6. Pagos realizados a proveedores dentro del rango de la sesión
      this.prisma.purchaseDebtPayment.aggregate({
        where: {
          tenantId,
          paymentDate: {
            gte: session.openedAt,
            ...(session.closedAt && { lte: session.closedAt }),
          },
        },
        _sum: { amount: true },
      }),
      // 7. Movimientos manuales de ingreso (IN) en la sesión
      this.prisma.cashMovement.aggregate({
        where: {
          tenantId,
          cashSessionId: sessionId,
          type: 'IN',
        },
        _sum: { amount: true },
      }),
      // 8. Movimientos manuales de egreso (OUT) en la sesión
      this.prisma.cashMovement.aggregate({
        where: {
          tenantId,
          cashSessionId: sessionId,
          type: 'OUT',
        },
        _sum: { amount: true },
      }),
      // 9. Lista de movimientos manuales de la sesión
      this.prisma.cashMovement.findMany({
        where: {
          tenantId,
          cashSessionId: sessionId,
        },
        orderBy: { createdAt: 'desc' },
      }),
    ])

    const totalCashSales = Number(salesResult._sum.total ?? 0)
    const totalDebtPayments = Number(paymentsResult._sum.amount ?? 0)
    const totalSales = totalCashSales + totalDebtPayments

    const totalCashPurchases = Number(cashPurchasesResult._sum.total ?? 0)
    const totalPurchaseDebtPayments = Number(purchasePaymentsResult._sum.amount ?? 0)
    const totalPurchases = totalCashPurchases + totalPurchaseDebtPayments
    const totalCreditPurchases = Number(creditPurchasesResult._sum.total ?? 0)

    const totalManualInflows = Number(inflowsResult._sum.amount ?? 0)
    const totalManualOutflows = Number(outflowsResult._sum.amount ?? 0)

    return {
      totalSales,
      totalPurchases,
      totalCreditSales: creditSalesResult._sum.remainingBalance ?? 0,
      totalCashSales,
      totalDebtPayments,
      totalCashPurchases,
      totalCreditPurchases,
      totalPurchaseDebtPayments,
      totalManualInflows,
      totalManualOutflows,
      movements: movementsList,
    }
  }

  private async executeClose(session: any, closingAmount: number) {
    const { totalSales, totalPurchases, totalManualInflows, totalManualOutflows } = await this.calculateTotals(
      session.tenantId,
      session.id,
    )
    const expectedAmount = session.openingAmount + totalSales + totalManualInflows - totalPurchases - totalManualOutflows
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

