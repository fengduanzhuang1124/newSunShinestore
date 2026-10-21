export type UnlistedPolicy = 'keep' | 'zero';

export interface BaselineEntry {
  productId: string;
  entryDate: string; // YYYY-MM-DD, store-local calendar date
  quantity: number;
  source: string;
}

export interface SaleLine {
  productId: string;
  saleDate: string; // YYYY-MM-DD, store-local calendar date
  orderedAt: Date;
  quantity: number;
}

export interface ProductState {
  productId: string;
  barcode: string;
  name: string;
  currentQuantity: number;
  // Net movements written by staff after the last system reconciliation (e.g. today's receipts); kept on top of the target.
  preservedDelta: number;
  // False when the product has never had a batch, so a shortfall has nowhere to be recorded.
  hasBatch?: boolean;
}

export interface ReconciliationRow {
  productId: string;
  barcode: string;
  name: string;
  listed: boolean;
  firstEntryDate: string;
  baselineQuantity: number;
  salesDeducted: number;
  salesSkipped: number;
  preservedDelta: number;
  targetQuantity: number;
  currentQuantity: number;
  delta: number;
  sources: string;
  flags: string[];
}

export interface ReconciliationPlan {
  rows: ReconciliationRow[];
  totals: {
    listedProducts: number;
    unlistedProducts: number;
    baselineQuantity: number;
    salesDeducted: number;
    salesSkipped: number;
    targetQuantity: number;
    currentQuantity: number;
    gain: number;
    loss: number;
    negativeProducts: number;
    negativeQuantity: number;
  };
}

export interface PlanInput {
  entries: BaselineEntry[];
  sales: SaleLine[];
  products: ProductState[];
  unlistedPolicy: UnlistedPolicy;
  // Unlisted products under 'keep' only deduct sales ordered after this instant (already-applied sales are in their balance).
  unlistedSalesAfter: Date;
}

export interface BatchLot {
  batchId: string;
  expiryDate: string; // YYYY-MM-DD
  quantity: number;
}

export interface BatchTarget {
  batchId: string;
  expiryDate: string;
  currentQuantity: number;
  targetQuantity: number;
  delta: number;
}

export interface BatchAllocationInput {
  // Quantities per batch before sales and before staff movements are layered back on.
  lots: BatchLot[];
  salesDeducted: number;
  // Staff movements after the last system reconciliation, per batch; added after FEFO deduction.
  preserved: BatchLot[];
  current: BatchLot[];
  // Batch that carries a shortfall when the product has no lots at all.
  fallback?: { batchId: string; expiryDate: string };
}

const byExpiry = (left: BatchLot, right: BatchLot) =>
  left.expiryDate.localeCompare(right.expiryDate) || Number(BigInt(left.batchId) - BigInt(right.batchId));

