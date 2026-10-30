import { jest } from '@jest/globals';
import { PosInventoryApplicationService } from './pos-inventory-application.service.js';

const from = new Date('2026-10-12T11:00:00.000Z');
const to = new Date('2026-10-13T11:00:00.000Z');

function paidOrder() {
  return {
    id: 10n,
    externalOrderNo: 'ORDER-10',
    orderedAt: new Date('2026-10-12T22:00:00.000Z'),
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
      product: { findMany: jest.fn().mockResolvedValue([] as never) },
      stockCountTaskItem: { findMany: jest.fn().mockResolvedValue([] as never) },
    };
    const service = new PosInventoryApplicationService({ client } as never);

    const result = await service.previewRange(1n, 3n, from, to);

    expect(result.summary).toEqual({
      ordersScanned: 1,
      eligibleOrders: 1,
      unitsPlanned: 3,
      reviewRequiredOrders: 2,
      blockedOrders: 0,
      reviewLines: 0,
      shortfallUnits: 0,
    });
    expect(client.posOrder.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        sourceStatus: 'Paid',
        refundAmount: 0,
        inventoryStatus: { in: ['OBSERVED', 'SIMULATED'] },
      }),
    }));
  });

  function applySetup(order: ReturnType<typeof paidOrder>, balances: ReturnType<typeof balance>[], counted: { productId: bigint; confirmedAt: Date }[] = []) {
    const transaction = {
      product: { findMany: jest.fn().mockResolvedValue([] as never) },
      stockCountTaskItem: { findMany: jest.fn().mockResolvedValue(counted as never) },
      posOrder: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 } as never),
        findUniqueOrThrow: jest.fn().mockResolvedValue(order as never),
        update: jest.fn().mockResolvedValue({ id: 10n } as never),
      },
      posOrderItem: { update: jest.fn().mockResolvedValue({} as never) },
      inventoryBalance: {
        findMany: jest.fn().mockResolvedValue(balances as never),
        updateMany: jest.fn().mockResolvedValue({ count: 1 } as never),
      },
      stockMovement: { create: jest.fn().mockResolvedValue({ id: 20n } as never) },
      auditLog: { create: jest.fn().mockResolvedValue({ id: 30n } as never) },
    };
    const client = {
      posOrder: { findMany: jest.fn().mockResolvedValue([order] as never) },
      $transaction: jest.fn(async (callback: (tx: typeof transaction) => unknown) => callback(transaction)),
    };
    return { transaction, service: new PosInventoryApplicationService({ client } as never) };
  }

  it('writes a SALE_OUT movement and decrements the batch atomically', async () => {
    const { transaction, service } = applySetup(paidOrder(), [balance()]);

    const result = await service.applyRange(1n, 7n, 3n, from, to);

    expect(result.summary).toEqual({
      ordersScanned: 1,
      appliedOrders: 1,
      unitsApplied: 3,
      blockedOrders: 0,
      reviewLines: 0,
      shortfallUnits: 0,
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
    expect(transaction.posOrderItem.update).toHaveBeenCalledWith({
      where: { id: 100n },
      data: { inventoryAppliedQuantity: 3, inventoryReviewReason: null },
    });
    expect(transaction.posOrder.update).toHaveBeenCalledWith({
      where: { id: 10n },
      data: expect.objectContaining({
        inventoryStatus: 'APPLIED',
        inventoryAppliedById: 7n,
      }),
    });
  });

  it('deducts what is available and records the shortfall for review instead of blocking the order', async () => {
    const { transaction, service } = applySetup(paidOrder(), [balance(2)]);

    const result = await service.applyRange(1n, 7n, 3n, from, to);

    expect(result.summary).toMatchObject({ appliedOrders: 1, unitsApplied: 2, blockedOrders: 0, reviewLines: 1, shortfallUnits: 1 });
    expect(result.issues).toEqual([expect.objectContaining({
      orderNo: 'ORDER-10', reason: 'INSUFFICIENT_INVENTORY', itemId: '100', required: 3, available: 2,
    })]);
    expect(transaction.inventoryBalance.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: { quantity: { decrement: 2 }, version: { increment: 1 } },
    }));
    expect(transaction.posOrderItem.update).toHaveBeenCalledWith({
      where: { id: 100n },
      data: { inventoryAppliedQuantity: 2, inventoryReviewReason: 'INSUFFICIENT_INVENTORY' },
    });
  });

  it('applies mapped lines even when another line in the order is unmapped or a return', async () => {
    const order = paidOrder();
    order.items.push(
      { id: 101n, productId: null as unknown as bigint, quantity: '1.0000', isMinus: false, disposition: 'UNMAPPED', status: 'ACTIVE' },
      { id: 102n, productId: 5n, quantity: '1.0000', isMinus: true, disposition: 'INVENTORY', status: 'ACTIVE' },
      { id: 103n, productId: null as unknown as bigint, quantity: '1.0000', isMinus: false, disposition: 'NON_INVENTORY', status: 'ACTIVE' },
    );
    const { transaction, service } = applySetup(order, [balance()]);

    const result = await service.applyRange(1n, 7n, 3n, from, to);

    expect(result.summary).toMatchObject({ appliedOrders: 1, unitsApplied: 3, reviewLines: 2, shortfallUnits: 0 });
    expect(result.issues.map((issue) => [issue.itemId, issue.reason])).toEqual([['101', 'UNMAPPED'], ['102', 'RETURN_LINE']]);
    expect(transaction.posOrderItem.update).toHaveBeenCalledTimes(3);
    expect(transaction.posOrderItem.update).not.toHaveBeenCalledWith(expect.objectContaining({ where: { id: 103n } }));
  });

  it('rolls the order back and reports a conflict when a batch changes mid-transaction', async () => {
    const { transaction, service } = applySetup(paidOrder(), [balance()]);
    transaction.inventoryBalance.updateMany.mockResolvedValue({ count: 0 } as never);

    const result = await service.applyRange(1n, 7n, 3n, from, to);

    expect(result.summary).toMatchObject({ appliedOrders: 0, blockedOrders: 1 });
    expect(result.issues).toEqual([expect.objectContaining({ reason: 'CONCURRENT_CHANGE' })]);
    expect(transaction.posOrder.update).not.toHaveBeenCalled();
  });

  describe('stock count coverage (REQ-012)', () => {
    it('does not deduct a sale ordered before the product was counted and reports no shortfall', async () => {
      const { transaction, service } = applySetup(paidOrder(), [balance()], [{ productId: 5n, confirmedAt: new Date('2026-10-12T23:00:00.000Z') }]);

      const result = await service.applyRange(1n, 7n, 3n, from, to);

      expect(result.summary).toMatchObject({ appliedOrders: 1, unitsApplied: 0, reviewLines: 0, shortfallUnits: 0 });
      expect(result.issues).toEqual([]);
      expect(transaction.stockMovement.create).not.toHaveBeenCalled();
      expect(transaction.posOrderItem.update).toHaveBeenCalledWith({
        where: { id: 100n },
        data: { inventoryAppliedQuantity: 0, inventoryReviewReason: 'COVERED_BY_STOCKTAKE' },
      });
      expect(transaction.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ afterSummary: expect.objectContaining({ coveredByStocktake: [{ itemId: '100', productId: '5', quantity: 3 }] }) }),
      });
    });

    it('deducts sales ordered after the count as usual', async () => {
      const { transaction, service } = applySetup(paidOrder(), [balance()], [{ productId: 5n, confirmedAt: new Date('2026-10-12T21:00:00.000Z') }]);

      const result = await service.applyRange(1n, 7n, 3n, from, to);

      expect(result.summary).toMatchObject({ unitsApplied: 3, reviewLines: 0 });
      expect(transaction.stockMovement.create).toHaveBeenCalledTimes(1);
    });

    it('leaves covered lines out of the preview', async () => {
      const client = {
        posOrder: { findMany: jest.fn().mockResolvedValue([paidOrder()] as never), count: jest.fn().mockResolvedValue(0 as never) },
        inventoryBalance: { findMany: jest.fn().mockResolvedValue([balance(1)] as never) },
        product: { findMany: jest.fn().mockResolvedValue([] as never) },
      stockCountTaskItem: { findMany: jest.fn().mockResolvedValue([{ productId: 5n, confirmedAt: new Date('2026-10-13T00:00:00.000Z') }] as never) },
      };
      const result = await new PosInventoryApplicationService({ client } as never).previewRange(1n, 3n, from, to);

      expect(result.summary).toMatchObject({ unitsPlanned: 0, reviewLines: 0, shortfallUnits: 0 });
      expect(client.stockCountTaskItem.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ status: 'CONFIRMED', task: { storeId: 3n } }),
      }));
    });

    it('keeps covered lines out of the review list', async () => {
      const client = {
        posOrderItem: { findMany: jest.fn().mockResolvedValue([] as never) },
        posProductMapping: { findMany: jest.fn().mockResolvedValue([] as never) },
        inventoryBalance: { findMany: jest.fn().mockResolvedValue([] as never) },
      };
      await new PosInventoryApplicationService({ client } as never).listReviewLines(1n, 3n);

      expect(client.posOrderItem.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ inventoryReviewReason: { not: null, notIn: ['COVERED_BY_STOCKTAKE', 'DIRECT_SHIP'] } }),
      }));
    });
  });

  describe('direct-ship products (CR-005)', () => {
    it('treats milk powder named with a pack marker as direct-ship without a flag', async () => {
      const { transaction, service } = applySetup(paidOrder(), [balance()]);
      transaction.product.findMany.mockResolvedValue([{ id: 5n, name: 'Anchor Full cream 1kg SF *6', chineseName: null, englishName: null, storeProducts: [] }] as never);

      const result = await service.applyRange(1n, 7n, 3n, from, to);

      expect(result.summary).toMatchObject({ unitsApplied: 0, reviewLines: 0 });
      expect(transaction.stockMovement.create).not.toHaveBeenCalled();
    });

    it('settles direct-ship lines without deducting or asking for review', async () => {
      const { transaction, service } = applySetup(paidOrder(), [balance()]);
      transaction.product.findMany.mockResolvedValue([{ id: 5n, name: 'Local direct-ship product', chineseName: null, englishName: null, storeProducts: [{ directShip: true }] }] as never);

      const result = await service.applyRange(1n, 7n, 3n, from, to);

      expect(result.summary).toMatchObject({ unitsApplied: 0, reviewLines: 0, shortfallUnits: 0 });
      expect(transaction.stockMovement.create).not.toHaveBeenCalled();
      expect(transaction.posOrderItem.update).toHaveBeenCalledWith({ where: { id: 100n }, data: { inventoryAppliedQuantity: 0, inventoryReviewReason: 'DIRECT_SHIP' } });
      expect(transaction.product.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: { in: [5n] } } }));
    });
  });

  it('reads the store baseline before falling back to the environment value', async () => {
    const findUnique = jest.fn()
      .mockResolvedValueOnce({ posInventoryBaselineAt: new Date('2026-10-20T10:01:47.000Z') } as never)
      .mockResolvedValueOnce({ posInventoryBaselineAt: null } as never);
    const service = new PosInventoryApplicationService({ client: { store: { findUnique } } } as never);
    const previous = process.env.POS_INVENTORY_BASELINE_AT;
    process.env.POS_INVENTORY_BASELINE_AT = '2026-10-12T05:15:22.401Z';
    try {
      expect(await service.resolveBaseline(3n)).toEqual(new Date('2026-10-20T10:01:47.000Z'));
      expect(await service.resolveBaseline(3n)).toEqual(new Date('2026-10-12T05:15:22.401Z'));
    } finally {
      if (previous === undefined) delete process.env.POS_INVENTORY_BASELINE_AT;
      else process.env.POS_INVENTORY_BASELINE_AT = previous;
    }
  });

  describe('re-applying review lines', () => {
    function reviewItem(overrides: Record<string, unknown> = {}) {
      return {
        id: 200n, externalProductId: 'POS-7', mappingId: null, productId: null, quantity: '3.0000', isMinus: false,
        disposition: 'UNMAPPED', inventoryReviewReason: 'UNMAPPED', inventoryAppliedQuantity: 0,
        order: { externalOrderNo: 'ORDER-20', orderedAt: new Date('2026-10-21T01:00:00.000Z') }, ...overrides,
      };
    }

    function reapplySetup(item: ReturnType<typeof reviewItem> | null, balances: ReturnType<typeof balance>[], mapping: unknown = { id: 9n, productId: 5n }, counted: { productId: bigint; confirmedAt: Date }[] = []) {
      const transaction = {
        product: { findMany: jest.fn().mockResolvedValue([] as never) },
      stockCountTaskItem: { findMany: jest.fn().mockResolvedValue(counted as never) },
        posOrderItem: { findFirst: jest.fn().mockResolvedValue(item as never), update: jest.fn().mockResolvedValue({} as never) },
        posProductMapping: { findFirst: jest.fn().mockResolvedValue(mapping as never) },
        inventoryBalance: {
          findMany: jest.fn().mockResolvedValue(balances as never),
          updateMany: jest.fn().mockResolvedValue({ count: 1 } as never),
        },
        stockMovement: { create: jest.fn().mockResolvedValue({ id: 21n } as never) },
        auditLog: { create: jest.fn().mockResolvedValue({ id: 31n } as never) },
      };
      const client = { $transaction: jest.fn(async (callback: (tx: typeof transaction) => unknown) => callback(transaction)) };
      return { transaction, service: new PosInventoryApplicationService({ client } as never) };
    }

    it('deducts a line whose POS product is now mapped and clears the review reason', async () => {
      const { transaction, service } = reapplySetup(reviewItem(), [balance(5)]);

      const result = await service.reapplyLines(1n, 7n, 3n, [200n]);

      expect(result).toMatchObject({ completed: 1, stillShort: 0, unitsApplied: 3, skipped: [] });
      expect(transaction.stockMovement.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ movementType: 'SALE_OUT', quantityDelta: -3, productId: 5n, idempotencyKey: 'posr:200:0:2:6' }),
      });
      expect(transaction.posOrderItem.update).toHaveBeenCalledWith({
        where: { id: 200n },
        data: expect.objectContaining({ productId: 5n, mappingId: 9n, disposition: 'INVENTORY', inventoryAppliedQuantity: 3, inventoryReviewReason: null }),
      });
    });

    it('tops up a short line only by the missing units and keeps the rest for review', async () => {
      const { transaction, service } = reapplySetup(
        reviewItem({ productId: 5n, disposition: 'INVENTORY', inventoryReviewReason: 'INSUFFICIENT_INVENTORY', inventoryAppliedQuantity: 1 }),
        [balance(1)],
      );

      const result = await service.reapplyLines(1n, 7n, 3n, [200n]);

      expect(result).toMatchObject({ completed: 0, stillShort: 1, unitsApplied: 1 });
      expect(transaction.posProductMapping.findFirst).not.toHaveBeenCalled();
      expect(transaction.posOrderItem.update).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ inventoryAppliedQuantity: 2, inventoryReviewReason: 'INSUFFICIENT_INVENTORY' }),
      }));
    });

    it('skips lines that are still unmapped or have no stock, writing nothing', async () => {
      const unmapped = reapplySetup(reviewItem(), [], null);
      expect(await unmapped.service.reapplyLines(1n, 7n, 3n, [200n])).toMatchObject({ skipped: [{ itemId: '200', reason: 'STILL_UNMAPPED' }] });

      const empty = reapplySetup(reviewItem({ productId: 5n, disposition: 'INVENTORY', inventoryReviewReason: 'INSUFFICIENT_INVENTORY' }), []);
      expect(await empty.service.reapplyLines(1n, 7n, 3n, [200n])).toMatchObject({ skipped: [{ itemId: '200', reason: 'NO_STOCK' }] });
      expect(empty.transaction.posOrderItem.update).not.toHaveBeenCalled();
      expect(empty.transaction.stockMovement.create).not.toHaveBeenCalled();
    });

    it('skips direct-ship products when re-applying', async () => {
      const { transaction, service } = reapplySetup(reviewItem({ productId: 5n, disposition: 'INVENTORY', inventoryReviewReason: 'INSUFFICIENT_INVENTORY' }), [balance(5)]);
      transaction.product.findMany.mockResolvedValue([{ id: 5n, name: 'Local direct-ship product', chineseName: null, englishName: null, storeProducts: [{ directShip: true }] }] as never);

      const result = await service.reapplyLines(1n, 7n, 3n, [200n]);

      expect(result).toMatchObject({ unitsApplied: 0, skipped: [{ itemId: '200', reason: 'DIRECT_SHIP' }] });
      expect(transaction.stockMovement.create).not.toHaveBeenCalled();
    });

    it('marks a line covered instead of deducting when the product was counted after the order', async () => {
      const { transaction, service } = reapplySetup(
        reviewItem({ productId: 5n, disposition: 'INVENTORY', inventoryReviewReason: 'INSUFFICIENT_INVENTORY', inventoryAppliedQuantity: 1 }),
        [balance(5)], undefined, [{ productId: 5n, confirmedAt: new Date('2026-10-24T02:00:00.000Z') }],
      );

      const result = await service.reapplyLines(1n, 7n, 3n, [200n]);

      expect(result).toMatchObject({ unitsApplied: 0, skipped: [{ itemId: '200', reason: 'COVERED_BY_STOCKTAKE' }] });
      expect(transaction.stockMovement.create).not.toHaveBeenCalled();
      expect(transaction.posOrderItem.update).toHaveBeenCalledWith({
        where: { id: 200n },
        data: expect.objectContaining({ inventoryReviewReason: 'COVERED_BY_STOCKTAKE' }),
      });
    });
  });
});

