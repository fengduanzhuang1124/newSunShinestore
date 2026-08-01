import { BadRequestException } from '@nestjs/common';
import { jest } from '@jest/globals';
import { InventoryService } from './inventory.service.js';

describe('InventoryService stocktake', () => {
  const permission = { warehouseId: 1n, warehouse: { id: 1n, storeId: 1n, name: '主仓库' } };

  function createService(currentQuantity = 10) {
    const transaction = {
      productBatch: { findFirst: jest.fn().mockResolvedValue({ productId: 2n } as never) },
      inventoryBalance: {
        findUnique: jest.fn().mockResolvedValue({
          organizationId: 1n, warehouseId: 1n, productId: 2n, batchId: 3n,
          quantity: currentQuantity, version: 1,
          product: { name: '测试商品' },
          batch: { expiryDate: new Date('2027-08-31T00:00:00.000Z'), expiryPrecision: 'MONTH' },
        } as never),
        updateMany: jest.fn().mockResolvedValue({ count: 1 } as never),
      },
      stockMovement: { create: jest.fn().mockResolvedValue({ id: 4n } as never) },
      auditLog: { create: jest.fn().mockResolvedValue({ id: 5n } as never) },
    };
    const client = {
      userWarehousePermission: { findFirst: jest.fn().mockResolvedValue(permission as never) },
      $transaction: jest.fn(async (callback: (tx: typeof transaction) => unknown) => callback(transaction)),
    };
    return { service: new InventoryService({ client } as never), transaction };
  }

  it('creates a gain movement when the counted quantity is higher', async () => {
    const { service, transaction } = createService(10);
    const result = await service.stocktakeAdjustment(1n, 1n, {
      batchId: '3', actualQuantity: 12, reason: '现场盘点',
    });

    expect(result).toMatchObject({ previousQuantity: 10, actualQuantity: 12, difference: 2 });
    expect(transaction.stockMovement.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ movementType: 'STOCKTAKE_GAIN', quantityDelta: 2 }),
    }));
  });

  it('rejects a stocktake that would not change inventory', async () => {
    const { service } = createService(10);
    await expect(service.stocktakeAdjustment(1n, 1n, {
      batchId: '3', actualQuantity: 10, reason: '现场盘点',
    })).rejects.toBeInstanceOf(BadRequestException);
  });
});
