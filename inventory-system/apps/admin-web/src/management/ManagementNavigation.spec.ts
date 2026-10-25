import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ManagementDashboard from './ManagementDashboard.vue';

// Test-only API fixtures. Production continues to read the existing API.
const capabilities = { overviewView: true, salesView: true, inventoryView: true, posSync: true, posIssues: true, permissionsManage: true };
const salesSummary = { revenue: 100, refunds: 0, netRevenue: 100, orderCount: 2, unitsSold: 3, averageOrderValue: 50, dailySales: [{ date: '2026-09-01', revenue: 100, orders: 2 }], topProducts: Array.from({ length: 8 }, (_, i) => ({ productName: `商品${i}`, brandName: '品牌', quantity: 1, revenue: 10 })), topBrands: [] };
const overview = {
  store: { id: '1', name: '测试门店' }, currency: 'NZD', period: { date: '2026-09-28', previousDate: '2026-09-27' }, salesAvailable: true, lastPosSyncAt: null,
  sales: { current: salesSummary, previous: salesSummary, comparison: { netRevenuePercent: null, orderCountPercent: null, unitsSoldPercent: null, averageOrderValuePercent: null } },
  inventory: { totalQuantity: 20, productCount: 2, batchCount: 3, expiryAttentionQuantity: 1, expiry: { expired: 1, urgent: 0, warning: 0, early: 0 }, activity: { movementCountToday: 4, stocktakeAdjustmentsToday: 0, openReceiptCount: 1, latestMovement: null } },
};
const foundation = { generatedAt: '2026-10-01T00:00:00Z', overallStatus: 'PARTIALLY_READY', quality: { inventory: { productCount: 2, latestUpdatedAt: null }, catalog: { productCount: 3, brandCoveragePercent: 0, categoryCoveragePercent: 0, barcodeCoveragePercent: 100, sellingPriceCoveragePercent: 100, minimumStockCoveragePercent: 0 }, sales: { mappingCoveragePercent: 50, mappedOrderItemCount: 1, orderItemCount: 2 } }, domains: [] };
const product = { productId: '1', productName: '商品A', sku: 'A', brandName: '品牌A', categoryName: '奶粉', barcode: null, unitsSold: 2, salesRevenue: 100, currentInventory: 20, minimumStock: null, salesToStockRatio: .1, stockStatus: 'IN_STOCK' };
const inventoryProduct = { ...product, soldUnits: 2, dailyVelocity: .02, coverageDays: 900, daysSinceLastSale: 2, slowMoving: true };
const fixtures: Record<string, unknown> = {
  'overview': overview,
  'data-foundation': foundation,
  'products-brands': { period: { from: '2026-10-01', to: '2026-10-06' }, summary: { productCount: 1, soldProductCount: 1, unitsSold: 2, salesRevenue: 100, currentInventory: 20, lowStockProducts: 0 }, products: [product], brands: [{ name: '品牌A', productCount: 1, unitsSold: 2, salesRevenue: 100, currentInventory: 20 }], categories: [{ name: '奶粉', productCount: 1, unitsSold: 2, salesRevenue: 100, currentInventory: 20 }], marginAvailable: false, marginNotice: '无确认成本' },
  'sales-analysis': { period: { from: '2026-09-01', to: '2026-09-30', previousFrom: '2026-08-02', previousTo: '2026-08-31' }, dataAvailable: true, metrics: { netRevenue: 100, grossRevenue: 100, refunds: 0, orderCount: 2, unitsSold: 2, averageOrderValue: 50 }, comparison: overview.sales.comparison, trend: [{ period: '2026-09-01', revenue: 100 }], hourlySales: [], topProducts: salesSummary.topProducts, topBrands: [], sourceQuality: { orders: 2, activeItems: 2, mappedItems: 1, reviewRequiredItems: 1 } },
  'inventory-operations': { period: { lookbackDays: 90, from: '2026-07-01', to: '2026-10-01' }, salesCoverage: { observedDays: 90, reliable: true, firstObservedSaleAt: '2026-07-01T00:00:00Z', lastObservedSaleAt: '2026-10-01T00:00:00Z', minimumReliableDays: 30 }, summary: { totalInventory: 20, stockedProducts: 1, outOfStockProducts: 0, lowStockProducts: 0, slowMovingProducts: 1, productCount: 1 }, products: [inventoryProduct], coverageBuckets: { noSales: 0, under30: 0, days30To90: 0, over90: 1 }, alerts: [], slowMoving: [inventoryProduct], turnoverNotice: '不可计算周转率', coverageNotice: '仅按已同步订单估算' },
  'product-insight-tags': { disclaimer: '不代表购买者真实身份', coverage: { productCount: 1, approvedProducts: 0, pendingProducts: 0, untaggedProducts: 1, approvedCoveragePercent: 0 }, tags: [{ id: 't1', code: 'milk', name: '奶粉', dimension: 'BUSINESS_CATEGORY', parentId: null, status: 'ACTIVE', sortOrder: 1 }], tagTree: [{ id: 't1', code: 'milk', name: '奶粉', dimension: 'BUSINESS_CATEGORY', children: [], status: 'ACTIVE', sortOrder: 1 }], dimensions: [{ code: 'BUSINESS_CATEGORY', name: '商品分类' }], products: [{ ...product, assignments: [] }] },
  'pos-sync/check': { checkedAt: null, readiness: 'NEEDS_REVIEW', orders: { total: 2, lastOrderedAt: null }, items: { mappingCoveragePercent: 50, mapped: 1, total: 2 }, issues: { total: 1 }, checks: [] },
  'pos-sync/status': { running: false, latestRun: null, cursor: null, history: [] },
  'pos-mapping/unlisted-stock': { products: [{ productId: '3734', sku: 'LOCAL-1', productName: '8分钟Pro Xylane玻色因细胞焕活精华液', englishName: null, barcodes: ['9421907711157'], stock: 240, createdAt: '2026-10-20T00:00:00.000Z' }], totalUnits: 240 },
  'pos-inventory/review-lines': { lines: [
    { itemId: '501', orderNo: 'RO-1', orderedAt: '2026-10-21T01:00:00.000Z', sourceName: 'alpine hand cream', productId: '40', productName: 'alpine 蜂蜜护手霜', reason: 'INSUFFICIENT_INVENTORY', required: 2, applied: 0, remaining: 2, availableStock: 12, canReapply: true },
    { itemId: '502', orderNo: 'RO-2', orderedAt: '2026-10-21T02:00:00.000Z', sourceName: 'careline', productId: null, productName: null, reason: 'UNMAPPED', required: 1, applied: 0, remaining: 1, availableStock: 0, canReapply: false },
  ] },
  'pos-sync/issues': { summary: { itemIssues: 0, pendingRefunds: 0 }, itemIssues: { items: [], pagination: { total: 0 } }, pendingRefunds: { items: [] } },
  'pos-inventory/preview': { mode: 'PREVIEW', period: { from: '2026-10-12T05:15:22.401Z', toExclusive: '2026-10-17T11:00:00.000Z' }, summary: { ordersScanned: 178, eligibleOrders: 105, unitsPlanned: 455, reviewRequiredOrders: 6, blockedOrders: 0, reviewLines: 73, shortfallUnits: 12 }, issues: [{ orderId: '9', orderNo: 'POS-9', reason: 'INSUFFICIENT_INVENTORY', itemId: '90', productId: '33', required: 4, available: 0 }] },
  'store-comparison': { storeCount: 1, comparisonAvailable: false, period: { from: '2026-10-01', to: '2026-10-06' }, stores: [{ store: { id: '1', name: '测试门店', code: 'ONE' }, selected: true, sales: salesSummary, inventory: { totalQuantity: 20, outOfStockProducts: 0, lowStockProducts: 0 } }], ranking: { byRevenue: [], byOrders: [], byInventory: [] } },
  'purchase-suggestions': (() => {
    const base = { sku: 'S', barcode: null, brandName: '品牌A', categoryName: '保健品', minimumStock: null, targetWeeks: 6, source: 'WEEKLY_FORECAST', priority: 'THIS_WEEK', alreadyIncluded: false, ignored: false, ignoredReason: null, ignoredAt: null };
    return { generatedAt: '2026-10-25T00:00:00Z', inventoryLatestUpdatedAt: null, period: { from: '2026-09-27', to: '2026-10-25' }, calculation: '按近28天销量折算周销', summary: { products: 2, suggestedUnits: 20, thisWeekProducts: 2, followUpProducts: 0, alreadyIncluded: 0, ignored: 0 },
      suggestions: [
        { ...base, productId: '11', productName: '高之源白瓶', currentInventory: 0, recent28DayQty: 8, weeklyVelocity: 2, coverageWeeks: 0, targetInventory: 12, suggestedQuantity: 12, salesBasis: '90_DAYS' },
        { ...base, productId: '12', productName: '科立纯妇科益生菌', currentInventory: 4, recent28DayQty: 8, weeklyVelocity: 2, coverageWeeks: 2, targetInventory: 12, suggestedQuantity: 8, recentReceivedQty: 4, salesBasis: '28_DAYS', mergedProducts: [{ productId: '12', productName: '科立纯妇科益生菌', barcode: '1', currentInventory: 4, recent28DayQty: 8 }, { productId: '13', productName: '科立纯 妇科益生菌', barcode: '2', currentInventory: 0, recent28DayQty: 0 }] },
      ], ignoredSuggestions: [] };
  })(),
  'purchase-orders/current': { order: null },
};

