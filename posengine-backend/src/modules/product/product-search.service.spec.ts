jest.mock('../../prisma/prisma.service', () => ({ PrismaService: class PrismaService {} }))
jest.mock('../../generated/prisma/client', () => ({
  Prisma: { QueryMode: { insensitive: 'insensitive' } },
}))

import { ProductService } from './product.service'

describe('ProductService search queries', () => {
  const stockMinimumField = { name: 'stockMinimum' }
  const product = {
    fields: { stockMinimum: stockMinimumField },
    findMany: jest.fn(),
    count: jest.fn(),
  }
  const prisma = { product } as any
  const service = new ProductService(prisma, {} as any)

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('filters low stock in PostgreSQL before pagination and counts the same filter', async () => {
    product.findMany.mockResolvedValue([])
    product.count.mockResolvedValue(4)

    const result = await service.findAll('tenant-a', {
      page: 2,
      limit: 2,
      skip: 2,
      lowStock: true,
    } as any)

    const expectedWhere = {
      tenantId: 'tenant-a',
      stock: { lte: stockMinimumField },
    }
    expect(product.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expectedWhere, skip: 2 }))
    expect(product.count).toHaveBeenCalledWith({ where: expectedWhere })
    expect(result).toMatchObject({ items: [], total: 4, page: 2, limit: 2 })
  })

  it('supports a server-side normal-stock filter', async () => {
    product.findMany.mockResolvedValue([])
    product.count.mockResolvedValue(8)

    await service.findAll('tenant-a', { page: 1, limit: 50, skip: 0, stockStatus: 'NORMAL' } as any)

    expect(product.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { tenantId: 'tenant-a', stock: { gt: stockMinimumField } },
    }))
  })

  it('uses a bounded projection and no count for the product selector', async () => {
    product.findMany.mockResolvedValue([])

    const result = await service.searchForSelector('tenant-a', {
      search: '000123',
      limit: 30,
      isActive: true,
    })

    expect(product.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        tenantId: 'tenant-a',
        isActive: true,
        OR: expect.arrayContaining([
          { barcode: { contains: '000123', mode: 'insensitive' } },
        ]),
      }),
      select: {
        id: true,
        name: true,
        description: true,
        barcode: true,
        sku: true,
        price: true,
        wholesalePrice: true,
        cost: true,
        stock: true,
        unitType: true,
      },
      take: 31,
    }))
    expect(product.count).not.toHaveBeenCalled()
    expect(result).toEqual({ items: [], hasMore: false })
  })
})
