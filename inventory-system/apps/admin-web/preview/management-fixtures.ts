// Fixed sample data for the management preview page (REQ-008 screenshots).
// Volumes and name lengths mirror the live store so layout problems show up;
// no value here comes from real business data.
import { storeToday } from '../src/store-date';

const today = storeToday();
const monthStart = `${today.slice(0, 7)}-01`;
const iso = (daysAgo: number, hour = 2) => new Date(Date.parse(`${today}T00:00:00Z`) - daysAgo * 86_400_000 + hour * 3_600_000).toISOString();
const day = (daysAgo: number) => iso(daysAgo).slice(0, 10);

const catalog: [name: string, brand: string, category: string][] = [
  ['GoodHealth 好健康 液体钙软胶囊 婴幼儿适用 60粒', 'GoodHealth', '保健品'],
  ['HAAB 绵羊油霜 含维生素E 500g 大罐装', 'HAAB', '护肤'],
  ['Sanderson 三德信 3000mg 高浓度深海鱼油 150粒', 'Sanderson', '保健品'],
  ['a2 白金版 婴儿配方奶粉 3段 900g', 'a2', '奶粉'],
  ['Comvita 康维他 麦卢卡蜂蜜 UMF10+ 500g', 'Comvita', '蜂蜜'],
  ['Red Seal 红印 天然草本无氟牙膏 100g', 'Red Seal', '日用'],
  ['Lanocreme 兰诺琳 绵羊油胎盘素面霜 100ml', 'Lanocreme', '护肤'],
  ['Healtheries 贺寿利 儿童维生素C咀嚼片 橙子味 150片', 'Healtheries', '保健品'],
  ['Kiwigarden 奇异果园 酸奶溶豆 原味 20g', 'Kiwigarden', '零食'],
  ['Manuka Health 蜜纽康 麦卢卡蜂蜜 MGO400+ 250g', 'Manuka Health', '蜂蜜'],
  ['Karicare 可瑞康 羊奶粉 1段 900g', 'Karicare', '奶粉'],
  ["Thompson's 汤普森 蔓越莓精华胶囊 60粒", "Thompson's", '保健品'],
  ['Pure Gold 新西兰蜂王浆胶囊 1000mg 365粒', 'Pure Gold', '保健品'],
  ['alpine 蜂蜜护手霜 75ml', 'alpine', '护肤'],
  ['Antipodes 安媞珀 极光焕颜精华 30ml', 'Antipodes', '护肤'],
  ['Wild Ferns 绵羊油麦卢卡蜂蜜面霜 100g', 'Wild Ferns', '护肤'],
  ['Lifestream 螺旋藻片 200粒', 'Lifestream', '保健品'],
  ['Ceres Organics 有机燕麦片 500g', 'Ceres Organics', '食品'],
  ["Whittaker's 惠特克 33%可可 牛奶巧克力 250g", "Whittaker's", '零食'],
  ['Bioglan 佰澳朗德 红磷虾油 1000mg 60粒', 'Bioglan', '保健品'],
  ['Oasis 绵羊油 SPF30 防晒霜 宝宝专用 100ml', 'Oasis', '护肤'],
  ['8分钟 Pro Xylane 玻色因细胞焕活精华液 30ml', '8分钟', '护肤'],
  ['Deep Blue Health 蓝色深海 角鲨烯软胶囊 1000mg 200粒', 'Deep Blue Health', '保健品'],
  ['Nature’s Way 佳思敏 儿童鱼油 软糖 60粒', 'Nature’s Way', '保健品'],
  ['Egmont 埃格蒙特 蜂胶喷雾 30ml', 'Egmont', '保健品'],
  ['Trilogy 趣乐活 有机玫瑰果油 20ml', 'Trilogy', '护肤'],
  ['Anchor 安佳 全脂奶粉 1kg', 'Anchor', '奶粉'],
  ['Go Healthy 高之源 护肝片 120粒', 'Go Healthy', '保健品'],
  ['Puhoi Valley 普霍谷 蜂蜜酸奶 450g', 'Puhoi Valley', '食品'],
  ['Linden Leaves 林登 玫瑰身体乳 250ml', 'Linden Leaves', '护肤'],
  ['careline 绵羊油润唇膏 4.5g', 'careline', '护肤'],
  ['Nutralife 纽乐 辅酶Q10 150mg 90粒', 'Nutralife', '保健品'],
  ['Kiwi Fresh 新西兰黄金奇异果干 200g', 'Kiwi Fresh', '零食'],
  ['Arataki 阿拉塔基 麦卢卡蜂蜜 UMF5+ 1kg', 'Arataki', '蜂蜜'],
  ['Hydra 鹿胎盘精华胶囊 50000mg 60粒', 'Hydra', '保健品'],
  ['Natureland 天然绵羊油 维E滋润霜 250g', 'Natureland', '护肤'],
];

