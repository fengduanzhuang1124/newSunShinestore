import { readFileSync } from 'node:fs';
import type { PrismaService } from '../../src/database/prisma.service.js';
import {
  allocateBatchTargets,
  collapseRecounts,
  planBaselineReconciliation,
  type BaselineEntry,
  type BatchLot,
  type BatchTarget,
  type ReconciliationPlan,
  type ReconciliationRow,
  type UnlistedPolicy,
} from './baseline-reconciliation.js';

export interface SourceOptions {
  storeId: bigint;
  entriesPath: string;
  receiptNos: string[];
  to: Date;
  preserveAfter: Date;
  unlistedSalesAfter: Date;
  unlistedPolicy: UnlistedPolicy;
}

export interface ProductBatchPlan {
  row: ReconciliationRow;
  batches: BatchTarget[];
}

export interface RebuildPlan {
  organizationId: bigint;
  storeId: bigint;
  warehouseId: bigint;
  timeZone: string;
  entryLines: number;
  saleLines: number;
  lastSaleAt: Date;
  plan: ReconciliationPlan;
  products: ProductBatchPlan[];
  // Current balances the plan was computed from; execution refuses to run if any of them moved.
  snapshot: Map<string, { quantity: number; version: number }>;
  // Entry lines dropped because a later day recounted the same product and expiry.
  superseded: (BaselineEntry & { expiryDate: string })[];
}

interface EntryLine extends BaselineEntry {
  barcode: string;
  expiryDate: string;
  batchId?: string;
}

const ENTRIES_HEADER = 'product_id,entry_date,quantity,source,barcode,expiry_date';
export const balanceKey = (productId: string, batchId: string) => `${productId}:${batchId}`;

function readEntries(path: string): EntryLine[] {
  const [header, ...lines] = readFileSync(path, 'utf8').replace(/^﻿/, '').split(/\r?\n/).filter(Boolean);
  if (header.trim() !== ENTRIES_HEADER) throw new Error(`Entries header must be ${ENTRIES_HEADER}, got ${header}`);
  return lines.map((line, index) => {
    const [productId, entryDate, quantity, source, barcode, expiryDate] = line.split(',');
    if (!/^\d+$/.test(productId) || !barcode || !/^\d{4}-\d{2}-\d{2}$/.test(expiryDate ?? '')) {
      throw new Error(`Invalid entries line ${index + 2}: ${line}`);
    }
    return { productId, entryDate, quantity: Number(quantity), source, barcode, expiryDate };
  });
}

export const isoDate = (date: Date) => date.toISOString().slice(0, 10);
const isMonthEnd = (date: string) => {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month, 0)).getUTCDate() === day;
};

