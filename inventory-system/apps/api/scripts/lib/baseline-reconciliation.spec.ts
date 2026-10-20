import { describe, expect, it } from '@jest/globals';
import { allocateBatchTargets, planBaselineReconciliation, type PlanInput, type ProductState } from './baseline-reconciliation.js';

const product = (productId: string, currentQuantity: number, preservedDelta = 0): ProductState => ({
  productId,
  barcode: `bc-${productId}`,
  name: `product ${productId}`,
  currentQuantity,
  preservedDelta,
});

const sale = (productId: string, saleDate: string, quantity: number, orderedAt = `${saleDate}T01:00:00Z`) => ({
  productId,
  saleDate,
  orderedAt: new Date(orderedAt),
  quantity,
});

const base = (overrides: Partial<PlanInput>): PlanInput => ({
  entries: [],
  sales: [],
  products: [],
  unlistedPolicy: 'keep',
  unlistedSalesAfter: new Date('2026-10-16T04:17:29Z'),
  ...overrides,
});

describe('planBaselineReconciliation', () => {
  it('deducts only sales after the first entry date and sums repeated entries', () => {
    const plan = planBaselineReconciliation(base({
      entries: [
        { productId: '1', entryDate: '2026-10-10', quantity: 5, source: 'RK-B' },
        { productId: '1', entryDate: '2026-10-08', quantity: 10, source: 'RK-A' },
      ],
      sales: [sale('1', '2026-10-08', 3), sale('1', '2026-10-09', 2), sale('1', '2026-10-20', 1)],
      products: [product('1', 40)],
    }));
    expect(plan.rows[0]).toMatchObject({
      firstEntryDate: '2026-10-08', baselineQuantity: 15, salesDeducted: 3, targetQuantity: 12, delta: -28, sources: 'RK-A RK-B',
    });
  });

  it('keeps staff movements made after the last reconciliation on top of the target', () => {
    const plan = planBaselineReconciliation(base({
      entries: [{ productId: '1', entryDate: '2026-10-13', quantity: 30, source: 'RK-1013' }],
      sales: [sale('1', '2026-10-14', 4)],
      products: [product('1', 10, 12)],
    }));
    expect(plan.rows[0]).toMatchObject({ targetQuantity: 38, delta: 28 });
  });

  it('flags negative targets instead of clamping them to zero', () => {
    const plan = planBaselineReconciliation(base({
      entries: [{ productId: '1', entryDate: '2026-10-08', quantity: 2, source: 'RK-A' }],
      sales: [sale('1', '2026-10-09', 5)],
      products: [product('1', 0)],
    }));
    expect(plan.rows[0]).toMatchObject({ targetQuantity: -3, flags: ['NEGATIVE_REVIEW'] });
    expect(plan.totals).toMatchObject({ negativeProducts: 1, negativeQuantity: -3 });
  });

  it('keeps unlisted products and deducts only sales after the applied cut-off', () => {
    const plan = planBaselineReconciliation(base({
      sales: [sale('2', '2026-10-15', 4, '2026-10-15T01:00:00Z'), sale('2', '2026-10-18', 3, '2026-10-18T01:00:00Z')],
      products: [product('2', 20), product('3', 0)],
    }));
    expect(plan.rows).toHaveLength(1);
    expect(plan.rows[0]).toMatchObject({ listed: false, salesDeducted: 3, targetQuantity: 17, flags: ['UNLISTED_REVIEW'] });
  });

  it('reports sales for never-stocked products instead of deducting them', () => {
    const plan = planBaselineReconciliation(base({
      sales: [sale('4', '2026-10-18', 2, '2026-10-18T01:00:00Z')],
      products: [{ ...product('4', 0), hasBatch: false }],
    }));
    expect(plan.rows[0]).toMatchObject({ salesDeducted: 0, salesSkipped: 2, targetQuantity: 0, delta: 0, flags: ['NO_BATCH_SALES_SKIPPED'] });
    expect(plan.totals.salesSkipped).toBe(2);
  });

  it('zeroes unlisted products only when that policy is chosen', () => {
    const plan = planBaselineReconciliation(base({ unlistedPolicy: 'zero', products: [product('2', 20, 6)] }));
    expect(plan.rows[0]).toMatchObject({ targetQuantity: 6, delta: -14, flags: ['UNLISTED_ZEROED'] });
  });

  it('rejects fractional quantities and unknown baseline products', () => {
    expect(() => planBaselineReconciliation(base({
      entries: [{ productId: '1', entryDate: '2026-10-08', quantity: 1.5, source: 'RK-A' }],
      products: [product('1', 0)],
    }))).toThrow('whole number');
    expect(() => planBaselineReconciliation(base({
      entries: [{ productId: '9', entryDate: '2026-10-08', quantity: 1, source: 'RK-A' }],
      products: [product('1', 0)],
    }))).toThrow('does not exist');
  });
});