type StockStatus = 'OUT_OF_STOCK' | 'LOW' | 'IN_STOCK';
const products = catalog.map(([productName, brandName, categoryName], index) => {
  const unitsSold = Math.max(0, Math.round(220 / (index + 1) + ((index * 7) % 13)));
  const currentInventory = index % 9 === 4 ? 0 : index % 7 === 3 ? 6 + (index % 5) : 18 + ((index * 37) % 240);
  const minimumStock = index % 3 === 0 ? 20 : null;
  const stockStatus: StockStatus = currentInventory === 0 ? 'OUT_OF_STOCK' : minimumStock !== null && currentInventory < minimumStock ? 'LOW' : 'IN_STOCK';
  return {
    productId: String(100 + index), sku: `SKU-${1000 + index}`, productName, brandName, categoryName,
    barcode: `94${String(21000000000 + index * 7919).padStart(11, '0')}`,
    unitsSold, salesRevenue: Math.round(unitsSold * (18 + (index % 6) * 9.5) * 100) / 100,
    currentInventory, minimumStock, sellingPriceCents: 1890 + index * 350, stockStatus,
    salesToStockRatio: currentInventory ? Math.round((unitsSold / currentInventory) * 100) / 100 : null,
  };
});
const sumBy = <T>(rows: T[], pick: (row: T) => number) => rows.reduce((total, row) => total + pick(row), 0);
const groupBy = (key: 'brandName' | 'categoryName') => [...new Set(products.map((row) => row[key]))].map((name) => {
  const rows = products.filter((row) => row[key] === name);
  return { name, productCount: rows.length, unitsSold: sumBy(rows, (row) => row.unitsSold), salesRevenue: sumBy(rows, (row) => row.salesRevenue), currentInventory: sumBy(rows, (row) => row.currentInventory) };
}).sort((a, b) => b.salesRevenue - a.salesRevenue);

const topProducts = [...products].sort((a, b) => b.salesRevenue - a.salesRevenue).slice(0, 20)
  .map((row) => ({ productId: row.productId, productName: row.productName, brandName: row.brandName, categoryName: row.categoryName, quantity: row.unitsSold, revenue: row.salesRevenue }));
const topBrands = groupBy('brandName').slice(0, 10).map((row) => ({ brandName: row.name, quantity: row.unitsSold, revenue: row.salesRevenue }));
const topCategories = groupBy('categoryName').map((row) => ({ categoryName: row.name, quantity: row.unitsSold, revenue: row.salesRevenue }));
const dailySales = Array.from({ length: 21 }, (_, index) => ({ date: day(20 - index), revenue: 1800 + ((index * 431) % 1900), orders: 38 + ((index * 17) % 31) }));