export async function loadRebuildPlan(prisma: PrismaService, options: SourceOptions): Promise<RebuildPlan> {
  const db = prisma.client;
  const { storeId } = options;
  const store = await db.store.findUniqueOrThrow({ where: { id: storeId }, select: { organizationId: true } });
  const organizationId = store.organizationId;
  const { timezone: timeZone } = await db.organization.findUniqueOrThrow({ where: { id: organizationId }, select: { timezone: true } });
  const warehouses = await db.warehouse.findMany({ where: { storeId, status: 'ACTIVE' }, select: { id: true } });
  if (warehouses.length !== 1) throw new Error(`Store ${storeId} must have exactly one active warehouse, found ${warehouses.length}`);
  const warehouseId = warehouses[0].id;

  const balances = await db.inventoryBalance.findMany({
    where: { organizationId, warehouseId },
    select: { productId: true, batchId: true, quantity: true, version: true, batch: { select: { expiryDate: true } } },
  });
  const snapshot = new Map(balances.map((row) => [balanceKey(row.productId.toString(), row.batchId.toString()), { quantity: row.quantity, version: row.version }]));
  const currentByProduct = new Map<string, BatchLot[]>();
  for (const row of balances) {
    if (row.quantity === 0) continue;
    const list = currentByProduct.get(row.productId.toString()) ?? [];
    list.push({ batchId: row.batchId.toString(), expiryDate: isoDate(row.batch.expiryDate), quantity: row.quantity });
    currentByProduct.set(row.productId.toString(), list);
  }

  const batches = await db.productBatch.findMany({
    where: { organizationId, status: 'ACTIVE' },
    select: { id: true, productId: true, expiryDate: true, expiryPrecision: true },
  });
  const batchesByExpiry = new Map<string, typeof batches>();
  const latestBatch = new Map<string, { batchId: string; expiryDate: string }>();
  for (const batch of batches) {
    const productId = batch.productId.toString();
    const key = `${productId}:${isoDate(batch.expiryDate)}`;
    batchesByExpiry.set(key, [...(batchesByExpiry.get(key) ?? []), batch]);
    const latest = latestBatch.get(productId);
    if (!latest || isoDate(batch.expiryDate) > latest.expiryDate) latestBatch.set(productId, { batchId: batch.id.toString(), expiryDate: isoDate(batch.expiryDate) });
  }

  // Exported entries carry a date only; reuse the batch already holding stock, else the precision that date implies.
  const resolveBatch = (entry: EntryLine) => {
    const candidates = batchesByExpiry.get(`${entry.productId}:${entry.expiryDate}`) ?? [];
    if (!candidates.length) throw new Error(`No batch for product ${entry.productId} expiring ${entry.expiryDate}`);
    const stocked = candidates.find((batch) => (snapshot.get(balanceKey(entry.productId, batch.id.toString()))?.quantity ?? 0) !== 0);
    const preferred = candidates.find((batch) => batch.expiryPrecision === (isMonthEnd(entry.expiryDate) ? 'MONTH' : 'DATE'));
    return (stocked ?? preferred ?? candidates[0]).id.toString();
  };

  const entries = readEntries(options.entriesPath);
  for (const entry of entries) entry.batchId = resolveBatch(entry);
  for (const receiptNo of options.receiptNos) {
    const lines = await db.stockReceiptItem.findMany({
      where: { receipt: { receiptNo, storeId } },
      select: { productId: true, batchId: true, quantity: true, barcode: true, receipt: { select: { receiptDate: true } }, batch: { select: { expiryDate: true } } },
    });
    if (!lines.length) throw new Error(`Receipt ${receiptNo} has no lines in store ${storeId}`);
    for (const line of lines) {
      entries.push({
        productId: line.productId.toString(),
        entryDate: isoDate(line.receipt.receiptDate),
        quantity: line.quantity,
        source: receiptNo,
        barcode: line.barcode,
        expiryDate: isoDate(line.batch.expiryDate),
        batchId: line.batchId.toString(),
      });
    }
  }

  // Every baseline line must scan to the product it claims; a mismatch means the source file is out of sync with the catalog.
  const barcodes = await db.productBarcode.findMany({ where: { organizationId, status: 'ACTIVE' }, select: { productId: true, barcode: true } });
  const barcodeOwners = new Map(barcodes.map((row) => [row.barcode, row.productId.toString()]));
  const mismatches = entries.filter((entry) => barcodeOwners.get(entry.barcode) !== entry.productId);
  if (mismatches.length) {
    throw new Error(`Barcode/product mismatch: ${mismatches.slice(0, 5).map((entry) => `${entry.barcode}->${entry.productId}`).join(', ')}`);
  }
  const { kept: counted, superseded } = collapseRecounts(entries);

  const preservedRows = await db.$queryRaw<{ product_id: bigint; batch_id: bigint; expiry_date: Date; delta: unknown }[]>`
    SELECT m.product_id, m.batch_id, b.expiry_date, SUM(m.quantity_delta) AS delta
    FROM stock_movements m JOIN product_batches b ON b.id = m.batch_id
    WHERE m.warehouse_id = ${warehouseId} AND m.created_at > ${options.preserveAfter}
    GROUP BY m.product_id, m.batch_id, b.expiry_date`;
  const preservedByProduct = new Map<string, BatchLot[]>();
  for (const row of preservedRows) {
    const delta = Number(row.delta);
    if (delta === 0) continue;
    const list = preservedByProduct.get(row.product_id.toString()) ?? [];
    list.push({ batchId: row.batch_id.toString(), expiryDate: isoDate(row.expiry_date), quantity: delta });
    preservedByProduct.set(row.product_id.toString(), list);
  }

  const earliestEntry = counted.reduce((min, entry) => (entry.entryDate < min ? entry.entryDate : min), '9999-12-31');
  const salesFrom = new Date(Math.min(new Date(`${earliestEntry}T00:00:00Z`).getTime() - 86_400_000, options.unlistedSalesAfter.getTime()));
  const sales = await db.$queryRaw<{ product_id: bigint; ordered_at: Date; quantity: unknown }[]>`
    SELECT i.product_id, o.ordered_at, i.quantity
    FROM pos_orders o JOIN pos_order_items i ON i.order_id = o.id
    WHERE o.store_id = ${storeId} AND o.source_status = 'Paid' AND o.refund_amount = 0
      AND i.status = 'ACTIVE' AND i.disposition = 'INVENTORY' AND i.is_minus = 0 AND i.product_id IS NOT NULL
      AND o.ordered_at >= ${salesFrom} AND o.ordered_at < ${options.to}`;

  const products = await db.product.findMany({
    where: { organizationId },
    select: { id: true, name: true, barcodes: { where: { isPrimary: true, status: 'ACTIVE' }, select: { barcode: true }, take: 1 } },
  });
  const sum = (lots: BatchLot[] | undefined) => (lots ?? []).reduce((total, lot) => total + lot.quantity, 0);
  const plan = planBaselineReconciliation({
    entries: counted,
    sales: sales.map((row) => ({
      productId: row.product_id.toString(),
      orderedAt: row.ordered_at,
      saleDate: row.ordered_at.toLocaleDateString('en-CA', { timeZone }),
      quantity: Number(row.quantity),
    })),
    products: products.map((row) => ({
      productId: row.id.toString(),
      barcode: row.barcodes[0]?.barcode ?? '',
      name: row.name,
      currentQuantity: sum(currentByProduct.get(row.id.toString())),
      preservedDelta: sum(preservedByProduct.get(row.id.toString())),
      hasBatch: latestBatch.has(row.id.toString()),
    })),
    unlistedPolicy: options.unlistedPolicy,
    unlistedSalesAfter: options.unlistedSalesAfter,
  });

  const entriesByProduct = new Map<string, BatchLot[]>();
  for (const entry of counted) {
    const list = entriesByProduct.get(entry.productId) ?? [];
    list.push({ batchId: entry.batchId!, expiryDate: entry.expiryDate, quantity: entry.quantity });
    entriesByProduct.set(entry.productId, list);
  }

  const recounted = new Set(superseded.map((entry) => entry.productId));
  for (const row of plan.rows) if (recounted.has(row.productId)) row.flags.push('RECOUNT_KEPT_LATER');

  const productPlans = plan.rows.map((row) => {
    const current = currentByProduct.get(row.productId) ?? [];
    const preserved = preservedByProduct.get(row.productId) ?? [];
    let lots: BatchLot[];
    if (row.listed) {
      lots = entriesByProduct.get(row.productId)!;
    } else if (options.unlistedPolicy === 'keep') {
      // Current stock already includes staff movements; take them out so they are layered back exactly once.
      const merged = new Map(current.map((lot) => [lot.batchId, { ...lot }]));
      for (const lot of preserved) {
        const existing = merged.get(lot.batchId);
        if (existing) existing.quantity -= lot.quantity;
        else merged.set(lot.batchId, { ...lot, quantity: -lot.quantity });
      }
      lots = [...merged.values()];
    } else {
      lots = [];
    }
    const batchTargets = allocateBatchTargets({
      lots,
      salesDeducted: row.salesDeducted,
      preserved,
      current,
      fallback: latestBatch.get(row.productId),
    });
    const total = batchTargets.reduce((sumTarget, batch) => sumTarget + batch.targetQuantity, 0);
    if (total !== row.targetQuantity) throw new Error(`Batch targets for product ${row.productId} sum to ${total}, expected ${row.targetQuantity}`);
    return { row, batches: batchTargets };
  });

  return {
    organizationId,
    storeId,
    warehouseId,
    timeZone,
    entryLines: counted.length,
    saleLines: sales.length,
    lastSaleAt: sales.reduce((max, row) => (row.ordered_at > max ? row.ordered_at : max), new Date(0)),
    plan,
    products: productPlans,
    snapshot,
    superseded,
  };
}

