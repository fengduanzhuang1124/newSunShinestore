import '../src/config/environment.js';
import { writeFile } from 'node:fs/promises';
import { MoniConfigService } from '../src/pos/config/moni-config.service.js';
import { MoniSignatureService } from '../src/pos/adapters/moni/moni-signature.service.js';
import { MoniHttpClient } from '../src/pos/adapters/moni/moni-http-client.js';
import { MoniAuthService } from '../src/pos/adapters/moni/moni-auth.service.js';
import { MoniProductGateway } from '../src/pos/adapters/moni/moni-product.gateway.js';
import { MoniOrderGateway } from '../src/pos/adapters/moni/moni-order.gateway.js';

const argumentsList = process.argv.slice(2).filter((value) => value !== '--');
const startDate = argumentsList[0] ?? '2026-05-26';
const endDate = argumentsList[1] ?? '2026-08-27';
const outputPath = argumentsList[2] ?? '/private/tmp/moni-milk-orders-2026-05-26-to-2026-08-27.json';
if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
  throw new Error('Dates must use YYYY-MM-DD');
}

const brandRules = [
  { brand: 'Anchor', patterns: [/\banchor\b/i] },
  { brand: 'Taupo', patterns: [/\btaupo\b/i] },
  { brand: 'A2', patterns: [/\ba\s*2\b/i] },
  { brand: 'Healtheries Goat Powder', patterns: [/healtheries/i, /goat/i] },
  { brand: 'Diploma', patterns: [/\bdiploma\b/i] },
  { brand: 'The Pure', patterns: [/\bthe\s*pure\b/i, /\bthepure\b/i] },
  { brand: 'Karicare', patterns: [/\bkaricare\b/i] },
  { brand: 'Aptamil', patterns: [/\baptamil\b/i] },
  { brand: 'Abbott', patterns: [/\babbot+t\b/i] },
  { brand: "Bellamy's / Beilami", patterns: [/\bbellamy'?s?\b/i, /\bbeilami\b/i, /bei\s*la\s*mi/i, /贝拉米/] },
  { brand: 'Maxigenes / Mei Ke Zhuo', patterns: [/\bmaxigenes?\b/i, /mei\s*ke\s*zhuo/i, /美可卓/] },
] as const;
const milkPattern = /(\b\d+(?:\.\d+)?\s*(?:kg|g)\b|\bstage\s*\d+\b|\bstep\s*\d+\b|\b\d+\s*tins?\b|\bmilk\s*pow(?:der|er)\b|\bgoat\s*powder\b|\bformula\b|\binfant\b|\btoddler\b|\bjunior\b|\bgrowing\s*up\b|\bplatinum\b|\bgold\+?\b|\bpro\b|\bskim\b|\btrim\b)/i;

function identifyBrand(name: string): string | null {
  for (const rule of brandRules) {
    if (rule.patterns.every((pattern) => pattern.test(name))) return rule.brand;
  }
  return null;
}

const config = new MoniConfigService();
const signature = new MoniSignatureService(config);
const http = new MoniHttpClient(config, signature);
const auth = new MoniAuthService(config, http);
const products = new MoniProductGateway(config, auth, http);
const orders = new MoniOrderGateway(config, auth, http);

const productList = await products.listAll();
const productById = new Map(
  productList.flatMap((product) =>
    product.externalProductId ? [[product.externalProductId, product] as const] : []),
);
const orderList = await orders.listAll(startDate, endDate);
console.log(JSON.stringify({ event: 'orders-listed', total: orderList.length, startDate, endDate }));

const matchedLines: Array<Record<string, unknown>> = [];
const reviewCandidates: Array<Record<string, unknown>> = [];
const matchingOrders = new Map<string, Record<string, unknown>>();
const failedOrders: Array<{ orderNo: string; error: string }> = [];
let detailsChecked = 0;

async function getOrderDetailWithRetry(orderNo: string) {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      return await orders.getDetail(orderNo);
    } catch (error) {
      lastError = error;
      if (attempt < 4) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 500));
      }
    }
  }
  failedOrders.push({
    orderNo,
    error: lastError instanceof Error ? lastError.message : String(lastError),
  });
  return null;
}

for (let offset = 0; offset < orderList.length; offset += 3) {
  const batch = orderList.slice(offset, offset + 3);
  const detailResults = await Promise.all(
    batch.map((order) => getOrderDetailWithRetry(order.orderNo)),
  );
  const details = detailResults.filter((detail) => detail !== null);
  for (const detail of details) {
    const orderMatches: Array<Record<string, unknown>> = [];
    for (const item of detail.items) {
      const product = productById.get(item.externalProductId);
      const name = item.name ?? product?.name ?? '';
      const brand = identifyBrand(name);
      if (!brand) continue;
      const record = {
        orderNo: detail.orderNo,
        orderDate: detail.date,
        orderStatus: detail.status,
        brand,
        externalProductId: item.externalProductId,
        sku: product?.sku ?? null,
        barcode: product?.barcode ?? null,
        productName: name,
        quantity: item.quantity,
        unitPrice: item.price,
        lineAmount: item.price === null ? null : Number((item.quantity * item.price).toFixed(2)),
        orderAmount: detail.orderAmount,
        refundAmount: detail.refundAmount,
        isMinus: item.isMinus,
      };
      if (milkPattern.test(name)) {
        matchedLines.push(record);
        orderMatches.push(record);
      } else {
        reviewCandidates.push({ ...record, reviewReason: 'Brand matched but milk-powder marker was not found' });
      }
    }
    if (orderMatches.length > 0) {
      const brands = [...new Set(orderMatches.map((line) => String(line.brand)))];
      matchingOrders.set(detail.orderNo, {
        orderNo: detail.orderNo,
        orderDate: detail.date,
        orderStatus: detail.status,
        brands: brands.join(', '),
        matchingLineCount: orderMatches.length,
        matchingQuantity: orderMatches.reduce((sum, line) => sum + Number(line.quantity), 0),
        milkPowderAmount: Number(orderMatches.reduce((sum, line) => sum + Number(line.lineAmount ?? 0), 0).toFixed(2)),
        orderAmount: detail.orderAmount,
        refundAmount: detail.refundAmount,
        orderNetAmount:
          detail.orderAmount === null
            ? null
            : Number((detail.orderAmount - (detail.refundAmount ?? 0)).toFixed(2)),
        productSummary: orderMatches
          .map((line) => `${line.productName} × ${line.quantity}`)
          .join(' | '),
      });
    }
  }
  detailsChecked += batch.length;
  if (detailsChecked % 99 === 0 || detailsChecked === orderList.length) {
    console.log(JSON.stringify({
      event: 'details-progress',
      detailsChecked,
      total: orderList.length,
      matchedOrders: matchingOrders.size,
      matchedLines: matchedLines.length,
      failedOrders: failedOrders.length,
    }));
  }
}

const result = {
  generatedAt: new Date().toISOString(),
  period: { startDate, endDate },
  source: 'Moni Back Office API (read-only)',
  brandRules: brandRules.map(({ brand }) => brand),
  counts: {
    allOrdersChecked: orderList.length,
    matchingOrders: matchingOrders.size,
    matchingLines: matchedLines.length,
    reviewCandidates: reviewCandidates.length,
    failedOrders: failedOrders.length,
  },
  orders: [...matchingOrders.values()],
  lines: matchedLines,
  reviewCandidates,
  failedOrders,
};
await writeFile(outputPath, JSON.stringify(result, null, 2), 'utf8');
console.log(JSON.stringify({ event: 'completed', outputPath, counts: result.counts }));
