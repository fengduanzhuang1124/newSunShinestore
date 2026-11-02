import { BadRequestException, NotFoundException } from '@nestjs/common';
import { jest } from '@jest/globals';
import { WarehouseLocationService } from './warehouse-location.service.js';

const permission = { warehouseId: 2n, warehouse: { storeId: 3n, name: '主仓库' } };
const product = (id: bigint, name: string, stock: number, home: { id: bigint; code: string; name: string } | null = null) => ({
  id, name, englishName: null, chineseName: null, brandName: null,
  barcodes: [{ barcode: `94${id}` }], inventoryBalances: [{ quantity: stock }], productLocations: home ? [{ location: home }] : [],
});

function setup() {
  const shelf = { id: 5n, code: 'A-01', name: '保健品 A 架', warehouseId: 2n, status: 'ACTIVE' };
  const tx = {
    warehouseLocation: { findFirst: jest.fn().mockResolvedValue(shelf as never) },
    product: { findMany: jest.fn().mockImplementation((async (args: { where: { id: { in: bigint[] } } }) => args.where.id.in.map((id) => ({ id }))) as never) },
    productLocation: {
      findMany: jest.fn().mockResolvedValue([{ productId: 11n, locationId: 9n }] as never),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 } as never),
      createMany: jest.fn().mockResolvedValue({ count: 2 } as never),
    },
    auditLog: { create: jest.fn().mockResolvedValue({} as never) },
  };
  const client = {
    product: {
      findMany: jest.fn().mockResolvedValue([
        product(10n, 'Parrs 蜂毒眼霜 30ml', 4),
        product(11n, 'parrs 精华', 2, { id: 9n, code: 'B-02', name: '护肤 B 架' }),
        product(12n, 'Parrs 香薰 120ml', 0),
        product(13n, 'swiss 护肝 120粒', 8),
      ] as never),
    },
    $transaction: jest.fn().mockImplementation(((callback: (client: typeof tx) => unknown) => callback(tx)) as never),
  };
  const service = new WarehouseLocationService({ client } as never, { warehousePermission: jest.fn().mockResolvedValue(permission as never) } as never);
  return { service, tx };
}

describe('WarehouseLocationService product locations (CR-008)', () => {
  it('groups stocked products by recognised brand with how many are placed', async () => {
    const { service } = setup();

    const brands = await service.productBrands(1n, 7n);

    expect(brands).toEqual([
      { brand: '帕氏', productCount: 2, placedCount: 1, stock: 6 },
      { brand: 'Swisse', productCount: 1, placedCount: 0, stock: 8 },
    ]);
  });

  it('lists a brand, a keyword or the unplaced products, including out-of-stock ones when asked', async () => {
    const { service } = setup();

    const byBrand = await service.productsForPlacement(1n, 7n, { brand: '帕氏', inStock: 'false' });
    expect(byBrand.products.map((row) => row.productId).sort()).toEqual(['10', '11', '12']);
    expect(byBrand.total).toBe(3);

    const unplaced = await service.productsForPlacement(1n, 7n, { brand: '帕氏', locationId: 'NONE' });
    expect(unplaced.products.map((row) => row.productId)).toEqual(['10']);

    const keyword = await service.productsForPlacement(1n, 7n, { q: 'swisse 护肝' });
    expect(keyword.products.map((row) => row.name)).toEqual(['swiss 护肝 120粒']);

    await expect(service.productsForPlacement(1n, 7n, {})).rejects.toBeInstanceOf(BadRequestException);
  });

  it('places many products at once and audits where each one was before', async () => {
    const { service, tx } = setup();

    const result = await service.setProductLocations(1n, 7n, { productIds: ['10', '11', '10'], locationId: '5' });

    expect(result).toEqual({ updated: 2, location: { locationId: '5', code: 'A-01', name: '保健品 A 架' } });
    expect(tx.productLocation.deleteMany).toHaveBeenCalledWith({ where: { organizationId: 1n, warehouseId: 2n, productId: { in: [10n, 11n] } } });
    expect(tx.productLocation.createMany).toHaveBeenCalledWith({ data: [
      { organizationId: 1n, warehouseId: 2n, productId: 10n, locationId: 5n, updatedById: 7n },
      { organizationId: 1n, warehouseId: 2n, productId: 11n, locationId: 5n, updatedById: 7n },
    ] });
    expect(tx.auditLog.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      action: 'SET_PRODUCT_LOCATION', entityId: 'A-01', beforeSummary: { 10: null, 11: '9' },
    }) });
  });

  it('clears locations without creating new ones, and rejects a location of another warehouse', async () => {
    const { service, tx } = setup();

    await service.setProductLocations(1n, 7n, { productIds: ['11'], locationId: null });
    expect(tx.productLocation.deleteMany).toHaveBeenCalled();
    expect(tx.productLocation.createMany).not.toHaveBeenCalled();

    tx.warehouseLocation.findFirst.mockResolvedValueOnce(null as never);
    await expect(service.setProductLocations(1n, 7n, { productIds: ['11'], locationId: '99' })).rejects.toBeInstanceOf(NotFoundException);
  });
});
