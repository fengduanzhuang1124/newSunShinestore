// Imports a recount list as a stock count task (REQ-012) that store admins then work through on the phone.
// CSV columns: product_id,priority,reasons (priority 1 = high, 2 = medium, 3 = low; reasons is the rest of the line).
// Without --execute it only validates the list and prints the plan.
import '../src/config/environment.js';
import { existsSync, readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../src/database/prisma.service.js';

const value = (name: string) => process.argv.find((argument) => argument.startsWith(`--${name}=`))?.slice(name.length + 3);
const itemsPath = value('items');
const storeValue = value('store');
const userValue = value('user');
const code = value('code');
const title = value('title');
const backupPath = value('backup');
const execute = process.argv.includes('--execute');
if (!itemsPath) throw new Error('--items must point to a CSV of product_id,priority,reasons');
if (!storeValue || !/^\d+$/.test(storeValue)) throw new Error('--store must be a positive integer');
if (!userValue || !/^\d+$/.test(userValue)) throw new Error('--user must be the id of the admin creating the task');
if (!code || !/^[A-Z0-9-]{6,40}$/.test(code)) throw new Error('--code must be 6-40 chars of A-Z, 0-9 and -');
if (!title || title.length > 120) throw new Error('--title is required (at most 120 characters)');
if (execute && (!backupPath || !existsSync(backupPath))) throw new Error('--backup must point to the database backup taken before this import');

const [header, ...lines] = readFileSync(itemsPath, 'utf8').replace(/^﻿/, '').split(/\r?\n/).filter(Boolean);
if (header.trim() !== 'product_id,priority,reasons') throw new Error(`Unexpected items header: ${header}`);
const items = lines.map((line, index) => {
  const [productId, priority, ...rest] = line.split(',');
  const reasons = rest.join(',').replace(/^"|"$/g, '').replace(/""/g, '"').trim();
  if (!/^\d+$/.test(productId) || !/^[123]$/.test(priority) || !reasons || reasons.length > 500) throw new Error(`Invalid items line ${index + 2}: ${line}`);
  return { productId: BigInt(productId), priority: Number(priority), reasons };
});
if (new Set(items.map((item) => item.productId.toString())).size !== items.length) throw new Error('Each product may appear only once');

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
  if (await db.stockCountTask.findUnique({ where: { organizationId_code: { organizationId, code } } })) {
    throw new Error(`Stock count task ${code} already exists; nothing written`);
  }
  const products = await db.product.findMany({ where: { organizationId, id: { in: items.map((item) => item.productId) } }, select: { id: true, status: true } });
  const known = new Map(products.map((product) => [product.id.toString(), product.status]));
  const missing = items.filter((item) => known.get(item.productId.toString()) !== 'ACTIVE');
  if (missing.length) throw new Error(`Products missing or inactive: ${missing.map((item) => item.productId).join(', ')}`);

  const byPriority = [1, 2, 3].map((priority) => items.filter((item) => item.priority === priority).length);
  console.log(JSON.stringify({ mode: execute ? 'EXECUTE' : 'PREVIEW', code, title, storeId: storeId.toString(), warehouseId: warehouseId.toString(), items: items.length, high: byPriority[0], medium: byPriority[1], low: byPriority[2] }, null, 2));
  if (!execute) process.exit(0);

  const task = await db.$transaction(async (transaction) => {
    const created = await transaction.stockCountTask.create({ data: { code, title, organizationId, storeId, warehouseId, createdById: userId } });
    await transaction.stockCountTaskItem.createMany({ data: items.map((item) => ({ taskId: created.id, productId: item.productId, priority: item.priority, reasons: item.reasons })) });
    await transaction.auditLog.create({
      data: {
        organizationId, userId, storeId, warehouseId, action: 'inventory.stock_count.import', entityType: 'StockCountTask', entityId: created.id.toString(),
        requestId: randomUUID(), afterSummary: { code, title, items: items.length, high: byPriority[0], medium: byPriority[1], low: byPriority[2], backup: backupPath ?? null },
      },
    });
    return created;
  });
  console.log(`Created stock count task ${task.id} (${code}) with ${items.length} items`);
} finally {
  await prisma.onModuleDestroy();
}