export function parseSourceArguments(argv: string[]): SourceOptions & { outPath: string } {
  const value = (name: string) => argv.find((argument) => argument.startsWith(`--${name}=`))?.slice(name.length + 3);
  const values = (name: string) => argv.filter((argument) => argument.startsWith(`--${name}=`)).map((argument) => argument.slice(name.length + 3));
  const timestamp = (name: string) => {
    const raw = value(name);
    if (!raw || Number.isNaN(new Date(raw).getTime())) throw new Error(`--${name} must be an ISO timestamp`);
    return new Date(raw);
  };
  const storeValue = value('store');
  const entriesPath = value('entries');
  const outPath = value('out');
  const unlistedPolicy = (value('unlisted') ?? 'keep') as UnlistedPolicy;
  if (!storeValue || !/^\d+$/.test(storeValue)) throw new Error('--store must be a positive integer');
  if (!entriesPath) throw new Error(`--entries must point to a CSV with header ${ENTRIES_HEADER}`);
  if (!outPath) throw new Error('--out must be a CSV path');
  if (unlistedPolicy !== 'keep' && unlistedPolicy !== 'zero') throw new Error('--unlisted must be keep or zero');
  return {
    storeId: BigInt(storeValue),
    entriesPath,
    receiptNos: values('receipt'),
    to: timestamp('to'),
    preserveAfter: timestamp('preserve-after'),
    unlistedSalesAfter: timestamp('unlisted-sales-after'),
    unlistedPolicy,
    outPath,
  };
}

export function csvCell(cell: string | number) {
  const text = String(cell);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}
