import '../src/config/environment.js';
import { MoniConfigService } from '../src/pos/config/moni-config.service.js';
import { MoniSignatureService } from '../src/pos/adapters/moni/moni-signature.service.js';
import { MoniHttpClient } from '../src/pos/adapters/moni/moni-http-client.js';
import { MoniAuthService } from '../src/pos/adapters/moni/moni-auth.service.js';
import { MoniProductGateway } from '../src/pos/adapters/moni/moni-product.gateway.js';

interface ProductListData {
  list?: unknown;
}

function priceFields(value: unknown, prefix = ''): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const result: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (/price|level/i.test(key)) {
      result[path] = child && typeof child === 'object'
        ? Array.isArray(child) ? `[array:${child.length}]` : '[object]'
        : child;
    }
    if (child && typeof child === 'object' && !Array.isArray(child)) {
      Object.assign(result, priceFields(child, path));
    }
  }
  return result;
}

const config = new MoniConfigService();
const signature = new MoniSignatureService(config);
const http = new MoniHttpClient(config, signature);
const auth = new MoniAuthService(config, http);
const products = new MoniProductGateway(config, auth, http);

try {
  const login = await auth.ensureLoggedIn();
  const data = await http.postReadOnly<ProductListData>('Webretailitem/itemList', {
    shop_id: login.shopId,
    store_id: config.requireStoreId(),
    login_token: login.loginToken,
    page_num: 1,
  });
  if (!Array.isArray(data.list) || !data.list.length) throw new Error('商品列表为空');
  const records = data.list.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'));
  const firstPage = await products.listPage(1);
  const pageRecords: Record<string, unknown>[] = [...records];
  for (let pageNum = 2; pageNum <= firstPage.pageTotal; pageNum += 1) {
    const page = await http.postReadOnly<ProductListData>('Webretailitem/itemList', {
      shop_id: login.shopId,
      store_id: config.requireStoreId(),
      login_token: login.loginToken,
      page_num: pageNum,
    });
    if (Array.isArray(page.list)) {
      pageRecords.push(...page.list.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object')));
    }
  }
  const withPriceBook = pageRecords.filter((record) => Array.isArray(record.price_book) && record.price_book.length > 0);
  console.log(JSON.stringify({
    ok: true,
    recordKeys: [...new Set(records.flatMap((record) => Object.keys(record)))].sort(),
    priceFieldSamples: records.slice(0, 5).map((record) => priceFields(record)),
    scannedProducts: pageRecords.length,
    productsWithPriceBook: withPriceBook.length,
    priceBookSamples: withPriceBook.slice(0, 10).map((record) => ({
      item_id: record.item_id,
      item_name: record.item_name,
      item_price: record.item_price,
      price_book: record.price_book,
    })),
    note: '只读检查字段，未修改POS或本地数据库',
  }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : 'Unknown error' }));
  process.exitCode = 1;
}
