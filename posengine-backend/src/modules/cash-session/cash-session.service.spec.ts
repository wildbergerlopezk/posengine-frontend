jest.mock('../../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}))

import { ConflictException } from '@nestjs/common'
import { CashSessionStatus, PaymentMethod } from '../../generated/prisma/enums'
import { CashSessionService } from './cash-session.service'

describe('CashSessionService physical cash totals', () => {
  const session = {
    id: 'cash-1',
    tenantId: 'tenant-1',
    openedAt: new Date('2026-11-11T10:00:00.000Z'),
    closedAt: null,
    openingAmount: 100,
    status: CashSessionStatus.OPEN,
  }
  const empty = { _sum: { total: null, amount: null, remainingBalance: null } }
  const prisma: any = {
    cashSession: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      updateMany: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(),
    sale: { aggregate: jest.fn() },
    customerPayment: { aggregate: jest.fn() },
    purchase: { aggregate: jest.fn() },
    purchaseDebtPayment: { aggregate: jest.fn() },
    cashMovement: { aggregate: jest.fn(), findMany: jest.fn() },
  }
  let service: CashSessionService

  beforeEach(() => {
    jest.clearAllMocks()
    service = new CashSessionService(prisma)
    prisma.cashSession.findUnique.mockResolvedValue(session)
    prisma.cashSession.findFirst.mockResolvedValue(session)
    prisma.cashSession.updateMany.mockResolvedValue({ count: 1 })
    prisma.$transaction.mockImplementation((callback: (tx: any) => unknown) => callback(prisma))
    prisma.sale.aggregate.mockResolvedValue(empty)
    prisma.customerPayment.aggregate.mockResolvedValue(empty)
    prisma.purchase.aggregate.mockResolvedValue(empty)
    prisma.purchaseDebtPayment.aggregate.mockResolvedValue(empty)
    prisma.cashMovement.aggregate.mockResolvedValue(empty)
    prisma.cashMovement.findMany.mockResolvedValue([])
  })

  it('keeps commercial totals and calculates drawer cash from cash tenders only', async () => {
    prisma.sale.aggregate
      .mockResolvedValueOnce({ _sum: { total: 200 } })
      .mockResolvedValueOnce({ _sum: { total: 100 } })
      .mockResolvedValueOnce({ _sum: { total: 100 } })
      .mockResolvedValueOnce({ _sum: { remainingBalance: 50 } })
    prisma.customerPayment.aggregate
      .mockResolvedValueOnce({ _sum: { amount: 80 } })
      .mockResolvedValueOnce({ _sum: { amount: 30 } })
      .mockResolvedValueOnce({ _sum: { amount: 50 } })

    // Cash purchase, no credit purchase, no supplier payment.
    prisma.purchase.aggregate
      .mockResolvedValueOnce({ _sum: { total: 40 } })
      .mockResolvedValueOnce({ _sum: { total: 0 } })
    // Cash IN and OUT.
    prisma.cashMovement.aggregate
      .mockResolvedValueOnce({ _sum: { amount: 20 } })
      .mockResolvedValueOnce({ _sum: { amount: 10 } })

    const totals = await (service as any).calculateTotals('tenant-1', 'cash-1')

    expect(totals).toMatchObject({
      totalCashSales: 200,
      totalPhysicalCashSales: 100,
      totalElectronicSales: 100,
      totalDebtPayments: 80,
      totalCashDebtPayments: 30,
      totalElectronicDebtPayments: 50,
      totalSales: 280,
      totalCashPurchases: 40,
      totalManualInflows: 20,
      totalManualOutflows: 10,
      expectedCashAmount: 200,
      cashReconciliationRequired: false,
    })
    expect(prisma.sale.aggregate.mock.calls[1][0].where.paymentMethod).toBe(PaymentMethod.CASH)
    expect(prisma.customerPayment.aggregate.mock.calls[1][0].where.paymentMethod).toBe(PaymentMethod.CASH)
  })

  it('marks legacy CREDIT payments and supplier payments unclassified without changing commercial totals', async () => {
    prisma.customerPayment.aggregate
      .mockResolvedValueOnce({ _sum: { amount: 25 } })
      .mockResolvedValueOnce(empty)
      .mockResolvedValueOnce(empty)
      .mockResolvedValueOnce({ _sum: { amount: 25 } })
    prisma.purchaseDebtPayment.aggregate.mockResolvedValue({ _sum: { amount: 40 } })

    const totals = await (service as any).calculateTotals('tenant-1', 'cash-1')

    expect(totals.totalDebtPayments).toBe(25)
    expect(totals.totalPurchaseDebtPayments).toBe(40)
    expect(totals.unclassifiedCustomerPayments).toBe(25)
    expect(totals.unclassifiedSupplierPayments).toBe(40)
    expect(totals.cashReconciliationRequired).toBe(true)
    expect(totals.expectedCashAmount).toBeNull()
  })

  it('subtracts CASH supplier debt payments from physical cash', async () => {
    prisma.purchaseDebtPayment.aggregate
      .mockResolvedValueOnce({ _sum: { amount: 60 } })
      .mockResolvedValueOnce({ _sum: { amount: 60 } })
      .mockResolvedValueOnce(empty)
      .mockResolvedValueOnce(empty)

    const totals = await (service as any).calculateTotals('tenant-1', 'cash-1')

    expect(totals.totalPurchaseDebtPayments).toBe(60)
    expect(totals.totalCashPurchaseDebtPayments).toBe(60)
    expect(totals.totalElectronicPurchaseDebtPayments).toBe(0)
    expect(totals.totalPurchases).toBe(60)
    expect(totals.expectedCashAmount).toBe(40)
    expect(totals.cashReconciliationRequired).toBe(false)
  })

  it('keeps TRANSFER supplier debt payments in commercial totals, outside physical cash', async () => {
    prisma.purchaseDebtPayment.aggregate
      .mockResolvedValueOnce({ _sum: { amount: 75 } })
      .mockResolvedValueOnce(empty)
      .mockResolvedValueOnce({ _sum: { amount: 75 } })
      .mockResolvedValueOnce(empty)

    const totals = await (service as any).calculateTotals('tenant-1', 'cash-1')

    expect(totals.totalPurchaseDebtPayments).toBe(75)
    expect(totals.totalCashPurchaseDebtPayments).toBe(0)
    expect(totals.totalElectronicPurchaseDebtPayments).toBe(75)
    expect(totals.totalPurchases).toBe(75)
    expect(totals.expectedCashAmount).toBe(100)
    expect(totals.cashReconciliationRequired).toBe(false)
  })

  it('does not close a session while physical cash cannot be reconciled', async () => {
    prisma.cashSession.findFirst.mockResolvedValue(session)
    prisma.customerPayment.aggregate
      .mockResolvedValueOnce({ _sum: { amount: 50 } })
      .mockResolvedValueOnce(empty)
      .mockResolvedValueOnce(empty)
      .mockResolvedValueOnce({ _sum: { amount: 50 } })

    await expect(service.close('tenant-1', 'cash-1', { closingAmount: 100 } as any))
      .rejects.toBeInstanceOf(ConflictException)
    expect(prisma.cashSession.update).not.toHaveBeenCalled()
  })
})
