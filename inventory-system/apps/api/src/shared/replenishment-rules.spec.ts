import { jest } from '@jest/globals';
import { DISCONTINUED_IGNORE_REASON, ignoreIsActive, isDirectShip, setDirectShip } from './replenishment-rules.js';

const now = new Date('2026-10-25T00:00:00.000Z');
const daysAgo = (days: number) => new Date(now.getTime() - days * 86_400_000);

describe('replenishment rules (CR-005)', () => {
  it('treats flagged products and stage-named formula as direct-ship', () => {
    expect(isDirectShip(true, 'Anchor Blue Milk Powder 1kg')).toBe(true);
    expect(isDirectShip(false, 'a2 Platinum Stage 3 900g')).toBe(true);
    expect(isDirectShip(false, 'Karicare 6 tins')).toBe(true);
    expect(isDirectShip(false, 'GoodHealth 液体钙')).toBe(false);
    expect(isDirectShip(false, 'Anchor Full cream 1kg SF *6')).toBe(true);
    expect(isDirectShip(false, 'taupo pure 1kg*6s full')).toBe(true);
    expect(isDirectShip(false, 'A2 Milk Powder Adult 6bags')).toBe(true);
    // Pack markers on anything other than milk powder are ordinary store stock.
    expect(isDirectShip(false, 'Bionique 麦卢卡蜂蜜喉糖 *35')).toBe(false);
    expect(isDirectShip(false, 'LACUES 亮白紧致面膜*5')).toBe(false);
    expect(isDirectShip(false, 'Anchor Blue Milk Powder 1kg')).toBe(false);
  });

  it('keeps manual ignores for 30 days even when out of stock, snoozes until their date and discontinued marks for good', () => {
    expect(ignoreIsActive({ reason: '当前库存足够', ignoredAt: daysAgo(10), restoredAt: null }, now)).toBe(true);
    expect(ignoreIsActive({ reason: '当前库存足够', ignoredAt: daysAgo(31), restoredAt: null }, now)).toBe(false);
    expect(ignoreIsActive({ reason: '当前库存足够', ignoredAt: daysAgo(2), restoredAt: null }, now)).toBe(true);
    expect(ignoreIsActive({ reason: '下周继续显示', ignoredAt: daysAgo(2), restoredAt: new Date(now.getTime() + 86_400_000) }, now)).toBe(true);
    expect(ignoreIsActive({ reason: '下周继续显示', ignoredAt: daysAgo(9), restoredAt: daysAgo(2) }, now)).toBe(false);
    expect(ignoreIsActive({ reason: DISCONTINUED_IGNORE_REASON, ignoredAt: daysAgo(90), restoredAt: null }, now)).toBe(true);
  });

  it('records the direct-ship flag with an audit row', async () => {
    const tx = {
      storeProduct: { upsert: jest.fn().mockResolvedValue({ productId: 2008n, directShip: true } as never) },
      auditLog: { create: jest.fn().mockResolvedValue({} as never) },
    };

    const result = await setDirectShip(tx as never, { organizationId: 1n, userId: 2n, storeId: 1n, productId: 2008n, directShip: true, source: 'management' });

    expect(result).toEqual({ productId: '2008', directShip: true });
    expect(tx.storeProduct.upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { storeId_productId: { storeId: 1n, productId: 2008n } }, update: { directShip: true } }));
    expect(tx.auditLog.create).toHaveBeenCalledWith({ data: expect.objectContaining({ action: 'store_product.direct_ship', afterSummary: { directShip: true, source: 'management' } }) });
  });
});
