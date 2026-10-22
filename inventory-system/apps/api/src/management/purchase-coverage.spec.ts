import { purchaseCoverage } from './purchase-coverage.js';

describe('purchaseCoverage', () => {
  it.each([
    [120, 0, { weeklyVelocity: 30, targetWeeks: 4, targetInventory: 120, gap: 120 }],
    [119, 50, { weeklyVelocity: 29.75, targetWeeks: 5, targetInventory: 149, gap: 99 }],
    [40, 10, { weeklyVelocity: 10, targetWeeks: 5, targetInventory: 50, gap: 40 }],
    [39, 37, { weeklyVelocity: 9.75, targetWeeks: 6, targetInventory: 59, gap: 22 }],
    [4, 0, { weeklyVelocity: 1, targetWeeks: 6, targetInventory: 6, gap: 6 }],
    [3, 0, { weeklyVelocity: 0.75, targetWeeks: null, targetInventory: 0, gap: 0 }],
    [41, 52, { weeklyVelocity: 10.25, targetWeeks: 5, targetInventory: 52, gap: 0 }],
  ])('28-day sales %i with stock %i', (sold, stock, expected) => {
    expect(purchaseCoverage(sold, stock)).toEqual(expected);
  });
});
