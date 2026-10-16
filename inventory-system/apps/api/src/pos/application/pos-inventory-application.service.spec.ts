import { jest } from '@jest/globals';
import { PosInventoryApplicationService } from './pos-inventory-application.service.js';

const from = new Date('2026-10-12T11:00:00.000Z');
const to = new Date('2026-10-13T11:00:00.000Z');

function paidOrder() {
  return {
    id: 10n,
    externalOrderNo: 'ORDER-10',
    sourceStatus: 'Paid',
    refundAmount: '0.00',
    inventoryStatus: 'OBSERVED',
    items: [{
      id: 100n,
      productId: 5n,
      quantity: '3.0000',
      isMinus: false,
      disposition: 'INVENTORY',
      status: 'ACTIVE',
    }],
  };
}

function balance(quantity = 5) {
  return {
    organizationId: 1n,
    warehouseId: 2n,
    productId: 5n,
    batchId: 6n,
    quantity,
    version: 0,
    batch: { expiryDate: new Date('2027-01-31T00:00:00.000Z'), status: 'ACTIVE' },
  };
}

describe('PosInventoryApplicationService', () => {
  it('previews paid inventory lines without changing stock', async () => {
    const client = {
      posOrder: {
        findMany: jest.fn().mockResolvedValue([paidOrder()] as never),
        count: jest.fn().mockResolvedValue(2 as never),
      },
      inventoryBalance: { findMany: jest.fn().mockResolvedValue([balance()] as never) },
    };
    const service = new PosInventoryApplicationService({ client } as never);

    const result = await service.previewRange(1n, 3n, from, to);

    expect(result.summary).toEqual({
      ordersScanned: 1,
      eligibleOrders: 1,
      unitsPlanned: 3,
      reviewRequiredOrders: 2,
      blockedOrders: 0,
    });
    expect(client.posOrder.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        sourceStatus: 'Paid',
        refundAmount: 0,
        inventoryStatus: { in: ['OBSERVED', 'SIMULATED'] },
      }),
    }));
  });

  it('writes a SALE_OUT movement and decrements the batch atomically', async () => {
    const transaction = {
      posOrder: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 } as never),
        findUniqueOrThrow: jest.fn().mockResolvedValue(paidOrder() as never),
        update: jest.fn().mockResolvedValue({ id: 10n } as never),
      },
      inventoryBalance: {
        findMany: jest.fn().mockResolvedValue([balance()] as never),
        updateMany: jest.fn().mockResolvedValue({ count: 1 } as never),
      },
      stockMovement: { create: jest.fn().mockResolvedValue({ id: 20n } as never) },
      auditLog: { create: jest.fn().mockResolvedValue({ id: 30n } as never) },
    };
    const client = {
      posOrder: { findMany: jest.fn().mockResolvedValue([paidOrder()] as never) },
      $transaction: jest.fn(async (callback: (tx: typeof transaction) => unknown) => callback(transaction)),
    };
    const service = new PosInventoryApplicationService({ client } as never);

    const result = await service.applyRange(1n, 7n, 3n, from, to);

    expect(result.summary).toEqual({
      ordersScanned: 1,
      appliedOrders: 1,
      unitsApplied: 3,
      blockedOrders: 0,
    });
    expect(transaction.stockMovement.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        movementType: 'SALE_OUT',
        quantityDelta: -3,
        referenceType: 'POS_SALE_ITEM',
        referenceId: 100n,
        performedById: 7n,
      }),
    });
    expect(transaction.inventoryBalance.updateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        organizationId: 1n,
        warehouseId: 2n,
        productId: 5n,
        batchId: 6n,
        version: 0,
      }),
      data: { quantity: { decrement: 3 }, version: { increment: 1 } },
    });
    expect(transaction.posOrder.update).toHaveBeenCalledWith({
      where: { id: 10n },
      data: expect.objectContaining({
        inventoryStatus: 'APPLIED',
        inventoryAppliedById: 7n,
      }),
    });
  });

  it('blocks an order when available stock is insufficient', async () => {
    const client = {
      posOrder: {
        findMany: jest.fn().mockResolvedValue([paidOrder()] as never),
        count: jest.fn().mockResolvedValue(0 as never),
      },
      inventoryBalance: { findMany: jest.fn().mockResolvedValue([balance(2)] as never) },
    };
    const service = new PosInventoryApplicationService({ client } as never);

    const result = await service.previewRange(1n, 3n, from, to);

    expect(result.summary.blockedOrders).toBe(1);
    expect(result.issues).toEqual([expect.objectContaining({
      orderNo: 'ORDER-10',
      reason: 'INSUFFICIENT_INVENTORY',
      required: 3,
      available: 2,
    })]);
  });
});
