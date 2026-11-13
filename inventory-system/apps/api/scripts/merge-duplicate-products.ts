// Merges duplicate product records into the POS-mapped record: stock moves batch by batch, barcodes move as secondary
// barcodes, the duplicate is deactivated. Without --execute it only prints the plan.
import '../src/config/environment.js';
import { existsSync, readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../src/database/prisma.service.js';

const REFERENCE_TYPE = 'PRODUCT_MERGE';
const value = (name: string) => process.argv.find((argument) => argument.startsWith(`--${name}=`))?.slice(name.length + 3);
const pairsPath = value('pairs');
const storeValue = value('store');
const userValue = value('user');
const run = value('run');
const backupPath = value('backup');
const execute = process.argv.includes('--execute');
if (!pairsPath) throw new Error('--pairs must point to a CSV of from_product_id,to_product_id,deduct_sales');
if (!storeValue || !/^\d+$/.test(storeValue)) throw new Error('--store must be a positive integer');
if (!userValue || !/^\d+$/.test(userValue)) throw new Error('--user must be the id of the staff member performing the merge');
if (!run || !/^[A-Z0-9-]{8,40}$/.test(run)) throw new Error('--run must be 8-40 chars of A-Z, 0-9 and -');
if (execute && (!backupPath || !existsSync(backupPath))) throw new Error('--backup must point to the database backup taken before this run');

const [header, ...lines] = readFileSync(pairsPath, 'utf8').replace(/^﻿/, '').split(/\r?\n/).filter(Boolean);
if (header.trim() !== 'from_product_id,to_product_id,deduct_sales') throw new Error(`Unexpected pairs header: ${header}`);
const pairs = lines.map((line, index) => {
  const [from, to, deduct] = line.split(',');
  if (!/^\d+$/.test(from) || !/^\d+$/.test(to) || !/^\d+$/.test(deduct ?? '') || from === to) throw new Error(`Invalid pairs line ${index + 2}: ${line}`);
  return { from: BigInt(from), to: BigInt(to), deduct: Number(deduct) };
});
const involved = pairs.flatMap((pair) => [pair.from, pair.to]);
if (new Set(involved.map(String)).size !== involved.length) throw new Error('Each product may appear in only one pair');

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
    // Ids are parsed from digits-only fields above, so joining them into the IN list cannot inject SQL.
    await transaction.$queryRawUnsafe(
      `SELECT product_id FROM inventory_balances WHERE organization_id = ? AND warehouse_id = ? AND product_id IN (${involved.join(',')}) FOR UPDATE`,
      organizationId, warehouseId,
    );
    const requestId = randomUUID();
    let sequence = 0;
    const summary = [];
    for (const pair of pairs) {
      const [from, to] = await Promise.all([pair.from, pair.to].map((id) => transaction.product.findFirst({
        where: { id, organizationId },
        select: { id: true, name: true, status: true, posProductMappings: { where: { status: 'ACTIVE' }, select: { id: true } } },
      })));
      if (!from || !to) throw new Error(`Pair ${pair.from}->${pair.to} refers to a missing product`);
      if (from.status !== 'ACTIVE' || to.status !== 'ACTIVE') throw new Error(`Pair ${pair.from}->${pair.to} has an inactive product`);
      if (from.posProductMappings.length) throw new Error(`Product ${pair.from} is POS-mapped; merge into it instead`);
      if (!to.posProductMappings.length) throw new Error(`Target ${pair.to} has no POS mapping; sales would still not reach it`);

      const write = async (productId: bigint, batchId: bigint, delta: number, reason: string, kind: string) => {
        const balance = await transaction.inventoryBalance.findUnique({
          where: { organizationId_warehouseId_productId_batchId: { organizationId, warehouseId, productId, batchId } },
        });
        if (balance) {
          const updated = await transaction.inventoryBalance.updateMany({
            where: { organizationId, warehouseId, productId, batchId, quantity: balance.quantity, version: balance.version },
            data: { quantity: { increment: delta }, version: { increment: 1 } },
          });
          if (updated.count !== 1) throw new Error(`Balance ${productId}:${batchId} changed during the merge`);
        } else {
          await transaction.inventoryBalance.create({ data: { organizationId, warehouseId, productId, batchId, quantity: delta } });
        }
        sequence += 1;
        const movement = await transaction.stockMovement.create({
          data: {
            movementNo: `MG${run.replaceAll('-', '').slice(-10)}${String(sequence).padStart(4, '0')}`.slice(0, 40),
            organizationId, storeId, warehouseId, productId, batchId,
            movementType: delta > 0 ? 'STOCKTAKE_GAIN' : 'STOCKTAKE_LOSS',
            quantityDelta: delta, referenceType: REFERENCE_TYPE, reason: reason.slice(0, 255), performedById: userId,
            idempotencyKey: `${run}:${pair.from}:${pair.to}:${batchId}:${kind}`,
          },
        });
        await transaction.auditLog.create({
          data: {
            organizationId, userId, storeId, warehouseId, action: 'inventory.product_merge', entityType: 'StockMovement',
            entityId: movement.id.toString(), requestId,
            beforeSummary: { quantity: balance?.quantity ?? 0 },
            afterSummary: { quantity: (balance?.quantity ?? 0) + delta, difference: delta, run, from: pair.from.toString(), to: pair.to.toString() },
          },
        });
      };

      const fromBalances = await transaction.inventoryBalance.findMany({
        where: { organizationId, warehouseId, productId: pair.from, quantity: { not: 0 } },
        include: { batch: true },
      });
      let moved = 0;
      for (const balance of fromBalances) {
        const target = await transaction.productBatch.upsert({
          where: { organizationId_productId_expiryDate_expiryPrecision: {
            organizationId, productId: pair.to, expiryDate: balance.batch.expiryDate, expiryPrecision: balance.batch.expiryPrecision,
          } },
          update: {},
          create: {
            organizationId, productId: pair.to, expiryDate: balance.batch.expiryDate,
            expiryPrecision: balance.batch.expiryPrecision, createdById: userId,
          },
        });
        const reason = `重复商品档案合并：${pair.from}「${from.name}」并入 POS 商品 ${pair.to}「${to.name}」`;
        await write(pair.from, balance.batchId, -balance.quantity, reason, 'out');
        await write(pair.to, target.id, balance.quantity, reason, 'in');
        moved += balance.quantity;
      }

      // Sales the POS recorded against the target while it had no stock to deduct from; first-expiry-first.
      let remaining = pair.deduct;
      const targetBalances = await transaction.inventoryBalance.findMany({
        where: { organizationId, warehouseId, productId: pair.to },
        include: { batch: true },
        orderBy: [{ batch: { expiryDate: 'asc' } }, { batchId: 'asc' }],
      });
      for (const balance of targetBalances) {
        if (remaining <= 0) break;
        const taken = Math.min(Math.max(balance.quantity, 0), remaining);
        if (taken === 0) continue;
        await write(pair.to, balance.batchId, -taken, `合并后补扣此前无库存可扣的 POS 销量 ${pair.deduct} 件`, 'sales');
        remaining -= taken;
      }
      if (remaining > 0) {
        const carrier = targetBalances.at(-1);
        if (!carrier) throw new Error(`Target ${pair.to} has no batch to carry ${remaining} unmet sales`);
        await write(pair.to, carrier.batchId, -remaining, `合并后补扣销量不足 ${remaining} 件，待核查`, 'shortfall');
      }

      const movedBarcodes = await transaction.productBarcode.updateMany({
        where: { organizationId, productId: pair.from, status: 'ACTIVE' },
        data: { productId: pair.to, isPrimary: false },
      });
      await transaction.product.update({ where: { id: pair.from }, data: { status: 'INACTIVE' } });
      await transaction.auditLog.create({
        data: {
          organizationId, userId, storeId, warehouseId, action: 'PRODUCT_MERGED', entityType: 'Product', entityId: pair.from.toString(), requestId,
          beforeSummary: { status: 'ACTIVE', stock: moved },
          afterSummary: {
            mergedInto: pair.to.toString(), status: 'INACTIVE', movedQuantity: moved, deductedSales: pair.deduct,
            movedBarcodes: movedBarcodes.count, run, backup: backupPath ? basename(backupPath) : null,
          },
        },
      });
      summary.push({ from: pair.from.toString(), to: pair.to.toString(), name: to.name, moved, deducted: pair.deduct, barcodes: movedBarcodes.count });
    }
    if (!execute) throw Object.assign(new Error('DRY_RUN'), { summary });
    return { requestId, summary, movements: sequence };
  }, { maxWait: 10_000, timeout: 120_000 }).catch((error) => {
    if (error instanceof Error && error.message === 'DRY_RUN') return { dryRun: true, summary: (error as Error & { summary: unknown }).summary };
    throw error;
  });

  const [check] = await db.$queryRaw<{ movements: unknown; balances: unknown }[]>`
    SELECT (SELECT COALESCE(SUM(quantity_delta), 0) FROM stock_movements WHERE warehouse_id = ${warehouseId}) AS movements,
      (SELECT COALESCE(SUM(quantity), 0) FROM inventory_balances WHERE warehouse_id = ${warehouseId}) AS balances`;
  console.log(JSON.stringify({ ok: Number(check.movements) === Number(check.balances), run, ...result,
    movementSum: Number(check.movements), balanceSum: Number(check.balances) }, null, 2));
} finally {
  await prisma.onModuleDestroy();
}
