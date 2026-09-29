import '../src/config/environment.js';
import { MoniConfigService } from '../src/pos/config/moni-config.service.js';
import { MoniSignatureService } from '../src/pos/adapters/moni/moni-signature.service.js';
import { MoniHttpClient } from '../src/pos/adapters/moni/moni-http-client.js';
import { MoniAuthService } from '../src/pos/adapters/moni/moni-auth.service.js';
import { MoniProductGateway } from '../src/pos/adapters/moni/moni-product.gateway.js';
import { MoniOrderGateway } from '../src/pos/adapters/moni/moni-order.gateway.js';

const TARGET_DATE = process.argv.slice(2).find((value) => /^\d{4}-\d{2}-\d{2}$/.test(value))
  ?? '2026-08-20';
if (!/^\d{4}-\d{2}-\d{2}$/.test(TARGET_DATE)) {
  throw new RangeError('Date must use YYYY-MM-DD format');
}

const config = new MoniConfigService();
const signature = new MoniSignatureService(config);
const http = new MoniHttpClient(config, signature);
const auth = new MoniAuthService(config, http);
const products = new MoniProductGateway(config, auth, http);
const orders = new MoniOrderGateway(config, auth, http);

try {
  const productList = await products.listAll();
  const productById = new Map(
    productList.flatMap((product) =>
      product.externalProductId ? [[product.externalProductId, product] as const] : [],
    ),
  );
  const orderList = await orders.listAll(TARGET_DATE, TARGET_DATE);
  const details = [];
  for (const order of orderList) details.push(await orders.getDetail(order.orderNo));
  const lines = details.flatMap((detail) => detail.items);
  const statusCounts = orderList.reduce<Record<string, number>>((counts, order) => {
    const status = order.status ?? 'unknown';
    counts[status] = (counts[status] ?? 0) + 1;
    return counts;
  }, {});
  const unmatched = lines.filter((line) => !productById.has(line.externalProductId));
  const withoutBarcode = lines.filter((line) => {
    const product = productById.get(line.externalProductId);
    return product && !product.barcode;
  });
  const aggregateExceptions = (exceptionLines: typeof lines) => [
    ...exceptionLines.reduce((groups, line) => {
      const key = `${line.externalProductId}\u0000${line.name ?? ''}`;
      const current = groups.get(key) ?? {
        foodId: line.externalProductId,
        name: line.name,
        occurrences: 0,
        quantityTotal: 0,
      };
      current.occurrences += 1;
      current.quantityTotal += line.quantity;
      groups.set(key, current);
      return groups;
    }, new Map<string, {
      foodId: string;
      name: string | null;
      occurrences: number;
      quantityTotal: number;
    }>()).values(),
  ];

  console.log(JSON.stringify({
    ok: true,
    date: TARGET_DATE,
    orders: {
      total: orderList.length,
      statusCounts,
      detailsChecked: details.length,
    },
    sales: {
      lineCount: lines.length,
      quantityTotal: lines.reduce((sum, line) => sum + line.quantity, 0),
    },
    mapping: {
      matched: lines.length - unmatched.length,
      unmatched: unmatched.length,
      withoutBarcode: withoutBarcode.length,
      matchRate: lines.length
        ? Number((((lines.length - unmatched.length) / lines.length) * 100).toFixed(2))
        : null,
    },
    exceptions: {
      unmatched: aggregateExceptions(unmatched),
      noBarcode: aggregateExceptions(withoutBarcode),
    },
  }, null, 2));
} catch (error) {
  console.error(JSON.stringify({
    ok: false,
    error: error instanceof Error ? error.message : 'Unknown Moni error',
  }));
  process.exitCode = 1;
}