export function allocateBatchTargets(input: BatchAllocationInput): BatchTarget[] {
  const targets = new Map<string, BatchLot>();
  for (const lot of [...input.lots].sort(byExpiry)) {
    const existing = targets.get(lot.batchId);
    if (existing) existing.quantity += lot.quantity;
    else targets.set(lot.batchId, { ...lot });
  }

  // First-expiry-first-out; anything the lots cannot cover stays as a negative on the latest batch for review.
  let remaining = input.salesDeducted;
  const ordered = [...targets.values()];
  for (const lot of ordered) {
    if (remaining <= 0) break;
    const taken = Math.min(Math.max(lot.quantity, 0), remaining);
    lot.quantity -= taken;
    remaining -= taken;
  }
  if (remaining > 0) {
    const carrier = ordered.at(-1) ?? (input.fallback ? { ...input.fallback, quantity: 0 } : undefined);
    if (!carrier) throw new Error('No batch available to carry the unmet sales');
    if (!targets.has(carrier.batchId)) targets.set(carrier.batchId, carrier);
    targets.get(carrier.batchId)!.quantity -= remaining;
  }

  for (const lot of input.preserved) {
    const existing = targets.get(lot.batchId);
    if (existing) existing.quantity += lot.quantity;
    else targets.set(lot.batchId, { ...lot });
  }

  // A shortfall on one batch is covered by sibling batches first-expiry-first; only a product-level shortfall stays negative.
  const settled = [...targets.values()].sort(byExpiry);
  const negatives = settled.filter((lot) => lot.quantity < 0);
  let deficit = negatives.reduce((total, lot) => total - lot.quantity, 0);
  if (deficit > 0 && settled.some((lot) => lot.quantity > 0)) {
    const carrier = negatives.at(-1)!;
    for (const lot of negatives) lot.quantity = 0;
    for (const lot of settled) {
      if (deficit === 0) break;
      const taken = Math.min(Math.max(lot.quantity, 0), deficit);
      lot.quantity -= taken;
      deficit -= taken;
    }
    carrier.quantity -= deficit;
  }

  const currentByBatch = new Map(input.current.map((lot) => [lot.batchId, lot]));
  const batchIds = new Set([...targets.keys(), ...currentByBatch.keys()]);
  return [...batchIds]
    .map((batchId) => {
      const target = targets.get(batchId);
      const current = currentByBatch.get(batchId);
      const targetQuantity = target?.quantity ?? 0;
      const currentQuantity = current?.quantity ?? 0;
      return {
        batchId,
        expiryDate: (target ?? current)!.expiryDate,
        currentQuantity,
        targetQuantity,
        delta: targetQuantity - currentQuantity,
      };
    })
    .sort((left, right) => left.expiryDate.localeCompare(right.expiryDate) || left.batchId.localeCompare(right.batchId));
}

// A later day counting at least as many units of the same product and expiry is a recount of the same stock, not new stock;
// only the later count is kept. Smaller later counts are treated as additional stock and summed.
export function collapseRecounts<T extends BaselineEntry & { expiryDate: string }>(entries: T[]): { kept: T[]; superseded: T[] } {
  const dayTotals = new Map<string, Map<string, number>>();
  for (const entry of entries) {
    const key = `${entry.productId}:${entry.expiryDate}`;
    const days = dayTotals.get(key) ?? new Map<string, number>();
    days.set(entry.entryDate, (days.get(entry.entryDate) ?? 0) + entry.quantity);
    dayTotals.set(key, days);
  }
  const dropped = new Set<string>();
  for (const [key, days] of dayTotals) {
    const ordered = [...days.entries()].sort(([left], [right]) => left.localeCompare(right));
    ordered.forEach(([day, quantity], index) => {
      if (ordered.slice(index + 1).some(([, later]) => later >= quantity)) dropped.add(`${key}:${day}`);
    });
  }
  const isDropped = (entry: T) => dropped.has(`${entry.productId}:${entry.expiryDate}:${entry.entryDate}`);
  return { kept: entries.filter((entry) => !isDropped(entry)), superseded: entries.filter(isDropped) };
}

function assertWholeQuantity(value: number, label: string) {
  if (!Number.isInteger(value)) throw new Error(`${label} must be a whole number, got ${value}`);
}

