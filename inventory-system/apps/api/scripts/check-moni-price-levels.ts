import '../src/config/environment.js';
import { MoniConfigService } from '../src/pos/config/moni-config.service.js';
import { MoniSignatureService } from '../src/pos/adapters/moni/moni-signature.service.js';
import { MoniHttpClient } from '../src/pos/adapters/moni/moni-http-client.js';
import { MoniAuthService } from '../src/pos/adapters/moni/moni-auth.service.js';

const config = new MoniConfigService();
const signature = new MoniSignatureService(config);
const http = new MoniHttpClient(config, signature);
const auth = new MoniAuthService(config, http);

try {
  const login = await auth.ensureLoggedIn();
  const parameters = {
    shop_id: login.shopId,
    store_id: config.requireStoreId(),
    login_token: login.loginToken,
  };
  const data = await http.postReadOnly<{ list?: Array<Record<string, unknown>> }>(
    'Webretailpricelevel/retailPriceBookList',
    parameters,
  );
  const level4 = data.list?.find((item) => String(item.price_name).trim().toLowerCase() === 'level 4');
  if (!level4?.price_id) throw new Error('没有找到Level 4价格等级');
  const priceId = String(level4.price_id);
  const detail = await http.postReadOnly<unknown>(
    'Webretailpricelevel/retailPriceBookDetail',
    { ...parameters, price_id: priceId },
  );
  const appliedItems: Array<Record<string, unknown>> = [];
  let pageNum = 1;
  let hasMore = true;
  while (hasMore && pageNum <= 1_000) {
    const page = await http.postReadOnly<{ list?: Array<Record<string, unknown>>; has_more?: unknown }>(
      'Webretailpricelevel/retailPriceBookApplyItems',
      { ...parameters, price_id: priceId, page_num: pageNum },
    );
    if (!Array.isArray(page.list)) throw new Error('Level 4商品列表格式错误');
    appliedItems.push(...page.list);
    hasMore = String(page.has_more) === '1';
    pageNum += 1;
  }
  if (hasMore) throw new Error('Level 4分页超过安全上限');
  const prices = appliedItems
    .map((item) => Number(item.tier_price))
    .filter((value) => Number.isFinite(value));
  console.log(JSON.stringify({
    ok: true,
    level4,
    detail,
    appliedItems: {
      total: appliedItems.length,
      pages: pageNum - 1,
      withBarcode: appliedItems.filter((item) => String(item.barcode || '').trim()).length,
      zeroPrice: prices.filter((price) => price === 0).length,
      minimumPrice: prices.length ? Math.min(...prices) : null,
      maximumPrice: prices.length ? Math.max(...prices) : null,
      samples: appliedItems.slice(0, 5),
    },
    note: '只读获取价格等级列表，未修改POS或本地数据库',
  }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : 'Unknown error' }));
  process.exitCode = 1;
}
