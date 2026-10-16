import { jest } from '@jest/globals';
import { PosInventorySimulationService } from './pos-inventory-simulation.service.js';

function order(id: bigint, quantity: string, options: { refund?: string } = {}) {
  return {
    id,
    sourceStatus: 'Paid',
    refundAmount: options.refund ?? '0.00',
    inventoryStatus: 'OBSERVED',
    sourceFingerprint: String(id).padStart(64, '0'),
    items: [{ id: id * 10n, productId: 5n, quantity }],
  };
}

function createService(orders: ReturnType<typeof order>[]) {
  const transaction = {
    posInventorySimulation: {
      upsert: jest.fn().mockResolvedValue({ id: 100n } as never),
    },
    posInventorySimulationItem: {
      deleteMany: jest.fn().mockResolvedValue({ count: 0 } as never),
      upsert: jest.fn().mockResolvedValue({ id: 101n } as never),
    },
    posOrder: { update: jest.fn().mockResolvedValue({ id: 1n } as never) },
  };
  const client = {
    organization: {
      findUniqueOrThrow: jest.fn().mockResolvedValue({ timezone: 'Pacific/Auckland' } as never),
    },
    posOrder: { findMany: jest.fn().mockResolvedValue(orders as never) },
    inventoryBalance: {
      findMany: jest.fn().mockResolvedValue([{ productId: 5n, quantity: 10 }] as never),
    },
    $transaction: jest.fn(async (callback: (value: typeof transaction) => unknown) =>
      callback(transaction)),
  };
  return {
    service: new PosInventorySimulationService({ client } as never),
    client,
    transaction,
  };
}

describe('PosInventorySimulationService', () => {
  it('calculates a continuous projected balance across chronological orders', async () => {
    const { service, client, transaction } = createService([
      order(1n, '3.0000'),
      order(2n, '4.0000'),
    ]);

    const result = await service.simulateDate(1n, 2n, '2026-08-21', '2026-08-20');

    expect(result).toMatchObject({
      ordersObserved: 2,
      ordersReady: 2,
      unitsSimulated: 7,
    });
    expect(client.posOrder.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        orderedAt: {
          gte: new Date('2026-08-19T12:00:00.000Z'),
          lt: new Date('2026-08-21T12:00:00.000Z'),
        },
      }),
    }));
    expect(transaction.posInventorySimulationItem.upsert).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        create: expect.objectContaining({ quantityBefore: 10, projectedQuantity: 7 }),
      }),
    );
    expect(transaction.posInventorySimulationItem.upsert).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        create: expect.objectContaining({ quantityBefore: 7, projectedQuantity: 3 }),
      }),
    );
  });

  it('sends refunded orders to review without reducing projected stock', async () => {
    const { service, transaction } = createService([
      order(1n, '2.0000', { refund: '5.00' }),
    ]);

    const result = await service.simulateDate(1n, 2n, '2026-08-20');

    expect(result.ordersReviewRequired).toBe(1);
    expect(transaction.posInventorySimulationItem.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          quantityBefore: 10,
          projectedQuantity: 10,
          status: 'REVIEW_REQUIRED',
        }),
      }),
    );
    expect(transaction.posOrder.update).toHaveBeenCalledWith({
      where: { id: 1n },
      data: { inventoryStatus: 'REVIEW_REQUIRED' },
    });
  });
});