const salesSummary = (period: string, scale: number) => ({
  period, revenue: 3412.6 * scale, refunds: 48 * scale, netRevenue: 3364.6 * scale, orderCount: Math.round(61 * scale),
  unitsSold: Math.round(148 * scale), averageOrderValue: 55.16, dailySales, topProducts: topProducts.slice(0, 8), topBrands,
});
const overview = {
  store: { id: '1', name: '汉密尔顿 City 店' }, currency: 'NZD',
  period: { date: today, previousDate: day(1) }, salesAvailable: true, lastPosSyncAt: iso(0, 1),
  sales: {
    current: salesSummary(today, 1), previous: salesSummary(day(1), 0.88),
    comparison: { netRevenuePercent: 12.4, orderCountPercent: 8.9, unitsSoldPercent: -3.1, averageOrderValuePercent: 3.2 },
  },
  inventory: {
    productCount: 1017, batchCount: 1288, totalQuantity: 32884, expiryAttentionQuantity: 146,
    expiry: { expired: 3, urgent: 6, warning: 14, early: 31 },
    activity: { openReceiptCount: 1, stocktakeAdjustmentsToday: 12, movementCountToday: 87, latestMovement: { createdAt: iso(0, 1), movementType: 'SALE_OUT', quantityDelta: -2 } },
  },
};

const salesAnalysis = {
  currency: 'NZD', dataAvailable: true, channelBreakdownAvailable: false, channelNotice: 'POS 未区分线上线下渠道',
  refundAllocationAvailable: false, refundNotice: '退款按订单记录，未分摊到单个商品',
  period: { from: monthStart, to: today, dimension: 'DAY', previousFrom: day(60), previousTo: day(31) },
  filters: { brand: null, category: null },
  metrics: { grossRevenue: 68420.5, refunds: 612, netRevenue: 67808.5, orderCount: 1236, unitsSold: 3014, averageOrderValue: 54.86 },
  comparison: overview.sales.comparison,
  trend: dailySales.map((row) => ({ period: row.date, revenue: row.revenue, orders: row.orders, units: row.orders * 2 })),
  hourlySales: Array.from({ length: 12 }, (_, index) => ({ hour: index + 9, revenue: 900 + ((index * 613) % 2400), orders: 12 + ((index * 7) % 30) })),
  weekdaySales: Array.from({ length: 7 }, (_, index) => ({ weekday: index, revenue: 7200 + index * 830, orders: 140 + index * 11 })),
  topProducts, topBrands, topCategories,
  sourceQuality: { orders: 1236, activeItems: 3360, mappedItems: 3305, reviewRequiredItems: 55 },
};

const productsBrands = {
  currency: 'NZD', period: { from: monthStart, to: today },
  summary: {
    productCount: 3714, soldProductCount: 642, unitsSold: 3014, salesRevenue: 67808.5, currentInventory: 32884,
    inStockProducts: 1017, outOfStockProducts: 347, lowStockProducts: 104, minimumStockConfiguredProducts: 412,
  },
  products: products.map((row) => ({ ...row, shortageVisible: row.stockStatus !== 'IN_STOCK' })),
  brands: groupBy('brandName'), categories: groupBy('categoryName'),
  catalogQuality: { withBrand: 3402, brandCoveragePercent: 91.6, withCategory: 2210, categoryCoveragePercent: 59.5, withBarcode: 3530, barcodeCoveragePercent: 95.05, barcodeOptional: true },
  mappingQuality: { activeItems: 3360, mappedItems: 3305, unmappedOrReviewItems: 55, coveragePercent: 98.36 },
  officialCostAvailable: false, marginAvailable: false, marginNotice: '尚无确认进货成本，暂不计算毛利',
};

