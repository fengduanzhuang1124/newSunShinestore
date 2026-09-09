import { jest } from '@jest/globals';
import { PosObservationService } from './pos-observation.service.js';

describe('PosObservationService reconciliation', () => {
  it('returns a changed paid order to OBSERVED and deactivates missing lines', async () => {
    const transaction = {
      posOrder: { upsert: jest.fn().mockResolvedValue({ id: 20n } as never) },
      posOrderItem: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 } as never),
        upsert: jest.fn().mockResolvedValue({ id: 30n } as never),
      },
      posRefundReview: { upsert: jest.fn() },
    };
    const client = {
      posSyncRun: {
        create: jest.fn().mockResolvedValue({ id: 10n } as never),
        update: jest.fn().mockResolvedValue({ id: 10n } as never),
      },
      posOrder: {
        findMany: jest.fn().mockResolvedValue([{
          id: 20n,
          externalOrderNo: 'ORDER-1',
          sourceStatus: 'Paid',
          refundAmount: '0.00',
          inventoryStatus: 'SIMULATED',
        }] as never),
      },
      posProductMapping: {
        findMany: jest.fn().mockResolvedValue([{
          id: 40n,
          externalProductId: 'PRODUCT-1',
          productId: 50n,
          barcode: '942000000001',
        }] as never),
      },
      posSyncCursor: { upsert: jest.fn().mockResolvedValue({ id: 60n } as never) },
      $transaction: jest.fn(async (callback: (value: typeof transaction) => unknown) =>
        callback(transaction)),
    };
    const orders = {
      listAll: jest.fn().mockResolvedValue([{
        orderNo: 'ORDER-1',
        date: '20/08/2026 10:00:00',
        status: 'Paid',
        refundAmount: 0,
      }] as never),
      getDetail: jest.fn().mockResolvedValue({
        orderNo: 'ORDER-1',
        date: '20/08/2026 10:00:00',
        status: 'Paid',
        refundAmount: 0,
        orderAmount: 10,
        items: [{
          externalProductId: 'PRODUCT-1',
          name: 'Product 1',
          quantity: 1,
          price: 10,
          isMinus: false,
        }],
      } as never),
    };
    const service = new PosObservationService(
      { client } as never,
      {} as never,
      orders as never,
    );

    await service.observeOrders(1n, 2n, '2026-08-20', { reconcile: true });

    expect(transaction.posOrder.upsert).toHaveBeenCalledWith(expect.objectContaining({
      update: expect.objectContaining({ inventoryStatus: 'OBSERVED' }),
    }));
    expect(transaction.posOrderItem.updateMany).toHaveBeenCalledWith({
      where: { orderId: 20n, lineKey: { notIn: ['PRODUCT-1:1'] } },
      data: { status: 'INACTIVE' },
    });
    expect(transaction.posOrderItem.upsert).toHaveBeenCalledWith(expect.objectContaining({
      update: expect.objectContaining({ status: 'ACTIVE' }),
    }));
  });
});