function setup(options: { failPos?: boolean; limited?: boolean; multipleStores?: boolean } = {}) {
  const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const path = String(input).split('/management/')[1]?.split('?')[0];
    if (options.failPos && path?.startsWith('pos-sync/')) return new Response(JSON.stringify({ message: 'POS 状态读取失败' }), { status: 500 });
    const data = path === 'access' ? { administrator: !options.limited, roleCodes: ['ADMIN'], capabilities: options.limited ? { ...capabilities, posSync: false, posIssues: false, permissionsManage: false } : capabilities, grantedPermissionCodes: [] }
      : path === 'pos-inventory/review-lines/reapply' ? { lines: 1, completed: 1, stillShort: 0, unitsApplied: 2, skipped: [] }
      : path === 'pos-sync/run' ? { result: { orders: 2, ordersProcessed: 2, ordersSkipped: 0, items: 2, unmappedItems: 0, reviewItems: 0 } }
        : path === 'pos-inventory/apply' ? { mode: 'APPLIED', period: { from: '2026-10-12T05:15:22.401Z', toExclusive: '2026-10-17T11:00:00.000Z' }, summary: { ordersScanned: 178, appliedOrders: 105, unitsApplied: 455, blockedOrders: 0, reviewLines: 73, shortfallUnits: 12 }, issues: [] }
        : path === 'store-comparison' && options.multipleStores ? { ...(fixtures[path] as object), comparisonAvailable: true, storeCount: 2 }
          : fixtures[path];
    if (!data) throw new Error(`Unexpected request ${path} ${init?.method || 'GET'}`);
    return new Response(JSON.stringify({ data }), { status: 200 });
  });
  const wrapper = mount(ManagementDashboard, { attachTo: document.body, props: { apiBaseUrl: '/api/v1', token: 'test', storeId: '1', storeName: '测试门店' } });
  return { wrapper, fetchSpy };
}
async function go(wrapper: VueWrapper, label: string) {
  const button = wrapper.findAll('.management-sidebar button').find(item => item.text().startsWith(label));
  expect(button).toBeTruthy(); await button!.trigger('click'); await flushPromises();
}
async function click(wrapper: VueWrapper, label: string) {
  const button = wrapper.findAll('button').find(item => item.text() === label);
  expect(button).toBeTruthy(); await button!.trigger('click'); await flushPromises();
}
afterEach(() => { vi.restoreAllMocks(); document.body.innerHTML = ''; });

