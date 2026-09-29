import '../src/config/environment.js';
import { MoniConfigService } from '../src/pos/config/moni-config.service.js';
import { MoniSignatureService } from '../src/pos/adapters/moni/moni-signature.service.js';
import { MoniHttpClient } from '../src/pos/adapters/moni/moni-http-client.js';
import { MoniAuthService } from '../src/pos/adapters/moni/moni-auth.service.js';
import { MoniProductGateway } from '../src/pos/adapters/moni/moni-product.gateway.js';
import { MoniOrderGateway } from '../src/pos/adapters/moni/moni-order.gateway.js';

const config = new MoniConfigService();
const signature = new MoniSignatureService(config);
const http = new MoniHttpClient(config, signature);
const auth = new MoniAuthService(config, http);
const products = new MoniProductGateway(config, auth, http);
const orders = new MoniOrderGateway(config, auth, http);

const end = new Date();
const start = new Date(end);
start.setDate(start.getDate() - 30);
const date = (value: Date) => value.toISOString().slice(0, 10);

try {
  const productList = await products.listAll();
  const productById = new Map(
    productList.flatMap((product) =>
      product.externalProductId ? [[product.externalProductId, product] as const] : [],
    ),
  );
  const orderList = await orders.listPaidPage(date(start), date(end));
  const details = [];
  for (const order of orderList.slice(0, 10)) details.push(await orders.getDetail(order.orderNo));
  const lines = details.flatMap((detail) => detail.items);
  const matched = lines.filter((line) => productById.has(line.externalProductId));
  const matchedEligible = matched.filter((line) => productById.get(line.externalProductId)?.barcode);

  console.log(JSON.stringify({
    ok: true,
    period: { start: date(start), end: date(end) },
    products: {
      total: productList.length,
      withExternalId: productById.size,
      eligibleWithBarcode: productList.filter(({ barcode }) => barcode).length,
    },
    orders: { returned: orderList.length, detailsChecked: details.length, linesChecked: lines.length },
    mapping: {
      matched: matched.length,
      matchedEligible: matchedEligible.length,
      unmatched: lines.length - matched.length,
      matchRate: lines.length ? Number((matched.length / lines.length * 100).toFixed(2)) : null,
    },
    safeSamples: lines.slice(0, 10).map((line) => ({
      foodId: line.externalProductId,
      matched: productById.has(line.externalProductId),
      hasBarcode: Boolean(productById.get(line.externalProductId)?.barcode),
      quantity: line.quantity,
    })),
  }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : 'Unknown Moni error' }));
  process.exitCode = 1;
}
