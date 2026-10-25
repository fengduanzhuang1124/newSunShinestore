import { jest } from '@jest/globals';
import { ManagementService } from './management.service.js';

const DAY = 86_400_000;

function product(id: bigint, name: string, options: { minimumStock?: number | null; mapped?: boolean } = {}) {
  return {
    id, sku: `SKU-${id}`, name, chineseName: null, englishName: null, brandName: null, categoryName: null,
    storeProducts: [{ minimumStock: options.minimumStock ?? null }],
    posProductMappings: options.mapped === false ? [] : [{ id: 1n }],
  };
}

function sale(productId: bigint, daysAgo: number, quantity = 1) {
  return { productId, quantity: String(quantity), isMinus: false, order: { orderedAt: new Date(Date.now() - daysAgo * DAY) } };
}

async function inventoryOperations(products: ReturnType<typeof product>[], balances: { productId: bigint; quantity: number }[], salesItems: ReturnType<typeof sale>[]) {
  const posOrderItem = { findMany: jest.fn().mockResolvedValue(salesItems as never) };
  const client = {
    userStoreRole: {
      findMany: jest.fn().mockResolvedValue([{ store: { id: 1n, name: 'City' }, role: { code: 'ADMIN', permissions: [] } }] as never),
    },
    organization: { findUniqueOrThrow: jest.fn().mockResolvedValue({ timezone: 'Pacific/Auckland' } as never) },
    product: { findMany: jest.fn().mockResolvedValue(products as never) },
    inventoryBalance: {
      findMany: jest.fn().mockResolvedValue(balances.map((row) => ({ ...row, updatedAt: new Date() })) as never),
      aggregate: jest.fn().mockResolvedValue({ _count: { _all: 2 }, _sum: { quantity: 14 } } as never),
    },
    posOrderItem,
    stockMovement: { findMany: jest.fn().mockResolvedValue([] as never) },
    posOrder: { aggregate: jest.fn().mockResolvedValue({ _min: { orderedAt: new Date(Date.now() - 200 * DAY) }, _max: { orderedAt: new Date() } } as never) },
    purchaseSuggestionIgnore: { findMany: jest.fn().mockResolvedValue([] as never) },
  };
  const service = new ManagementService({ client } as never, {} as never, {} as never, {} as never);
  const result = await service.inventoryOperations(1n, 2n, 1n, 90);
  return { result, posOrderItem, rows: new Map(result.products.map((row) => [row.productId, row])) };
}

describe('ManagementService.inventoryOperations', () => {
  it('reports zero stock as out of stock only when the product sold within 180 days', async () => {
    const { rows, result } = await inventoryOperations(
      [product(1n, 'Comvita 喉糖'), product(2n, 'Kerastase 洗发水'), product(3n, 'Trilogy 玫瑰果油')],
      [],
      [sale(1n, 150), sale(2n, 200)],
    );

    expect(rows.get('1')).toMatchObject({ stockStatus: 'OUT_OF_STOCK', shortageVisible: true });
    // Zero stock with no sale in 180 days is catalogue-only: counted nowhere and left out of the list.
    expect(rows.has('2')).toBe(false);
    expect(rows.has('3')).toBe(false);
    expect(result.summary.outOfStockProducts).toBe(1);
  });

  it('alerts low stock only for core brands, lanolin and products with a hand-set minimum', async () => {
    const { rows, result } = await inventoryOperations(
      [
        product(1n, 'GoodHealth 液体钙'),
        product(2n, 'HAAB 绵羊油 霜 150g'),
        product(3n, 'Kerastase 洗发水'),
        product(4n, 'Comvita 喉糖', { minimumStock: 30 }),
      ],
      [1n, 2n, 3n, 4n].map((productId) => ({ productId, quantity: 5 })),
      [],
    );

    expect(rows.get('1')).toMatchObject({ stockStatus: 'LOW', minimumStock: 20, minimumStockSource: 'DEFAULT', coreProduct: true });
    expect(rows.get('2')).toMatchObject({ stockStatus: 'LOW', minimumStockSource: 'DEFAULT' });
    expect(rows.get('3')).toMatchObject({ stockStatus: 'IN_STOCK', minimumStock: null, minimumStockSource: 'NONE' });
    expect(rows.get('4')).toMatchObject({ stockStatus: 'LOW', minimumStock: 30, minimumStockSource: 'MANUAL' });
    expect(result.summary.lowStockProducts).toBe(3);
  });

  it('does not call an unmapped product slow-moving and counts only paid, unrefunded inventory sales', async () => {
    const { rows, posOrderItem, result } = await inventoryOperations(
      [product(1n, 'sanderson 鱼油', { mapped: false }), product(2n, 'Kerastase 洗发水')],
      [{ productId: 1n, quantity: 500 }, { productId: 2n, quantity: 50 }],
      [],
    );

    expect(rows.get('1')).toMatchObject({ posMapped: false, slowMoving: false });
    expect(rows.get('2')).toMatchObject({ posMapped: true, slowMoving: true });
    expect(posOrderItem.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        disposition: 'INVENTORY',
        order: expect.objectContaining({ sourceStatus: 'Paid', refundAmount: 0 }),
      }),
    }));
    expect(result.summary).toMatchObject({ expiredBatches: 2, expiredUnits: 14 });
  });
});