export function planBaselineReconciliation(input: PlanInput): ReconciliationPlan {
  const listed = new Map<string, { firstEntryDate: string; quantity: number; sources: Set<string> }>();
  for (const entry of input.entries) {
    assertWholeQuantity(entry.quantity, `entry quantity for product ${entry.productId}`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.entryDate)) throw new Error(`Invalid entry date ${entry.entryDate}`);
    const current = listed.get(entry.productId);
    if (current) {
      current.quantity += entry.quantity;
      if (entry.entryDate < current.firstEntryDate) current.firstEntryDate = entry.entryDate;
      current.sources.add(entry.source);
    } else {
      listed.set(entry.productId, { firstEntryDate: entry.entryDate, quantity: entry.quantity, sources: new Set([entry.source]) });
    }
  }

  const salesByProduct = new Map<string, SaleLine[]>();
  for (const sale of input.sales) {
    assertWholeQuantity(sale.quantity, `sale quantity for product ${sale.productId}`);
    const list = salesByProduct.get(sale.productId) ?? [];
    list.push(sale);
    salesByProduct.set(sale.productId, list);
  }

  const states = new Map(input.products.map((product) => [product.productId, product]));
  for (const productId of listed.keys()) {
    if (!states.has(productId)) throw new Error(`Baseline product ${productId} does not exist`);
  }

  const rows: ReconciliationRow[] = [];
  for (const product of input.products) {
    const baseline = listed.get(product.productId);
    const sales = salesByProduct.get(product.productId) ?? [];
    const flags: string[] = [];
    let targetQuantity: number;
    let salesDeducted: number;
    let salesSkipped = 0;
    if (baseline) {
      // Sales on the entry day are already reflected in the counted quantity; only later days are deducted.
      salesDeducted = sales.filter((sale) => sale.saleDate > baseline.firstEntryDate).reduce((sum, sale) => sum + sale.quantity, 0);
      targetQuantity = baseline.quantity - salesDeducted + product.preservedDelta;
    } else if (input.unlistedPolicy === 'zero') {
      salesDeducted = 0;
      targetQuantity = product.preservedDelta;
      if (product.currentQuantity !== 0) flags.push('UNLISTED_ZEROED');
    } else {
      salesDeducted = sales.filter((sale) => sale.orderedAt > input.unlistedSalesAfter).reduce((sum, sale) => sum + sale.quantity, 0);
      if (product.hasBatch === false && salesDeducted > 0) {
        // Never stocked: there is no batch to hold a negative, so the sales are reported rather than deducted.
        salesSkipped = salesDeducted;
        salesDeducted = 0;
        flags.push('NO_BATCH_SALES_SKIPPED');
      }
      targetQuantity = product.currentQuantity - salesDeducted;
      if (product.currentQuantity !== 0 || salesDeducted !== 0) flags.push('UNLISTED_REVIEW');
    }
    if (targetQuantity < 0) flags.push('NEGATIVE_REVIEW');
    const delta = targetQuantity - product.currentQuantity;
    if (!baseline && delta === 0 && product.currentQuantity === 0 && salesSkipped === 0) continue;
    rows.push({
      productId: product.productId,
      barcode: product.barcode,
      name: product.name,
      listed: Boolean(baseline),
      firstEntryDate: baseline?.firstEntryDate ?? '',
      baselineQuantity: baseline?.quantity ?? 0,
      salesDeducted,
      salesSkipped,
      preservedDelta: product.preservedDelta,
      targetQuantity,
      currentQuantity: product.currentQuantity,
      delta,
      sources: baseline ? [...baseline.sources].sort().join(' ') : '',
      flags,
    });
  }

  const sum = (pick: (row: ReconciliationRow) => number) => rows.reduce((total, row) => total + pick(row), 0);
  const negatives = rows.filter((row) => row.targetQuantity < 0);
  return {
    rows,
    totals: {
      listedProducts: rows.filter((row) => row.listed).length,
      unlistedProducts: rows.filter((row) => !row.listed).length,
      baselineQuantity: sum((row) => row.baselineQuantity),
      salesDeducted: sum((row) => row.salesDeducted),
      salesSkipped: sum((row) => row.salesSkipped),
      targetQuantity: sum((row) => row.targetQuantity),
      currentQuantity: sum((row) => row.currentQuantity),
      gain: sum((row) => Math.max(row.delta, 0)),
      loss: sum((row) => Math.min(row.delta, 0)),
      negativeProducts: negatives.length,
      negativeQuantity: negatives.reduce((total, row) => total + row.targetQuantity, 0),
    },
  };
}
