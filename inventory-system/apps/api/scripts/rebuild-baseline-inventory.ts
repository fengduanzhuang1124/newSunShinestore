// Writes the baseline rebuild as STOCKTAKE_GAIN/LOSS movements in one transaction. Run preview-baseline-reconciliation first.
import '../src/config/environment.js';
import { existsSync, writeFileSync } from 'node:fs';
import { basename } from 'node:path';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../src/database/prisma.service.js';
import { balanceKey, csvCell, loadRebuildPlan, parseSourceArguments } from './lib/baseline-reconciliation-source.js';

const REFERENCE_TYPE = 'BASELINE_REBUILD';
const value = (name: string) => process.argv.find((argument) => argument.startsWith(`--${name}=`))?.slice(name.length + 3);
const options = parseSourceArguments(process.argv);
const userValue = value('user');
const run = value('run');
const backupPath = value('backup');
if (!process.argv.includes('--execute')) throw new Error('Refusing to write without --execute; use preview-baseline-reconciliation for a dry run');
if (!userValue || !/^\d+$/.test(userValue)) throw new Error('--user must be the id of the staff member performing the rebuild');
if (!run || !/^[A-Z0-9-]{8,40}$/.test(run)) throw new Error('--run must be 8-40 chars of A-Z, 0-9 and -');
if (!backupPath || !existsSync(backupPath)) throw new Error('--backup must point to the database backup taken before this run');
if (options.to.getTime() > Date.now()) throw new Error('--to cannot be in the future');

