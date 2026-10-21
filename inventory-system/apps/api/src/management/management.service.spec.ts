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
    expect(rows.get('2')).toMatchObject({ stockStatus: 'OUT_OF_STOCK', shortageVisible: false });
    expect(rows.get('3')).toMatchObject({ shortageVisible: false });
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
