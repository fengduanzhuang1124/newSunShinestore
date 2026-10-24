import { planStockCount, type CurrentBatch } from './stock-count-plan.js';

const month = (value: string) => ({ expiryDate: new Date(`${value}T00:00:00.000Z`), expiryPrecision: 'MONTH' as const });
const day = (value: string) => ({ expiryDate: new Date(`${value}T00:00:00.000Z`), expiryPrecision: 'DATE' as const });
const batch = (batchId: bigint, expiry: ReturnType<typeof month> | ReturnType<typeof day>, quantity: number): CurrentBatch => ({ batchId, ...expiry, quantity });

describe('planStockCount', () => {
  it('makes no adjustment when the count matches the system', () => {
    const plan = planStockCount([batch(1n, day('2028-03-11'), 201), batch(2n, month('2028-03-31'), 21)], [{ ...day('2028-03-11'), quantity: 201 }, { ...month('2028-03-31'), quantity: 21 }]);
    expect(plan.adjustments).toEqual([]);
    expect([plan.before, plan.after]).toEqual([222, 222]);
  });

  it('adjusts a batch to the counted quantity', () => {
    const plan = planStockCount([batch(1n, day('2028-03-11'), 201)], [{ ...day('2028-03-11'), quantity: 195 }]);
    expect(plan.adjustments).toEqual([expect.objectContaining({ batchId: 1n, before: 201, after: 195, delta: -6 })]);
  });

  it('moves stock to a new batch when the expiry was wrong', () => {
    const plan = planStockCount([batch(2n, month('2028-03-31'), 21)], [{ ...month('2028-04-30'), quantity: 21 }]);
    expect(plan.adjustments).toEqual([
      expect.objectContaining({ batchId: 2n, before: 21, after: 0, delta: -21 }),
      expect.objectContaining({ batchId: null, expiryDate: new Date('2028-04-30T00:00:00.000Z'), expiryPrecision: 'MONTH', before: 0, after: 21, delta: 21 }),
    ]);
  });

  it('sets uncounted batches to zero and lifts negative batches to the count', () => {
    const plan = planStockCount([batch(1n, day('2029-05-19'), -57), batch(2n, day('2028-01-01'), 4)], [{ ...day('2029-05-19'), quantity: 12 }]);
    expect(plan.adjustments).toEqual([
      expect.objectContaining({ batchId: 1n, before: -57, after: 12, delta: 69 }),
      expect.objectContaining({ batchId: 2n, before: 4, after: 0, delta: -4 }),
    ]);
    expect([plan.before, plan.after]).toEqual([-53, 12]);
  });

  it('adds up counted lines with the same expiry and treats date and month precision as different batches', () => {
    const plan = planStockCount([batch(1n, day('2029-06-02'), 178)], [{ ...day('2029-06-02'), quantity: 48 }, { ...day('2029-06-02'), quantity: 96 }, { ...month('2029-06-02'), quantity: 1 }]);
    expect(plan.adjustments).toEqual([
      expect.objectContaining({ batchId: 1n, after: 144, delta: -34 }),
      expect.objectContaining({ batchId: null, expiryPrecision: 'MONTH', after: 1 }),
    ]);
  });
});
