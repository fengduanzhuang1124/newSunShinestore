import '../src/config/environment.js';
import { PrismaService } from '../src/database/prisma.service.js';
import { MoniConfigService } from '../src/pos/config/moni-config.service.js';
import { MoniSignatureService } from '../src/pos/adapters/moni/moni-signature.service.js';
import { MoniHttpClient } from '../src/pos/adapters/moni/moni-http-client.js';
import { MoniAuthService } from '../src/pos/adapters/moni/moni-auth.service.js';
import { MoniProductGateway } from '../src/pos/adapters/moni/moni-product.gateway.js';
import { MoniOrderGateway } from '../src/pos/adapters/moni/moni-order.gateway.js';
import { PosObservationService } from '../src/pos/application/pos-observation.service.js';

const dates = process.argv.slice(2).filter((value) => /^\d{4}-\d{2}-\d{2}$/.test(value));
if (dates.length === 0) dates.push('2026-08-20');

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
if (!testDatabaseUrl) throw new Error('TEST_DATABASE_URL is required');
const databaseName = new URL(testDatabaseUrl).pathname.replace(/^\/+/, '');
if (!databaseName.endsWith('_test')) {
  throw new Error('POS observation import may only use a database ending in _test');
}
process.env.DATABASE_URL = testDatabaseUrl;

const config = new MoniConfigService();
const signature = new MoniSignatureService(config);
const http = new MoniHttpClient(config, signature);
const auth = new MoniAuthService(config, http);
const products = new MoniProductGateway(config, auth, http);
const orders = new MoniOrderGateway(config, auth, http);
const prisma = new PrismaService();
const observation = new PosObservationService(prisma, products, orders);

await prisma.onModuleInit();
try {
  const organization = await prisma.client.organization.upsert({
    where: { code: 'POS-SIM-TEST' },
    create: { code: 'POS-SIM-TEST', name: 'POS Simulation Test' },
    update: { name: 'POS Simulation Test' },
  });
  const store = await prisma.client.store.upsert({
    where: {
      organizationId_code: {
        organizationId: organization.id,
        code: config.requireStoreId(),
      },
    },
    create: {
      organizationId: organization.id,
      code: config.requireStoreId(),
      name: 'Sunshine Health POS Test',
    },
    update: { name: 'Sunshine Health POS Test' },
  });

  const stockBefore = {
    movements: await prisma.client.stockMovement.count({
      where: { organizationId: organization.id },
    }),
    balances: await prisma.client.inventoryBalance.count({
      where: { organizationId: organization.id },
    }),
  };
  const mappingImport = await observation.importProductMappings(
    organization.id,
    store.id,
  );
  const orderObservations = [];
  for (const date of dates) {
    orderObservations.push({
      date,
      result: await observation.observeOrders(organization.id, store.id, date),
    });
  }
  const stockAfter = {
    movements: await prisma.client.stockMovement.count({
      where: { organizationId: organization.id },
    }),
    balances: await prisma.client.inventoryBalance.count({
      where: { organizationId: organization.id },
    }),
  };
  const dispositions = await prisma.client.posOrderItem.groupBy({
    by: ['disposition'],
    where: { order: { organizationId: organization.id } },
    _count: { _all: true },
  });

  console.log(JSON.stringify({
    ok: true,
    database: databaseName,
    dates,
    mappingImport,
    orderObservations,
    persisted: {
      mappings: await prisma.client.posProductMapping.count({ where: { storeId: store.id } }),
      orders: await prisma.client.posOrder.count({ where: { storeId: store.id } }),
      items: await prisma.client.posOrderItem.count({ where: { order: { storeId: store.id } } }),
      syncRuns: await prisma.client.posSyncRun.count({ where: { storeId: store.id } }),
      cursors: await prisma.client.posSyncCursor.count({ where: { storeId: store.id } }),
      dispositions,
    },
    inventoryUnchanged: {
      before: stockBefore,
      after: stockAfter,
      unchanged:
        stockBefore.movements === stockAfter.movements &&
        stockBefore.balances === stockAfter.balances,
    },
  }, null, 2));
} finally {
  await prisma.onModuleDestroy();
}
