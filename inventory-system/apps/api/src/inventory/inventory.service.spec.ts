import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { jest } from '@jest/globals';
import { MovementService } from './movement.service.js';
import { InventoryQueryService } from './inventory-query.service.js';
import { ReceivingService } from './receiving.service.js';
import { StocktakeService } from './stocktake.service.js';

describe('InventoryQueryService', () => {
  it('expands nearby brand words and ranks an UMF grade match first', async () => {
    const products = [
      {
        id: 3n, name: '康维他 麦卢卡蜂蜜 UMF25+ 250g', sku: 'HONEY-25', englishName: 'Comvita UMF25+ 250g',
        chineseName: null, brandName: 'Comvita', categoryName: '蜂蜜', barcodes: [{ barcode: '9400000000003' }], batches: [],
      },
      {
        id: 2n, name: '普通麦卢卡蜂蜜 10+ 250g', sku: 'HONEY-10', englishName: null, chineseName: null,
        brandName: null, categoryName: '蜂蜜', barcodes: [{ barcode: '9400000000002' }], batches: [],
      },
      {
        id: 1n, name: '康维他 麦卢卡蜂蜜 5+ 500g', sku: 'COMVITA-5', englishName: 'Comvita UMF 5+ 500g',
        chineseName: '康维他5+ 500g', brandName: 'Comvita', categoryName: '蜂蜜',
        barcodes: [{ barcode: '9400000000001' }], batches: [],
      },
    ];
    const client = { product: { findMany: jest.fn().mockResolvedValue(products as never) } };
    const permissions = { warehousePermission: jest.fn().mockResolvedValue({ warehouseId: 7n, warehouse: { name: '主仓库' } } as never) };
    const service = new InventoryQueryService({ client } as never, permissions as never);

    const result = await service.search(1n, 9n, 'umf 5+');

    expect(result.products[0]?.productName).toBe('康维他 麦卢卡蜂蜜 5+ 500g');
    expect(client.product.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        OR: expect.arrayContaining([
          expect.objectContaining({ name: { contains: '5+' } }),
          expect.objectContaining({ englishName: { contains: 'umf' } }),
        ]),
      }),
      take: 200,
    }));
  });
});

