jest.mock('../../../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

import { SaleCreditService } from './sale-credit.service';
import { PaymentMethod } from '../../../generated/prisma/enums';

describe('SaleCreditService.processCreditDebtAndPayments', () => {
  const prisma = {};
  const tx = {
    customer: { update: jest.fn() },
    customerPayment: { create: jest.fn() },
  };
  let service: SaleCreditService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new SaleCreditService(prisma as any);
  });

  it('does not create customer debt or a ledger payment for a collected non-credit sale', async () => {
    await service.processCreditDebtAndPayments(
      tx as any,
      'tenant-1',
      'sale-1',
      { id: 'customer-1' },
      0,
      100,
      PaymentMethod.CASH,
    );
    expect(tx.customer.update).not.toHaveBeenCalled();
    expect(tx.customerPayment.create).not.toHaveBeenCalled();
  });

  it('keeps debt and partial payment ledger entries for CREDIT', async () => {
    await service.processCreditDebtAndPayments(
      tx as any,
      'tenant-1',
      'sale-1',
      { id: 'customer-1' },
      70,
      30,
      PaymentMethod.CREDIT,
      'cash-1',
      PaymentMethod.TRANSFER,
    );
    expect(tx.customer.update).toHaveBeenCalledWith({
      where: { id: 'customer-1' },
      data: { currentDebt: { increment: 70 } },
    });
    expect(tx.customerPayment.create).toHaveBeenCalledWith({
      data: {
        tenantId: 'tenant-1',
        customerId: 'customer-1',
        saleId: 'sale-1',
        cashSessionId: 'cash-1',
        amount: 30,
        paymentMethod: PaymentMethod.TRANSFER,
      },
    });
  });
});
