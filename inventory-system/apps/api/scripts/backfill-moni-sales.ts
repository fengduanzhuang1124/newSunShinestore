import '../src/config/environment.js';
import { PrismaService } from '../src/database/prisma.service.js';
import { MoniConfigService } from '../src/pos/config/moni-config.service.js';
import { MoniSignatureService } from '../src/pos/adapters/moni/moni-signature.service.js';
import { MoniHttpClient } from '../src/pos/adapters/moni/moni-http-client.js';
import { MoniAuthService } from '../src/pos/adapters/moni/moni-auth.service.js';
import { MoniProductGateway } from '../src/pos/adapters/moni/moni-product.gateway.js';
import { MoniOrderGateway } from '../src/pos/adapters/moni/moni-order.gateway.js';
import { PosObservationService } from '../src/pos/application/pos-observation.service.js';

function argument(name: string) {
  const prefix = `--${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length);
}

function calendarDate(value: string | undefined, name: string) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`${name} must use YYYY-MM-DD`);
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw new Error(`${name} is not a calendar date`);
  return date;
}

function isoDate(value: Date) { return value.toISOString().slice(0, 10); }

const from = calendarDate(argument('from'), 'from');
const to = calendarDate(argument('to'), 'to');
if (from > to) throw new Error('from cannot be later than to');
if (!process.argv.includes('--confirm-live')) throw new Error('Refusing to write without --confirm-live');

const prisma = new PrismaService();
const config = new MoniConfigService();
const signature = new MoniSignatureService(config);
const http = new MoniHttpClient(config, signature);
const auth = new MoniAuthService(config, http);
const products = new MoniProductGateway(config, auth, http);
const orders = new MoniOrderGateway(config, auth, http);
const observation = new PosObservationService(prisma, products, orders);

await prisma.onModuleInit();
try {
  const requestedStoreId = argument('store-id');
  if (requestedStoreId && !/^\d+$/.test(requestedStoreId)) throw new Error('store-id must be numeric');
  const store = await prisma.client.store.findFirstOrThrow({
    where: { ...(requestedStoreId ? { id: BigInt(requestedStoreId) } : {}), status: 'ACTIVE' },
    orderBy: { id: 'asc' },
  });
  if (!process.argv.includes('--skip-mapping')) {
    const mapping = await observation.importProductMappings(store.organizationId, store.id);
    console.log(JSON.stringify({ phase: 'mapping', storeId: store.id.toString(), ...mapping }));
  }

  let days = 0;
  let ordersObserved = 0;
  let ordersProcessed = 0;
  let itemsObserved = 0;
  for (const cursor = new Date(from); cursor <= to; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    const date = isoDate(cursor);
    const result = await observation.observeOrders(store.organizationId, store.id, date, { reconcile: true });
    days += 1;
    ordersObserved += result.orders;
    ordersProcessed += result.ordersProcessed;
    itemsObserved += result.items;
    console.log(JSON.stringify({ phase: 'orders', date, day: days, ...result }));
  }
  console.log(JSON.stringify({ ok: true, from: isoDate(from), to: isoDate(to), days, ordersObserved, ordersProcessed, itemsObserved }));
} finally {
  await prisma.onModuleDestroy();
}
