import '../src/config/environment.js';
import { PrismaService } from '../src/database/prisma.service.js';
import { MoniConfigService } from '../src/pos/config/moni-config.service.js';
import { MoniSignatureService } from '../src/pos/adapters/moni/moni-signature.service.js';
import { MoniHttpClient } from '../src/pos/adapters/moni/moni-http-client.js';
import { MoniAuthService } from '../src/pos/adapters/moni/moni-auth.service.js';
import { MoniProductGateway } from '../src/pos/adapters/moni/moni-product.gateway.js';
import { MoniOrderGateway } from '../src/pos/adapters/moni/moni-order.gateway.js';
import { PosObservationService } from '../src/pos/application/pos-observation.service.js';
import { PosInventorySimulationService } from '../src/pos/application/pos-inventory-simulation.service.js';

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
if (!testDatabaseUrl) throw new Error('TEST_DATABASE_URL is required');

const databaseName = new URL(testDatabaseUrl).pathname.replace(/^\/+/, '');
if (!databaseName.endsWith('_test')) {
  throw new Error('POS simulation may only use a database ending in _test');
}
process.env.DATABASE_URL = testDatabaseUrl;

const once = process.argv.includes('--once');
const requestedReconciliation = process.argv
  .find((argument) => argument.startsWith('--reconcile='))
  ?.split('=')[1];
const refreshProducts =
  process.argv.includes('--refresh-products') || (!once && !requestedReconciliation);
if (requestedReconciliation && !/^\d{4}-\d{2}-\d{2}$/.test(requestedReconciliation)) {
  throw new Error('--reconcile must use YYYY-MM-DD');
}

const intervalMs = Number(process.env.POS_SIMULATION_INTERVAL_MS ?? '60000');
if (!Number.isInteger(intervalMs) || intervalMs < 10_000) {
  throw new Error('POS_SIMULATION_INTERVAL_MS must be an integer of at least 10000');
}

function aucklandDateParts(now = new Date()): {
  date: string;
  hour: number;
  minute: number;
} {
  const parts = new Intl.DateTimeFormat('en-NZ', {
    timeZone: 'Pacific/Auckland',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const value = (name: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === name)?.value ?? '';

  return {
    date: `${value('year')}-${value('month')}-${value('day')}`,
    hour: Number(value('hour')),
    minute: Number(value('minute')),
  };
}

function previousDate(date: string): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() - 1);
  return value.toISOString().slice(0, 10);
}

const config = new MoniConfigService();
const signature = new MoniSignatureService(config);
const http = new MoniHttpClient(config, signature);
const auth = new MoniAuthService(config, http);
const products = new MoniProductGateway(config, auth, http);
const orders = new MoniOrderGateway(config, auth, http);
const prisma = new PrismaService();
const observation = new PosObservationService(prisma, products, orders);
const inventorySimulation = new PosInventorySimulationService(prisma);

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

  if (refreshProducts) {
    const mappingImport = await observation.importProductMappings(
      organization.id,
      store.id,
    );
    console.log(JSON.stringify({ event: 'mapping-refresh', databaseName, mappingImport }));
  }

  let running = false;
  let firstSynchronization = true;
  let lastReconciledDate: string | null = null;
  const synchronize = async (): Promise<void> => {
    if (running) {
      console.log(JSON.stringify({ event: 'sync-skipped', reason: 'previous-run-active' }));
      return;
    }

    running = true;
    try {
      const now = aucklandDateParts();
      const reconciliationDate = requestedReconciliation ??
        (now.hour === 0 && now.minute >= 15 ? previousDate(now.date) : null);
      const shouldReconcile =
        reconciliationDate !== null && reconciliationDate !== lastReconciledDate;
      const date = shouldReconcile ? reconciliationDate : now.date;
      const result = await observation.observeOrders(
        organization.id,
        store.id,
        date,
        { reconcile: shouldReconcile },
      );
      if (shouldReconcile) lastReconciledDate = date;
      const shouldSimulateInventory =
        firstSynchronization || shouldReconcile || result.ordersProcessed > 0;
      const simulationResult = shouldSimulateInventory
        ? await inventorySimulation.simulateDate(
            organization.id,
            store.id,
            now.date,
            process.env.POS_SIMULATION_BASELINE_DATE ?? '2026-08-20',
          )
        : null;
      firstSynchronization = false;

      const stockWrites = {
        movements: await prisma.client.stockMovement.count({
          where: { organizationId: organization.id },
        }),
        balances: await prisma.client.inventoryBalance.count({
          where: { organizationId: organization.id },
        }),
      };
      console.log(JSON.stringify({
        event: shouldReconcile ? 'reconciliation-completed' : 'incremental-sync-completed',
        date,
        result,
        simulationResult,
        stockWrites,
      }));
    } catch (error) {
      console.error(JSON.stringify({
        event: 'sync-failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      }));
    } finally {
      running = false;
    }
  };

  await synchronize();
  if (!once && !requestedReconciliation) {
    console.log(JSON.stringify({ event: 'simulation-started', intervalMs }));
    const timer = setInterval(() => void synchronize(), intervalMs);
    await new Promise<void>((resolve) => {
      const stop = () => {
        clearInterval(timer);
        resolve();
      };
      process.once('SIGINT', stop);
      process.once('SIGTERM', stop);
    });
  }
} finally {
  await prisma.onModuleDestroy();
}
