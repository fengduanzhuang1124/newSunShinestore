import { jest } from '@jest/globals';
import { ConflictException, ForbiddenException } from '@nestjs/common';
import { StockCountService } from './stock-count.service.js';

const requestId = '6f1b7c3e-2a4d-4e8f-9b1a-3c5d7e9f0a12';
const task = { id: 3n, code: 'RECOUNT-20261024', storeId: 1n, warehouseId: 2n, status: 'OPEN' };

function setup(options: { balances?: unknown[]; replay?: boolean; pendingAfter?: number; admin?: boolean } = {}) {
  const tx = {
    auditLog: {
      findFirst: jest.fn().mockResolvedValue((options.replay ? { id: 99n } : null) as never),
      create: jest.fn().mockResolvedValue({} as never),
    },
    stockCountTaskItem: {
      findFirst: jest.fn().mockResolvedValue({ id: 40n, taskId: 3n, productId: 1994n, confirmCount: 0, task } as never),
      update: jest.fn().mockResolvedValue({} as never),
      count: jest.fn().mockResolvedValue((options.pendingAfter ?? 5) as never),
      findUniqueOrThrow: jest.fn().mockResolvedValue({
        id: 40n, productId: 1994n, priority: 1, reasons: '10-20 入库单叠加', source: 'PLANNED', status: 'CONFIRMED', countedQuantity: 216, confirmCount: 1,
        confirmedAt: new Date('2026-10-24T03:00:00.000Z'), product: { name: 'TheraLady 大金瓶精华液', brandName: null, barcodes: [{ barcode: '9421' }] },
      } as never),
      groupBy: jest.fn().mockResolvedValue([{ status: 'CONFIRMED', _count: { _all: 1 } }, { status: 'PENDING', _count: { _all: 5 } }] as never),
    },
    stockCountTask: { update: jest.fn().mockResolvedValue({} as never) },
    inventoryBalance: {
      findMany: jest.fn().mockResolvedValue((options.balances ?? [
        { productId: 1994n, batchId: 7n, quantity: 201, version: 4, batch: { expiryDate: new Date('2028-03-11T00:00:00.000Z'), expiryPrecision: 'DATE' } },
        { productId: 1994n, batchId: 8n, quantity: 21, version: 2, batch: { expiryDate: new Date('2028-03-31T00:00:00.000Z'), expiryPrecision: 'MONTH' } },
      ]) as never),
      updateMany: jest.fn().mockResolvedValue({ count: 1 } as never),
      create: jest.fn().mockResolvedValue({} as never),
    },
    productBatch: { upsert: jest.fn().mockResolvedValue({ id: 9n } as never) },
    stockMovement: { create: jest.fn().mockResolvedValue({} as never) },
    posOrderItem: { updateMany: jest.fn().mockResolvedValue({ count: 2 } as never) },
  };
  const client = { $transaction: jest.fn(async (callback: (value: typeof tx) => unknown) => callback(tx)) };
  const permissions = {
    warehousePermission: jest.fn().mockResolvedValue({ warehouseId: 2n, warehouse: { storeId: 1n } } as never),
    requireStoreAdmin: options.admin === false
      ? jest.fn().mockRejectedValue(new ForbiddenException('只有门店管理员可以执行此操作') as never)
      : jest.fn().mockResolvedValue(undefined as never),
  };
  return { tx, service: new StockCountService({ client } as never, permissions as never), permissions };
}

const expected = [{ batchId: '7', quantity: 201 }, { batchId: '8', quantity: 21 }];

