import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { jest } from '@jest/globals';
import { MovementService } from './movement.service.js';
import { StocktakeService } from './stocktake.service.js';

describe('StocktakeService', () => {
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
    return { service: new StocktakeService({ client } as never), transaction };
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

describe('MovementService', () => {
  const permission = { warehouseId: 1n, warehouse: { id: 1n, storeId: 1n, name: '主仓库' } };

  function createReversalService(options: { admin?: boolean; balanceUpdated?: boolean } = {}) {
    const original = {
      id: 10n, movementNo: 'RCV-10', organizationId: 1n, storeId: 1n, warehouseId: 1n,
      productId: 2n, batchId: 3n, movementType: 'RECEIPT', quantityDelta: 5,
      product: { name: '测试商品' }, batch: { expiryDate: new Date('2027-08-31T00:00:00.000Z') },
      reversedBy: null,
    };
    const transaction = {
      stockMovement: {
        findUnique: jest.fn().mockResolvedValue(null as never),
        findFirst: jest.fn().mockResolvedValue(original as never),
        create: jest.fn().mockResolvedValue({ id: 11n, movementNo: 'REV-11' } as never),
      },
      inventoryBalance: {
        updateMany: jest.fn().mockResolvedValue({ count: options.balanceUpdated === false ? 0 : 1 } as never),
        findUniqueOrThrow: jest.fn().mockResolvedValue({ quantity: 7 } as never),
      },
      auditLog: { create: jest.fn().mockResolvedValue({ id: 12n } as never) },
    };
    const client = {
      userWarehousePermission: { findFirst: jest.fn().mockResolvedValue(permission as never) },
      userStoreRole: { findFirst: jest.fn().mockResolvedValue((options.admin === false ? null : { userId: 1n }) as never) },
      $transaction: jest.fn(async (callback: (tx: typeof transaction) => unknown) => callback(transaction)),
    };
    return { service: new MovementService({ client } as never), transaction };
  }

  it('reverses a receipt with an immutable negative movement', async () => {
    const { service, transaction } = createReversalService();
    const result = await service.reverseMovement(1n, 1n, '10', {
      reason: '数量录入错误', idempotencyKey: '11111111-1111-4111-8111-111111111111',
    });

    expect(result).toMatchObject({ reversedMovementNo: 'RCV-10', quantityDelta: -5, currentQuantity: 7 });
    expect(transaction.stockMovement.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ movementType: 'REVERSAL', quantityDelta: -5, reversalOfId: 10n }),
    }));
  });

  it('rejects reversing a receipt when remaining stock is insufficient', async () => {
    const { service } = createReversalService({ balanceUpdated: false });
    await expect(service.reverseMovement(1n, 1n, '10', {
      reason: '数量录入错误', idempotencyKey: '22222222-2222-4222-8222-222222222222',
    })).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects a non-admin user', async () => {
    const { service } = createReversalService({ admin: false });
    await expect(service.reverseMovement(1n, 1n, '10', {
      reason: '数量录入错误', idempotencyKey: '33333333-3333-4333-8333-333333333333',
    })).rejects.toBeInstanceOf(ForbiddenException);
  });
});
