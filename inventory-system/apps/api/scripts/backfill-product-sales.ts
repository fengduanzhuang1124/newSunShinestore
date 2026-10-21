// Deducts POS sales from a time window that a baseline rebuild deliberately left out, for an explicit product list.
// Lines are deducted first-expiry-first; what the stock cannot cover stays as a negative review item on the latest
// batch (controlled reconciliation, see docs/records/negative-inventory-reconciliation.md). Dry run unless --execute.
import '../src/config/environment.js';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { basename } from 'node:path';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../src/database/prisma.service.js';
import { allocateBatchTargets } from './lib/baseline-reconciliation.js';
import { csvCell } from './lib/baseline-reconciliation-source.js';

const REFERENCE_TYPE = 'SALES_BACKFILL';
const value = (name: string) => process.argv.find((argument) => argument.startsWith(`--${name}=`))?.slice(name.length + 3);
const storeValue = value('store');
const productsPath = value('products');
const fromValue = value('from');
const toValue = value('to');
const deductedAfterValue = value('deducted-after');
const run = value('run');
const userValue = value('user');
const backupPath = value('backup');
const outPath = value('out');
const execute = process.argv.includes('--execute');
if (!storeValue || !/^\d+$/.test(storeValue)) throw new Error('--store must be a positive integer');
if (!productsPath) throw new Error('--products must point to a file with one product id per line');
if (!fromValue || !toValue || Number.isNaN(Date.parse(fromValue)) || Number.isNaN(Date.parse(toValue))) throw new Error('--from and --to must be ISO timestamps');
if (!deductedAfterValue || Number.isNaN(Date.parse(deductedAfterValue))) throw new Error('--deducted-after must be the ISO time after which SALE_OUT rows are already reflected in stock');
if (!run || !/^[A-Z0-9-]{8,40}$/.test(run)) throw new Error('--run must be 8-40 chars of A-Z, 0-9 and -');
if (!userValue || !/^\d+$/.test(userValue)) throw new Error('--user must be the id of the staff member performing the backfill');
if (!outPath) throw new Error('--out must be a CSV path');
if (execute && (!backupPath || !existsSync(backupPath))) throw new Error('--backup must point to the database backup taken before this run');
const from = new Date(fromValue);
const to = new Date(toValue);
const deductedAfter = new Date(deductedAfterValue);
const productIds = [...new Set(readFileSync(productsPath, 'utf8').split(/\s+/).filter(Boolean))].map((id) => {
  if (!/^\d+$/.test(id)) throw new Error(`Invalid product id ${id}`);
  return BigInt(id);
});

const isoDate = (date: Date) => date.toISOString().slice(0, 10);