describe('ReceivingService', () => {
  it('creates an internal product code and inventory movement for a barcode-free item', async () => {
    const permission = { warehouseId: 1n, warehouse: { id: 1n, storeId: 2n, name: '主仓库' } };
    const product = { id: 22n, organizationId: 1n, sku: 'LOCAL-TEST', name: '整箱奶粉' };
    const transaction = {
      stockMovement: {
        findUnique: jest.fn().mockResolvedValue(null as never),
        create: jest.fn().mockResolvedValue({ id: 40n, createdAt: new Date('2026-09-22T01:00:00.000Z') } as never),
      },
      organization: { findUniqueOrThrow: jest.fn().mockResolvedValue({ timezone: 'Pacific/Auckland' } as never) },
      stockReceipt: {
        findFirst: jest.fn().mockResolvedValue(null as never),
        create: jest.fn().mockResolvedValue({ id: 30n, receiptNo: 'RK-TEST-003' } as never),
      },
      product: {
        findFirst: jest.fn().mockResolvedValue(null as never),
        create: jest.fn().mockResolvedValue(product as never),
      },
      productBarcode: {
        findUnique: jest.fn().mockResolvedValue(null as never),
        findFirst: jest.fn().mockResolvedValue(null as never),
        create: jest.fn().mockResolvedValue({
          id: 23n, productId: 22n, barcode: 'LOCAL-22', product,
        } as never),
      },
      storeProduct: { upsert: jest.fn().mockResolvedValue({} as never) },
      productBatch: { upsert: jest.fn().mockResolvedValue({ id: 24n } as never) },
      inventoryBalance: { upsert: jest.fn().mockResolvedValue({ quantity: 6 } as never) },
      stockReceiptItem: { create: jest.fn().mockResolvedValue({ id: 41n } as never) },
      auditLog: { create: jest.fn().mockResolvedValue({ id: 42n } as never) },
    };
    const client = {
      $transaction: jest.fn(async (callback: (tx: typeof transaction) => unknown) => callback(transaction)),
    };
    const permissions = { warehousePermission: jest.fn().mockResolvedValue(permission as never) };
    const service = new ReceivingService({ client } as never, permissions as never);

    const result = await service.receive(1n, 9n, {
      warehouseId: '1', idempotencyKey: '11111111-1111-4111-8111-111111111111',
      productName: '整箱奶粉', expiryMonth: '2027-12', quantity: 6,
    });

    expect(result).toMatchObject({
      barcode: 'LOCAL-22', productName: '整箱奶粉', quantityAdded: 6,
      currentQuantity: 6, generatedInternalBarcode: true, createdProduct: true,
    });
    expect(transaction.productBarcode.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ barcode: 'LOCAL-22', barcodeType: 'INTERNAL', isPrimary: true }),
    }));
    expect(transaction.inventoryBalance.upsert).toHaveBeenCalled();
    expect(transaction.stockMovement.create).toHaveBeenCalled();
  });

  it('merges repeated effective receipt entries while keeping reversals visible', async () => {
    const items = [
      {
        id: 1n, productId: 2n, batchId: 3n, barcode: '9400000000001', quantity: 5,
        createdAt: new Date('2026-09-22T01:00:00.000Z'), product: { name: '测试商品' },
        batch: { expiryDate: new Date('2027-08-31T00:00:00.000Z'), expiryPrecision: 'MONTH' },
        movement: { reversedBy: null },
      },
      {
        id: 2n, productId: 2n, batchId: 3n, barcode: '9400000000001', quantity: 7,
        createdAt: new Date('2026-09-22T02:00:00.000Z'), product: { name: '测试商品' },
        batch: { expiryDate: new Date('2027-08-31T00:00:00.000Z'), expiryPrecision: 'MONTH' },
        movement: { reversedBy: null },
      },
      {
        id: 4n, productId: 2n, batchId: 3n, barcode: '9400000000001', quantity: 4,
        createdAt: new Date('2026-09-22T03:00:00.000Z'), product: { name: '测试商品' },
        batch: { expiryDate: new Date('2027-08-31T00:00:00.000Z'), expiryPrecision: 'MONTH' },
        movement: { reversedBy: { id: 5n } },
      },
    ];
    const client = {
      organization: { findUniqueOrThrow: jest.fn().mockResolvedValue({ timezone: 'Pacific/Auckland' } as never) },
      stockReceipt: { findMany: jest.fn().mockResolvedValue([{
        id: 6n, receiptNo: 'RK-TEST', status: 'COMPLETED', createdAt: new Date('2026-09-22T01:00:00.000Z'),
        completedAt: new Date('2026-09-22T04:00:00.000Z'), openedBy: { displayName: '员工1' }, items,
      }] as never) },
    };
    const permissions = { warehousePermission: jest.fn().mockResolvedValue({ warehouseId: 1n, warehouse: { name: '主仓库' } } as never) };
    const service = new ReceivingService({ client } as never, permissions as never);

    const result = await service.listReceipts(1n, 9n, '2026-09-22');

    expect(result.summary.totalQuantity).toBe(12);
    expect(result.receipts[0]).toMatchObject({ totalQuantity: 12, productCount: 1 });
    expect(result.receipts[0]?.items).toEqual([
      expect.objectContaining({ quantity: 12, entryCount: 2, reversed: false }),
      expect.objectContaining({ quantity: 4, entryCount: 1, reversed: true }),
    ]);
  });
});

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

  it('allows an employee with receiving permission to increase an existing batch and records the operation', async () => {
    const transaction = {
      stockMovement: {
        findUnique: jest.fn().mockResolvedValue(null as never),
        create: jest.fn().mockResolvedValue({ id: 8n } as never),
      },
      product: { findFirst: jest.fn().mockResolvedValue({ id: 2n, name: '测试商品' } as never) },
      productBatch: { findFirst: jest.fn().mockResolvedValue({
        id: 3n, productId: 2n, expiryDate: new Date('2027-08-31T00:00:00.000Z'), expiryPrecision: 'MONTH',
      } as never) },
      inventoryBalance: {
        findUnique: jest.fn().mockResolvedValue({ quantity: 10 } as never),
        upsert: jest.fn().mockResolvedValue({ quantity: 15 } as never),
      },
      auditLog: { create: jest.fn().mockResolvedValue({ id: 9n } as never) },
    };
    const client = { $transaction: jest.fn(async (callback: (tx: typeof transaction) => unknown) => callback(transaction)) };
    const permissions = { warehousePermission: jest.fn().mockResolvedValue(permission as never) };
    const service = new StocktakeService({ client } as never, permissions as never);

    const result = await service.increaseStock(1n, 7n, {
      productId: '2', batchId: '3', quantity: 5, reason: '后续发现库存',
      idempotencyKey: '33333333-3333-4333-8333-333333333333',
    });

    expect(permissions.warehousePermission).toHaveBeenCalledWith(1n, 7n, 'canReceive', undefined);
    expect(result).toMatchObject({ productName: '测试商品', previousQuantity: 10, currentQuantity: 15, quantityAdded: 5 });
    expect(transaction.inventoryBalance.upsert).toHaveBeenCalledWith(expect.objectContaining({
      update: { quantity: { increment: 5 }, version: { increment: 1 } },
    }));
    expect(transaction.stockMovement.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        movementType: 'STOCKTAKE_GAIN', referenceType: 'MANUAL_INCREASE', quantityDelta: 5,
        reason: '后续发现库存', performedById: 7n,
      }),
    }));
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
