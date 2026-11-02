import { purchaseCoverage } from './purchase-coverage.js';

describe('purchaseCoverage', () => {
  it.each([
    [120, 0, { weeklyVelocity: 30, targetWeeks: 2, targetInventory: 60, gap: 60 }],
    [119, 50, { weeklyVelocity: 29.75, targetWeeks: 2, targetInventory: 60, gap: 10 }],
    [40, 10, { weeklyVelocity: 10, targetWeeks: 2, targetInventory: 20, gap: 10 }],
    [4, 0, { weeklyVelocity: 1, targetWeeks: 2, targetInventory: 2, gap: 2 }],
    [3, 0, { weeklyVelocity: 0.75, targetWeeks: null, targetInventory: 0, gap: 0 }],
    [41, 52, { weeklyVelocity: 10.25, targetWeeks: 2, targetInventory: 21, gap: 0 }],
  ])('28-day sales %i with stock %i covers the default two weeks', (sold, stock, expected) => {
    expect(purchaseCoverage(sold, stock)).toEqual(expected);
  });

  it('covers the weeks chosen on a purchase order line', () => {
    expect(purchaseCoverage(40, 10, 4)).toEqual({ weeklyVelocity: 10, targetWeeks: 4, targetInventory: 40, gap: 30 });
    expect(purchaseCoverage(3, 0, 4)).toEqual({ weeklyVelocity: 0.75, targetWeeks: null, targetInventory: 0, gap: 0 });
  });
});
