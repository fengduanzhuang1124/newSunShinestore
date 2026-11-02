import '../src/config/environment.js';
import { PrismaService } from '../src/database/prisma.service.js';
import { PosInventoryApplicationService } from '../src/pos/application/pos-inventory-application.service.js';

const value = (name: string) => process.argv
  .find((argument) => argument.startsWith(`--${name}=`))
  ?.slice(name.length + 3);

const storeValue = value('store');
const username = value('username');
const fromValue = value('from') ?? process.env.POS_INVENTORY_BASELINE_AT;
const toValue = value('to');
const confirmation = value('confirm');

if (!storeValue || !/^\d+$/.test(storeValue)) throw new Error('--store must be a positive integer');
if (!username) throw new Error('--username is required for the audit trail');
if (!fromValue || Number.isNaN(new Date(fromValue).getTime())) throw new Error('--from must be an ISO timestamp');
if (!toValue || Number.isNaN(new Date(toValue).getTime())) throw new Error('--to must be an ISO timestamp');
if (confirmation !== 'APPLY_SAFE_POS_SALES') throw new Error('--confirm=APPLY_SAFE_POS_SALES is required');

const storeId = BigInt(storeValue);
const prisma = new PrismaService();
await prisma.onModuleInit();
try {
  const store = await prisma.client.store.findUniqueOrThrow({
    where: { id: storeId },
    select: { organizationId: true, name: true },
  });
  const actor = await prisma.client.user.findFirst({
    where: {
      organizationId: store.organizationId,
      username,
      status: 'ACTIVE',
      storeRoles: { some: { storeId } },
    },
    select: { id: true, username: true, displayName: true },
  });
  if (!actor) throw new Error(`Active user ${username} does not have a role for store ${storeValue}`);

  const service = new PosInventoryApplicationService(prisma);
  const from = new Date(fromValue);
  const to = new Date(toValue);
  const preview = await service.previewRange(store.organizationId, storeId, from, to);
  const inventoryBefore = await prisma.client.inventoryBalance.aggregate({
    where: { organizationId: store.organizationId, warehouse: { storeId, status: 'ACTIVE' } },
    _sum: { quantity: true },
  });
  const result = await service.applyRange(store.organizationId, actor.id, storeId, from, to);
  const inventoryAfter = await prisma.client.inventoryBalance.aggregate({
    where: { organizationId: store.organizationId, warehouse: { storeId, status: 'ACTIVE' } },
    _sum: { quantity: true },
  });

  console.log(JSON.stringify({
    store: { id: storeValue, name: store.name },
    actor: { id: actor.id.toString(), username: actor.username, displayName: actor.displayName },
    preview: preview.summary,
    applied: result.summary,
    inventory: {
      before: inventoryBefore._sum.quantity ?? 0,
      after: inventoryAfter._sum.quantity ?? 0,
      change: (inventoryAfter._sum.quantity ?? 0) - (inventoryBefore._sum.quantity ?? 0),
    },
  }, null, 2));
} finally {
  await prisma.onModuleDestroy();
}