describe('经营管理页面组织', () => {
  it('lists purchase suggestions as a table with priority labels and CR-005 notes', async () => {
    const { wrapper } = setup(); await flushPromises();
    await go(wrapper, '本周进货');

    expect(wrapper.findAll('.buy-tabs button').map((tab) => tab.text())).toEqual(['全部（2）', '本周优先（2）', '后续跟进（0）', '已忽略（0）']);
    const rows = wrapper.findAll('.buy-table tbody tr');
    expect(rows).toHaveLength(2);
    expect(rows[0].findAll('td').map((cell) => cell.text()).slice(1, 6)).toEqual(['0', '2', '已断货', '12', '高']);
    expect(rows[0].get('.buy-product em').text()).toBe('断货中，按近 90 天销量估算');
    expect(rows[1].findAll('td').map((cell) => cell.text()).slice(1, 6)).toEqual(['4', '2', '2 周', '8', '中']);
    expect(rows[1].get('.buy-product em').text()).toBe('近 7 天已入库 4 件，仍不足');
    expect(rows[1].get('.buy-btn').text()).toBe('加入进货单');
    expect(rows[1].get('.buy-merged').text()).toBe('已合并 2 个同名档案（库存 4 + 0）');
    expect(wrapper.find('.buy-rules').exists()).toBe(false);
  });

  it('moves the built-in current-page marker with the selected module', async () => {
    const { wrapper } = setup(); await flushPromises();
    expect(wrapper.findAll('.nav-current-marker')).toHaveLength(1);
    expect(wrapper.get('.nav-current-marker').element.closest('button')?.textContent).toContain('经营总览');
    await go(wrapper, '本周进货');
    expect(wrapper.findAll('.nav-current-marker')).toHaveLength(1);
    expect(wrapper.get('.nav-current-marker').element.closest('button')?.textContent).toContain('本周进货');
  });

  it('groups navigation, keeps a read-only overview and moves detailed checks to the data center', async () => {
    const { wrapper, fetchSpy } = setup(); await flushPromises();
    expect(wrapper.findAll('.navigation-group h3').map(item => item.text())).toEqual(['经营分析', '资料维护', '系统支持']);
    expect(wrapper.findAll('.management-mobile-nav button').map(item => item.text().replace(/^[^\u4e00-\u9fff]+/, ''))).toEqual(['总览', '销售', '商品', '库存', '更多']);
    expect(wrapper.findAll('.hot-products-grid article')).toHaveLength(8);
    expect(wrapper.text()).toContain('热销产品 20');
    expect(wrapper.find('.foundation-check').exists()).toBe(false);
    expect(wrapper.text()).toContain('只有 1 个有记录的日期');
    await click(wrapper, '查看数据检查');
    expect(wrapper.find('.foundation-check').text()).toContain('正式品牌字段完整率');
    expect(wrapper.find('.foundation-check').text()).toContain('条码不是库存商品的必填条件');
    expect(fetchSpy.mock.calls.every(([, init]) => !init?.method || init.method === 'GET')).toBe(true);
  });

  it('drives the phone top bar, bottom navigation and more sheet', async () => {
    const { wrapper } = setup(); await flushPromises();
    expect(wrapper.get('.management-topbar h1').text()).toBe('经营总览');
    expect(wrapper.get('.management-topbar small').text()).toBe('测试门店');
    expect(wrapper.get('.management-mobile-nav button[aria-current="page"]').text()).toBe('总览');

    await wrapper.findAll('.management-mobile-nav button').find(item => item.text() === '库存')!.trigger('click'); await flushPromises();
    expect(wrapper.get('.management-topbar h1').text()).toBe('库存经营');
    expect(wrapper.get('.management-mobile-nav button[aria-current="page"]').text()).toBe('库存');

    await wrapper.get('.management-topbar button').trigger('click');
    expect(wrapper.find('.page-guide-popover').exists()).toBe(true);
    await wrapper.find('.page-guide-popover header button').trigger('click');

    const more = () => wrapper.findAll('.management-mobile-nav button').find(item => item.text() === '更多')!;
    await more().trigger('click');
    expect(wrapper.findAll('.more-modules strong').map(item => item.text())).toEqual(['本周进货', '分类与标签', '门店对比', '数据中心']);
    await wrapper.findAll('.more-modules button').find(item => item.text().includes('数据中心'))!.trigger('click'); await flushPromises();
    expect(wrapper.find('.management-more-sheet').exists()).toBe(false);
    expect(wrapper.get('.management-topbar h1').text()).toBe('数据中心');
    expect(more().classes()).toContain('active');

    await more().trigger('click');
    await wrapper.findAll('.more-account button').find(item => item.text().includes('账户设置'))!.trigger('click');
    expect(wrapper.emitted('open-account')).toHaveLength(1);
    expect(wrapper.find('.management-more-sheet').exists()).toBe(false);
    await more().trigger('click');
    await wrapper.findAll('.more-account button').find(item => item.text().includes('返回库存系统'))!.trigger('click');
    expect(wrapper.emitted('exit')).toHaveLength(1);
  });

  it('labels every list cell with its column so phones can show rows as cards', async () => {
    const { wrapper } = setup(); await flushPromises();
    await go(wrapper, '库存经营');
    const headers = wrapper.findAll('.inventory-scroll-table th').map(item => item.text());
    const cells = wrapper.findAll('.inventory-scroll-table tbody tr')[0].findAll('td');
    expect(cells.map(item => item.attributes('data-label'))).toEqual(headers);
    expect(wrapper.find('.inventory-table-pagination .load-more').exists()).toBe(false);
  });

  it('introduces the purpose and contents of every management page', async () => {
    const { wrapper } = setup(); await flushPromises();
    const expected: Record<string, string> = {
      '经营总览': '今日销售与昨日比较', '销售分析': '商品及品牌排行', '商品分析': '品牌结构',
      '库存经营': '覆盖天数', '分类与标签': '人工判断依据', '门店对比': '单店销售基线', '数据中心': '异常与同步历史',
    };
    for (const [section, content] of Object.entries(expected)) {
      await go(wrapper, section);
      await wrapper.find('.page-guide-fab').trigger('click');
      expect(wrapper.find('.page-guide-popover').text()).toContain('本页包含什么');
      expect(wrapper.find('.page-guide-popover').text()).toContain(content);
      await wrapper.find('.page-guide-popover header button').trigger('click');
    }
  });

  it('links to existing inventory reports without writing data', async () => {
    const { wrapper } = setup(); await flushPromises();
    for (const button of wrapper.findAll('.action-list button')) await button.trigger('click');
    expect(wrapper.emitted('open-report')).toEqual([['receipts'], ['expiry'], ['movements']]);
  });

  it('carries the overview date into sales analysis and shows the actual comparison period', async () => {
    const { wrapper, fetchSpy } = setup(); await flushPromises();
    await click(wrapper, '销售详情 →');
    expect(fetchSpy.mock.calls.some(([url]) => String(url).includes('from=2026-09-28&to=2026-09-28'))).toBe(true);
    expect(wrapper.text()).toContain('2026-08-02 至 2026-08-31');
    expect(wrapper.text()).not.toContain('暂无上月基数');
  });

  it('opens sales analysis on the current Auckland business date by default', async () => {
    const { wrapper, fetchSpy } = setup(); await flushPromises();
    await go(wrapper, '销售分析');
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Pacific/Auckland', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    expect(fetchSpy.mock.calls.some(([url]) => String(url).includes(`from=${today}&to=${today}`))).toBe(true);
    expect(wrapper.get('.period-shortcuts').text()).toContain('默认显示今天');
    expect((wrapper.get('.sales-filter-panel input[type="date"]').element as HTMLInputElement).value).toBe(today);
  });

  it('keeps product analysis read-only with three separate views', async () => {
    const { wrapper } = setup(); await flushPromises(); await go(wrapper, '商品分析');
    expect(wrapper.find('.product-table-card').isVisible()).toBe(true);
    await click(wrapper, '品牌结构');
    expect(wrapper.find('.product-table-card').isVisible()).toBe(false);
    expect(wrapper.findAll('.product-ranking')[0].isVisible()).toBe(true);
    await click(wrapper, '品类结构');
    expect(wrapper.findAll('.product-ranking')[1].isVisible()).toBe(true);
    expect(wrapper.findAll('button').some(b => /新增商品|修改售价|维护条码/.test(b.text()))).toBe(false);
  });

  it('keeps stock status filtering and removes duplicate alert lists', async () => {
    const { wrapper } = setup(); await flushPromises(); await go(wrapper, '库存经营');
    expect(wrapper.findAll('.inventory-alert-list')).toHaveLength(0);
    expect(wrapper.text()).toContain('查询商品范围'); expect(wrapper.text()).toContain('筛选当前结果');
    await wrapper.get('[aria-label="筛选缺货商品"]').trigger('click');
    expect(wrapper.findAll('.inventory-scroll-table tbody tr')).toHaveLength(0);
    expect(wrapper.text()).not.toContain('库存覆盖结构');
    await click(wrapper, '清除筛选');
    expect(wrapper.findAll('.inventory-scroll-table tbody tr')).toHaveLength(1);
  });

  it('separates tag dictionary from assignments and opens editors only on demand', async () => {
    const { wrapper } = setup(); await flushPromises(); await go(wrapper, '分类与标签');
    expect(wrapper.text()).toContain('展示全部启用商品');
    expect(wrapper.find('.tag-definition-editor').exists()).toBe(false);
    await click(wrapper, '标签字典');
    expect(wrapper.find('.insight-product-list').isVisible()).toBe(false);
    await click(wrapper, '新增标签'); expect(wrapper.find('.tag-definition-editor').exists()).toBe(true);
    await click(wrapper, '关闭编辑'); expect(wrapper.find('.tag-definition-editor').exists()).toBe(false);
    await wrapper.find('.taxonomy-list button').trigger('click');
    expect((wrapper.find('.tag-definition-editor input').element as HTMLInputElement).value).toBe('奶粉');
  });

  it('does not show a one-store ranking, but retains comparison and rankings for multiple stores', async () => {
    const { wrapper } = setup(); await flushPromises(); await go(wrapper, '门店对比');
    expect(wrapper.find('.store-ranking-card').exists()).toBe(false);
    expect(wrapper.find('.store-card-grid').exists()).toBe(true);
    wrapper.unmount(); vi.restoreAllMocks();
    const multi = setup({ multipleStores: true }); await flushPromises(); await go(multi.wrapper, '门店对比');
    expect(multi.wrapper.find('.store-comparison-table').exists()).toBe(true);
    expect(multi.wrapper.find('.store-ranking-card').exists()).toBe(true);
  });

  it('does not present zero or idle as a successful result when POS status fails', async () => {
    const { wrapper } = setup({ failPos: true }); await flushPromises(); await go(wrapper, '数据中心');
    const cards = wrapper.findAll('.pos-status-grid article strong').map(item => item.text());
    expect(cards).toEqual(['加载失败', '—', '—', '—', '—']);
    await click(wrapper, '异常记录'); expect(wrapper.find('.issue-card').text()).toContain('不能判断是否存在异常');
  });

  it('does not allow restricted accounts to open data center or edit tags', async () => {
    const { wrapper } = setup({ limited: true }); await flushPromises();
    const systemButton = wrapper.findAll('.management-sidebar button').find(b => b.text().startsWith('数据中心'))!;
    expect(systemButton.attributes('disabled')).toBeDefined();
    await go(wrapper, '分类与标签'); await click(wrapper, '标签字典');
    expect(wrapper.find('.tag-definition-editor').exists()).toBe(false);
    expect(wrapper.find('.taxonomy-list button').attributes('disabled')).toBeDefined();
  });

  it('preserves the explicit manual sync payload and never syncs just by navigating', async () => {
    const { wrapper, fetchSpy } = setup(); await flushPromises(); await go(wrapper, '数据中心');
    expect(fetchSpy.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false);
    await wrapper.get('.primary-sync-controls input').setValue('2026-10-01');
    await click(wrapper, '开始同步');
    const call = fetchSpy.mock.calls.find(([url]) => String(url).includes('pos-sync/run'));
    expect(call?.[1]?.method).toBe('POST');
    expect(JSON.parse(String(call?.[1]?.body))).toEqual({ date: '2026-10-01', reconcile: false });
  });

  it('lists stocked products the POS has not listed yet', async () => {
    const { wrapper } = setup(); await flushPromises(); await go(wrapper, '数据中心');
    const card = wrapper.find('.pos-unlisted-card');
    expect(card.text()).toContain('8分钟Pro Xylane玻色因细胞焕活精华液');
    expect(card.text()).toContain('9421907711157');
    expect(card.text()).toContain('1 种商品，共 240 件库存');
    expect(card.text()).toContain('导出 Excel');
  });

  it('lists review lines and re-applies a short line only when asked', async () => {
    const { wrapper, fetchSpy } = setup(); await flushPromises(); await go(wrapper, '数据中心');
    const card = wrapper.find('.pos-review-card');
    expect(card.text()).toContain('alpine 蜂蜜护手霜');
    expect(card.text()).toContain('未映射');
    expect(fetchSpy.mock.calls.some(([url]) => String(url).includes('review-lines/reapply'))).toBe(false);
    await card.findAll('button').find((button) => button.text() === '重扣')!.trigger('click'); await flushPromises();
    const call = fetchSpy.mock.calls.find(([url]) => String(url).includes('review-lines/reapply'));
    expect(call?.[1]?.method).toBe('POST');
    expect(JSON.parse(String(call?.[1]?.body))).toEqual({ itemIds: ['501'], confirm: true });
    expect(wrapper.find('.pos-review-card').text()).toContain('补扣 2 件');
  });

  it('previews POS inventory deductions before requiring an explicit confirmed write', async () => {
    const { wrapper, fetchSpy } = setup(); await flushPromises(); await go(wrapper, '数据中心');
    expect(fetchSpy.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false);
    await click(wrapper, '生成扣库预览');
    expect(wrapper.find('.pos-inventory-preview-summary').text()).toContain('105 张');
    expect(wrapper.find('.pos-inventory-preview-summary').text()).toContain('455 件商品');
    expect(wrapper.find('.pos-inventory-preview-summary').text()).toContain('73 行');
    expect(fetchSpy.mock.calls.some(([url]) => String(url).includes('pos-inventory/apply'))).toBe(false);
    await click(wrapper, '确认正式扣库');
    expect(document.body.querySelector('.pos-inventory-confirm-dialog')?.textContent).toContain('其余商品照常扣减，不会产生负库存');
    const confirm = document.body.querySelector('.morph-submit') as HTMLButtonElement;
    confirm.click(); await flushPromises();
    const call = fetchSpy.mock.calls.find(([url]) => String(url).includes('pos-inventory/apply'));
    expect(call?.[1]?.method).toBe('POST');
    expect(JSON.parse(String(call?.[1]?.body))).toEqual({ from: expect.any(String), to: expect.any(String), confirm: true });
  });
});