const inventoryRows = products.map((row, index) => {
  const dailyVelocity = Math.round((row.unitsSold / 90) * 100) / 100;
  return {
    productId: row.productId, sku: row.sku, productName: row.productName, brandName: row.brandName, categoryName: row.categoryName,
    currentInventory: row.currentInventory, minimumStock: row.minimumStock, configuredMinimumStock: index % 6 === 0 ? 20 : null,
    minimumStockSource: row.minimumStock === null ? 'NONE' : index % 6 === 0 ? 'MANUAL' : 'DEFAULT', coreProduct: index % 3 === 0, posMapped: index % 11 !== 10,
    soldUnits: row.unitsSold, dailyVelocity, coverageDays: dailyVelocity ? Math.round(row.currentInventory / dailyVelocity) : null,
    shortageVisible: row.stockStatus !== 'IN_STOCK', lastSoldAt: row.unitsSold ? iso(index % 40) : null, daysSinceLastSale: row.unitsSold ? index % 40 : null,
    lastMovementAt: iso(index % 9), inventoryUpdatedAt: iso(index % 9), stockStatus: row.stockStatus, slowMoving: index % 5 === 2,
    replenishmentHidden: false, replenishmentHiddenUntil: null, directShipExcluded: false,
  };
});
const inventoryOperations = {
  period: { lookbackDays: 90, from: day(90), to: today },
  salesCoverage: { observedDays: 90, reliable: true, firstObservedSaleAt: iso(90), lastObservedSaleAt: iso(0, 1), minimumReliableDays: 30 },
  summary: { productCount: 1461, stockedProducts: 1017, totalInventory: 32884, outOfStockProducts: 347, lowStockProducts: 104, slowMovingProducts: 440, expiredBatches: 3, expiredUnits: 11 },
  coverageBuckets: { noSales: 375, under30: 212, days30To90: 268, over90: 162 },
  products: inventoryRows, turnoverAvailable: false, turnoverNotice: '尚无确认进货成本，暂不计算周转率', coverageNotice: '按已同步 POS 订单估算日均销量',
  defaultMinimumStock: 20, shortageNotice: '近 180 天有销售才算缺货',
};

const suggestion = (row: (typeof products)[number], index: number) => ({
  productId: row.productId, sku: row.sku, barcode: row.barcode, productName: row.productName, brandName: row.brandName, categoryName: row.categoryName,
  currentInventory: row.currentInventory, minimumStock: row.minimumStock, recent28DayQty: Math.round(row.unitsSold / 3), weeklyVelocity: Math.round((row.unitsSold / 13) * 10) / 10,
  coverageWeeks: row.currentInventory ? Math.round((row.currentInventory / Math.max(1, row.unitsSold / 13)) * 10) / 10 : 0, targetWeeks: index < 8 ? 4 : 6,
  targetInventory: 40 + index * 3, suggestedQuantity: 24 + ((index * 5) % 36),
  source: row.stockStatus === 'OUT_OF_STOCK' ? 'OUT_OF_STOCK' : row.stockStatus === 'LOW' ? 'LOW_STOCK' : index % 2 ? 'HOT_SALES' : 'WEEKLY_FORECAST',
  priority: index < 10 ? 'THIS_WEEK' : 'FOLLOW_UP', alreadyIncluded: index % 4 === 1, ignored: false, ignoredReason: null, ignoredAt: null,
  recentReceivedQty: 0, lastReceivedAt: null,
});
const suggestions = products.slice(0, 24).map(suggestion);
const purchaseSuggestions = {
  generatedAt: iso(0, 1), inventoryLatestUpdatedAt: iso(0, 1), period: { from: day(28), to: today },
  calculation: '近 28 天销量折算周销量，按 4–6 周覆盖计算建议量',
  summary: { products: suggestions.length, suggestedUnits: sumBy(suggestions, (row) => row.suggestedQuantity), thisWeekProducts: 10, followUpProducts: 14, alreadyIncluded: 6, ignored: 2, arrived: 1 },
  suggestions,
  ignoredSuggestions: products.slice(24, 26).map((row, index) => ({ ...suggestion(row, 24 + index), ignored: true, ignoredReason: '供应商断货', ignoredAt: iso(2) })),
  arrivedSuggestions: [{ ...suggestion(products[26], 26), recentReceivedQty: 24, lastReceivedAt: iso(1) }],
};
const orderItems = suggestions.filter((row) => row.alreadyIncluded).map((row, index) => ({
  id: String(700 + index), productId: row.productId, sku: row.sku, barcode: row.barcode, productName: row.productName, brandName: row.brandName, categoryName: row.categoryName,
  source: row.source, currentInventory: row.currentInventory, recentSevenDayQty: Math.round(row.weeklyVelocity), suggestedQuantity: row.suggestedQuantity,
  orderedQuantity: row.suggestedQuantity, receivedQuantity: 0, supplierName: index % 2 ? '奥克兰批发' : null, unitCostCents: index % 2 ? 1250 + index * 90 : null, caseSize: index % 3 ? 12 : null, notes: null,
}));
const currentPurchaseOrder = {
  generatedAt: iso(0, 1), inventoryLatestUpdatedAt: iso(0, 1), currency: 'NZD',
  order: {
    id: '31', orderNo: `PO-${today.replaceAll('-', '')}-01`, weekStart: day(2), status: 'DRAFT', createdAt: iso(2), updatedAt: iso(0, 1), confirmedAt: null, orderedAt: null,
    summary: { productCount: orderItems.length, suggestedUnits: sumBy(orderItems, (row) => row.suggestedQuantity), orderedUnits: sumBy(orderItems, (row) => row.orderedQuantity), receivedUnits: 0, totalCostCents: sumBy(orderItems, (row) => (row.unitCostCents ?? 0) * row.orderedQuantity) },
    items: orderItems,
  },
};

