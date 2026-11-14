import { ForbiddenException, Injectable } from '@nestjs/common'
import { PaymentMethod, SaleStatus } from '../../../generated/prisma/enums'
import { PrismaService } from '../../../prisma/prisma.service'
import { CashSessionService } from '../../cash-session/cash-session.service'
import { BUSINESS_TIME_ZONE, getBusinessCalendarWindow, toUtcTimestampWithoutZone } from './business-time'

function isMissingSaleReturnsTable(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false

  const prismaError = error as {
    code?: unknown
    meta?: { code?: unknown; message?: unknown }
    message?: unknown
  }
  const databaseCode = prismaError.meta?.code
  const databaseMessage = [prismaError.meta?.message, prismaError.message]
    .filter((part): part is string => typeof part === 'string')
    .join(' ')

  return prismaError.code === 'P2010' &&
    (databaseCode === '42P01' || databaseMessage.includes('42P01')) &&
    /sale_returns/i.test(databaseMessage)
}

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cashSessionService: CashSessionService,
  ) {}

  async getStats(tenantId: string | null | undefined) {
    if (!tenantId) throw new ForbiddenException('Seleccioná un comercio para consultar el Dashboard.')

    const window = getBusinessCalendarWindow()
    const asOf = toUtcTimestampWithoutZone(window.asOf)
    const todayStart = toUtcTimestampWithoutZone(window.startOfToday)
    const monthStart = toUtcTimestampWithoutZone(window.startOfMonth)
    let returnTrackingAvailable = true

    const salesMetricsPromise = (this.prisma.$queryRaw<Array<{
        todayBilling: number
        todaySalesCount: number
        todayCreditBalance: number
        monthBilling: number
        todayReturns: number
        monthReturns: number
      }>>`
        WITH matching_sales AS (
          SELECT
            ("saleDate" AT TIME ZONE 'UTC' AT TIME ZONE ${BUSINESS_TIME_ZONE})::date AS local_date,
            total,
            "remainingBalance",
            "paymentMethod"
          FROM sales
          WHERE "tenantId" = ${tenantId}
            AND status::text = ${SaleStatus.COMPLETED}
            AND "saleDate" >= ${monthStart}::timestamp
            AND "saleDate" < ${asOf}::timestamp
        ), matching_returns AS (
          SELECT
            ("returnDate" AT TIME ZONE 'UTC' AT TIME ZONE ${BUSINESS_TIME_ZONE})::date AS local_date,
            total
          FROM sale_returns
          WHERE "tenantId" = ${tenantId}
            AND status::text = 'CONFIRMED'
            AND "returnDate" >= ${monthStart}::timestamp
            AND "returnDate" < ${asOf}::timestamp
        ), metrics AS (
          SELECT
            COALESCE(SUM(total) FILTER (WHERE local_date = ${window.today}::date), 0)::double precision AS today_billing,
            COUNT(*) FILTER (WHERE local_date = ${window.today}::date)::integer AS today_sales_count,
            COALESCE(SUM("remainingBalance") FILTER (
              WHERE local_date = ${window.today}::date AND "paymentMethod"::text = ${PaymentMethod.CREDIT}
            ), 0)::double precision AS today_credit_balance,
            COALESCE(SUM(total), 0)::double precision AS month_billing,
            (SELECT COALESCE(SUM(total), 0) FROM matching_returns WHERE local_date = ${window.today}::date)::double precision AS today_returns,
            (SELECT COALESCE(SUM(total), 0) FROM matching_returns)::double precision AS month_returns
          FROM matching_sales
        )
        SELECT
          metrics.today_billing AS "todayBilling",
          metrics.today_sales_count AS "todaySalesCount",
          metrics.today_credit_balance AS "todayCreditBalance",
          metrics.month_billing AS "monthBilling",
          metrics.today_returns AS "todayReturns",
          metrics.month_returns AS "monthReturns"
        FROM metrics
      `).catch((error: unknown) => {
        if (!isMissingSaleReturnsTable(error)) throw error

        // Older local schemas may predate sale-return migrations. Keep the
        // operational dashboard available while clearly marking return totals
        // unavailable; never hide unrelated query or data errors.
        returnTrackingAvailable = false
        console.warn('Dashboard return metrics unavailable: sale_returns table is missing; apply pending migrations.')
        return this.prisma.$queryRaw<Array<{
          todayBilling: number
          todaySalesCount: number
          todayCreditBalance: number
          monthBilling: number
          todayReturns: number
          monthReturns: number
        }>>`
          WITH matching_sales AS (
            SELECT
              ("saleDate" AT TIME ZONE 'UTC' AT TIME ZONE ${BUSINESS_TIME_ZONE})::date AS local_date,
              total,
              "remainingBalance",
              "paymentMethod"
            FROM sales
            WHERE "tenantId" = ${tenantId}
              AND status::text = ${SaleStatus.COMPLETED}
              AND "saleDate" >= ${monthStart}::timestamp
              AND "saleDate" < ${asOf}::timestamp
          )
          SELECT
            COALESCE(SUM(total) FILTER (WHERE local_date = ${window.today}::date), 0)::double precision AS "todayBilling",
            COUNT(*) FILTER (WHERE local_date = ${window.today}::date)::integer AS "todaySalesCount",
            COALESCE(SUM("remainingBalance") FILTER (
              WHERE local_date = ${window.today}::date AND "paymentMethod"::text = ${PaymentMethod.CREDIT}
            ), 0)::double precision AS "todayCreditBalance",
            COALESCE(SUM(total), 0)::double precision AS "monthBilling",
            0::double precision AS "todayReturns",
            0::double precision AS "monthReturns"
          FROM matching_sales
        `
      })

    const [salesRows, collectionRows, stockRows, receivables, recentSales] = await Promise.all([
      salesMetricsPromise,
      this.prisma.$queryRaw<Array<{ method: string; amount: number }>>`
        WITH collections AS (
          SELECT "paymentMethod"::text AS method, total AS amount
          FROM sales
          WHERE "tenantId" = ${tenantId}
            AND status::text = ${SaleStatus.COMPLETED}
            AND "saleDate" >= ${todayStart}::timestamp
            AND "saleDate" < ${asOf}::timestamp
            AND "paymentMethod"::text IN (${PaymentMethod.CASH}, ${PaymentMethod.CARD}, ${PaymentMethod.TRANSFER})

          UNION ALL

          SELECT payment."paymentMethod"::text AS method, payment.amount
          FROM customer_payments AS payment
          LEFT JOIN sales AS sale
            ON sale.id = payment."saleId"
            AND sale."tenantId" = payment."tenantId"
          WHERE payment."tenantId" = ${tenantId}
            AND payment."isVoided" = false
            AND payment."paymentDate" >= ${todayStart}::timestamp
            AND payment."paymentDate" < ${asOf}::timestamp
            AND (
              payment."saleId" IS NULL
              OR (sale.status::text = ${SaleStatus.COMPLETED} AND sale."paymentMethod"::text = ${PaymentMethod.CREDIT})
            )
        )
        SELECT method, COALESCE(SUM(amount), 0)::double precision AS amount
        FROM collections
        GROUP BY method
      `,
      this.prisma.$queryRaw<Array<{
        lowStockCount: number
        outOfStockCount: number
        items: Array<{ id: string; name: string; sku: string | null; stock: number; stockMinimum: number; unitType: string }>
      }>>`
        WITH low_stock AS (
          SELECT id, name, sku, stock, "stockMinimum", "unitType"
          FROM products
          WHERE "tenantId" = ${tenantId}
            AND "isActive" = true
            AND stock <= "stockMinimum"
        ), counts AS (
          SELECT
            COUNT(*)::integer AS low_stock_count,
            COUNT(*) FILTER (WHERE stock <= 0)::integer AS out_of_stock_count
          FROM low_stock
        ), preview AS (
          SELECT COALESCE(
            json_agg(json_build_object(
              'id', id,
              'name', name,
              'sku', sku,
              'stock', stock,
              'stockMinimum', "stockMinimum",
              'unitType', "unitType"
            ) ORDER BY stock ASC, name ASC),
            '[]'::json
          ) AS items
          FROM (SELECT * FROM low_stock ORDER BY stock ASC, name ASC LIMIT 5) products_preview
        )
        SELECT counts.low_stock_count AS "lowStockCount",
          counts.out_of_stock_count AS "outOfStockCount",
          preview.items
        FROM counts CROSS JOIN preview
      `,
      this.prisma.customer.aggregate({
        where: { tenantId, currentDebt: { gt: 0 } },
        _count: { id: true },
        _sum: { currentDebt: true },
      }),
      this.prisma.sale.findMany({
        where: { tenantId, status: SaleStatus.COMPLETED, saleDate: { lt: window.asOf } },
        orderBy: [{ saleDate: 'desc' }, { id: 'desc' }],
        take: 5,
        select: {
          id: true,
          total: true,
          saleDate: true,
          paymentMethod: true,
          customer: { select: { name: true } },
          _count: { select: { items: true } },
        },
      }),
    ])
    // The cash service intentionally runs its own parallel aggregate batch.
    // Keep that batch separate from the dashboard reads to limit pool pressure.
    const cashSummary = await this.cashSessionService.getCurrentSummary(tenantId)

    const salesMetrics = salesRows[0]
    const collectionsByMethod = collectionRows.reduce<Record<string, number>>((totals, row) => {
      totals[row.method] = Number(row.amount ?? 0)
      return totals
    }, {})
    const cashCollections = collectionsByMethod[PaymentMethod.CASH] ?? 0
    const cardCollections = collectionsByMethod[PaymentMethod.CARD] ?? 0
    const transferCollections = collectionsByMethod[PaymentMethod.TRANSFER] ?? 0
    const unclassifiedCollections = collectionsByMethod[PaymentMethod.CREDIT] ?? 0
    const stock = stockRows[0] ?? { lowStockCount: 0, outOfStockCount: 0, items: [] }
    const stockItems = typeof stock.items === 'string' ? JSON.parse(stock.items) : stock.items
    const cashSession = cashSummary.session

    return {
      timezone: BUSINESS_TIME_ZONE,
      returnTrackingAvailable,
      billing: {
        today: Number(salesMetrics?.todayBilling ?? 0),
        todayReturns: Number(salesMetrics?.todayReturns ?? 0),
        netToday: Number(salesMetrics?.todayBilling ?? 0) - Number(salesMetrics?.todayReturns ?? 0),
        todaySalesCount: Number(salesMetrics?.todaySalesCount ?? 0),
        creditBalanceToday: Number(salesMetrics?.todayCreditBalance ?? 0),
        month: Number(salesMetrics?.monthBilling ?? 0),
        monthReturns: Number(salesMetrics?.monthReturns ?? 0),
        netMonth: Number(salesMetrics?.monthBilling ?? 0) - Number(salesMetrics?.monthReturns ?? 0),
      },
      collections: {
        today: cashCollections + cardCollections + transferCollections + unclassifiedCollections,
        cash: cashCollections,
        card: cardCollections,
        transfer: transferCollections,
        electronic: cardCollections + transferCollections,
        unclassified: unclassifiedCollections,
      },
      cash: {
        status: cashSession ? 'OPEN' : 'CLOSED',
        expectedAmount: cashSession?.expectedCashAmount === null || cashSession?.expectedCashAmount === undefined
          ? null
          : Number(cashSession.expectedCashAmount),
        reconciliationPending: cashSession?.cashReconciliationRequired ?? false,
      },
      receivables: {
        balance: Number(receivables._sum.currentDebt ?? 0),
        customersCount: receivables._count.id,
      },
      stock: {
        lowStockCount: Number(stock.lowStockCount ?? 0),
        outOfStockCount: Number(stock.outOfStockCount ?? 0),
        items: stockItems,
      },
      recentSales: recentSales.map((sale) => ({
        id: sale.id,
        total: Number(sale.total),
        saleDate: sale.saleDate.toISOString(),
        customerName: sale.customer?.name ?? 'Consumidor Final',
        paymentType: sale.paymentMethod === PaymentMethod.CREDIT ? 'CREDIT' : 'CASH',
        itemCount: sale._count.items,
      })),
    }
  }
}
