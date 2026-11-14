import { ConflictException, ForbiddenException, Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { OpenCashSessionDto } from './dto/open-cash-session.dto'
import { CloseCashSessionDto } from './dto/close-cash-session.dto'
import { CashSessionFilterDto } from './dto/cash-session-filter.dto'
import { CreateCashMovementDto } from './dto/create-cash-movement.dto'
import { ClassifyCashPaymentDto } from './dto/classify-cash-payment.dto'
import { CashSessionStatus, SaleStatus, PaymentMethod, PurchaseStatus, PurchasePaymentType } from '../../generated/prisma/enums'

@Injectable()
export class CashSessionService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Open ────────────────────────────────────────────────────────────────────
  async open(tenantId: string, userId: string, dto: OpenCashSessionDto) {
    const session = await this.prisma.$transaction(async (tx) => {
      // Serialize concurrent opens per tenant without adding a schema constraint.
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(1, hashtext(${tenantId}))::text AS locked`
      const existingOpen = await tx.cashSession.findFirst({
        where: { tenantId, status: CashSessionStatus.OPEN },
      })

      if (existingOpen) {
        throw new ConflictException(
          'Ya hay una caja abierta. Cerrála antes de abrir una nueva.',
        )
      }

      return tx.cashSession.create({
        data: {
          tenantId,
          openedBy: userId,
          openingAmount: dto.openingAmount,
          status: CashSessionStatus.OPEN,
        },
      })
    })

    // Return the same calculated fields as GET /current so the client can render
    // the opening balance immediately without treating missing totals as pending.
    const totals = await this.calculateTotals(tenantId, session.id)
    return { ...session, ...totals }
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

  async getCurrentSummary(tenantId: string) {
    const sessions = await this.prisma.cashSession.findMany({
      where: { tenantId, status: CashSessionStatus.OPEN },
      take: 2,
      select: { id: true },
    })
    if (sessions.length > 1) {
      throw new ConflictException('Hay más de una caja abierta; no se puede resumir con seguridad.')
    }
    if (!sessions[0]) return { session: null }

    const totals = await this.calculateTotals(tenantId, sessions[0].id, this.prisma, false)
    return {
      session: {
        id: sessions[0].id,
        status: CashSessionStatus.OPEN,
        expectedCashAmount: totals.expectedCashAmount,
        cashReconciliationRequired: totals.cashReconciliationRequired,
      },
    }
  }

  async getReconciliationItems(tenantId: string) {
    const openSessions = await this.prisma.cashSession.findMany({
      where: { tenantId, status: CashSessionStatus.OPEN },
      take: 2,
      select: { id: true, openedAt: true, closedAt: true },
    })
    if (openSessions.length > 1) throw new ConflictException('Hay más de una caja abierta; no se puede conciliar con seguridad.')
    const session = openSessions[0]
    if (!session) throw new NotFoundException('No hay una caja abierta para conciliar.')

    const [sessions, customerPayments, supplierPayments] = await Promise.all([
      this.prisma.cashSession.findMany({
        where: { tenantId },
        select: { id: true, openedAt: true, closedAt: true, status: true },
      }),
      this.prisma.customerPayment.findMany({
        where: {
          tenantId,
          isVoided: false,
          paymentMethod: PaymentMethod.CREDIT,
          OR: [
            { cashSessionId: session.id },
            { cashSessionId: null, paymentDate: { gte: session.openedAt } },
          ],
        },
        include: {
          customer: { select: { id: true, name: true } },
          sale: {
            select: {
              id: true,
              saleDate: true,
              total: true,
              internalReceipt: { select: { docNumber: true } },
            },
          },
        },
        orderBy: [{ paymentDate: 'asc' }, { id: 'asc' }],
      }),
      this.prisma.purchaseDebtPayment.findMany({
        where: {
          tenantId,
          OR: [
            { paymentMethod: null },
            { paymentMethod: { notIn: [PaymentMethod.CASH, PaymentMethod.TRANSFER] } },
          ],
          AND: [{
            OR: [
              { cashSessionId: session.id },
              { cashSessionId: null, paymentDate: { gte: session.openedAt } },
            ],
          }],
        },
        include: {
          purchaseDebt: {
            include: {
              purchase: {
                select: {
                  id: true,
                  invoiceNumber: true,
                  supplier: { select: { id: true, name: true } },
                },
              },
            },
          },
        },
        orderBy: [{ paymentDate: 'asc' }, { id: 'asc' }],
      }),
    ])

    const canBelongToSession = (paymentDate: Date, explicitSessionId: string | null) => {
      if (explicitSessionId) {
        return explicitSessionId === session.id
          ? { canClassify: true, reason: null }
          : { canClassify: false, reason: 'El pago está asociado a otra sesión de caja.' }
      }
      const candidates = sessions.filter((candidate) =>
        candidate.openedAt <= paymentDate &&
        (candidate.closedAt === null || paymentDate <= candidate.closedAt),
      )
      if (candidates.length !== 1) {
        return {
          canClassify: false,
          reason: candidates.length === 0
            ? 'No se pudo asociar el pago a una sesión de caja.'
            : 'La fecha coincide con más de una sesión; requiere revisión administrativa.',
        }
      }
      if (candidates[0].id !== session.id || candidates[0].status !== CashSessionStatus.OPEN) {
        return { canClassify: false, reason: 'El pago no pertenece a la sesión abierta actual.' }
      }
      return { canClassify: true, reason: null }
    }

    return {
      sessionId: session.id,
      customers: customerPayments.map((payment) => ({
        id: payment.id,
        type: 'CUSTOMER' as const,
        customer: payment.customer,
        date: payment.paymentDate,
        amount: payment.amount,
        reference: payment.sale
          ? payment.sale.internalReceipt
            ? `Comprobante CI-${String(payment.sale.internalReceipt.docNumber).padStart(7, '0')}`
            : `Venta ${payment.sale.id.slice(0, 8).toUpperCase()}`
          : 'Pago a cuenta',
        paymentMethod: payment.paymentMethod,
        ...canBelongToSession(payment.paymentDate, payment.cashSessionId),
      })),
      suppliers: supplierPayments.map((payment) => ({
        id: payment.id,
        type: 'SUPPLIER' as const,
        supplier: payment.purchaseDebt.purchase.supplier,
        date: payment.paymentDate,
        amount: payment.amount,
        reference: `Compra ${payment.purchaseDebt.purchase.invoiceNumber}`,
        paymentMethod: payment.paymentMethod,
        ...canBelongToSession(payment.paymentDate, payment.cashSessionId),
      })),
    }
  }

  async classifyPayment(
    tenantId: string,
    actorId: string,
    type: string,
    paymentId: string,
    dto: ClassifyCashPaymentDto,
  ) {
    if (type !== 'CUSTOMER' && type !== 'SUPPLIER') {
      throw new BadRequestException('Tipo de pago inválido.')
    }
    const paymentMethod = dto.paymentMethod
    if (type === 'SUPPLIER' && paymentMethod === PaymentMethod.CARD) {
      throw new BadRequestException('Los pagos a proveedores solo permiten CASH o TRANSFER.')
    }
    const reason = dto.reason.trim()
    if (reason.length < 3 || reason.length > 500) {
      throw new BadRequestException('El motivo debe tener entre 3 y 500 caracteres.')
    }

    return this.prisma.$transaction(async (tx) => {
      const openSessions = await tx.cashSession.findMany({
        where: { tenantId, status: CashSessionStatus.OPEN },
        take: 2,
        select: { id: true },
      })
      if (openSessions.length !== 1) {
        throw new ConflictException(openSessions.length > 1
          ? 'Hay más de una caja abierta; no se puede conciliar con seguridad.'
          : 'No hay una caja abierta para conciliar.')
      }
      const session = openSessions[0]

      // Acquire the same row lock as close() before touching either payment.
      const lock = await tx.cashSession.updateMany({
        where: { id: session.id, tenantId, status: CashSessionStatus.OPEN },
        data: { totalSales: { increment: 0 } },
      })
      if (lock.count !== 1) {
        throw new ConflictException('La caja se cerró antes de completar la conciliación.')
      }

      const actor = await tx.user.findFirst({ where: { id: actorId, tenantId }, select: { id: true } })
      if (!actor) throw new ForbiddenException('El usuario autenticado no pertenece al negocio de esta caja.')

      const payment: any = type === 'CUSTOMER'
        ? await tx.customerPayment.findFirst({ where: { id: paymentId, tenantId } })
        : await tx.purchaseDebtPayment.findFirst({ where: { id: paymentId, tenantId } })
      if (!payment) throw new NotFoundException('No se encontró el pago para este negocio.')
      if (type === 'CUSTOMER' && payment.isVoided) {
        throw new ConflictException('No se puede clasificar un pago anulado.')
      }

      const pending = type === 'CUSTOMER'
        ? payment.paymentMethod === PaymentMethod.CREDIT
        : payment.paymentMethod !== PaymentMethod.CASH && payment.paymentMethod !== PaymentMethod.TRANSFER
      if (!pending) throw new ConflictException('El pago ya fue clasificado o ya no está pendiente.')

      if (payment.cashSessionId && payment.cashSessionId !== session.id) {
        throw new ConflictException('El pago pertenece a otra sesión de caja.')
      }
      if (!payment.cashSessionId) {
        const candidates = await tx.cashSession.findMany({
          where: {
            tenantId,
            openedAt: { lte: payment.paymentDate },
            OR: [
              { closedAt: null, status: CashSessionStatus.OPEN },
              { closedAt: { gte: payment.paymentDate } },
            ],
          },
          select: { id: true, status: true },
          take: 2,
        })
        if (candidates.length !== 1 || candidates[0].id !== session.id || candidates[0].status !== CashSessionStatus.OPEN) {
          throw new ConflictException(
            candidates.length > 1
              ? 'La fecha del pago coincide con varias cajas; requiere revisión administrativa.'
              : 'No se pudo atribuir inequívocamente el pago a la caja abierta.',
          )
        }
      }

      const updated = type === 'CUSTOMER'
        ? await tx.customerPayment.updateMany({
            where: {
              id: paymentId,
              tenantId,
              isVoided: false,
              paymentMethod: PaymentMethod.CREDIT,
              ...(payment.cashSessionId ? { cashSessionId: session.id } : { cashSessionId: null }),
            },
            data: { paymentMethod, cashSessionId: session.id },
          })
        : await tx.purchaseDebtPayment.updateMany({
            where: {
              id: paymentId,
              tenantId,
              paymentMethod: payment.paymentMethod,
              ...(payment.cashSessionId ? { cashSessionId: session.id } : { cashSessionId: null }),
            },
            data: { paymentMethod, cashSessionId: session.id },
          })
      if (updated.count !== 1) throw new ConflictException('El pago cambió durante la conciliación; actualizá la lista.')

      await tx.cashPaymentClassificationAudit.create({
        data: {
          tenantId,
          cashSessionId: session.id,
          actorId,
          type,
          customerPaymentId: type === 'CUSTOMER' ? paymentId : null,
          supplierPaymentId: type === 'SUPPLIER' ? paymentId : null,
          previousMethod: payment.paymentMethod,
          newMethod: paymentMethod,
          reason,
        },
      })

      return { id: paymentId, type, paymentMethod, cashSessionId: session.id }
    })
  }

  // ── Close ───────────────────────────────────────────────────────────────────
  async close(tenantId: string, sessionId: string, dto: CloseCashSessionDto) {
    return this.prisma.$transaction(async (tx) => {
      const locked = await tx.cashSession.updateMany({
        where: { id: sessionId, tenantId, status: CashSessionStatus.OPEN },
        data: { totalSales: { increment: 0 } },
      })
      if (locked.count !== 1) {
        throw new NotFoundException('No se encontró una sesión de caja abierta con ese id.')
      }

      const session = await tx.cashSession.findFirst({ where: { id: sessionId, tenantId } })
      if (!session) {
        throw new NotFoundException(`Sesión de caja "${sessionId}" no encontrada`)
      }

      const totals = await this.calculateTotals(tenantId, sessionId, tx)
      if (totals.expectedCashAmount === null) {
        throw new ConflictException(
          'No se puede cerrar la caja: hay pagos cuyo medio de cobro o pago no está clasificado. Conciliá esos registros antes del cierre.',
        )
      }

      const expectedAmount = totals.expectedCashAmount
      return tx.cashSession.update({
        where: { id: sessionId },
        data: {
          status: CashSessionStatus.CLOSED,
          closedAt: new Date(),
          closingAmount: dto.closingAmount,
          expectedAmount,
          totalSales: totals.totalSales,
          totalPurchases: totals.totalPurchases,
          difference: dto.closingAmount - expectedAmount,
        },
      })
    })
  }

  // ── Manual Movements ────────────────────────────────────────────────────────
  async addMovement(tenantId: string, dto: CreateCashMovementDto) {
    return this.prisma.$transaction(async (tx) => {
      const activeSession = await tx.cashSession.findFirst({
        where: { tenantId, status: CashSessionStatus.OPEN },
      })
      if (!activeSession) {
        throw new BadRequestException('No hay una sesión de caja activa para registrar movimientos.')
      }

      const locked = await tx.cashSession.updateMany({
        where: { id: activeSession.id, tenantId, status: CashSessionStatus.OPEN },
        data: { totalSales: { increment: 0 } },
      })
      if (locked.count !== 1) {
        throw new ConflictException('La sesión de caja se cerró antes de registrar el movimiento.')
      }

      return tx.cashMovement.create({
        data: {
          tenantId,
          cashSessionId: activeSession.id,
          amount: dto.amount,
          type: dto.type,
          description: dto.description,
        },
      })
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
  private async calculateTotals(
    tenantId: string,
    sessionId: string,
    db: any = this.prisma,
    includeMovements = true,
  ) {
    const session = await db.cashSession.findUnique({
      where: { id: sessionId },
      select: { openedAt: true, closedAt: true, openingAmount: true },
    })

    if (!session) {
      return {
        totalSales: 0,
        totalPurchases: 0,
        totalCreditSales: 0,
        totalCashSales: 0,
        totalPhysicalCashSales: 0,
        totalElectronicSales: 0,
        totalDebtPayments: 0,
        totalCashDebtPayments: 0,
        totalElectronicDebtPayments: 0,
        unclassifiedCustomerPayments: 0,
        totalCashPurchases: 0,
        totalCreditPurchases: 0,
        totalPurchaseDebtPayments: 0,
        totalCashPurchaseDebtPayments: 0,
        totalElectronicPurchaseDebtPayments: 0,
        unclassifiedSupplierPayments: 0,
        totalManualInflows: 0,
        totalManualOutflows: 0,
        cashReconciliationRequired: true,
        expectedCashAmount: null,
        movements: [],
      }
    }

    const paymentSessionScope = {
      OR: [
        { cashSessionId: sessionId },
        {
          cashSessionId: null,
          paymentDate: {
            gte: session.openedAt,
            ...(session.closedAt && { lte: session.closedAt }),
          },
        },
      ],
    }

    const [
      salesResult,
      physicalCashSalesResult,
      electronicSalesResult,
      paymentsResult,
      cashPaymentsResult,
      electronicPaymentsResult,
      unclassifiedCustomerPaymentsResult,
      cashPurchasesResult,
      creditPurchasesResult,
      creditSalesResult,
      purchasePaymentsResult,
      cashPurchasePaymentsResult,
      electronicPurchasePaymentsResult,
      unclassifiedSupplierPaymentsResult,
      inflowsResult,
      outflowsResult,
      movementsList
    ] = await Promise.all([
      // 1. Solo ventas en efectivo/tarjeta/transferencia que pertenezcan a esta sesión
      db.sale.aggregate({
        where: {
          tenantId,
          cashSessionId: sessionId,
          status: SaleStatus.COMPLETED,
          paymentMethod: { in: [PaymentMethod.CASH, PaymentMethod.CARD, PaymentMethod.TRANSFER] },
        },
        _sum: { total: true },
      }),
      db.sale.aggregate({
        where: {
          tenantId,
          cashSessionId: sessionId,
          status: SaleStatus.COMPLETED,
          paymentMethod: PaymentMethod.CASH,
        },
        _sum: { total: true },
      }),
      db.sale.aggregate({
        where: {
          tenantId,
          cashSessionId: sessionId,
          status: SaleStatus.COMPLETED,
          paymentMethod: { in: [PaymentMethod.CARD, PaymentMethod.TRANSFER] },
        },
        _sum: { total: true },
      }),
      // 2. Todos los pagos recibidos de clientes (señas de créditos y cobros posteriores) dentro del rango de tiempo de la sesión
      db.customerPayment.aggregate({
        where: {
          tenantId,
          isVoided: false,
          ...paymentSessionScope,
        },
        _sum: { amount: true },
      }),
      db.customerPayment.aggregate({
        where: {
          tenantId,
          isVoided: false,
          paymentMethod: PaymentMethod.CASH,
          ...paymentSessionScope,
        },
        _sum: { amount: true },
      }),
      db.customerPayment.aggregate({
        where: {
          tenantId,
          isVoided: false,
          paymentMethod: { in: [PaymentMethod.CARD, PaymentMethod.TRANSFER] },
          ...paymentSessionScope,
        },
        _sum: { amount: true },
      }),
      // CREDIT is not a tender method. Keep legacy rows visible and require reconciliation.
      db.customerPayment.aggregate({
        where: {
          tenantId,
          isVoided: false,
          paymentMethod: PaymentMethod.CREDIT,
          ...paymentSessionScope,
        },
        _sum: { amount: true },
      }),
      // 3. Compras registradas al contado en la sesión
      db.purchase.aggregate({
        where: {
          tenantId,
          cashSessionId: sessionId,
          paymentType: PurchasePaymentType.CASH,
          status: { in: [PurchaseStatus.RECEIVED, PurchaseStatus.FULLY_RETURNED] },
        },
        _sum: { total: true },
      }),
      // 4. Compras registradas a crédito en la sesión
      db.purchase.aggregate({
        where: {
          tenantId,
          cashSessionId: sessionId,
          paymentType: PurchasePaymentType.CREDIT,
          status: { in: [PurchaseStatus.RECEIVED, PurchaseStatus.FULLY_RETURNED] },
        },
        _sum: { total: true },
      }),
      // 5. Ventas a crédito de la sesión
      db.sale.aggregate({
        where: {
          tenantId,
          cashSessionId: sessionId,
          status: SaleStatus.COMPLETED,
          paymentMethod: PaymentMethod.CREDIT,
        },
        _sum: { remainingBalance: true },
      }),
      // 6. Supplier debt payment aggregates retain explicit session attribution
      // and use a time-window fallback only for legacy rows without a session id.
      db.purchaseDebtPayment.aggregate({
        where: {
          tenantId,
          OR: [
            { cashSessionId: sessionId },
            {
              cashSessionId: null,
              paymentDate: {
                gte: session.openedAt,
                ...(session.closedAt && { lte: session.closedAt }),
              },
            },
          ],
        },
        _sum: { amount: true },
      }),
      db.purchaseDebtPayment.aggregate({
        where: {
          tenantId,
          paymentMethod: PaymentMethod.CASH,
          OR: [
            { cashSessionId: sessionId },
            {
              cashSessionId: null,
              paymentDate: {
                gte: session.openedAt,
                ...(session.closedAt && { lte: session.closedAt }),
              },
            },
          ],
        },
        _sum: { amount: true },
      }),
      db.purchaseDebtPayment.aggregate({
        where: {
          tenantId,
          paymentMethod: PaymentMethod.TRANSFER,
          OR: [
            { cashSessionId: sessionId },
            {
              cashSessionId: null,
              paymentDate: {
                gte: session.openedAt,
                ...(session.closedAt && { lte: session.closedAt }),
              },
            },
          ],
        },
        _sum: { amount: true },
      }),
      db.purchaseDebtPayment.aggregate({
        where: {
          tenantId,
          OR: [
            { paymentMethod: null },
            { paymentMethod: { notIn: [PaymentMethod.CASH, PaymentMethod.TRANSFER] } },
          ],
          AND: [
            {
              OR: [
                { cashSessionId: sessionId },
                {
                  cashSessionId: null,
                  paymentDate: {
                    gte: session.openedAt,
                    ...(session.closedAt && { lte: session.closedAt }),
                  },
                },
              ],
            },
          ],
        },
        _sum: { amount: true },
      }),
      // 7. Movimientos manuales de ingreso (IN) en la sesión
      db.cashMovement.aggregate({
        where: {
          tenantId,
          cashSessionId: sessionId,
          type: 'IN',
        },
        _sum: { amount: true },
      }),
      // 8. Movimientos manuales de egreso (OUT) en la sesión
      db.cashMovement.aggregate({
        where: {
          tenantId,
          cashSessionId: sessionId,
          type: 'OUT',
        },
        _sum: { amount: true },
      }),
      // 9. Lista de movimientos manuales de la sesión
      includeMovements ? db.cashMovement.findMany({
        where: {
          tenantId,
          cashSessionId: sessionId,
        },
        orderBy: { createdAt: 'desc' },
      }) : Promise.resolve([]),
    ])

    const totalCashSales = Number(salesResult._sum.total ?? 0)
    const totalPhysicalCashSales = Number(physicalCashSalesResult._sum.total ?? 0)
    const totalElectronicSales = Number(electronicSalesResult._sum.total ?? 0)
    const totalDebtPayments = Number(paymentsResult._sum.amount ?? 0)
    const totalCashDebtPayments = Number(cashPaymentsResult._sum.amount ?? 0)
    const totalElectronicDebtPayments = Number(electronicPaymentsResult._sum.amount ?? 0)
    const unclassifiedCustomerPayments = Number(unclassifiedCustomerPaymentsResult._sum.amount ?? 0)
    const totalSales = totalCashSales + totalDebtPayments

    const totalCashPurchases = Number(cashPurchasesResult._sum.total ?? 0)
    const totalPurchaseDebtPayments = Number(purchasePaymentsResult._sum.amount ?? 0)
    const totalCashPurchaseDebtPayments = Number(cashPurchasePaymentsResult._sum.amount ?? 0)
    const totalElectronicPurchaseDebtPayments = Number(electronicPurchasePaymentsResult._sum.amount ?? 0)
    const unclassifiedSupplierPayments = Number(unclassifiedSupplierPaymentsResult._sum.amount ?? 0)
    const totalPurchases = totalCashPurchases + totalPurchaseDebtPayments
    const totalCreditPurchases = Number(creditPurchasesResult._sum.total ?? 0)

    const totalManualInflows = Number(inflowsResult._sum.amount ?? 0)
    const totalManualOutflows = Number(outflowsResult._sum.amount ?? 0)
    const cashReconciliationRequired = unclassifiedCustomerPayments > 0 || unclassifiedSupplierPayments > 0
    const expectedCashAmount = cashReconciliationRequired
      ? null
      : Number(session.openingAmount ?? 0) +
        totalPhysicalCashSales +
        totalCashDebtPayments +
        totalManualInflows -
        totalCashPurchaseDebtPayments -
        totalCashPurchases -
        totalManualOutflows

    return {
      totalSales,
      totalPurchases,
      totalCreditSales: creditSalesResult._sum.remainingBalance ?? 0,
      totalCashSales,
      totalPhysicalCashSales,
      totalElectronicSales,
      totalDebtPayments,
      totalCashDebtPayments,
      totalElectronicDebtPayments,
      unclassifiedCustomerPayments,
      totalCashPurchases,
      totalCreditPurchases,
      totalPurchaseDebtPayments,
      totalCashPurchaseDebtPayments,
      totalElectronicPurchaseDebtPayments,
      unclassifiedSupplierPayments,
      totalManualInflows,
      totalManualOutflows,
      cashReconciliationRequired,
      expectedCashAmount,
      movements: movementsList,
    }
  }

}

