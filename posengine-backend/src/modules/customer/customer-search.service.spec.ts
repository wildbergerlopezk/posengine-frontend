jest.mock('../../prisma/prisma.service', () => ({ PrismaService: class PrismaService {} }))

import { CustomerService } from './customer.service'

describe('CustomerService search filters', () => {
  const customer = {
    findMany: jest.fn(),
    count: jest.fn(),
  }
  const service = new CustomerService({ customer } as any)

  beforeEach(() => {
    jest.clearAllMocks()
    customer.findMany.mockResolvedValue([])
    customer.count.mockResolvedValue(0)
  })

  it('applies tenant, active, debt and search filters before pagination', async () => {
    await service.findAll('tenant-a', {
      search: 'Cliente remoto',
      hasDebt: true,
      page: 2,
      limit: 10,
    })

    const expectedWhere = {
      tenantId: 'tenant-a',
      isActive: true,
      currentDebt: { gt: 0 },
      OR: expect.arrayContaining([
        { name: { contains: 'Cliente remoto', mode: 'insensitive' } },
      ]),
    }
    expect(customer.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expectedWhere,
      skip: 10,
      take: 10,
    }))
    expect(customer.count).toHaveBeenCalledWith({ where: expectedWhere })
  })
})
