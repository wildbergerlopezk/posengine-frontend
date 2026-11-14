jest.mock('../../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { StockMovementService } from './stock-movement.service';
import {
  StockMovementSourceType,
  StockMovementType,
} from '../../generated/prisma/enums';

describe('StockMovementService.registerSale', () => {
  const prisma = {};
  const tx = {
    $queryRaw: jest.fn(),
    product: { findFirst: jest.fn() },
    stockMovement: { create: jest.fn() },
  };
  let service: StockMovementService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new StockMovementService(prisma as any);
    tx.stockMovement.create.mockResolvedValue({ id: 'movement-1' });
  });

  it('decrements stock atomically and records matching before/after values', async () => {
    tx.$queryRaw.mockResolvedValue([{ stock: 3 }]);

    await service.registerSale(
      'tenant-1',
      'product-1',
      2,
      'sale-item-1',
      tx as any,
    );

    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(tx.stockMovement.create).toHaveBeenCalledWith({
      data: {
        tenantId: 'tenant-1',
        productId: 'product-1',
        type: StockMovementType.SALE,
        quantity: -2,
        before: 5,
        after: 3,
        referenceId: 'sale-item-1',
        notes: 'Venta',
        sourceType: StockMovementSourceType.SALE,
      },
    });
    expect(tx.product.findFirst).not.toHaveBeenCalled();
  });

  it('rejects when the atomic decrement finds insufficient stock', async () => {
    tx.$queryRaw.mockResolvedValue([]);
    tx.product.findFirst.mockResolvedValue({ stock: 1, isActive: true });

    await expect(
      service.registerSale(
        'tenant-1',
        'product-1',
        2,
        'sale-item-1',
        tx as any,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.stockMovement.create).not.toHaveBeenCalled();
  });

  it('rejects products missing from the authorized tenant', async () => {
    tx.$queryRaw.mockResolvedValue([]);
    tx.product.findFirst.mockResolvedValue(null);

    await expect(
      service.registerSale(
        'tenant-1',
        'product-1',
        2,
        'sale-item-1',
        tx as any,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(tx.stockMovement.create).not.toHaveBeenCalled();
  });

  it('allows only one concurrent sale when one unit is available', async () => {
    let remainingStock = 1;
    tx.$queryRaw.mockImplementation(
      async (_strings: TemplateStringsArray, ...values: unknown[]) => {
        const quantity = Number(values[0]);
        if (remainingStock < quantity) return [];
        remainingStock -= quantity;
        return [{ stock: remainingStock }];
      },
    );
    tx.product.findFirst.mockResolvedValue({
      stock: 0,
      isActive: true,
      name: 'Producto',
    });

    const results = await Promise.allSettled([
      service.registerSale(
        'tenant-1',
        'product-1',
        1,
        'sale-item-1',
        tx as any,
      ),
      service.registerSale(
        'tenant-1',
        'product-1',
        1,
        'sale-item-2',
        tx as any,
      ),
    ]);

    expect(results.filter(({ status }) => status === 'fulfilled')).toHaveLength(
      1,
    );
    expect(results.filter(({ status }) => status === 'rejected')).toHaveLength(
      1,
    );
    expect(remainingStock).toBe(0);
    expect(tx.stockMovement.create).toHaveBeenCalledTimes(1);
  });

  it('propagates a movement-write failure after updating stock so the caller can roll back its transaction', async () => {
    tx.$queryRaw.mockResolvedValue([{ stock: 3 }]);
    tx.stockMovement.create.mockRejectedValue(
      new Error('movement insert failed'),
    );

    await expect(
      service.registerSale(
        'tenant-1',
        'product-1',
        2,
        'sale-item-1',
        tx as any,
      ),
    ).rejects.toThrow('movement insert failed');
  });
});

describe('StockMovementService purchase inventory updates', () => {
  const prisma = {};
  const tx = {
    $queryRaw: jest.fn(),
    product: { findFirst: jest.fn() },
    stockMovement: { create: jest.fn() },
  };
  let service: StockMovementService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new StockMovementService(prisma as any);
    tx.stockMovement.create.mockResolvedValue({ id: 'movement-1' });
  });

  it('adds received purchase stock atomically and records the returned values', async () => {
    tx.$queryRaw.mockResolvedValue([{ stock: 7.5 }]);
    await service.registerPurchase('tenant-1', 'product-1', 2.5, 'purchase-item-1', tx as any);
    expect(tx.stockMovement.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: 'tenant-1', productId: 'product-1', quantity: 2.5,
        before: 5, after: 7.5, referenceId: 'purchase-item-1',
      }),
    });
  });

  it('rejects purchase stock updates for products outside the tenant', async () => {
    tx.$queryRaw.mockResolvedValue([]);

    await expect(service.registerPurchase(
      'tenant-a',
      'product-b',
      2,
      'purchase-item-1',
      tx as any,
    )).rejects.toBeInstanceOf(NotFoundException);

    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(tx.stockMovement.create).not.toHaveBeenCalled();
  });

  it('subtracts purchase cancellation stock conditionally and records the actual before/after', async () => {
    tx.$queryRaw.mockResolvedValue([{ stock: 2.5 }]);
    await service.registerPurchaseCancellation('tenant-1', 'product-1', 2.5, 'purchase-item-1', tx as any);
    expect(tx.stockMovement.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: 'tenant-1', productId: 'product-1', quantity: -2.5,
        before: 5, after: 2.5, referenceId: 'purchase-item-1',
      }),
    });
  });

  it('rejects purchase cancellation when the conditional decrement cannot preserve nonnegative stock', async () => {
    tx.$queryRaw.mockResolvedValue([]);
    tx.product.findFirst.mockResolvedValue({ stock: 1 });
    await expect(service.registerPurchaseCancellation('tenant-1', 'product-1', 2, 'purchase-item-1', tx as any))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(tx.stockMovement.create).not.toHaveBeenCalled();
  });
});