const syncRun = (index: number) => ({
  id: String(900 - index), status: index === 3 ? 'FAILED' : 'SUCCEEDED', requestedFrom: iso(index), requestedTo: iso(index, 3), startedAt: iso(0, 1 - index * 0.1), finishedAt: iso(0, 1 - index * 0.1),
  ordersObserved: 12 - index, ordersInserted: 3, ordersUpdated: 1, ordersSkipped: 0, itemsObserved: 30 - index, exceptionsCount: index === 3 ? 1 : 0,
  errorCode: index === 3 ? 'POS_TIMEOUT' : null, errorMessage: index === 3 ? 'POS 接口响应超时' : null,
});
const tags = [
  { id: 't1', code: 'baby', name: '母婴', dimension: 'AUDIENCE', description: null, parentId: null, source: 'MANUAL', externalId: null, sortOrder: 1, status: 'ACTIVE' },
  { id: 't2', code: 'immune', name: '免疫支持', dimension: 'HEALTH_NEED', description: null, parentId: null, source: 'MANUAL', externalId: null, sortOrder: 2, status: 'ACTIVE' },
  { id: 't3', code: 'gift', name: '送礼', dimension: 'USE_CASE', description: null, parentId: null, source: 'MANUAL', externalId: null, sortOrder: 3, status: 'ACTIVE' },
];

