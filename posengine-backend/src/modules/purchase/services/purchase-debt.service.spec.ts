jest.mock('../../../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}))

import { BadRequestException, ConflictException } from '@nestjs/common'
import { PurchaseDebtService } from './purchase-debt.service'

describe('PurchaseDebtService.registerPayment', () => {
  const debt = {
    id: 'debt-1',
    purchaseId: 'purchase-1',
    tenantId: 'tenant-1',
    totalAmount: 100,
    paidAmount: 0,
    balance: 100,
    status: 'PENDING',
    installments: [],
  }
  const tx: any = {
    purchaseDebt: {
      findFirst: jest.fn(),
      updateMany: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
    },
    purchaseDebtPayment: { create: jest.fn() },
    purchaseDebtInstallment: { update: jest.fn() },
    cashSession: { findMany: jest.fn(), findFirst: jest.fn(), updateMany: jest.fn() },
  }
  const prisma: any = {
    $transaction: jest.fn((callback: (client: any) => unknown) => callback(tx)),
  }
  const service = new PurchaseDebtService(prisma)

  beforeEach(() => {
    jest.resetAllMocks()
    prisma.$transaction.mockImplementation((callback: (client: any) => unknown) => callback(tx))
    tx.purchaseDebt.findFirst
      .mockResolvedValueOnce({ id: debt.id })
      .mockResolvedValue(debt)
    tx.purchaseDebt.updateMany.mockResolvedValue({ count: 1 })
    tx.purchaseDebt.update.mockResolvedValue({ ...debt, balance: 60 })
    tx.purchaseDebt.findUnique.mockResolvedValue({ ...debt, balance: 60 })
    tx.purchaseDebtPayment.create.mockResolvedValue({ id: 'payment-1' })
    tx.cashSession.findMany.mockResolvedValue([{ id: 'cash-1' }])
    tx.cashSession.findFirst.mockResolvedValue(null)
    tx.cashSession.updateMany.mockResolvedValue({ count: 1 })
  })

  it('persists CASH with the validated open session and updates the debt atomically', async () => {
    await service.registerPayment('tenant-1', 'purchase-1', {
      amount: 40,
      paymentMethod: 'CASH',
      cashSessionId: 'cash-1',
    } as any)

    expect(tx.cashSession.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'cash-1', tenantId: 'tenant-1', status: 'OPEN' },
    }))
    expect(tx.purchaseDebtPayment.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ paymentMethod: 'CASH', cashSessionId: 'cash-1' }),
    }))
    expect(tx.purchaseDebt.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'debt-1' },
      data: expect.objectContaining({ paidAmount: 40, balance: 60, status: 'PARTIAL' }),
    }))
  })

  it('persists TRANSFER without a cash session when none is open', async () => {
    tx.cashSession.findMany.mockResolvedValue([])

    await service.registerPayment('tenant-1', 'purchase-1', {
      amount: 100,
      paymentMethod: 'TRANSFER',
    } as any)

    expect(tx.cashSession.updateMany).not.toHaveBeenCalled()
    expect(tx.purchaseDebtPayment.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ paymentMethod: 'TRANSFER' }),
    }))
    expect(tx.purchaseDebt.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ paidAmount: 100, balance: 0, status: 'PAID' }),
    }))
  })

  it.each([undefined, 'CARD', 'CREDIT'])('rejects unsupported/missing payment method %s', async (paymentMethod) => {
    await expect(service.registerPayment('tenant-1', 'purchase-1', {
      amount: 20,
      paymentMethod,
    } as any)).rejects.toBeInstanceOf(BadRequestException)
    expect(tx.purchaseDebtPayment.create).not.toHaveBeenCalled()
  })

  it('rejects non-positive amounts', async () => {
    await expect(service.registerPayment('tenant-1', 'purchase-1', {
      amount: 0,
      paymentMethod: 'CASH',
      cashSessionId: 'cash-1',
    } as any)).rejects.toBeInstanceOf(BadRequestException)
    expect(tx.purchaseDebtPayment.create).not.toHaveBeenCalled()
  })

  it('rejects cash payments when there is no open session', async () => {
    tx.cashSession.findMany.mockResolvedValue([])

    await expect(service.registerPayment('tenant-1', 'purchase-1', {
      amount: 20,
      paymentMethod: 'CASH',
    } as any)).rejects.toBeInstanceOf(ConflictException)
    expect(tx.purchaseDebtPayment.create).not.toHaveBeenCalled()
  })

  it('rejects a transfer backdated into a closed session when no current session can receive it', async () => {
    tx.cashSession.findMany.mockResolvedValue([])
    tx.cashSession.findFirst.mockResolvedValue({ id: 'closed-cash' })

    await expect(service.registerPayment('tenant-1', 'purchase-1', {
      amount: 20,
      paymentMethod: 'TRANSFER',
      paymentDate: '2026-11-10T12:00:00.000Z',
    } as any)).rejects.toBeInstanceOf(ConflictException)
    expect(tx.purchaseDebtPayment.create).not.toHaveBeenCalled()
  })

  it('rejects payments above the current balance', async () => {
    await expect(service.registerPayment('tenant-1', 'purchase-1', {
      amount: 100.02,
      paymentMethod: 'CASH',
      cashSessionId: 'cash-1',
    } as any)).rejects.toBeInstanceOf(BadRequestException)
    expect(tx.purchaseDebtPayment.create).not.toHaveBeenCalled()
  })
})
