// Merges duplicate records of one product into the record whose stock count is the truth (REQ-013 follow-up), for
// duplicates the same goods were counted under twice. Unlike merge-duplicate-products.ts the duplicates' stock is not
// added: it is zeroed with PRODUCT_MERGE movements, because the target's count already covers those units. Barcodes,
// POS mappings and sales lines move to the target (POS mappings follow barcode ownership, so the hourly refresh keeps
// them); the duplicates are deactivated. Without --execute it only prints the plan.
import '../src/config/environment.js';
import { existsSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../src/database/prisma.service.js';
import { mergeProductInto } from '../src/inventory/product-merge.js';

const value = (name: string) => process.argv.find((argument) => argument.startsWith(`--${name}=`))?.slice(name.length + 3);
const intoValue = value('into');
const fromValue = value('from');
const storeValue = value('store');
const userValue = value('user');
const reason = value('reason');
const backupPath = value('backup');
const execute = process.argv.includes('--execute');
if (!intoValue || !/^\d+$/.test(intoValue)) throw new Error('--into must be the product id whose count is kept');
if (!fromValue || !/^\d+(,\d+)*$/.test(fromValue)) throw new Error('--from must be comma-separated duplicate product ids');
if (!storeValue || !/^\d+$/.test(storeValue)) throw new Error('--store must be a positive integer');
if (!userValue || !/^\d+$/.test(userValue)) throw new Error('--user must be the id of the admin performing the merge');
if (!reason || reason.length > 200) throw new Error('--reason is required (at most 200 characters)');
if (execute && (!backupPath || !existsSync(backupPath))) throw new Error('--backup must point to the database backup taken before this merge');

const into = BigInt(intoValue);
const fromIds = [...new Set(fromValue.split(','))].map(BigInt);
if (fromIds.includes(into)) throw new Error('--from must not contain the --into product');

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

  const describe = async (id: bigint) => {
    const product = await db.product.findFirst({ where: { id, organizationId }, select: { id: true, name: true, status: true } });
    if (!product) throw new Error(`Product ${id} not found`);
    if (product.status !== 'ACTIVE') throw new Error(`Product ${id} is not active`);
    const [stock, barcodes, mappings, sales] = await Promise.all([
      db.inventoryBalance.aggregate({ where: { organizationId, warehouseId, productId: id }, _sum: { quantity: true } }),
      db.productBarcode.findMany({ where: { organizationId, productId: id }, select: { barcode: true } }),
      db.posProductMapping.count({ where: { organizationId, productId: id, status: 'ACTIVE' } }),
      db.posOrderItem.count({ where: { productId: id } }),
    ]);
    return { id: id.toString(), name: product.name, stock: stock._sum.quantity ?? 0, barcodes: barcodes.map((row) => row.barcode), posMappings: mappings, salesLines: sales };
  };
  const plan = { into: await describe(into), from: await Promise.all(fromIds.map(describe)), reason };
  console.log(JSON.stringify(plan, null, 2));
  if (!execute) {
    console.log('Dry run only: nothing written. Add --execute --backup=<file> to merge.');
  } else {
    const requestId = randomUUID();
    const result = await db.$transaction(async (tx) => {
      const summary = [];
      for (const fromId of fromIds) {
        summary.push(await mergeProductInto(tx, {
          organizationId, storeId, warehouseId, userId, intoProductId: into, fromProductId: fromId, stockMode: 'KEEP_TARGET',
          reason, requestId, action: 'product.merge_counted_duplicate', extraAudit: { backup: backupPath },
        }));
      }
      return summary;
    });
    console.log(JSON.stringify({ executed: true, requestId, result, into: await describe(into) }, null, 2));
  }
} finally {
  await prisma.onModuleDestroy();
}
