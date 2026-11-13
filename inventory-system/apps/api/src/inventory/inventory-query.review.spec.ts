import { jest } from '@jest/globals';
import { InventoryQueryService } from './inventory-query.service.js';

describe('InventoryQueryService.reviewItems', () => {
  it('returns negative and expired batches and stocked products without a POS mapping', async () => {
    const batch = (expiry: string) => ({ expiryDate: new Date(`${expiry}T00:00:00.000Z`), expiryPrecision: 'MONTH' });
    const product = (name: string) => ({ name, barcodes: [{ barcode: '9400000000001' }] });
    const findMany = jest.fn()
      .mockResolvedValueOnce([{ productId: 270n, batchId: 33n, quantity: -5, product: product('BePure'), batch: batch('2027-01-31') }] as never)
      .mockResolvedValueOnce([{ productId: 7n, batchId: 2148n, quantity: 28, product: product('NutraLife'), batch: batch('2026-01-31') }] as never);
    const groupBy = jest.fn().mockResolvedValue([
      { productId: 3734n, _sum: { quantity: 240 } },
      { productId: 3735n, _sum: { quantity: 0 } },
    ] as never);
    const client = {
      organization: { findUniqueOrThrow: jest.fn().mockResolvedValue({ timezone: 'Pacific/Auckland' } as never) },
      inventoryBalance: { findMany, groupBy },
      product: { findMany: jest.fn().mockResolvedValue([{ id: 3734n, ...product('8分钟Pro 精华液') }] as never) },
    };
    const permissions = { warehousePermission: jest.fn().mockResolvedValue({ warehouseId: 1n, warehouse: { storeId: 1n } } as never) };
    const service = new InventoryQueryService({ client } as never, permissions as never);

    const result = await service.reviewItems(1n, 2n);

    expect(result.negative).toEqual([expect.objectContaining({ batchId: '33', expiryDate: '2027-01', quantity: -5 })]);
    expect(result.expired).toEqual([expect.objectContaining({ batchId: '2148', quantity: 28 })]);
    expect(result.posUnmapped).toEqual([{ productId: '3734', productName: '8分钟Pro 精华液', barcode: '9400000000001', quantity: 240 }]);
    expect(groupBy).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ product: { status: 'ACTIVE', posProductMappings: { none: { storeId: 1n, status: 'ACTIVE' } } } }),
    }));
  });
});
