// Aligns a product's batches with what was counted (REQ-012 R2): batches are matched by expiry date and
// precision; a counted expiry without a batch becomes a new batch, a batch that was not counted goes to 0.
export type ExpiryPrecision = 'DATE' | 'MONTH';

export type CurrentBatch = { batchId: bigint; expiryDate: Date; expiryPrecision: ExpiryPrecision; quantity: number };
export type CountedBatch = { expiryDate: Date; expiryPrecision: ExpiryPrecision; quantity: number };
export type CountAdjustment = {
  batchId: bigint | null;
  expiryDate: Date;
  expiryPrecision: ExpiryPrecision;
  before: number;
  after: number;
  delta: number;
};

const expiryKey = (batch: { expiryDate: Date; expiryPrecision: ExpiryPrecision }) =>
  `${batch.expiryDate.toISOString().slice(0, 10)}|${batch.expiryPrecision}`;

export function planStockCount(current: CurrentBatch[], counted: CountedBatch[]) {
  const countedByExpiry = new Map<string, CountedBatch>();
  for (const line of counted) {
    const key = expiryKey(line);
    const existing = countedByExpiry.get(key);
    countedByExpiry.set(key, existing ? { ...existing, quantity: existing.quantity + line.quantity } : { ...line });
  }

  const rows: CountAdjustment[] = [];
  for (const batch of current) {
    const key = expiryKey(batch);
    const after = countedByExpiry.get(key)?.quantity ?? 0;
    countedByExpiry.delete(key);
    rows.push({ batchId: batch.batchId, expiryDate: batch.expiryDate, expiryPrecision: batch.expiryPrecision, before: batch.quantity, after, delta: after - batch.quantity });
  }
  for (const line of countedByExpiry.values()) {
    rows.push({ batchId: null, expiryDate: line.expiryDate, expiryPrecision: line.expiryPrecision, before: 0, after: line.quantity, delta: line.quantity });
  }

  return {
    rows,
    adjustments: rows.filter((row) => row.delta !== 0),
    before: current.reduce((sum, batch) => sum + batch.quantity, 0),
    after: counted.reduce((sum, line) => sum + line.quantity, 0),
  };
}
