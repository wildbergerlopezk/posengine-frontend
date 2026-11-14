jest.mock('../../../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));
jest.mock('../../product/product.service', () => ({
  ProductService: class ProductService {},
}));

import { SaleService } from './sale.service';
import { ServiceUnavailableException } from '@nestjs/common';
import {
  PaymentMethod,
  PaymentStatus,
  PriceType,
} from '../../../generated/prisma/enums';

describe('SaleService.create payment accounting', () => {
  const tx = {
    customer: { updateMany: jest.fn(), findFirst: jest.fn() },
    sale: {
      create: jest.fn(),
      findUnique: jest.fn(),
    },
    saleItem: { create: jest.fn() },
    cashSession: { update: jest.fn(), updateMany: jest.fn() },
  };
  const prisma = { $transaction: jest.fn() };
  const stockMovementService = { registerSale: jest.fn() };
  const saleValidationService = { validateAndFetchProducts: jest.fn() };
  const saleCreditService = {
    validateCreditLimit: jest.fn(),
    processCreditDebtAndPayments: jest.fn(),
  };
  const transactionOptions: any[] = [];
  let service: SaleService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new SaleService(
      prisma as any,
      stockMovementService as any,
      saleValidationService as any,
      saleCreditService as any,
    );
    saleValidationService.validateAndFetchProducts.mockResolvedValue([]);
    saleCreditService.validateCreditLimit.mockImplementation(
      async (_tenant, dto) => (dto.customerId ? {
        id: dto.customerId, currentDebt: 0, creditLimit: 1_000, isActive: true, creditEnabled: true,
      } : null),
    );
    tx.sale.create.mockResolvedValue({ id: 'sale-1' });
    tx.saleItem.create.mockResolvedValue({ id: 'item-1' });
    tx.sale.findUnique.mockResolvedValue({ id: 'sale-1' });
    tx.cashSession.updateMany.mockResolvedValue({ count: 1 });
    tx.customer.updateMany.mockResolvedValue({ count: 1 });
    tx.customer.findFirst.mockImplementation(async ({ where }: any) => ({
      id: where.id, currentDebt: 0, creditLimit: 1_000, isActive: true, creditEnabled: true,
    }));
    transactionOptions.length = 0;
    prisma.$transaction.mockImplementation(
      (callback: (client: typeof tx) => unknown, options: unknown) => {
        transactionOptions.push(options);
        return callback(tx);
      },
    );
  });

  async function create(
    paymentMethod: PaymentMethod,
    customerId?: string,
    amountPaid?: number,
  ) {
    await service.create('tenant-1', 'cash-session-1', {
      paymentMethod,
      customerId,
      amountPaid,
      ...(paymentMethod === PaymentMethod.CREDIT && amountPaid && amountPaid > 0
        ? { initialPaymentMethod: PaymentMethod.CASH }
        : {}),
      items: [
        {
          productId: 'product-1',
          quantity: 2,
          unitPrice: 50,
          priceType: PriceType.PUBLIC,
        },
      ],
    } as any);
    return tx.sale.create.mock.calls[0][0].data;
  }

  it.each([PaymentMethod.CASH, PaymentMethod.CARD, PaymentMethod.TRANSFER])(
    'records a collected %s sale as paid with no outstanding debt or customer-payment record',
    async (method) => {
      const sale = await create(method, 'customer-1');

      expect(sale).toMatchObject({
        paymentMethod: method,
        paymentStatus: PaymentStatus.PAID,
        remainingBalance: 0,
      });
      expect(tx.cashSession.update).toHaveBeenCalledWith({
        where: { id: 'cash-session-1' },
        data: { totalSales: { increment: 100 } },
      });
      expect(
        saleCreditService.processCreditDebtAndPayments,
      ).toHaveBeenCalledWith(
        tx,
        'tenant-1',
        'sale-1',
        { id: 'customer-1', currentDebt: 0, creditLimit: 1_000, isActive: true, creditEnabled: true },
        0,
        100,
        method,
        'cash-session-1',
        undefined,
      );
    },
  );

  it('records a CASH sale without a customer as paid', async () => {
    const sale = await create(PaymentMethod.CASH);
    expect(sale).toMatchObject({
      paymentStatus: PaymentStatus.PAID,
      remainingBalance: 0,
    });
    expect(tx.cashSession.update).toHaveBeenCalledWith({
      where: { id: 'cash-session-1' },
      data: { totalSales: { increment: 100 } },
    });
    expect(saleCreditService.processCreditDebtAndPayments).toHaveBeenCalledWith(
      tx,
      'tenant-1',
      'sale-1',
      null,
      0,
      100,
      PaymentMethod.CASH,
      'cash-session-1',
      undefined,
    );
  });

  it('retains pending and partial CREDIT balances', async () => {
    const pending = await create(PaymentMethod.CREDIT, 'customer-1', 0);
    expect(pending).toMatchObject({
      paymentStatus: PaymentStatus.PENDING,
      remainingBalance: 100,
    });

    jest.clearAllMocks();
    tx.sale.create.mockResolvedValue({ id: 'sale-1' });
    tx.saleItem.create.mockResolvedValue({ id: 'item-1' });
    tx.sale.findUnique.mockResolvedValue({ id: 'sale-1' });
    prisma.$transaction.mockImplementation(
      (callback: (client: typeof tx) => unknown, options: unknown) => {
        transactionOptions.push(options);
        return callback(tx);
      },
    );
    saleValidationService.validateAndFetchProducts.mockResolvedValue([]);
    saleCreditService.validateCreditLimit.mockResolvedValue({
      id: 'customer-1', currentDebt: 0, creditLimit: 1_000, isActive: true, creditEnabled: true,
    });

    const partial = await create(PaymentMethod.CREDIT, 'customer-1', 30);
    expect(partial).toMatchObject({
      paymentStatus: PaymentStatus.PARTIAL,
      remainingBalance: 70,
    });
    expect(tx.cashSession.update).toHaveBeenCalledWith({
      where: { id: 'cash-session-1' },
      data: { totalSales: { increment: 30 } },
    });
  });

  it.each([PaymentMethod.CASH, PaymentMethod.TRANSFER])(
    'requires an explicit permitted initial tender for a CREDIT deposit (%s)',
    async (initialPaymentMethod) => {
      saleValidationService.validateAndFetchProducts.mockResolvedValue([]);
      saleCreditService.validateCreditLimit.mockResolvedValue({
        id: 'customer-1', currentDebt: 0, creditLimit: 1_000, isActive: true, creditEnabled: true,
      });

      const sale = await service.create('tenant-1', 'cash-session-1', {
        paymentMethod: PaymentMethod.CREDIT,
        customerId: 'customer-1',
        amountPaid: 30,
        initialPaymentMethod,
        items: [{ productId: 'product-1', quantity: 2, unitPrice: 50 }],
      } as any);

      expect(sale).toEqual({ id: 'sale-1' });
      expect(saleCreditService.processCreditDebtAndPayments).toHaveBeenCalledWith(
        tx,
        'tenant-1',
        'sale-1',
        { id: 'customer-1', currentDebt: 0, creditLimit: 1_000, isActive: true, creditEnabled: true },
        70,
        30,
        PaymentMethod.CREDIT,
        'cash-session-1',
        initialPaymentMethod,
      );
    },
  );

  it('rejects a positive CREDIT deposit without a real tender method', async () => {
    saleValidationService.validateAndFetchProducts.mockResolvedValue([]);
    await expect(service.create('tenant-1', 'cash-session-1', {
      paymentMethod: PaymentMethod.CREDIT,
      customerId: 'customer-1',
      amountPaid: 30,
      items: [{ productId: 'product-1', quantity: 2, unitPrice: 50 }],
    } as any)).rejects.toThrow('El abono inicial requiere seleccionar efectivo o transferencia.');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it.each([1, 5, 10, 20])(
    'processes %i sale items in the sale transaction',
    async (count) => {
      saleValidationService.validateAndFetchProducts.mockResolvedValue([]);
      saleCreditService.validateCreditLimit.mockResolvedValue(null);
      tx.saleItem.create.mockImplementation(async ({ data }: any) => ({
        id: `item-${data.productId}`,
      }));
      await service.create('tenant-1', 'cash-session-1', {
        paymentMethod: PaymentMethod.CASH,
        items: Array.from({ length: count }, (_, index) => ({
          productId: `product-${String(index).padStart(2, '0')}`,
          quantity: 1,
          unitPrice: 50,
        })),
      } as any);

      expect(tx.saleItem.create).toHaveBeenCalledTimes(count);
      expect(stockMovementService.registerSale).toHaveBeenCalledTimes(count);
      expect(transactionOptions.at(-1)).toEqual({ timeout: 15_000 });
    },
  );

  it('stops cash and credit writes when a stock operation fails inside the transaction callback', async () => {
    stockMovementService.registerSale.mockRejectedValue(
      new Error('intermediate stock failure'),
    );

    await expect(
      service.create('tenant-1', 'cash-session-1', {
        paymentMethod: PaymentMethod.CASH,
        items: [{ productId: 'product-1', quantity: 1, unitPrice: 50 }],
      } as any),
    ).rejects.toThrow('intermediate stock failure');

    expect(tx.cashSession.update).not.toHaveBeenCalled();
    expect(
      saleCreditService.processCreditDebtAndPayments,
    ).not.toHaveBeenCalled();
  });

  it('blocks cancellation and restoration at the service boundary by default', async () => {
    const originalCancel = process.env.POSENGINE_ENABLE_SALE_CANCELLATIONS;
    const originalRestore = process.env.POSENGINE_ENABLE_SALE_RESTORATIONS;
    delete process.env.POSENGINE_ENABLE_SALE_CANCELLATIONS;
    delete process.env.POSENGINE_ENABLE_SALE_RESTORATIONS;
    try {
      await expect(service.cancel('sale-1', 'tenant-1')).rejects.toBeInstanceOf(ServiceUnavailableException);
      await expect(service.uncancel('sale-1', 'tenant-1')).rejects.toBeInstanceOf(ServiceUnavailableException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    } finally {
      if (originalCancel === undefined) delete process.env.POSENGINE_ENABLE_SALE_CANCELLATIONS;
      else process.env.POSENGINE_ENABLE_SALE_CANCELLATIONS = originalCancel;
      if (originalRestore === undefined) delete process.env.POSENGINE_ENABLE_SALE_RESTORATIONS;
      else process.env.POSENGINE_ENABLE_SALE_RESTORATIONS = originalRestore;
    }
  });
});