const prisma = new PrismaService();
await prisma.onModuleInit();
try {
  const db = prisma.client;
  const storeId = BigInt(storeValue);
  const store = await db.store.findUniqueOrThrow({ where: { id: storeId }, select: { organizationId: true } });
  const organizationId = store.organizationId;
  const warehouses = await db.warehouse.findMany({ where: { storeId, status: 'ACTIVE' }, select: { id: true } });
  if (warehouses.length !== 1) throw new Error(`Store ${storeId} must have exactly one active warehouse`);
  const warehouseId = warehouses[0].id;
  const userId = BigInt(userValue);
  await db.user.findFirstOrThrow({ where: { id: userId, organizationId, status: 'ACTIVE' } });
  if (await db.stockMovement.count({ where: { idempotencyKey: { startsWith: `${run}:` } } })) {
    throw new Error(`Run ${run} has already been executed; nothing written`);
  }

  const result = await db.$transaction(async (transaction) => {
    // Ids come from a digits-only parse above, so joining them cannot inject SQL.
    await transaction.$queryRawUnsafe(
      `SELECT product_id FROM inventory_balances WHERE organization_id = ? AND warehouse_id = ? AND product_id IN (${productIds.join(',')}) FOR UPDATE`,
      organizationId, warehouseId,
    );
    // SALE_OUT rows written after `deductedAfter` are already part of current stock; only the rest is missing.
    const sales = await transaction.$queryRaw<{ product_id: bigint; quantity: unknown }[]>`
      SELECT i.product_id, SUM(i.quantity) - COALESCE(SUM((
          SELECT SUM(-m.quantity_delta) FROM stock_movements m
          WHERE m.movement_type = 'SALE_OUT' AND m.reference_type = 'POS_SALE_ITEM'
            AND m.reference_id = i.id AND m.created_at >= ${deductedAfter}
        )), 0) AS quantity
      FROM pos_orders o JOIN pos_order_items i ON i.order_id = o.id
      WHERE o.store_id = ${storeId} AND o.source_status = 'Paid' AND o.refund_amount = 0
        AND i.status = 'ACTIVE' AND i.disposition = 'INVENTORY' AND i.is_minus = 0
        AND o.ordered_at >= ${from} AND o.ordered_at < ${to}
      GROUP BY i.product_id`;
    const soldByProduct = new Map(sales.map((row) => [row.product_id.toString(), Number(row.quantity)]));
    const requestId = randomUUID();
    const rows: (string | number)[][] = [];
    let sequence = 0;
    let deducted = 0;
    let shortfall = 0;

    for (const productId of productIds) {
      const sold = soldByProduct.get(productId.toString()) ?? 0;
      if (!Number.isInteger(sold)) throw new Error(`Product ${productId} has a fractional sold quantity ${sold}`);
      if (sold <= 0) continue;
      const product = await transaction.product.findFirst({ where: { id: productId, organizationId, status: 'ACTIVE' }, select: { name: true } });
      if (!product) continue;
      const balances = await transaction.inventoryBalance.findMany({
        where: { organizationId, warehouseId, productId },
        include: { batch: true },
      });
      const current = balances
        .filter((balance) => balance.quantity !== 0)
        .map((balance) => ({ batchId: balance.batchId.toString(), expiryDate: isoDate(balance.batch.expiryDate), quantity: balance.quantity }));
      const latest = await transaction.productBatch.findFirst({
        where: { organizationId, productId, status: 'ACTIVE' }, orderBy: { expiryDate: 'desc' }, select: { id: true, expiryDate: true },
      });
      if (!current.length && !latest) {
        rows.push([productId.toString(), product.name, sold, 0, 0, 0, '无批次，未扣']);
        continue;
      }
      const targets = allocateBatchTargets({
        lots: current.filter((lot) => lot.quantity > 0),
        salesDeducted: sold,
        preserved: current.filter((lot) => lot.quantity < 0),
        current,
        fallback: latest ? { batchId: latest.id.toString(), expiryDate: isoDate(latest.expiryDate) } : undefined,
      });
      const before = current.reduce((sum, lot) => sum + lot.quantity, 0);
      const after = targets.reduce((sum, target) => sum + target.targetQuantity, 0);
      const productShortfall = Math.max(0, -after) - Math.max(0, -before);
      deducted += sold - Math.max(0, productShortfall);
      shortfall += Math.max(0, productShortfall);
      rows.push([productId.toString(), product.name, sold, before, after, Math.max(0, productShortfall), after < 0 ? '负库存待核查' : '']);

      for (const target of targets.filter((row) => row.delta !== 0)) {
        const batchId = BigInt(target.batchId);
        const balance = balances.find((row) => row.batchId === batchId);
        if (balance) {
          const updated = await transaction.inventoryBalance.updateMany({
            where: { organizationId, warehouseId, productId, batchId, quantity: balance.quantity, version: balance.version },
            data: { quantity: target.targetQuantity, version: { increment: 1 } },
          });
          if (updated.count !== 1) throw new Error(`Balance ${productId}:${batchId} changed during the backfill`);
        } else {
          await transaction.inventoryBalance.create({ data: { organizationId, warehouseId, productId, batchId, quantity: target.targetQuantity } });
        }
        sequence += 1;
        const movement = await transaction.stockMovement.create({
          data: {
            movementNo: `SB${run.replaceAll('-', '').slice(-10)}${String(sequence).padStart(5, '0')}`.slice(0, 40),
            organizationId, storeId, warehouseId, productId, batchId,
            movementType: target.delta > 0 ? 'STOCKTAKE_GAIN' : 'STOCKTAKE_LOSS',
            quantityDelta: target.delta,
            referenceType: REFERENCE_TYPE,
            reason: `补扣 ${from.toISOString()} 至 ${to.toISOString()} 的 POS 销量 ${sold} 件（基准外保留商品）`.slice(0, 255),
            performedById: userId,
            idempotencyKey: `${run}:${productId}:${batchId}`,
          },
        });
        await transaction.auditLog.create({
          data: {
            organizationId, userId, storeId, warehouseId, action: 'inventory.sales_backfill', entityType: 'StockMovement',
            entityId: movement.id.toString(), requestId,
            beforeSummary: { quantity: target.currentQuantity },
            afterSummary: { quantity: target.targetQuantity, difference: target.delta, run, soldInWindow: sold },
          },
        });
      }
    }
    await transaction.auditLog.create({
      data: {
        organizationId, userId, storeId, warehouseId, action: 'INVENTORY_SALES_BACKFILLED', entityType: 'InventoryBaseline', entityId: run, requestId,
        beforeSummary: { products: productIds.length, from: from.toISOString(), to: to.toISOString(), deductedAfter: deductedAfter.toISOString(), list: basename(productsPath) },
        afterSummary: { movements: sequence, deducted, shortfall, backup: backupPath ? basename(backupPath) : null },
      },
    });
    const summary = { products: rows.length, movements: sequence, deducted, shortfall };
    if (!execute) throw Object.assign(new Error('DRY_RUN'), { rows, summary });
    return { rows, summary, requestId };
  }, { maxWait: 10_000, timeout: 300_000 }).catch((error) => {
    if (error instanceof Error && error.message === 'DRY_RUN') {
      const dry = error as Error & { rows: (string | number)[][]; summary: unknown };
      return { rows: dry.rows, summary: dry.summary, dryRun: true };
    }
    throw error;
  });

  writeFileSync(outPath, `﻿${[['商品ID', '商品名称', '窗口内销量', '补扣前库存', '补扣后库存', '扣不够件数', '标记'], ...result.rows]
    .map((row) => row.map(csvCell).join(',')).join('\n')}\n`);
  const [check] = await db.$queryRaw<{ movements: unknown; balances: unknown }[]>`
    SELECT (SELECT COALESCE(SUM(quantity_delta), 0) FROM stock_movements WHERE warehouse_id = ${warehouseId}) AS movements,
      (SELECT COALESCE(SUM(quantity), 0) FROM inventory_balances WHERE warehouse_id = ${warehouseId}) AS balances`;
  console.log(JSON.stringify({ ok: Number(check.movements) === Number(check.balances), run, ...('dryRun' in result ? { dryRun: true } : { requestId: result.requestId }), ...result.summary as object, out: outPath }, null, 2));
} finally {
  await prisma.onModuleDestroy();
}
