import '../src/config/environment.js';
import { PrismaService } from '../src/database/prisma.service.js';
import { MoniConfigService } from '../src/pos/config/moni-config.service.js';
import { PosInventorySimulationService } from '../src/pos/application/pos-inventory-simulation.service.js';

const date = process.argv.find((value) => /^\d{4}-\d{2}-\d{2}$/.test(value)) ??
  '2026-08-20';
const baselineDate = process.argv
  .find((value) => value.startsWith('--baseline='))
  ?.split('=')[1] ?? date;
const testDatabaseUrl = process.env.TEST_DATABASE_URL;
if (!testDatabaseUrl) throw new Error('TEST_DATABASE_URL is required');

const databaseName = new URL(testDatabaseUrl).pathname.replace(/^\/+/, '');
if (!databaseName.endsWith('_test')) {
  throw new Error('POS inventory simulation may only use a database ending in _test');
}
process.env.DATABASE_URL = testDatabaseUrl;

const config = new MoniConfigService();
const prisma = new PrismaService();
const simulationService = new PosInventorySimulationService(prisma);

await prisma.onModuleInit();
try {
  const organization = await prisma.client.organization.findUniqueOrThrow({
    where: { code: 'POS-SIM-TEST' },
  });
  const store = await prisma.client.store.findUniqueOrThrow({
    where: {
      organizationId_code: {
        organizationId: organization.id,
        code: config.requireStoreId(),
      },
    },
  });
  const inventoryBefore = {
    movements: await prisma.client.stockMovement.count({
      where: { organizationId: organization.id },
    }),
    balances: await prisma.client.inventoryBalance.count({
      where: { organizationId: organization.id },
    }),
  };

  const result = await simulationService.simulateDate(
    organization.id,
    store.id,
    date,
    baselineDate,
  );
  const inventoryAfter = {
    movements: await prisma.client.stockMovement.count({
      where: { organizationId: organization.id },
    }),
    balances: await prisma.client.inventoryBalance.count({
      where: { organizationId: organization.id },
    }),
  };
  const statusCounts = await prisma.client.posInventorySimulation.groupBy({
    by: ['status'],
    where: {
      storeId: store.id,
      order: {
        orderedAt: {
          gte: new Date(`${date}T00:00:00`),
          lt: new Date(`${date}T23:59:59.999`),
        },
      },
    },
    _count: { _all: true },
  });
  const orderInventoryStatuses = await prisma.client.posOrder.groupBy({
    by: ['inventoryStatus'],
    where: { storeId: store.id },
    _count: { _all: true },
  });
  const orderItemStatuses = await prisma.client.posOrderItem.groupBy({
    by: ['status'],
    where: { order: { storeId: store.id } },
    _count: { _all: true },
  });

  console.log(JSON.stringify({
    ok: true,
    databaseName,
    date,
    baselineDate,
    result,
    persisted: {
      simulations: await prisma.client.posInventorySimulation.count({
        where: { storeId: store.id },
      }),
      simulationItems: await prisma.client.posInventorySimulationItem.count({
        where: { simulation: { storeId: store.id } },
      }),
      statusCounts,
      orderInventoryStatuses,
      orderItemStatuses,
    },
    inventoryUnchanged: {
      before: inventoryBefore,
      after: inventoryAfter,
      unchanged:
        inventoryBefore.movements === inventoryAfter.movements &&
        inventoryBefore.balances === inventoryAfter.balances,
    },
  }, null, 2));
} finally {
  await prisma.onModuleDestroy();
}
