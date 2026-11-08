import { jest } from '@jest/globals';
import { PosPriceLevelService } from './pos-price-level.service.js';

function setup(current: { productId: bigint; level4PriceCents: number | null }[]) {
  const update = jest.fn().mockResolvedValue({} as never);
  const client = {
    posProductMapping: {
      findMany: jest.fn().mockResolvedValue([
        { externalProductId: 'A', productId: 1n },
        { externalProductId: 'B', productId: 2n },
        { externalProductId: 'C', productId: 3n },
        { externalProductId: 'D1', productId: 4n },
        { externalProductId: 'D2', productId: 4n },
      ] as never),
    },
    storeProduct: { findMany: jest.fn().mockResolvedValue(current as never), update },
  };
  const gateway = {
    findActiveByName: jest.fn().mockResolvedValue({ priceId: '34', name: 'Level 4', status: 'Active' } as never),
    listAllAppliedItems: jest.fn().mockResolvedValue([
      { externalProductId: 'A', levelPriceCents: 2590 },
      { externalProductId: 'B', levelPriceCents: 1200 },
      { externalProductId: 'D1', levelPriceCents: 900 },
      { externalProductId: 'D2', levelPriceCents: 950 },
    ] as never),
  };
  return { service: new PosPriceLevelService({ client } as never, gateway as never), update, gateway };
}

describe('PosPriceLevelService (CR-014)', () => {
  it('writes changed Level 4 prices, clears products left out of the book and skips conflicting prices', async () => {
    const { service, update, gateway } = setup([
      { productId: 1n, level4PriceCents: null },
      { productId: 2n, level4PriceCents: 1200 },
      { productId: 3n, level4PriceCents: 500 },
      { productId: 4n, level4PriceCents: null },
      { productId: 5n, level4PriceCents: null },
    ]);

    await expect(service.importRetailPrices(7n)).resolves.toEqual({ priceId: '34', sourceItems: 4, updated: 1, cleared: 1, skippedConflicts: 1 });

    expect(gateway.findActiveByName).toHaveBeenCalledWith('Level 4');
    expect(update).toHaveBeenCalledTimes(2);
    expect(update).toHaveBeenCalledWith({
      where: { storeId_productId: { storeId: 7n, productId: 1n } },
      data: { level4PriceCents: 2590, level4PriceId: '34', level4PriceSyncedAt: expect.any(Date) },
    });
    expect(update).toHaveBeenCalledWith({
      where: { storeId_productId: { storeId: 7n, productId: 3n } },
      data: { level4PriceCents: null, level4PriceId: null, level4PriceSyncedAt: expect.any(Date) },
    });
  });
});