export const managementFixtures: Record<string, unknown> = {
  'access': { administrator: true, roleCodes: ['ADMIN'], capabilities: { overviewView: true, salesView: true, inventoryView: true, posSync: true, posIssues: true, permissionsManage: true }, grantedPermissionCodes: [] },
  'overview': overview,
  'data-foundation': {
    generatedAt: iso(0, 1), overallStatus: 'PARTIALLY_READY', note: '基于已同步的 POS 订单与本系统库存流水',
    quality: {
      catalog: { productCount: 3714, productsWithBarcode: 3530, barcodeCoveragePercent: 95.05, barcodeOptional: true, productsWithBrand: 3402, brandCoveragePercent: 91.6, productsWithCategory: 2210, categoryCoveragePercent: 59.5, productsWithSellingPrice: 3650, sellingPriceCoveragePercent: 98.28, productsWithMinimumStock: 412, minimumStockCoveragePercent: 11.09 },
      inventory: { positiveBalanceRows: 1288, productCount: 1017, batchCount: 1288, totalQuantity: 32884, latestUpdatedAt: iso(0, 1) },
      sales: { orderCount: 1236, orderItemCount: 3360, mappedOrderItemCount: 3305, mappingCoveragePercent: 98.36 },
    },
    domains: [
      { code: 'OVERVIEW', status: 'READY', availableMetrics: ['销售额', '订单数', '库存数量'], gaps: [] },
      { code: 'SALES', status: 'READY', availableMetrics: ['趋势', '时段', '品牌'], gaps: ['未区分渠道'] },
      { code: 'INVENTORY_OPERATIONS', status: 'PARTIAL', availableMetrics: ['覆盖天数', '滞销'], gaps: ['品类字段完整率不足 60%'] },
    ],
  },
  'sales-analysis': salesAnalysis,
  'products-brands': productsBrands,
  'inventory-operations': inventoryOperations,
  'purchase-suggestions': purchaseSuggestions,
  'purchase-orders/current': currentPurchaseOrder,
  'product-insight-tags': {
    disclaimer: '标签描述商品适用场景，不代表购买者真实身份',
    dimensions: [{ code: 'AUDIENCE', name: '适用人群' }, { code: 'HEALTH_NEED', name: '健康需求' }, { code: 'USE_CASE', name: '使用场景' }],
    tags, tagTree: tags.map((tag) => ({ ...tag, children: [] })),
    coverage: { productCount: 3714, approvedProducts: 214, pendingProducts: 38, untaggedProducts: 3462, approvedCoveragePercent: 5.76 },
    products: products.slice(0, 20).map((row, index) => ({
      productId: row.productId, sku: row.sku, productName: row.productName, brandName: row.brandName, categoryName: row.categoryName,
      assignments: index % 3 === 0 ? [{ id: `a${index}`, confidence: 'HIGH', evidence: '商品说明', source: 'MANUAL', reviewStatus: index % 2 ? 'PENDING' : 'APPROVED', tag: { code: tags[index % 3].code, name: tags[index % 3].name, dimension: tags[index % 3].dimension } }] : [],
    })),
  },
  'store-comparison': {
    currency: 'NZD', period: { from: monthStart, to: today }, storeCount: 1, comparisonAvailable: false, comparisonNotice: '目前只有一家门店，接入第二家门店后显示对比',
    stores: [{ store: { id: '1', code: 'HAM-CITY', name: '汉密尔顿 City 店' }, selected: true, sales: salesAnalysis.metrics, inventory: { totalQuantity: 32884, productCount: 1017, lowStockProducts: 104, outOfStockProducts: 347 } }],
    ranking: { byRevenue: [], byOrders: [], byInventory: [] },
  },
  'pos-sync/check': {
    checkedAt: iso(0, 1), readiness: 'NEEDS_REVIEW', observationOnly: false, inventoryChanged: true,
    orders: { total: 1236, firstOrderedAt: iso(40), lastOrderedAt: iso(0, 1) },
    items: { total: 3360, mappable: 3320, nonInventory: 40, mapped: 3305, unmapped: 15, reviewRequired: 40, inactive: 0, mappingCoveragePercent: 98.36 },
    issues: { total: 7, pendingRefundReviews: 2, failedSyncRuns: 1 },
    checks: [
      { code: 'ORDERS_PRESENT', passed: true, message: '已同步 POS 订单' },
      { code: 'MAPPING_COVERAGE', passed: false, message: '15 条销售明细尚未匹配本地商品' },
    ],
  },
  'pos-sync/status': {
    running: false,
    realtime: { enabled: true, intervalMinutes: 5, lastTickAt: iso(0, 1), lastSuccessAt: iso(0, 1), lastError: null, lastApplied: { storeId: '1', appliedOrders: 3, unitsApplied: 7, reviewLines: 0, shortfallUnits: 0 } },
    cursor: { lastSourceTimestamp: iso(0, 1), updatedAt: iso(0, 1) }, latestRun: syncRun(0), history: Array.from({ length: 6 }, (_, index) => syncRun(index)),
  },
  'pos-sync/issues': {
    summary: { itemIssues: 3, pendingRefunds: 2, failedRuns: 1 },
    itemIssues: { items: [
      { id: 'i1', orderNo: 'RO-20481', orderedAt: iso(1), externalProductId: 'H-8821', productName: 'careline 绵羊油润唇膏 4.5g', barcode: '9415184000123', quantity: '1', disposition: 'UNMAPPED', reason: '条码未找到本地商品' },
      { id: 'i2', orderNo: 'RO-20477', orderedAt: iso(1), externalProductId: 'H-9010', productName: '礼品袋（大）', barcode: null, quantity: '2', disposition: 'REVIEW_REQUIRED', reason: '疑似非库存商品' },
      { id: 'i3', orderNo: 'RO-20455', orderedAt: iso(2), externalProductId: 'H-7712', productName: 'Hydra 鹿胎盘精华胶囊 50000mg 60粒', barcode: '9421904410020', quantity: '1', disposition: 'UNMAPPED', reason: '一个条码对应多个商品' },
    ], pagination: { total: 3 } },
    pendingRefunds: { items: [
      { id: 'r1', orderNo: 'RO-20390', orderedAt: iso(3), amount: '48.00', reason: '顾客退货', createdAt: iso(2) },
      { id: 'r2', orderNo: 'RO-20311', orderedAt: iso(5), amount: '19.90', reason: '价格调整', createdAt: iso(4) },
    ], pagination: { total: 2 } },
    failedRuns: [{ id: '897', requestedFrom: iso(0), startedAt: iso(0, 1), errorCode: 'POS_TIMEOUT', errorMessage: 'POS 接口响应超时' }],
  },
  'pos-inventory/review-lines': { lines: [
    { itemId: '501', orderNo: 'RO-20502', orderedAt: iso(0, 1), sourceName: 'alpine hand cream', productId: '113', productName: 'alpine 蜂蜜护手霜 75ml', reason: 'INSUFFICIENT_INVENTORY', required: 2, applied: 0, remaining: 2, availableStock: 12, canReapply: true },
    { itemId: '502', orderNo: 'RO-20498', orderedAt: iso(0, 1), sourceName: 'careline lip balm', productId: null, productName: null, reason: 'UNMAPPED', required: 1, applied: 0, remaining: 1, availableStock: 0, canReapply: false },
  ] },
  'pos-mapping/unlisted-stock': { products: [
    { productId: '3734', sku: 'LOCAL-1', productName: '8分钟 Pro Xylane 玻色因细胞焕活精华液 30ml', englishName: null, barcodes: ['9421907711157'], stock: 240, createdAt: iso(2) },
  ], totalUnits: 240 },
  'pos-inventory/preview': {
    mode: 'PREVIEW', period: { from: iso(2), toExclusive: iso(0, 1) },
    summary: { ordersScanned: 178, eligibleOrders: 105, unitsPlanned: 455, reviewRequiredOrders: 6, blockedOrders: 0, reviewLines: 73, shortfallUnits: 12 },
    issues: [{ orderId: '9', orderNo: 'RO-20481', reason: 'INSUFFICIENT_INVENTORY', itemId: '90', productId: '113', required: 4, available: 0 }],
  },
  'barcode-audit': {
    generatedAt: iso(0, 1), summary: { duplicateBarcodes: 0, duplicateNameConflicts: 0, localBarcodeMismatches: 0, unmappedBarcodes: 1 },
    duplicateBarcodes: [], localBarcodeMismatches: [],
    unmappedBarcodes: [{ barcode: '9415184000123', occurrences: 3, units: 3, dispositions: ['UNMAPPED'], products: [{ externalProductId: 'H-8821', sourceName: 'careline lip balm' }] }],
  },
};