const prisma = new PrismaService();
await prisma.onModuleInit();
try {
  const db = prisma.client;
  if (await db.stockMovement.count({ where: { idempotencyKey: { startsWith: `${run}:` } } })) {
    throw new Error(`Run ${run} has already been executed; nothing written`);
  }
  const rebuild = await loadRebuildPlan(prisma, options);
  const { organizationId, storeId, warehouseId } = rebuild;
  const userId = BigInt(userValue);
  await db.user.findFirstOrThrow({ where: { id: userId, organizationId, status: 'ACTIVE' } });

  const day = options.to.toLocaleDateString('en-CA', { timeZone: rebuild.timeZone }).slice(2).replaceAll('-', '');
  const movementPrefix = `RB${day}`;
  const requestId = randomUUID();
  const planned = rebuild.products.flatMap(({ row, batches }) => batches
    .filter((batch) => batch.delta !== 0)
    .map((batch) => ({ row, batch })));
  const reasonOf = (row: (typeof planned)[number]['row']) => (row.listed
    ? `入库单基准重建 ${row.sources}；基准${row.baselineQuantity} 扣${row.firstEntryDate}后销量${row.salesDeducted}`
    : `入库单基准外商品保留并扣${options.unlistedSalesAfter.toISOString()}后销量${row.salesDeducted}；待核查`
  ).slice(0, 255);

  const written = await db.$transaction(async (transaction) => {
    const repeated = await transaction.stockMovement.count({
      where: { organizationId, OR: [{ idempotencyKey: { startsWith: `${run}:` } }, { movementNo: { startsWith: movementPrefix } }] },
    });
    if (repeated) throw new Error(`Run ${run} or movement prefix ${movementPrefix} already used; nothing written`);

    // Lock the warehouse and refuse to continue if anything moved since the plan was computed.
    const locked = await transaction.$queryRaw<{ product_id: bigint; batch_id: bigint; quantity: number; version: number }[]>`
      SELECT product_id, batch_id, quantity, version FROM inventory_balances
      WHERE organization_id = ${organizationId} AND warehouse_id = ${warehouseId} FOR UPDATE`;
    const drifted = locked.filter((row) => {
      const expected = rebuild.snapshot.get(balanceKey(row.product_id.toString(), row.batch_id.toString()));
      return !expected || expected.quantity !== row.quantity || expected.version !== row.version;
    });
    if (drifted.length || locked.length !== rebuild.snapshot.size) {
      throw new Error(`Inventory changed after planning (${drifted.length} rows); rerun the preview and try again`);
    }

    let sequence = 0;
    const results: ((typeof planned)[number] & { movementNo: string })[] = [];
    for (const { row, batch } of planned) {
      const productId = BigInt(row.productId);
      const batchId = BigInt(batch.batchId);
      const key = balanceKey(row.productId, batch.batchId);
      const before = rebuild.snapshot.get(key);
      if (before) {
        const updated = await transaction.inventoryBalance.updateMany({
          where: { organizationId, warehouseId, productId, batchId, quantity: before.quantity, version: before.version },
          data: { quantity: batch.targetQuantity, version: { increment: 1 } },
        });
        if (updated.count !== 1) throw new Error(`Balance ${key} changed during the rebuild`);
      } else {
        await transaction.inventoryBalance.create({
          data: { organizationId, warehouseId, productId, batchId, quantity: batch.targetQuantity },
        });
      }
      sequence += 1;
      const movement = await transaction.stockMovement.create({
        data: {
          movementNo: `${movementPrefix}${String(sequence).padStart(6, '0')}`,
          organizationId, storeId, warehouseId, productId, batchId,
          movementType: batch.delta > 0 ? 'STOCKTAKE_GAIN' : 'STOCKTAKE_LOSS',
          quantityDelta: batch.delta,
          referenceType: REFERENCE_TYPE,
          reason: reasonOf(row),
          performedById: userId,
          idempotencyKey: `${run}:${row.productId}:${batch.batchId}`,
        },
      });
      await transaction.auditLog.create({
        data: {
          organizationId, userId, storeId, warehouseId,
          action: 'inventory.baseline_rebuild', entityType: 'StockMovement', entityId: movement.id.toString(), requestId,
          beforeSummary: { quantity: batch.currentQuantity },
          afterSummary: {
            quantity: batch.targetQuantity, difference: batch.delta, run,
            baselineQuantity: row.baselineQuantity, salesDeducted: row.salesDeducted, flags: row.flags,
          },
        },
      });
      results.push({ movementNo: movement.movementNo, row, batch });
    }

    const totals = rebuild.plan.totals;
    await transaction.auditLog.create({
      data: {
        organizationId, userId, storeId, warehouseId,
        action: 'INVENTORY_BASELINE_REBUILT', entityType: 'InventoryBaseline', entityId: run, requestId,
        beforeSummary: {
          entries: basename(options.entriesPath), receipts: options.receiptNos, backup: basename(backupPath),
          currentQuantity: totals.currentQuantity,
        },
        afterSummary: {
          movements: results.length, gain: totals.gain, loss: totals.loss, targetQuantity: totals.targetQuantity,
          negativeProducts: totals.negativeProducts, negativeQuantity: totals.negativeQuantity,
          unlistedPolicy: options.unlistedPolicy, salesThrough: options.to.toISOString(),
        },
      },
    });
    return results;
  }, { maxWait: 10_000, timeout: 600_000 });

  writeFileSync(options.outPath, `﻿${[
    ['流水号', '商品ID', '商品名称', '批次ID', '到期日', '原库存', '目标库存', '调整差额', '标记'],
    ...written.map(({ movementNo, row, batch }) => [
      movementNo, row.productId, row.name, batch.batchId, batch.expiryDate, batch.currentQuantity, batch.targetQuantity, batch.delta, row.flags.join(' '),
    ]),
  ].map((row) => row.map(csvCell).join(',')).join('\n')}\n`);

  const [check] = await db.$queryRaw<{ movements: unknown; balances: unknown; negatives: unknown }[]>`
    SELECT (SELECT COALESCE(SUM(quantity_delta), 0) FROM stock_movements WHERE warehouse_id = ${warehouseId}) AS movements,
      (SELECT COALESCE(SUM(quantity), 0) FROM inventory_balances WHERE warehouse_id = ${warehouseId}) AS balances,
      (SELECT COUNT(*) FROM inventory_balances WHERE warehouse_id = ${warehouseId} AND quantity < 0) AS negatives`;
  console.log(JSON.stringify({
    ok: Number(check.movements) === Number(check.balances),
    run,
    requestId,
    movements: written.length,
    movementSum: Number(check.movements),
    balanceSum: Number(check.balances),
    negativeBalances: Number(check.negatives),
    nextPosInventoryBaselineAt: options.to.toISOString(),
    out: options.outPath,
  }, null, 2));
} finally {
  await prisma.onModuleDestroy();
}