describe('ManagementService.purchaseSuggestions', () => {
  it('applies the CR-005 purchase rules: arrivals still short, out-of-stock history, ignore expiry and direct-ship', async () => {
    const stockMovement = {
      groupBy: jest.fn().mockResolvedValue([
        { productId: 1n, _sum: { quantityDelta: 40 }, _max: { createdAt: new Date('2026-10-20T03:00:00.000Z') } },
      ] as never),
    };
    const fortyDaysAgo = new Date(Date.now() - 40 * 86_400_000);
    const client = {
      userStoreRole: {
        findMany: jest.fn().mockResolvedValue([{ store: { id: 1n, name: 'City' }, role: { code: 'ADMIN', permissions: [] } }] as never),
      },
      organization: { findUniqueOrThrow: jest.fn().mockResolvedValue({ timezone: 'Pacific/Auckland' } as never) },
      product: {
        findMany: jest.fn().mockResolvedValue([
          { ...product(1n, 'lifespace 60+益生菌'), barcodes: [] },
          { ...product(2n, 'GoodHealth 液体钙'), barcodes: [] },
          { ...product(3n, '高之源白瓶'), barcodes: [] },
          { ...product(4n, '爱乐维女性'), barcodes: [] },
          { ...product(5n, '停售奶粉'), barcodes: [] },
          { ...product(6n, 'Anchor Blue Milk Powder 1kg'), storeProducts: [{ minimumStock: null, directShip: true }], barcodes: [] },
        ] as never),
      },
      inventoryBalance: {
        findMany: jest.fn().mockResolvedValue([
          { productId: 1n, quantity: 37, updatedAt: new Date() },
          { productId: 2n, quantity: 3, updatedAt: new Date() },
        ] as never),
      },
      posOrderItem: {
        findMany: jest.fn().mockResolvedValue([
          { productId: 1n, quantity: '41', isMinus: false },
          { productId: 2n, quantity: '40', isMinus: false },
          { productId: 4n, quantity: '8', isMinus: false },
          { productId: 5n, quantity: '20', isMinus: false },
          { productId: 6n, quantity: '30', isMinus: false },
        ] as never),
        // 90-day sales: product 3 sold 45 before it ran out.
        groupBy: jest.fn().mockResolvedValue([{ productId: 3n, _sum: { quantity: '45' } }] as never),
      },
      purchaseOrder: { findUnique: jest.fn().mockResolvedValue(null as never) },
      purchaseSuggestionIgnore: {
        findMany: jest.fn().mockResolvedValue([
          { productId: 4n, reason: '当前库存足够', ignoredAt: fortyDaysAgo, restoredAt: null },
          { productId: 5n, reason: '盘点时标记不再销售', ignoredAt: fortyDaysAgo, restoredAt: null },
        ] as never),
      },
      stockMovement,
    };
    const service = new ManagementService({ client } as never, {} as never, {} as never, {} as never);

    const result = await service.purchaseSuggestions(1n, 2n, 1n);
    const byId = new Map(result.suggestions.map((row) => [row.productId, row]));

    expect([...byId.keys()].sort()).toEqual(['1', '2', '3', '4']);
    expect(byId.get('1')).toMatchObject({ suggestedQuantity: 15, recentReceivedQty: 40, lastReceivedAt: '2026-10-20T03:00:00.000Z' });
    expect(byId.get('3')).toMatchObject({ recent28DayQty: 14, salesBasis: '90_DAYS', suggestedQuantity: 21 });
    expect(byId.get('4')).toMatchObject({ ignored: false, suggestedQuantity: 12 });
    expect(result.ignoredSuggestions.map((row) => row.productId)).toEqual(['5']);
    expect(result.arrivedSuggestions).toEqual([]);
    expect(stockMovement.groupBy).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ movementType: 'RECEIPT', reversedBy: { is: null } }),
    }));
  });
});

