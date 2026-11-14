jest.mock('../../prisma/prisma.service', () => ({ PrismaService: class PrismaService {} }))

import { BadRequestException, ConflictException } from '@nestjs/common'
import { CashSessionStatus, PaymentMethod } from '../../generated/prisma/enums'
import { CashSessionService } from './cash-session.service'

describe('CashSessionService reconciliation', () => {
  const session = { id: 'cash-1', openedAt: new Date('2026-11-12T10:00:00Z'), closedAt: null }
  const paymentDate = new Date('2026-11-12T11:00:00Z')
  let tx: any
  let prisma: any
  let service: CashSessionService

  beforeEach(() => {
    tx = {
      cashSession: {
        findFirst: jest.fn().mockResolvedValue({ id: session.id }),
        findMany: jest.fn().mockResolvedValue([{ id: session.id, status: CashSessionStatus.OPEN }]),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      customerPayment: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'payment-1', tenantId: 'tenant-1', cashSessionId: null,
          paymentDate, paymentMethod: PaymentMethod.CREDIT, isVoided: false, amount: 150,
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      purchaseDebtPayment: {
        findFirst: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      cashPaymentClassificationAudit: { create: jest.fn().mockResolvedValue({ id: 'audit-1' }) },
      user: { findFirst: jest.fn().mockResolvedValue({ id: 'user-1' }) },
    }
    prisma = {
      $transaction: jest.fn((callback: (client: any) => unknown) => callback(tx)),
      cashSession: { findFirst: jest.fn(), findMany: jest.fn() },
      customerPayment: { findMany: jest.fn() },
      purchaseDebtPayment: { findMany: jest.fn() },
    }
    service = new CashSessionService(prisma)
  })

  it('classifies an existing customer payment without changing its amount or debt', async () => {
    await service.classifyPayment('tenant-1', 'user-1', 'CUSTOMER', 'payment-1', {
      paymentMethod: 'CASH', reason: 'Comprobante verificado',
    })

    expect(tx.customerPayment.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: 'payment-1', tenantId: 'tenant-1', paymentMethod: PaymentMethod.CREDIT }),
      data: { paymentMethod: 'CASH', cashSessionId: 'cash-1' },
    }))
    expect(tx.cashPaymentClassificationAudit.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        customerPaymentId: 'payment-1', supplierPaymentId: null,
        previousMethod: PaymentMethod.CREDIT, newMethod: 'CASH', actorId: 'user-1',
        cashSessionId: 'cash-1', reason: 'Comprobante verificado',
      }),
    }))
  })

  it('rejects CARD for supplier payments before opening a transaction', async () => {
    await expect(service.classifyPayment('tenant-1', 'user-1', 'SUPPLIER', 'payment-1', {
      paymentMethod: 'CARD', reason: 'Comprobante verificado',
    })).rejects.toBeInstanceOf(BadRequestException)
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it('rejects legacy payments whose session attribution is ambiguous', async () => {
    tx.cashSession.findMany.mockResolvedValueOnce([{ id: 'cash-1' }]).mockResolvedValueOnce([
      { id: 'cash-1', status: CashSessionStatus.OPEN },
      { id: 'cash-2', status: CashSessionStatus.CLOSED },
    ])
    await expect(service.classifyPayment('tenant-1', 'user-1', 'CUSTOMER', 'payment-1', {
      paymentMethod: 'TRANSFER', reason: 'Comprobante verificado',
    })).rejects.toBeInstanceOf(ConflictException)
    expect(tx.customerPayment.updateMany).not.toHaveBeenCalled()
    expect(tx.cashPaymentClassificationAudit.create).not.toHaveBeenCalled()
  })

  it('does not classify when the session was closed before the lock was acquired', async () => {
    tx.cashSession.updateMany.mockResolvedValue({ count: 0 })
    await expect(service.classifyPayment('tenant-1', 'user-1', 'CUSTOMER', 'payment-1', {
      paymentMethod: 'CASH', reason: 'Comprobante verificado',
    })).rejects.toBeInstanceOf(ConflictException)
    expect(tx.customerPayment.findFirst).not.toHaveBeenCalled()
  })

  it('rolls back the classification if audit persistence fails', async () => {
    tx.cashPaymentClassificationAudit.create.mockRejectedValue(new Error('audit insert failed'))
    await expect(service.classifyPayment('tenant-1', 'user-1', 'CUSTOMER', 'payment-1', {
      paymentMethod: 'TRANSFER', reason: 'Comprobante verificado',
    })).rejects.toThrow('audit insert failed')
    expect(tx.customerPayment.updateMany).toHaveBeenCalled()
  })
})