describe('allocateBatchTargets', () => {
  const lot = (batchId: string, expiryDate: string, quantity: number) => ({ batchId, expiryDate, quantity });

  it('deducts sales from the earliest expiry first and zeroes batches outside the baseline', () => {
    const targets = allocateBatchTargets({
      lots: [lot('2', '2028-06-30', 10), lot('1', '2027-01-31', 4)],
      salesDeducted: 6,
      preserved: [],
      current: [lot('1', '2027-01-31', 9), lot('3', '2026-12-31', 5)],
    });
    expect(targets).toEqual([
      { batchId: '3', expiryDate: '2026-12-31', currentQuantity: 5, targetQuantity: 0, delta: -5 },
      { batchId: '1', expiryDate: '2027-01-31', currentQuantity: 9, targetQuantity: 0, delta: -9 },
      { batchId: '2', expiryDate: '2028-06-30', currentQuantity: 0, targetQuantity: 8, delta: 8 },
    ]);
  });

  it('merges repeated lots and leaves the unmet sales as a negative on the latest batch', () => {
    const targets = allocateBatchTargets({
      lots: [lot('1', '2027-01-31', 2), lot('2', '2028-01-31', 1), lot('1', '2027-01-31', 1)],
      salesDeducted: 7,
      preserved: [],
      current: [],
    });
    expect(targets.map((target) => [target.batchId, target.targetQuantity])).toEqual([['1', 0], ['2', -3]]);
  });

  it('covers a batch shortfall from sibling batches and keeps only the product-level shortfall negative', () => {
    const covered = allocateBatchTargets({
      lots: [lot('1', '2027-01-31', 2)], salesDeducted: 5, preserved: [lot('2', '2028-01-31', 10)], current: [],
    });
    expect(covered.map((target) => [target.batchId, target.targetQuantity])).toEqual([['1', 0], ['2', 7]]);
    const short = allocateBatchTargets({
      lots: [lot('1', '2027-01-31', 2)], salesDeducted: 5, preserved: [lot('2', '2028-01-31', 2)], current: [],
    });
    expect(short.map((target) => [target.batchId, target.targetQuantity])).toEqual([['1', -1], ['2', 0]]);
  });

  it('adds staff movements back after FEFO and uses the fallback batch when there are no lots', () => {
    expect(allocateBatchTargets({
      lots: [lot('1', '2027-01-31', 5)],
      salesDeducted: 5,
      preserved: [lot('1', '2027-01-31', 12)],
      current: [lot('1', '2027-01-31', 12)],
    })).toEqual([{ batchId: '1', expiryDate: '2027-01-31', currentQuantity: 12, targetQuantity: 12, delta: 0 }]);
    expect(allocateBatchTargets({
      lots: [], salesDeducted: 2, preserved: [], current: [], fallback: { batchId: '9', expiryDate: '2029-01-31' },
    })).toEqual([{ batchId: '9', expiryDate: '2029-01-31', currentQuantity: 0, targetQuantity: -2, delta: -2 }]);
    expect(() => allocateBatchTargets({ lots: [], salesDeducted: 1, preserved: [], current: [] })).toThrow('No batch');
  });
});