describe('ManagementService.purchaseSuggestions same-name records', () => {
  it('sums stock and sales of records with the same name and suggests once', async () => {
    const client = {
      userStoreRole: { findMany: jest.fn().mockResolvedValue([{ store: { id: 1n, name: 'City' }, role: { code: 'ADMIN', permissions: [] } }] as never) },
      organization: { findUniqueOrThrow: jest.fn().mockResolvedValue({ timezone: 'Pacific/Auckland' } as never) },
      product: {
        findMany: jest.fn().mockResolvedValue([
          { ...product(10n, 'swiss120粒护肝'), barcodes: [{ barcode: '9311770609432' }] },
          { ...product(11n, 'swisse 120粒护肝'), barcodes: [{ barcode: '9311770593380' }] },
          { ...product(20n, 'Good Health 好健康 更年期平衡片60 片'), barcodes: [] },
          { ...product(21n, 'Good Health 好健康更年期平衡片 60 片'), barcodes: [] },
        ] as never),
      },
      inventoryBalance: {
        findMany: jest.fn().mockResolvedValue([
          { productId: 10n, quantity: 63, updatedAt: new Date() },
          { productId: 20n, quantity: 9, updatedAt: new Date() },
          { productId: 21n, quantity: 15, updatedAt: new Date() },
        ] as never),
      },
      posOrderItem: {
        findMany: jest.fn().mockResolvedValue([
          { productId: 11n, quantity: '20', isMinus: false },
          { productId: 20n, quantity: '20', isMinus: false },
          { productId: 21n, quantity: '40', isMinus: false },
        ] as never),
        groupBy: jest.fn().mockResolvedValue([] as never),
      },
      purchaseOrder: { findUnique: jest.fn().mockResolvedValue(null as never) },
      purchaseSuggestionIgnore: { findMany: jest.fn().mockResolvedValue([] as never) },
      stockMovement: { groupBy: jest.fn().mockResolvedValue([] as never) },
    };
    const service = new ManagementService({ client } as never, {} as never, {} as never, {} as never);

    const result = await service.purchaseSuggestions(1n, 2n, 1n);

    // 63 in stock across both liver records covers 20 sales a month, so nothing to buy.
    expect(result.suggestions.map((row) => row.productId)).toEqual(['21']);
    expect(result.suggestions[0]).toMatchObject({ currentInventory: 24, recent28DayQty: 60, weeklyVelocity: 15, suggestedQuantity: 51 });
    expect(result.suggestions[0].mergedProducts.map((member) => [member.productId, member.currentInventory, member.recent28DayQty])).toEqual([['21', 15, 40], ['20', 9, 20]]);
  });
});

describe('ManagementService.posDataCheck', () => {
  it('flags recent MISC sales because they cannot be deducted from a product', async () => {
    const aggregate = jest.fn()
      .mockResolvedValueOnce({ _min: { orderedAt: new Date() }, _max: { orderedAt: new Date() } } as never)
      .mockResolvedValueOnce({ _count: { _all: 3 }, _sum: { quantity: '5' } } as never);
    const client = {
      userStoreRole: {
        findMany: jest.fn().mockResolvedValue([{ store: { id: 1n, name: 'City' }, role: { code: 'ADMIN', permissions: [] } }] as never),
      },
      posOrder: { count: jest.fn().mockResolvedValue(10 as never), aggregate },
      posOrderItem: { count: jest.fn().mockResolvedValue(0 as never), aggregate },
      posRefundReview: { count: jest.fn().mockResolvedValue(0 as never) },
      posSyncRun: { count: jest.fn().mockResolvedValue(0 as never) },
    };
    const service = new ManagementService({ client } as never, {} as never, {} as never, {} as never);

    const result = await service.posDataCheck(1n, 2n, 1n);

    expect(result.miscSales).toMatchObject({ lines: 3, units: 5 });
    expect(result.checks[0]).toEqual(expect.objectContaining({ code: 'NO_MISC_SALES', passed: false }));
  });
});

describe('ManagementService.posUnlistedStock', () => {
  it('lists stocked products without a POS mapping and hides internal LOCAL barcodes', async () => {
    const product = { findMany: jest.fn().mockResolvedValue([
      { id: 1n, sku: 'LOCAL-A', name: '8分钟Pro 精华', englishName: null, createdAt: new Date('2026-10-20T00:00:00.000Z'), barcodes: [{ barcode: '9421907711157' }, { barcode: 'LOCAL-1' }] },
      { id: 2n, sku: 'B', name: '已售完商品', englishName: null, createdAt: new Date('2026-10-20T00:00:00.000Z'), barcodes: [] },
    ] as never) };
    const inventoryBalance = { groupBy: jest.fn().mockResolvedValue([{ productId: 1n, _sum: { quantity: 240 } }, { productId: 2n, _sum: { quantity: 0 } }] as never) };
    const client = {
      userStoreRole: {
        findMany: jest.fn().mockResolvedValue([{ store: { id: 1n, name: 'City' }, role: { code: 'ADMIN', permissions: [] } }] as never),
      },
      product, inventoryBalance,
    };
    const service = new ManagementService({ client } as never, {} as never, {} as never, {} as never);

    const result = await service.posUnlistedStock(1n, 2n, 1n);

    expect(result).toEqual({ totalUnits: 240, products: [expect.objectContaining({ productId: '1', barcodes: ['9421907711157'], stock: 240 })] });
    expect(product.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ posProductMappings: { none: { storeId: 1n, status: 'ACTIVE' } } }),
    }));
  });
});