describe('StockCountService.confirm', () => {
  it('aligns the batches with the count, covers earlier POS shortfalls and records the confirmation', async () => {
    const { tx, service } = setup();

    const result = await service.confirm(1n, 2n, '3', '40', { lines: [{ expiry: '2028-03-11', quantity: 195 }, { expiry: '2028-04', quantity: 21 }], expected, requestId });

    expect(tx.inventoryBalance.updateMany).toHaveBeenCalledWith({
      where: { organizationId: 1n, warehouseId: 2n, productId: 1994n, batchId: 7n, quantity: 201, version: 4 },
      data: { quantity: 195, version: { increment: 1 } },
    });
    expect(tx.inventoryBalance.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ batchId: 8n }), data: { quantity: 0, version: { increment: 1 } } }));
    expect(tx.productBatch.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ productId: 1994n, expiryDate: new Date('2028-04-30T00:00:00.000Z'), expiryPrecision: 'MONTH' }),
    }));
    expect(tx.inventoryBalance.create).toHaveBeenCalledWith({ data: { organizationId: 1n, warehouseId: 2n, productId: 1994n, batchId: 9n, quantity: 21 } });
    expect(tx.stockMovement.create).toHaveBeenCalledTimes(3);
    expect(tx.stockMovement.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ movementType: 'STOCKTAKE_LOSS', quantityDelta: -6, referenceType: 'STOCK_COUNT', referenceId: 40n, idempotencyKey: 'count:40:1:7' }),
    });
    expect(tx.posOrderItem.updateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({ productId: 1994n, inventoryReviewReason: { in: ['INSUFFICIENT_INVENTORY'] }, order: expect.objectContaining({ storeId: 1n }) }),
      data: { inventoryReviewReason: 'COVERED_BY_STOCKTAKE' },
    });
    expect(tx.stockCountTaskItem.update).toHaveBeenCalledWith({
      where: { id: 40n },
      data: expect.objectContaining({ status: 'CONFIRMED', systemQuantity: 222, countedQuantity: 216, confirmCount: 1, confirmedById: 2n }),
    });
    expect(tx.auditLog.create).toHaveBeenCalledWith({ data: expect.objectContaining({ action: 'inventory.stock_count.confirm', requestId }) });
    expect(tx.stockCountTask.update).not.toHaveBeenCalled();
    expect(result.task).toEqual({ id: '3', code: 'RECOUNT-20261024', total: 6, confirmed: 1, pending: 5 });
    expect(result.item).toMatchObject({ id: '40', status: 'CONFIRMED', countedQuantity: 216, batches: expect.any(Array) });
  });

  it('confirms an unchanged product without movements and closes the task after the last item', async () => {
    const { tx, service } = setup({ pendingAfter: 0 });

    await service.confirm(1n, 2n, '3', '40', { lines: [{ expiry: '2028-03-11', quantity: 201 }, { expiry: '2028-03', quantity: 21 }], expected, requestId });

    expect(tx.stockMovement.create).not.toHaveBeenCalled();
    expect(tx.stockCountTaskItem.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ systemQuantity: 222, countedQuantity: 222 }) }));
    expect(tx.stockCountTask.update).toHaveBeenCalledWith({ where: { id: 3n }, data: expect.objectContaining({ status: 'COMPLETED' }) });
  });

  it('refuses when stock moved after the phone loaded the product', async () => {
    const { tx, service } = setup();

    await expect(service.confirm(1n, 2n, '3', '40', { lines: [], expected: [{ batchId: '7', quantity: 203 }, { batchId: '8', quantity: 21 }], requestId }))
      .rejects.toBeInstanceOf(ConflictException);
    expect(tx.stockMovement.create).not.toHaveBeenCalled();
  });

  it('returns the earlier result for a repeated request without writing again', async () => {
    const { tx, service } = setup({ replay: true });

    const result = await service.confirm(1n, 2n, '3', '40', { lines: [{ expiry: '2028-03-11', quantity: 1 }], expected, requestId });

    expect(result.item.status).toBe('CONFIRMED');
    expect(tx.inventoryBalance.updateMany).not.toHaveBeenCalled();
    expect(tx.stockMovement.create).not.toHaveBeenCalled();
  });

  it('is limited to store administrators', async () => {
    const { tx, service } = setup({ admin: false });

    await expect(service.confirm(1n, 5n, '3', '40', { lines: [], expected: [], requestId })).rejects.toBeInstanceOf(ForbiddenException);
    expect(tx.stockCountTaskItem.findFirst).not.toHaveBeenCalled();
  });
});

describe('StockCountService.summary', () => {
  it('returns only the progress of the open task', async () => {
    const client = {
      stockCountTask: { findFirst: jest.fn().mockResolvedValue({ id: 3n, code: 'RECOUNT-20261024', title: '10-24重新点货' } as never) },
      stockCountTaskItem: { groupBy: jest.fn().mockResolvedValue([{ status: 'CONFIRMED', _count: { _all: 4 } }, { status: 'PENDING', _count: { _all: 660 } }] as never) },
    };
    const permissions = { warehousePermission: jest.fn().mockResolvedValue({ warehouseId: 2n, warehouse: { storeId: 1n } } as never), requireStoreAdmin: jest.fn().mockResolvedValue(undefined as never) };

    const result = await new StockCountService({ client } as never, permissions as never).summary(1n, 2n);

    expect(result).toEqual({ task: { id: '3', code: 'RECOUNT-20261024', title: '10-24重新点货', total: 664, confirmed: 4, pending: 660 } });
    expect(permissions.requireStoreAdmin).toHaveBeenCalledWith(1n, 2n, 1n);
  });
});
