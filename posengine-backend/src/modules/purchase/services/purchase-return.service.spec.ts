jest.mock('../../../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}))

import { ServiceUnavailableException } from '@nestjs/common'
import { PurchaseReturnService } from './purchase-return.service'

describe('PurchaseReturnService temporary protection', () => {
  const originalValue = process.env.POSENGINE_ENABLE_PURCHASE_RETURNS
  const prisma = { $transaction: jest.fn() }
  const service = new PurchaseReturnService(prisma as any)

  beforeEach(() => {
    delete process.env.POSENGINE_ENABLE_PURCHASE_RETURNS
    jest.clearAllMocks()
  })

  afterAll(() => {
    if (originalValue === undefined) delete process.env.POSENGINE_ENABLE_PURCHASE_RETURNS
    else process.env.POSENGINE_ENABLE_PURCHASE_RETURNS = originalValue
  })

  it('blocks draft creation at the service boundary before any database call', async () => {
    await expect(service.create('tenant-1', {} as any)).rejects.toBeInstanceOf(ServiceUnavailableException)
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it('blocks confirmation at the service boundary before any database call', async () => {
    await expect(service.confirm('return-1', 'tenant-1')).rejects.toBeInstanceOf(ServiceUnavailableException)
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })
})
