import { jest } from '@jest/globals';
import { ManagementService } from './management.service.js';

// CR-010: categories recognised from names, typed-in categories first, and the admin-only assignment.
const role = (code: string, permissions: string[] = []) => [{ store: { id: 1n, name: 'City' }, role: { code, permissions: permissions.map((permission) => ({ permission: { code: permission } })) } }];
const product = (id: bigint, name: string, categoryName: string | null = null) => ({
  id, sku: `S${id}`, name, chineseName: null, englishName: null, brandName: null, categoryName, barcodes: [],
  storeProducts: [{ sellingPriceCents: null, level4PriceCents: null, minimumStock: null }],
});

function service(client: Record<string, unknown>) {
  return new ManagementService({ client } as never, {} as never, {} as never, {} as never);
}

describe('product categories (CR-010)', () => {
  it('filters product analysis by the recognised category, function and audience', async () => {
    const products = [
      product(1n, 'Gohealthy 鱼油 2000mg 230粒'),
      product(2n, 'Goodhealth 儿童叶黄素dha护眼咀嚼片'),
      product(3n, 'HAAB 绵羊油 霜 150g'),
      product(4n, 'careline', '绵羊油系列'),
    ];
    const findMany = jest.fn().mockResolvedValue(products as never);
    const client = {
      userStoreRole: { findMany: jest.fn().mockResolvedValue(role('ADMIN') as never) },
      organization: { findUniqueOrThrow: jest.fn().mockResolvedValue({ timezone: 'Pacific/Auckland', currency: 'NZD' } as never) },
      product: { findMany },
      inventoryBalance: { findMany: jest.fn().mockResolvedValue([] as never) },
      posOrderItem: { findMany: jest.fn().mockResolvedValue([] as never), count: jest.fn().mockResolvedValue(0 as never), groupBy: jest.fn().mockResolvedValue([] as never) },
    };
    const run = (filters: Record<string, string>) => service(client).productsBrandsAnalysis(1n, 2n, 1n, { from: '2026-10-01', to: '2026-10-31', ...filters });

    const lanolin = await run({ category: '绵羊油系列' });
    expect(lanolin.products.map((row) => row.productId).sort()).toEqual(['3', '4']);
    // A whole first-level group also works.
    expect((await run({ category: '保健品' })).products.map((row) => row.productId).sort()).toEqual(['1', '2']);
    expect((await run({ functionTag: '护眼' })).products.map((row) => row.productId)).toEqual(['2']);
    expect((await run({ audience: '儿童' })).products.map((row) => row.productId)).toEqual(['2']);

    const all = await run({});
    expect(all.products.find((row) => row.productId === '4')).toMatchObject({ categoryName: '绵羊油系列', categoryGroup: '护肤品', categoryManual: true });
    expect(all.products.find((row) => row.productId === '1')).toMatchObject({ categoryName: '鱼油与 Omega-3', categoryManual: false, functions: expect.arrayContaining(['鱼油与 Omega-3']) });
    expect(all.categories.map((row) => row.name).sort()).toEqual(['绵羊油系列', '辅酶与抗氧化营养素', '鱼油与 Omega-3'].sort());
    expect(all.catalogQuality).toMatchObject({ withCategory: 4, manualCategory: 1 });
    // The category filter is applied after recognition, not as a database condition.
    expect(JSON.stringify(findMany.mock.calls[0][0], (_, value) => (typeof value === 'bigint' ? value.toString() : value))).not.toContain('categoryName":{"contains');
  });

  it('lets only admins set or clear a category from the list, and audits it', async () => {
    const update = jest.fn(async ({ data }: { data: { categoryName: string | null } }) => ({ id: 9n, name: 'careline', chineseName: null, englishName: null, categoryName: data.categoryName }));
    const auditCreate = jest.fn().mockResolvedValue({} as never);
    const client = {
      userStoreRole: { findMany: jest.fn().mockResolvedValue(role('ADMIN') as never) },
      product: { findFirst: jest.fn().mockResolvedValue({ id: 9n, name: 'careline', chineseName: null, englishName: null, categoryName: null } as never), update },
      auditLog: { create: auditCreate },
      $transaction: jest.fn(async (callback: (tx: unknown) => unknown) => callback(client)),
    };

    await expect(service(client).assignProductCategory(1n, 2n, 1n, 9n, '绵羊油系列')).resolves.toMatchObject({ level1: '护肤品', level2: '绵羊油系列', manualCategory: '绵羊油系列' });
    expect(auditCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: 'catalog.product_category.assign', beforeSummary: { categoryName: null }, afterSummary: { categoryName: '绵羊油系列' } }) }));
    await expect(service(client).assignProductCategory(1n, 2n, 1n, 9n, null)).resolves.toMatchObject({ level2: '未识别', manualCategory: null });
    await expect(service(client).assignProductCategory(1n, 2n, 1n, 9n, '随便写')).rejects.toThrow('品类不在分类表中');

    const staff = { ...client, userStoreRole: { findMany: jest.fn().mockResolvedValue(role('STAFF', ['management.sales.view']) as never) } };
    await expect(service(staff).assignProductCategory(1n, 2n, 1n, 9n, '绵羊油系列')).rejects.toThrow('只有管理员可以修改商品品类');
  });

  it('lists unclassified products by recent sales and searches any product', async () => {
    const products = [product(1n, 'careline'), product(2n, 'vocal'), product(3n, 'HAAB 绵羊油 霜 150g'), product(4n, 'Bio-E thing', '面部护理')];
    const client = {
      userStoreRole: { findMany: jest.fn().mockResolvedValue(role('ADMIN') as never) },
      product: { findMany: jest.fn().mockResolvedValue(products as never) },
      posOrderItem: { groupBy: jest.fn().mockResolvedValue([{ productId: 2n, _sum: { quantity: '9' } }, { productId: 1n, _sum: { quantity: '17' } }] as never) },
      inventoryBalance: { groupBy: jest.fn().mockResolvedValue([{ productId: 1n, _sum: { quantity: 5 } }] as never) },
    };
    const result = await service(client).productCategories(1n, 2n, 1n, { view: 'UNCLASSIFIED' });
    expect(result.summary).toEqual({ products: 4, unclassified: 2, manual: 1, unclassifiedSelling: 2 });
    expect(result.products.map((row) => [row.productId, row.unitsLast90Days, row.currentInventory])).toEqual([['1', 17, 5], ['2', 9, 0]]);
    const manual = await service(client).productCategories(1n, 2n, 1n, { view: 'MANUAL' });
    expect(manual.products).toEqual([expect.objectContaining({ productId: '4', manualCategory: '面部护理', automaticCategory: null, level2: '面部护理' })]);
    // A search shows every match, whatever its state.
    expect((await service(client).productCategories(1n, 2n, 1n, { view: 'UNCLASSIFIED', query: 'a' })).products).toHaveLength(4);
  });
});
