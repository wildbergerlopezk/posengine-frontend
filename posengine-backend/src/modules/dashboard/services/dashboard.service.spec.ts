jest.mock('../../../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}))

import { ForbiddenException } from '@nestjs/common'
import { PaymentMethod } from '../../../generated/prisma/enums'
import { CashSessionService } from '../../cash-session/cash-session.service'
import { PrismaService } from '../../../prisma/prisma.service'
import { DashboardService } from './dashboard.service'

describe('DashboardService operational metrics', () => {
  const date = new Date('2026-11-13T01:00:00.000Z')
  const prisma = {
    $queryRaw: jest.fn(),
    customer: { aggregate: jest.fn() },
    sale: { findMany: jest.fn() },
  }
  const cashSessionService = { getCurrentSummary: jest.fn() }
  let service: DashboardService

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(date)
    jest.clearAllMocks()
    prisma.$queryRaw
      .mockResolvedValueOnce([{
        todayBilling: 1_500_000,
        todaySalesCount: 2,
        todayCreditBalance: 800_000,
        monthBilling: 4_250_000,
        todayReturns: 50_000,
        monthReturns: 150_000,
      }])
      .mockResolvedValueOnce([
        { method: PaymentMethod.CASH, amount: 800_000 },
        { method: PaymentMethod.TRANSFER, amount: 200_000 },
        { method: PaymentMethod.CREDIT, amount: 50_000 },
      ])
      .mockResolvedValueOnce([{
        lowStockCount: 12,
        outOfStockCount: 2,
        items: [{ id: 'product-1', name: 'Producto', stock: 0, stockMinimum: 3, unitType: 'KG' }],
      }])
    prisma.customer.aggregate.mockResolvedValue({ _count: { id: 3 }, _sum: { currentDebt: 8_750_000 } })
    prisma.sale.findMany.mockResolvedValue([{
      id: 'sale-1',
      total: 500_000,
      saleDate: new Date('2026-11-13T00:30:00.000Z'),
      paymentMethod: PaymentMethod.CASH,
      customer: null,
      _count: { items: 1 },
    }])
    cashSessionService.getCurrentSummary.mockResolvedValue({
      session: { id: 'cash-1', expectedCashAmount: 2_800_000, cashReconciliationRequired: false },
    })
    service = new DashboardService(prisma as unknown as PrismaService, cashSessionService as unknown as CashSessionService)
  })

  afterEach(() => jest.useRealTimers())

  it('separates billing from tender collections and keeps unclassified payments visible', async () => {
    const result = await service.getStats('tenant-a')

    expect(result).toMatchObject({
      timezone: 'America/Asuncion',
      billing: {
        today: 1_500_000, todayReturns: 50_000, netToday: 1_450_000,
        todaySalesCount: 2, creditBalanceToday: 800_000,
        month: 4_250_000, monthReturns: 150_000, netMonth: 4_100_000,
      },
      collections: {
        today: 1_050_000,
        cash: 800_000,
        electronic: 200_000,
        unclassified: 50_000,
      },
      cash: { status: 'OPEN', expectedAmount: 2_800_000, reconciliationPending: false },
      receivables: { balance: 8_750_000, customersCount: 3 },
      stock: { lowStockCount: 12, outOfStockCount: 2 },
    })
    expect(result.recentSales[0]).toMatchObject({
      customerName: 'Consumidor Final',
      paymentType: 'CASH',
      itemCount: 1,
    })
    expect(prisma.customer.aggregate).toHaveBeenCalledWith(expect.objectContaining({
      where: { tenantId: 'tenant-a', currentDebt: { gt: 0 } },
    }))
    expect(prisma.sale.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ tenantId: 'tenant-a', status: 'COMPLETED' }),
      orderBy: [{ saleDate: 'desc' }, { id: 'desc' }],
      take: 5,
    }))
    expect(cashSessionService.getCurrentSummary).toHaveBeenCalledWith('tenant-a')
  })

  it('never executes global aggregates without an authenticated tenant context', async () => {
    await expect(service.getStats(null)).rejects.toBeInstanceOf(ForbiddenException)
    expect(prisma.$queryRaw).not.toHaveBeenCalled()
    expect(prisma.customer.aggregate).not.toHaveBeenCalled()
    expect(cashSessionService.getCurrentSummary).not.toHaveBeenCalled()
  })

  it('returns a closed register without inventing an expected cash amount', async () => {
    cashSessionService.getCurrentSummary.mockResolvedValue({ session: null })

    const result = await service.getStats('tenant-a')

    expect(result.cash).toEqual({ status: 'CLOSED', expectedAmount: null, reconciliationPending: false })
  })
})
