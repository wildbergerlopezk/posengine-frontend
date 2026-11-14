jest.mock('../../prisma/prisma.service', () => ({ PrismaService: class PrismaService {} }))
jest.mock('../stock-movement/stock-movement.service', () => ({ StockMovementService: class StockMovementService {} }))
jest.mock('./services/sale-validation.service', () => ({ SaleValidationService: class SaleValidationService {} }))
jest.mock('./services/sale-credit.service', () => ({ SaleCreditService: class SaleCreditService {} }))

import { SaleService } from './services/sale.service'

describe('SaleService history search', () => {
  const sale = {
    findMany: jest.fn(),
    count: jest.fn(),
  }
  const service = new SaleService({ sale } as any, {} as any, {} as any, {} as any)

  beforeEach(() => {
    jest.clearAllMocks()
    sale.findMany.mockResolvedValue([])
    sale.count.mockResolvedValue(0)
  })

  it('searches sale ID and customer name before applying page and keeps tenant filters', async () => {
    await service.findAll('tenant-a', {
      search: 'cliente lejano',
      status: 'COMPLETED' as any,
      page: 3,
      limit: 10,
    })

    const expectedWhere = {
      tenantId: 'tenant-a',
      status: 'COMPLETED',
      OR: [
        { id: { contains: 'cliente lejano', mode: 'insensitive' } },
        { customer: { is: { name: { contains: 'cliente lejano', mode: 'insensitive' } } } },
      ],
    }
    expect(sale.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expectedWhere,
      skip: 20,
      take: 10,
    }))
    expect(sale.count).toHaveBeenCalledWith({ where: expectedWhere })
  })
})
