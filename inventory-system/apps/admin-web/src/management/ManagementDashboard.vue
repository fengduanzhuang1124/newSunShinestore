<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';

type SalesSummary = {
  month: string; revenue: number; refunds: number; netRevenue: number; orderCount: number;
  unitsSold: number; averageOrderValue: number;
  dailySales: { date: string; revenue: number; orders: number }[];
  topProducts: { productName: string; brandName: string; quantity: number; revenue: number }[];
  topBrands: { brandName: string; quantity: number; revenue: number }[];
};
type Overview = {
  store: { id: string; name: string }; currency: string;
  period: { month: string; previousMonth: string }; salesAvailable: boolean; lastPosSyncAt: string | null;
  sales: {
    current: SalesSummary; previous: SalesSummary;
    comparison: { netRevenuePercent: number | null; orderCountPercent: number | null; unitsSoldPercent: number | null; averageOrderValuePercent: number | null };
  };
  inventory: {
    productCount: number; batchCount: number; totalQuantity: number; expiryAttentionQuantity: number;
    expiry: { expired: number; urgent: number; warning: number; early: number };
    activity: {
      openReceiptCount: number; stocktakeAdjustmentsThisMonth: number; movementCountThisMonth: number;
      latestMovement: { createdAt: string; movementType: string; quantityDelta: number } | null;
    };
  };
};
type DataFoundation = {
  generatedAt: string; overallStatus: 'IN_PROGRESS' | 'PARTIALLY_READY'; note: string;
  quality: {
    catalog: {
      productCount: number; productsWithBarcode: number; barcodeCoveragePercent: number; barcodeOptional: boolean;
      productsWithBrand: number; brandCoveragePercent: number; productsWithCategory: number; categoryCoveragePercent: number;
      productsWithSellingPrice: number; sellingPriceCoveragePercent: number;
      productsWithMinimumStock: number; minimumStockCoveragePercent: number;
    };
    inventory: { positiveBalanceRows: number; productCount: number; batchCount: number; totalQuantity: number; latestUpdatedAt: string | null };
    sales: { orderCount: number; orderItemCount: number; mappedOrderItemCount: number; mappingCoveragePercent: number };
  };
  domains: { code: string; status: 'READY' | 'PARTIAL' | 'WAITING_FOR_DATA' | 'BLOCKED'; availableMetrics: string[]; gaps: string[] }[];
};
type PosDataCheck = {
  checkedAt: string; readiness: 'WAITING_FOR_DATA' | 'NEEDS_REVIEW' | 'READY'; observationOnly: boolean; inventoryChanged: boolean;
  orders: { total: number; firstOrderedAt: string | null; lastOrderedAt: string | null };
  items: { total: number; mapped: number; unmapped: number; reviewRequired: number; inactive: number; mappingCoveragePercent: number };
  issues: { total: number; pendingRefundReviews: number; failedSyncRuns: number };
  checks: { code: string; passed: boolean; message: string }[];
};
type PosSyncRun = {
  id: string; status: 'RUNNING' | 'SUCCEEDED' | 'FAILED'; requestedFrom: string | null; requestedTo: string | null;
  startedAt: string; finishedAt: string | null; ordersObserved: number; ordersInserted: number; ordersUpdated: number;
  ordersSkipped: number; itemsObserved: number; exceptionsCount: number; errorCode: string | null; errorMessage: string | null;
};
type PosSyncStatus = { running: boolean; cursor: { lastSourceTimestamp: string | null; updatedAt: string } | null; latestRun: PosSyncRun | null; history: PosSyncRun[] };
type PosSyncIssues = {
  summary: { itemIssues: number; pendingRefunds: number; failedRuns: number };
  itemIssues: { items: { id: string; orderNo: string; orderedAt: string; externalProductId: string; productName: string | null; barcode: string | null; quantity: string; disposition: string; reason: string | null }[]; pagination: { total: number } };
  pendingRefunds: { items: { id: string; orderNo: string; orderedAt: string; amount: string; reason: string; createdAt: string }[]; pagination: { total: number } };
  failedRuns: { id: string; requestedFrom: string | null; startedAt: string; errorCode: string | null; errorMessage: string | null }[];
};
type SalesAnalysis = {
  currency: string; dataAvailable: boolean; channelBreakdownAvailable: boolean; channelNotice: string | null;
  refundAllocationAvailable: boolean; refundNotice: string | null;
  period: { from: string; to: string; dimension: 'DAY' | 'WEEK' | 'MONTH'; previousFrom: string; previousTo: string };
  filters: { brand: string | null; category: string | null };
  metrics: { grossRevenue: number; refunds: number; netRevenue: number; orderCount: number; unitsSold: number; averageOrderValue: number };
  comparison: { netRevenuePercent: number | null; orderCountPercent: number | null; unitsSoldPercent: number | null; averageOrderValuePercent: number | null };
  trend: { period: string; revenue: number; orders: number; units: number }[];
  hourlySales: { hour: number; revenue: number; orders: number }[];
  weekdaySales: { weekday: number; revenue: number; orders: number }[];
  topProducts: { productName: string; brandName: string; categoryName: string; quantity: number; revenue: number }[];
  topBrands: { brandName: string; quantity: number; revenue: number }[];
  topCategories: { categoryName: string; quantity: number; revenue: number }[];
  sourceQuality: { orders: number; activeItems: number; mappedItems: number; reviewRequiredItems: number };
};
type ProductsBrands = {
  currency: string; period: { from: string; to: string };
  summary: { productCount: number; soldProductCount: number; unitsSold: number; salesRevenue: number; currentInventory: number; lowStockProducts: number };
  products: { productId: string; sku: string; productName: string; brandName: string; categoryName: string; barcode: string | null; unitsSold: number; salesRevenue: number; currentInventory: number; minimumStock: number | null; sellingPriceCents: number | null; stockStatus: 'OUT_OF_STOCK' | 'LOW' | 'IN_STOCK'; salesToStockRatio: number | null }[];
  brands: { name: string; productCount: number; unitsSold: number; salesRevenue: number; currentInventory: number }[];
  categories: { name: string; productCount: number; unitsSold: number; salesRevenue: number; currentInventory: number }[];
  catalogQuality: { withBrand: number; brandCoveragePercent: number; withCategory: number; categoryCoveragePercent: number; withBarcode: number; barcodeCoveragePercent: number; barcodeOptional: boolean };
  mappingQuality: { activeItems: number; mappedItems: number; unmappedOrReviewItems: number; coveragePercent: number };
  officialCostAvailable: boolean; marginAvailable: boolean; marginNotice: string;
};
type InventoryOperations = {
  period: { lookbackDays: number; from: string; to: string };
  summary: { productCount: number; stockedProducts: number; totalInventory: number; outOfStockProducts: number; lowStockProducts: number; slowMovingProducts: number };
  coverageBuckets: { noSales: number; under30: number; days30To90: number; over90: number };
  alerts: InventoryOperationRow[]; slowMoving: InventoryOperationRow[]; products: InventoryOperationRow[];
  turnoverAvailable: boolean; turnoverNotice: string; coverageNotice: string;
};
type InventoryOperationRow = {
  productId: string; sku: string; productName: string; brandName: string; categoryName: string;
  currentInventory: number; minimumStock: number | null; soldUnits: number; dailyVelocity: number; coverageDays: number | null;
  lastSoldAt: string | null; daysSinceLastSale: number | null; lastMovementAt: string | null; inventoryUpdatedAt: string | null;
  stockStatus: 'OUT_OF_STOCK' | 'LOW' | 'IN_STOCK'; slowMoving: boolean;
};
type StoreComparison = {
  currency: string; period: { from: string; to: string }; storeCount: number; comparisonAvailable: boolean; comparisonNotice: string | null;
  stores: { store: { id: string; code: string; name: string }; selected: boolean; sales: { grossRevenue: number; refunds: number; netRevenue: number; orderCount: number; unitsSold: number; averageOrderValue: number }; inventory: { totalQuantity: number; productCount: number; lowStockProducts: number; outOfStockProducts: number } }[];
  ranking: { byRevenue: StoreRanking[]; byOrders: StoreRanking[]; byInventory: StoreRanking[] };
};
type StoreRanking = { storeId: string; storeName: string; value: number };
type ManagementAccess = { administrator: boolean; roleCodes: string[]; capabilities: { overviewView: boolean; salesView: boolean; inventoryView: boolean; posSync: boolean; posIssues: boolean; permissionsManage: boolean }; grantedPermissionCodes: string[] };
type ProductInsightTags = {
  disclaimer: string; dimensions: { code: string; name: string }[];
  tags: InsightTag[]; tagTree: (InsightTag & { children: InsightTag[] })[];
  coverage: { productCount: number; approvedProducts: number; pendingProducts: number; untaggedProducts: number; approvedCoveragePercent: number };
  products: { productId: string; sku: string; productName: string; brandName: string; categoryName: string; assignments: { id: string; confidence: 'LOW' | 'MEDIUM' | 'HIGH'; evidence: string | null; source: string; reviewStatus: 'PENDING' | 'APPROVED'; tag: { code: string; name: string; dimension: string } }[] }[];
};
type InsightDimension = 'BUSINESS_CATEGORY' | 'AUDIENCE' | 'HEALTH_NEED' | 'USE_CASE' | 'OPERATION' | 'MARKETING';
type InsightTag = { id: string; code: string; name: string; dimension: InsightDimension; description: string | null; parentId: string | null; source: string; externalId: string | null; sortOrder: number; status: 'ACTIVE' | 'INACTIVE' };

const props = defineProps<{ apiBaseUrl: string; token: string; storeId: string; storeName: string; administrator?: boolean }>();
const emit = defineEmits<{ 'open-report': [view: 'receipts' | 'expiry' | 'movements'] }>();
const productView = ref<'products' | 'brands' | 'categories'>('products');
const tagView = ref<'products' | 'dictionary'>('products');
const tagEditorOpen = ref(false);
const systemView = ref<'sync' | 'quality' | 'issues'>('sync');
const posLoadError = ref('');
const month = ref(new Intl.DateTimeFormat('en-CA', { timeZone: 'Pacific/Auckland', year: 'numeric', month: '2-digit' }).format(new Date()));
const overview = ref<Overview | null>(null);
const foundation = ref<DataFoundation | null>(null);
const loading = ref(false);
const error = ref('');
const posCheck = ref<PosDataCheck | null>(null);
const posStatus = ref<PosSyncStatus | null>(null);
const posIssues = ref<PosSyncIssues | null>(null);
const posLoading = ref(false);
const posRunning = ref(false);
const posMessage = ref('');
const syncDate = ref(new Intl.DateTimeFormat('en-CA', { timeZone: 'Pacific/Auckland', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()));
const reconcile = ref(false);
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Pacific/Auckland', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const salesFrom = ref(`${today.slice(0, 7)}-01`);
const salesTo = ref(today);
const salesDimension = ref<'DAY' | 'WEEK' | 'MONTH'>('DAY');
const salesBrand = ref('');
const salesCategory = ref('');
const salesAnalysis = ref<SalesAnalysis | null>(null);
const salesLoading = ref(false);
const productFrom = ref(`${today.slice(0, 7)}-01`);
const productTo = ref(today);
const productQuery = ref('');
const productBrand = ref('');
const productCategory = ref('');
const productsBrands = ref<ProductsBrands | null>(null);
const productsLoading = ref(false);
const productDetailPage = ref(1);
const productDetailPageSize = ref(50);
const inventoryLookbackDays = ref(90);
const inventoryQuery = ref('');
const inventoryOperations = ref<InventoryOperations | null>(null);
const inventoryLoading = ref(false);
const inventoryTableQuery = ref('');
const inventoryBrandFilter = ref('');
const inventoryCategoryFilter = ref('');
const inventoryStatusFilter = ref<'ALL' | 'SLOW' | 'OUT_OF_STOCK' | 'LOW' | 'OVERSTOCK' | 'NO_MINIMUM'>('ALL');
const inventorySort = ref<'INVENTORY_DESC' | 'SALES_DESC' | 'COVERAGE_DESC' | 'LAST_SALE_ASC' | 'NAME_ASC'>('INVENTORY_DESC');
const inventoryPage = ref(1);
const inventoryPageSize = ref(50);
const storeFrom = ref(`${today.slice(0, 7)}-01`);
const storeTo = ref(today);
const storeComparison = ref<StoreComparison | null>(null);
const storeLoading = ref(false);
const managementAccess = ref<ManagementAccess | null>(null);
const insightQuery = ref('');
const productInsights = ref<ProductInsightTags | null>(null);
const insightLoading = ref(false);
const insightProductId = ref('');
const insightTagCode = ref('');
const insightConfidence = ref<'LOW' | 'MEDIUM' | 'HIGH'>('MEDIUM');
const insightEvidence = ref('');
const insightMessage = ref('');
const insightDetailPage = ref(1);
const insightDetailPageSize = ref(50);
const newTagName = ref('');
const newTagDimension = ref<InsightDimension>('HEALTH_NEED');
const newTagParentId = ref('');
const newTagDescription = ref('');
const editingTagId = ref('');
const newTagSortOrder = ref(0);
const newTagStatus = ref<'ACTIVE' | 'INACTIVE'>('ACTIVE');
type ManagementSection = 'overview' | 'sales' | 'products' | 'inventory' | 'customers' | 'stores' | 'system';
const activeSection = ref<ManagementSection>('overview');
const showMobileMore = ref(false);
const allSections: { id: ManagementSection; label: string; description: string; ready: boolean }[] = [
  { id: 'overview', label: '经营总览', description: '核心指标与经营提醒', ready: true },
  { id: 'sales', label: '销售分析', description: '销售趋势、时段与上期比较', ready: true },
  { id: 'products', label: '商品分析', description: '商品、品牌与品类表现', ready: true },
  { id: 'inventory', label: '库存经营', description: '覆盖、滞销与低库存', ready: true },
  { id: 'customers', label: '分类与标签', description: '商品标记与标签字典', ready: true },
  { id: 'stores', label: '门店对比', description: '门店经营基线与比较', ready: true },
  { id: 'system', label: '数据中心', description: 'POS 同步、检查与异常', ready: true },
];
const navigationGroups = [
  { label: '经营分析', ids: ['overview', 'sales', 'products', 'inventory', 'stores'] },
  { label: '资料维护', ids: ['customers'] },
  { label: '系统支持', ids: ['system'] },
];
const canSection = (id: ManagementSection) => {
  if (props.administrator) return true;
  if (!managementAccess.value) return id === 'overview';
  const capability = managementAccess.value.capabilities;
  if (id === 'overview' || id === 'stores') return capability.overviewView;
  if (id === 'sales' || id === 'products') return capability.salesView;
  if (id === 'inventory') return capability.inventoryView;
  if (id === 'system') return capability.posSync || capability.posIssues || capability.permissionsManage;
  return capability.salesView;
};
const sections = computed(() => allSections);
const currentSection = computed(() => allSections.find((item) => item.id === activeSection.value) ?? allSections[0]);
function selectSection(section: ManagementSection) {
  if (!canSection(section)) return;
  activeSection.value = section;
  showMobileMore.value = false;
}
function openDataCenter(view: 'sync' | 'quality' | 'issues' = 'quality') {
  systemView.value = view;
  selectSection('system');
}
function openSalesFromOverview() {
  if (!overview.value) return;
  const selectedMonth = overview.value.period.month;
  const [year, monthNumber] = selectedMonth.split('-').map(Number);
  salesFrom.value = `${selectedMonth}-01`;
  salesTo.value = selectedMonth === today.slice(0, 7) ? today : `${selectedMonth}-${new Date(Date.UTC(year, monthNumber, 0)).getUTCDate()}`;
  salesBrand.value = ''; salesCategory.value = ''; salesDimension.value = 'DAY';
  selectSection('sales');
}
function clearSalesFilters() { salesBrand.value = ''; salesCategory.value = ''; }
function clearProductFilters() { productQuery.value = ''; productBrand.value = ''; productCategory.value = ''; }
function setDateRange(target: 'sales' | 'products' | 'stores', preset: 'today' | 'week' | 'month') {
  const weekStart = new Date(`${today}T00:00:00Z`);
  weekStart.setUTCDate(weekStart.getUTCDate() - 6);
  const from = preset === 'today' ? today : preset === 'week' ? weekStart.toISOString().slice(0, 10) : `${today.slice(0, 7)}-01`;
  if (target === 'sales') { salesFrom.value = from; salesTo.value = today; }
  if (target === 'products') { productFrom.value = from; productTo.value = today; }
  if (target === 'stores') { storeFrom.value = from; storeTo.value = today; }
}
function clearInventoryFilters() {
  inventoryTableQuery.value = ''; inventoryBrandFilter.value = ''; inventoryCategoryFilter.value = ''; inventoryStatusFilter.value = 'ALL';
}
const pageBusy = computed(() => ({ overview: loading.value, sales: salesLoading.value, products: productsLoading.value, inventory: inventoryLoading.value, customers: insightLoading.value, stores: storeLoading.value, system: posLoading.value }[activeSection.value]));
function retryCurrentPage() {
  const loaders = { overview: loadOverview, sales: loadSalesAnalysis, products: loadProductsBrands, inventory: loadInventoryOperations, customers: loadProductInsights, stores: loadStoreComparison, system: loadSystemManagement };
  void loaders[activeSection.value]();
}
const maxDailyRevenue = computed(() => Math.max(1, ...(overview.value?.sales.current.dailySales.map((item) => item.revenue) ?? [1])));
const salesTimeBuckets = computed(() => Array.from({ length: 8 }, (_, index) => {
  const start = index * 3;
  const rows = (salesAnalysis.value?.hourlySales ?? []).filter((item) => item.hour >= start && item.hour <= start + 2);
  return {
    label: `${String(start).padStart(2, '0')}–${String(start + 2).padStart(2, '0')}`,
    revenue: rows.reduce((sum, item) => sum + item.revenue, 0),
    orders: rows.reduce((sum, item) => sum + item.orders, 0),
  };
}));
const singleDaySales = computed(() => salesAnalysis.value?.period.from === salesAnalysis.value?.period.to);
const salesTrendSeries = computed(() => {
  const daily = salesAnalysis.value?.trend ?? [];
  if (!singleDaySales.value || daily.length > 1) return daily.map((item) => ({ label: item.period, revenue: item.revenue }));
  return salesTimeBuckets.value.map((item) => ({ label: item.label, revenue: item.revenue }));
});
const maxSalesTrend = computed(() => Math.max(1, ...salesTrendSeries.value.map((item) => item.revenue)));
const chartPoints = (values: number[], max: number) => values.map((value, index) => {
  const x = values.length <= 1 ? 500 : index / (values.length - 1) * 1000;
  const y = 210 - value / Math.max(1, max) * 170;
  return { x: Number(x.toFixed(2)), y: Number(y.toFixed(2)), value };
});
const overviewTrendPoints = computed(() => chartPoints(overview.value?.sales.current.dailySales.map((item) => item.revenue) ?? [], maxDailyRevenue.value));
const salesTrendPoints = computed(() => chartPoints(salesTrendSeries.value.map((item) => item.revenue), maxSalesTrend.value));
const linePath = (points: { x: number; y: number }[]) => points.map((point) => `${point.x},${point.y}`).join(' ');
const areaPath = (points: { x: number; y: number }[]) => points.length ? `M ${points[0].x} 210 L ${points.map((point) => `${point.x} ${point.y}`).join(' L ')} L ${points[points.length - 1].x} 210 Z` : '';
const conicGradient = (values: number[], colors: string[]) => {
  const total = values.reduce((sum, value) => sum + value, 0);
  if (!total) return 'conic-gradient(#263247 0 100%)';
  let cursor = 0;
  return `conic-gradient(${values.map((value, index) => {
    const start = cursor;
    cursor += value / total * 100;
    return `${colors[index]} ${start.toFixed(2)}% ${cursor.toFixed(2)}%`;
  }).join(',')})`;
};
const expiryTotal = computed(() => {
  const expiry = overview.value?.inventory.expiry;
  return expiry ? expiry.expired + expiry.urgent + expiry.warning + expiry.early : 0;
});
const expiryGradient = computed(() => {
  const expiry = overview.value?.inventory.expiry;
  return conicGradient(expiry ? [expiry.expired, expiry.urgent, expiry.warning, expiry.early] : [], ['#ff7080', '#f59c61', '#efd56a', '#45c6e4']);
});
const coverageTotal = computed(() => {
  const buckets = inventoryOperations.value?.coverageBuckets;
  return buckets ? buckets.noSales + buckets.under30 + buckets.days30To90 + buckets.over90 : 0;
});
const coverageGradient = computed(() => {
  const buckets = inventoryOperations.value?.coverageBuckets;
  return conicGradient(buckets ? [buckets.noSales, buckets.under30, buckets.days30To90, buckets.over90] : [], ['#ff7080', '#3dd9a2', '#6880ff', '#f4b860']);
});
const productDetailPageCount = computed(() => Math.max(1, Math.ceil((productsBrands.value?.products.length ?? 0) / productDetailPageSize.value)));
const pagedProductDetails = computed(() => {
  const start = (productDetailPage.value - 1) * productDetailPageSize.value;
  return (productsBrands.value?.products ?? []).slice(start, start + productDetailPageSize.value);
});
const insightDetailPageCount = computed(() => Math.max(1, Math.ceil((productInsights.value?.products.length ?? 0) / insightDetailPageSize.value)));
const pagedInsightProducts = computed(() => {
  const start = (insightDetailPage.value - 1) * insightDetailPageSize.value;
  return (productInsights.value?.products ?? []).slice(start, start + insightDetailPageSize.value);
});
const inventoryBrands = computed(() => [...new Set((inventoryOperations.value?.products ?? []).map((item) => item.brandName).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'zh-CN')));
const inventoryCategories = computed(() => [...new Set((inventoryOperations.value?.products ?? []).map((item) => item.categoryName).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'zh-CN')));
const inventoryStatusCounts = computed(() => {
  const products = inventoryOperations.value?.products ?? [];
  return {
    ALL: products.length,
    SLOW: products.filter((item) => item.slowMoving).length,
    OUT_OF_STOCK: products.filter((item) => item.stockStatus === 'OUT_OF_STOCK').length,
    LOW: products.filter((item) => item.stockStatus === 'LOW').length,
    OVERSTOCK: products.filter((item) => item.coverageDays !== null && item.coverageDays > 90).length,
    NO_MINIMUM: products.filter((item) => item.minimumStock === null).length,
  };
});
const filteredInventoryProducts = computed(() => {
  const query = inventoryTableQuery.value.trim().toLowerCase();
  const rows = (inventoryOperations.value?.products ?? []).filter((item) => {
    if (query && ![item.productName, item.brandName, item.categoryName, item.sku].some((value) => value?.toLowerCase().includes(query))) return false;
    if (inventoryBrandFilter.value && item.brandName !== inventoryBrandFilter.value) return false;
    if (inventoryCategoryFilter.value && item.categoryName !== inventoryCategoryFilter.value) return false;
    if (inventoryStatusFilter.value === 'SLOW' && !item.slowMoving) return false;
    if (inventoryStatusFilter.value === 'OUT_OF_STOCK' && item.stockStatus !== 'OUT_OF_STOCK') return false;
    if (inventoryStatusFilter.value === 'LOW' && item.stockStatus !== 'LOW') return false;
    if (inventoryStatusFilter.value === 'OVERSTOCK' && !(item.coverageDays !== null && item.coverageDays > 90)) return false;
    if (inventoryStatusFilter.value === 'NO_MINIMUM' && item.minimumStock !== null) return false;
    return true;
  });
  return rows.sort((a, b) => {
    if (inventorySort.value === 'SALES_DESC') return b.soldUnits - a.soldUnits;
    if (inventorySort.value === 'COVERAGE_DESC') return (b.coverageDays ?? Number.MAX_SAFE_INTEGER) - (a.coverageDays ?? Number.MAX_SAFE_INTEGER);
    if (inventorySort.value === 'LAST_SALE_ASC') return (b.daysSinceLastSale ?? Number.MAX_SAFE_INTEGER) - (a.daysSinceLastSale ?? Number.MAX_SAFE_INTEGER);
    if (inventorySort.value === 'NAME_ASC') return a.productName.localeCompare(b.productName, 'zh-CN');
    return b.currentInventory - a.currentInventory;
  });
});
const inventoryPageCount = computed(() => Math.max(1, Math.ceil(filteredInventoryProducts.value.length / inventoryPageSize.value)));
const pagedInventoryProducts = computed(() => {
  const start = (inventoryPage.value - 1) * inventoryPageSize.value;
  return filteredInventoryProducts.value.slice(start, start + inventoryPageSize.value);
});

const money = (value: number) => new Intl.NumberFormat('zh-CN', {
  style: 'currency', currency: overview.value?.currency || 'NZD', maximumFractionDigits: 2,
}).format(value);
const number = (value: number) => new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 2 }).format(value);
const percent = (value: number | null) => value === null ? '暂无可比较基数' : `${value >= 0 ? '+' : ''}${value}%`;
const comparisonClass = (value: number | null) => value === null ? 'neutral' : value >= 0 ? 'up' : 'down';
const dateTime = (value: string | null) => value ? new Date(value).toLocaleString('zh-CN') : '尚无记录';
const readinessLabel = (status: DataFoundation['domains'][number]['status']) => ({ READY: '可用', PARTIAL: '逐步完善', WAITING_FOR_DATA: '等待数据', BLOCKED: '缺少基础数据' }[status]);
const domainLabel = (code: string) => ({ OVERVIEW: '经营总览', INVENTORY_OPERATIONS: '库存经营', SALES: '销售数据' }[code] ?? code);

function openNativePicker(event: Event) {
  const input = event.currentTarget as HTMLInputElement & { showPicker?: () => void };
  if (input.disabled) return;
  try {
    input.showPicker?.();
  } catch {
    // Safari/iOS 仍会使用原生点击行为打开选择器。
  }
}

async function loadOverview() {
  if (!props.storeId) return;
  loading.value = true;
  error.value = '';
  try {
    const headers = { Authorization: `Bearer ${props.token}` };
    const [overviewResponse, foundationResponse] = await Promise.all([
      fetch(`${props.apiBaseUrl}/management/overview?storeId=${encodeURIComponent(props.storeId)}&month=${month.value}`, { headers }),
      fetch(`${props.apiBaseUrl}/management/data-foundation?storeId=${encodeURIComponent(props.storeId)}`, { headers }),
    ]);
    const [overviewBody, foundationBody] = await Promise.all([overviewResponse.json(), foundationResponse.json()]);
    if (!overviewResponse.ok) throw new Error(Array.isArray(overviewBody.message) ? overviewBody.message.join('，') : overviewBody.message || '经营数据加载失败');
    if (!foundationResponse.ok) throw new Error(Array.isArray(foundationBody.message) ? foundationBody.message.join('，') : foundationBody.message || '数据基础检查失败');
    overview.value = overviewBody.data;
    foundation.value = foundationBody.data;
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : '经营数据加载失败';
  } finally {
    loading.value = false;
  }
}

async function managementRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${props.apiBaseUrl}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${props.token}`, ...(init?.headers ?? {}) },
  });
  const body = await response.json();
  if (!response.ok) throw new Error(Array.isArray(body.message) ? body.message.join('，') : body.message || '请求失败');
  return body.data as T;
}

async function loadManagementAccess() {
  if (!props.storeId) return;
  try {
    managementAccess.value = await managementRequest<ManagementAccess>(`/management/access?storeId=${encodeURIComponent(props.storeId)}`);
    if (!canSection(activeSection.value)) activeSection.value = canSection('overview') ? 'overview' : allSections.find((section) => canSection(section.id))?.id ?? 'overview';
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : '经营管理权限加载失败';
  }
}

async function loadPosManagement() {
  if (!props.storeId) return;
  posLoading.value = true;
  error.value = '';
  posLoadError.value = '';
  try {
    const store = encodeURIComponent(props.storeId);
    if (managementAccess.value?.capabilities.posIssues) posCheck.value = await managementRequest<PosDataCheck>(`/management/pos-sync/check?storeId=${store}`);
    if (managementAccess.value?.capabilities.posSync) posStatus.value = await managementRequest<PosSyncStatus>(`/management/pos-sync/status?storeId=${store}`);
    if (managementAccess.value?.capabilities.posIssues) posIssues.value = await managementRequest<PosSyncIssues>(`/management/pos-sync/issues?storeId=${store}&page=1&pageSize=20`);
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : 'POS管理数据加载失败';
    posLoadError.value = error.value;
  } finally {
    posLoading.value = false;
  }
}

async function loadSystemManagement() {
  await loadManagementAccess();
  if (managementAccess.value) await loadPosManagement();
}

async function runManualSync() {
  if (!props.storeId || !syncDate.value || !managementAccess.value?.capabilities.posSync) return;
  posRunning.value = true;
  posMessage.value = '';
  error.value = '';
  try {
    const result = await managementRequest<{ result: { orders: number; ordersProcessed: number; ordersSkipped: number; items: number; unmappedItems: number; reviewItems: number }; message: string }>(
      `/management/pos-sync/run?storeId=${encodeURIComponent(props.storeId)}`,
      { method: 'POST', body: JSON.stringify({ date: syncDate.value, reconcile: reconcile.value }) },
    );
    posMessage.value = `${syncDate.value} 同步完成：读取 ${result.result.orders} 张订单，处理 ${result.result.ordersProcessed} 张，跳过 ${result.result.ordersSkipped} 张；异常商品 ${result.result.unmappedItems + result.result.reviewItems} 项。`;
    await Promise.all([loadPosManagement(), loadOverview()]);
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : 'POS手动同步失败';
  } finally {
    posRunning.value = false;
  }
}

async function loadSalesAnalysis() {
  if (!props.storeId || !salesFrom.value || !salesTo.value) return;
  salesLoading.value = true;
  error.value = '';
  try {
    const params = new URLSearchParams({ storeId: props.storeId, from: salesFrom.value, to: salesTo.value, dimension: salesDimension.value });
    if (salesBrand.value.trim()) params.set('brand', salesBrand.value.trim());
    if (salesCategory.value.trim()) params.set('category', salesCategory.value.trim());
    salesAnalysis.value = await managementRequest<SalesAnalysis>(`/management/sales-analysis?${params.toString()}`);
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : '销售分析加载失败';
  } finally {
    salesLoading.value = false;
  }
}

async function loadProductsBrands() {
  if (!props.storeId || !productFrom.value || !productTo.value) return;
  productsLoading.value = true;
  error.value = '';
  try {
    const params = new URLSearchParams({ storeId: props.storeId, from: productFrom.value, to: productTo.value });
    if (productQuery.value.trim()) params.set('q', productQuery.value.trim());
    if (productBrand.value.trim()) params.set('brand', productBrand.value.trim());
    if (productCategory.value.trim()) params.set('category', productCategory.value.trim());
    productsBrands.value = await managementRequest<ProductsBrands>(`/management/products-brands?${params.toString()}`);
    productDetailPage.value = 1;
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : '商品分析加载失败';
  } finally {
    productsLoading.value = false;
  }
}

async function loadInventoryOperations() {
  if (!props.storeId) return;
  inventoryLoading.value = true;
  error.value = '';
  try {
    const params = new URLSearchParams({ storeId: props.storeId, lookbackDays: String(inventoryLookbackDays.value) });
    if (inventoryQuery.value.trim()) params.set('q', inventoryQuery.value.trim());
    inventoryOperations.value = await managementRequest<InventoryOperations>(`/management/inventory-operations?${params.toString()}`);
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : '库存经营分析加载失败';
  } finally {
    inventoryLoading.value = false;
  }
}

async function loadStoreComparison() {
  if (!props.storeId || !storeFrom.value || !storeTo.value) return;
  storeLoading.value = true;
  error.value = '';
  try {
    const params = new URLSearchParams({ storeId: props.storeId, from: storeFrom.value, to: storeTo.value });
    storeComparison.value = await managementRequest<StoreComparison>(`/management/store-comparison?${params.toString()}`);
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : '门店经营对比加载失败';
  } finally {
    storeLoading.value = false;
  }
}

async function loadProductInsights() {
  if (!props.storeId) return;
  insightLoading.value = true; error.value = '';
  try {
    const params = new URLSearchParams({ storeId: props.storeId });
    if (insightQuery.value.trim()) params.set('q', insightQuery.value.trim());
    productInsights.value = await managementRequest<ProductInsightTags>(`/management/product-insight-tags?${params.toString()}`);
    insightDetailPage.value = 1;
  } catch (reason) { error.value = reason instanceof Error ? reason.message : '消费倾向标签加载失败'; }
  finally { insightLoading.value = false; }
}

async function assignInsightTag() {
  const tag = productInsights.value?.tags.find((item) => item.code === insightTagCode.value);
  if (!tag || !insightProductId.value) return;
  insightLoading.value = true; error.value = ''; insightMessage.value = '';
  try {
    await managementRequest(`/management/product-insight-tags/assign?storeId=${encodeURIComponent(props.storeId)}`, { method: 'POST', body: JSON.stringify({ productId: insightProductId.value, tagCode: tag.code, tagName: tag.name, dimension: tag.dimension, confidence: insightConfidence.value, evidence: insightEvidence.value.trim() || undefined }) });
    insightMessage.value = '商品标签已保存并记录审计日志。'; insightEvidence.value = '';
    await loadProductInsights();
  } catch (reason) { error.value = reason instanceof Error ? reason.message : '商品标签保存失败'; }
  finally { insightLoading.value = false; }
}

function editInsightTag(tag: InsightTag) {
  tagEditorOpen.value = true;
  editingTagId.value = tag.id; newTagName.value = tag.name; newTagDimension.value = tag.dimension;
  newTagParentId.value = tag.parentId ?? ''; newTagDescription.value = tag.description ?? '';
  newTagSortOrder.value = tag.sortOrder; newTagStatus.value = tag.status;
}

function resetInsightTagEditor() {
  tagEditorOpen.value = false;
  editingTagId.value = ''; newTagName.value = ''; newTagDimension.value = 'HEALTH_NEED';
  newTagParentId.value = ''; newTagDescription.value = ''; newTagSortOrder.value = 0; newTagStatus.value = 'ACTIVE';
}

async function saveInsightTag() {
  if (!newTagName.value.trim()) return;
  insightLoading.value = true; error.value = ''; insightMessage.value = '';
  try {
    await managementRequest(`/management/product-insight-tags/definitions?storeId=${encodeURIComponent(props.storeId)}`, {
      method: 'POST', body: JSON.stringify({ id: editingTagId.value || undefined, name: newTagName.value.trim(), dimension: newTagDimension.value, parentId: newTagParentId.value || null, description: newTagDescription.value.trim() || undefined, sortOrder: newTagSortOrder.value, status: newTagStatus.value }),
    });
    insightMessage.value = editingTagId.value ? '标签已更新。' : '新标签已创建，可立即用于商品标记。';
    resetInsightTagEditor();
    await loadProductInsights();
  } catch (reason) { error.value = reason instanceof Error ? reason.message : '标签创建失败'; }
  finally { insightLoading.value = false; }
}

watch(month, loadOverview);
watch(productDetailPageSize, () => { productDetailPage.value = 1; });
watch(productDetailPageCount, (count) => { if (productDetailPage.value > count) productDetailPage.value = count; });
watch(insightDetailPageSize, () => { insightDetailPage.value = 1; });
watch(insightDetailPageCount, (count) => { if (insightDetailPage.value > count) insightDetailPage.value = count; });
watch([inventoryTableQuery, inventoryBrandFilter, inventoryCategoryFilter, inventoryStatusFilter, inventorySort, inventoryPageSize], () => { inventoryPage.value = 1; });
watch(inventoryPageCount, (count) => { if (inventoryPage.value > count) inventoryPage.value = count; });
watch(activeSection, (section) => {
  if (section === 'system') void loadSystemManagement();
  if (section === 'sales') void loadSalesAnalysis();
  if (section === 'products') void loadProductsBrands();
  if (section === 'inventory') void loadInventoryOperations();
  if (section === 'stores') void loadStoreComparison();
  if (section === 'customers') void loadProductInsights();
});
onMounted(async () => { await loadManagementAccess(); if (canSection('overview')) await loadOverview(); });
</script>

<template>
  <section class="management-workspace decision-workspace" :class="{ 'inventory-master': activeSection === 'inventory' }">
    <aside class="management-sidebar">
      <div class="sidebar-heading">
        <p>MANAGEMENT</p>
        <strong>经营功能导航</strong>
        <small>选择下面的分析模块</small>
      </div>
      <nav aria-label="经营管理功能">
        <section v-for="group in navigationGroups" :key="group.label" class="navigation-group" :aria-label="group.label">
        <h3>{{ group.label }}</h3>
        <button v-for="section in sections.filter(item => group.ids.includes(item.id))" :key="section.id" type="button" :disabled="!canSection(section.id)" :aria-current="activeSection === section.id ? 'page' : undefined" :class="{ active: activeSection === section.id, locked: !canSection(section.id) }" :title="canSection(section.id) ? section.description : '当前账号没有此模块权限'" @click="selectSection(section.id)">
          <span>{{ section.label }}</span><small>{{ section.description }}</small><em v-if="!canSection(section.id)">无权限</em><em v-else-if="!section.ready">规划中</em>
        </button>
        </section>
      </nav>
      <p>正式数据来自 Homi 数据库<br />POS 数据同步后自动更新</p>
    </aside>

    <main class="management-content" :class="{ 'overview-content': activeSection === 'overview' }">
    <header class="management-heading">
      <div><p>MANAGEMENT / {{ activeSection.toUpperCase() }}</p><h2>{{ currentSection.label }}</h2><span>{{ overview?.store.name || storeName }} · {{ currentSection.description }}</span></div>
      <div v-if="activeSection === 'overview'" class="management-filters"><label>统计月份<input v-model="month" type="month" @click="openNativePicker" /></label><button type="button" :disabled="loading" @click="loadOverview">{{ loading ? '加载中…' : '刷新数据' }}</button></div>
      <div v-else-if="activeSection === 'system'" class="management-filters"><button type="button" :disabled="posLoading || posRunning" @click="loadSystemManagement">{{ posLoading ? '加载中…' : '刷新状态' }}</button></div>
    </header>

    <div v-if="error" class="management-alert error" role="alert"><span>{{ error }}。本次数据未能更新，已显示的内容可能不是最新结果。</span><button class="text-action" type="button" :disabled="pageBusy" @click="retryCurrentPage">重新加载</button></div>
    <p v-if="pageBusy" class="page-load-status" role="status">正在更新{{ currentSection.label }}…</p>
    <template v-if="activeSection === 'overview'">
    <p v-if="overview && !overview.salesAvailable" class="management-alert pending sync-required-alert"><strong>POS 销售数据尚未同步</strong><span>当前销售卡片显示为 0，“刷新数据”只查询本地数据库，不会从 POS 拉取订单，也不会使用演示数据。</span><button type="button" :disabled="!canSection('system')" @click="openDataCenter('sync')">前往 POS 同步</button></p>
    <div class="data-freshness" aria-label="数据更新时间"><span>库存更新：{{ dateTime(foundation?.quality.inventory.latestUpdatedAt ?? null) }}</span><span>POS 最近成功同步：{{ dateTime(overview?.lastPosSyncAt ?? null) }}</span><button v-if="canSection('system')" class="text-action" type="button" @click="openDataCenter()">查看数据检查</button></div>

    <template v-if="overview">
      <div class="management-kpis">
        <article><span>本月净销售额</span><strong>{{ money(overview.sales.current.netRevenue) }}</strong><small :class="comparisonClass(overview.sales.comparison.netRevenuePercent)">较上月 {{ percent(overview.sales.comparison.netRevenuePercent) }}</small></article>
        <article><span>本月订单</span><strong>{{ overview.sales.current.orderCount }}</strong><small :class="comparisonClass(overview.sales.comparison.orderCountPercent)">较上月 {{ percent(overview.sales.comparison.orderCountPercent) }}</small></article>
        <article><span>销售件数</span><strong>{{ number(overview.sales.current.unitsSold) }}</strong><small :class="comparisonClass(overview.sales.comparison.unitsSoldPercent)">较上月 {{ percent(overview.sales.comparison.unitsSoldPercent) }}</small></article>
        <article><span>平均客单价</span><strong>{{ money(overview.sales.current.averageOrderValue) }}</strong><small :class="comparisonClass(overview.sales.comparison.averageOrderValuePercent)">较上月 {{ percent(overview.sales.comparison.averageOrderValuePercent) }}</small></article>
        <article class="inventory-kpi"><span>当前库存</span><strong>{{ number(overview.inventory.totalQuantity) }} 件</strong><small>{{ overview.inventory.productCount }} 种商品 · {{ overview.inventory.batchCount }} 个批次</small></article>
        <article class="expiry-kpi"><span>到期关注</span><strong>{{ number(overview.inventory.expiryAttentionQuantity) }} 件</strong><small>已过期、紧急、预警及提前关注</small></article>
      </div>

      <section class="management-card overview-actions">
        <div class="card-title"><div><h3>经营关注与待办</h3><p>查看分析，或进入库存系统处理</p></div></div>
        <div class="action-list">
          <button type="button" @click="emit('open-report', 'receipts')"><span>待提交入库单</span><strong>{{ overview.inventory.activity.openReceiptCount }} 单</strong><small>查看入库单 →</small></button>
          <button type="button" @click="emit('open-report', 'expiry')"><span>到期关注</span><strong>{{ number(overview.inventory.expiryAttentionQuantity) }} 件</strong><small>查看批次明细 →</small></button>
          <button type="button" @click="emit('open-report', 'movements')"><span>本月库存作业</span><strong>{{ overview.inventory.activity.movementCountThisMonth }} 笔流水</strong><small>盘点修正 {{ overview.inventory.activity.stocktakeAdjustmentsThisMonth }} 笔 · 查看流水 →</small></button>
        </div>
        <p class="scope-note">最近库存流水：{{ dateTime(overview.inventory.activity.latestMovement?.createdAt ?? null) }}</p>
      </section>

      <div class="management-grid">
        <section class="management-card sales-trend">
          <div class="card-title"><div><h3>本月销售走势</h3><p>{{ overview.period.month }} 每日净销售概览 · 退款 {{ money(overview.sales.current.refunds) }}</p></div><button v-if="canSection('sales')" class="text-action" type="button" @click="openSalesFromOverview">销售详情 →</button></div>
          <p v-if="overview.sales.current.dailySales.length === 1" class="scope-note">当前只有 1 个有记录的日期；尚不足以形成多日趋势。</p>
          <div v-if="overview.sales.current.dailySales.length" class="trend-line-chart">
            <svg viewBox="-150 0 1160 230" role="img" aria-label="本月每日净销售趋势">
              <defs><linearGradient id="overview-area" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#24d6e5" stop-opacity=".38"/><stop offset="100%" stop-color="#24d6e5" stop-opacity="0"/></linearGradient></defs>
              <g class="chart-grid"><line v-for="y in [40,82,124,166,210]" :key="y" x1="0" :y1="y" x2="1000" :y2="y" /></g><g class="chart-values"><text v-for="y in [40,124,210]" :key="y" x="-12" :y="y + 5" text-anchor="end">{{ money(maxDailyRevenue * (210 - y) / 170) }}</text></g>
              <path :d="areaPath(overviewTrendPoints)" fill="url(#overview-area)" />
              <polyline :points="linePath(overviewTrendPoints)" />
              <circle v-for="(point,index) in overviewTrendPoints" :key="index" :cx="point.x" :cy="point.y" r="4"><title>{{ overview.sales.current.dailySales[index].date }} · {{ money(point.value) }}</title></circle>
            </svg>
            <div class="trend-axis"><span v-for="day in overview.sales.current.dailySales.filter((_,index,rows) => index === 0 || index === rows.length - 1 || index % Math.max(1, Math.ceil(rows.length / 5)) === 0)" :key="day.date">{{ day.date.slice(5) }}</span></div>
          </div>
          <p v-else class="management-empty">本月暂无已同步销售记录。</p><details v-if="overview.sales.current.dailySales.length" class="trend-data"><summary>查看趋势数值</summary><p class="scope-note">仅列出接口返回日期；缺少记录不自动补零。</p><dl><div v-for="day in overview.sales.current.dailySales" :key="day.date"><dt>{{ day.date }}</dt><dd>{{ money(day.revenue) }}</dd></div></dl></details>
        </section>

        <section class="management-card expiry-panel">
          <div class="card-title"><div><h3>库存临期预警</h3><p>按现有预警规则统计件数</p></div></div>
          <div class="donut-analysis">
            <div class="donut-chart" :style="{ background: expiryGradient }"><div><strong>{{ number(expiryTotal) }}</strong><span>关注件数</span></div></div>
            <div class="donut-legend"><div class="expired"><i></i><span>已过期</span><strong>{{ overview.inventory.expiry.expired }}</strong></div><div class="urgent"><i></i><span>紧急临期</span><strong>{{ overview.inventory.expiry.urgent }}</strong></div><div class="warning"><i></i><span>临期预警</span><strong>{{ overview.inventory.expiry.warning }}</strong></div><div class="early"><i></i><span>提前关注</span><strong>{{ overview.inventory.expiry.early }}</strong></div></div>
          </div>
        </section>

        <section class="management-card ranking">
          <div class="card-title"><div><h3>热销商品 · 前 5 名</h3><p>{{ overview.period.month }} · 按商品销售金额排序</p></div><button v-if="canSection('sales')" class="text-action" type="button" @click="openSalesFromOverview">查看完整排行 →</button></div>
          <ol v-if="overview.sales.current.topProducts.length"><li v-for="(item, index) in overview.sales.current.topProducts.slice(0,5)" :key="item.productName"><b>{{ index + 1 }}</b><span><strong>{{ item.productName }}</strong><small>{{ item.brandName }} · {{ number(item.quantity) }} 件</small></span><em>{{ money(item.revenue) }}</em></li></ol>
          <p v-else class="management-empty">POS 同步后将在这里显示商品排行。</p>
        </section>

        <section class="management-card analysis-shortcuts"><div class="card-title"><div><h3>继续分析</h3><p>按经营问题进入明细</p></div></div><button v-if="canSection('products')" class="text-action" type="button" @click="productView = 'brands'; selectSection('products')">品牌销售与库存结构 →</button><button v-if="canSection('inventory')" class="text-action" type="button" @click="selectSection('inventory')">缺货、滞销与库存覆盖 →</button></section>
      </div>
    </template>
    </template>

    <section v-else-if="activeSection === 'sales'" class="sales-analysis-page">
      <div class="period-shortcuts" role="group" aria-label="快捷日期"><span>快捷日期</span><button type="button" @click="setDateRange('sales', 'today')">今天</button><button type="button" @click="setDateRange('sales', 'week')">近7天</button><button type="button" @click="setDateRange('sales', 'month')">本月</button><small>修改条件后点击更新分析</small></div>
      <form class="sales-filter-panel" @submit.prevent="loadSalesAnalysis">
        <label>开始日期<input v-model="salesFrom" type="date" @click="openNativePicker" /></label>
        <label>结束日期<input v-model="salesTo" type="date" @click="openNativePicker" /></label>
        <label>统计维度<select v-model="salesDimension"><option value="DAY">按日</option><option value="WEEK">按周</option><option value="MONTH">按月</option></select></label>
        <label>品牌<input v-model="salesBrand" placeholder="全部品牌" /></label>
        <label>品类<input v-model="salesCategory" placeholder="全部品类" /></label>
        <button type="submit" :disabled="salesLoading">{{ salesLoading ? '查询中…' : '更新分析' }}</button><button class="secondary-action" type="button" @click="clearSalesFilters">清除品牌 / 品类</button>
      </form>
      <details v-if="salesAnalysis" class="analysis-method"><summary>销售统计口径与筛选说明</summary><p class="scope-note">品牌按正式品牌名称精确匹配，品类按商品主档匹配；名称识别的品牌尚不能代替正式字段。商品分类与健康需求标签分开统计。</p><p v-if="salesAnalysis?.channelNotice" class="management-alert pending sync-required-alert"><strong>渠道说明</strong><span>{{ salesAnalysis.channelNotice }}“更新分析”只读取已同步数据。</span><button v-if="!salesAnalysis.dataAvailable" type="button" :disabled="!canSection('system')" @click="openDataCenter('sync')">前往 POS 同步</button></p>
      <p v-if="salesAnalysis?.refundNotice" class="management-alert pending"><strong>退款口径</strong><span>{{ salesAnalysis.refundNotice }}</span></p></details><p v-if="salesAnalysis && !salesAnalysis.dataAvailable" class="inline-notice">所选期间没有已同步订单，不代表门店没有销售。<button v-if="canSection('system')" type="button" class="text-action" @click="openDataCenter('sync')">检查 POS 同步 →</button></p>

      <template v-if="salesAnalysis">
        <p class="scope-note">当前：{{ salesAnalysis.period.from }} 至 {{ salesAnalysis.period.to }} · 对比：{{ salesAnalysis.period.previousFrom }} 至 {{ salesAnalysis.period.previousTo }}（前一等长时段，非同比）</p>
        <div class="sales-kpis">
          <article><span>净销售额</span><strong>{{ money(salesAnalysis.metrics.netRevenue) }}</strong><small :class="comparisonClass(salesAnalysis.comparison.netRevenuePercent)">较上期 {{ percent(salesAnalysis.comparison.netRevenuePercent) }}</small></article>
          <article><span>订单数</span><strong>{{ salesAnalysis.metrics.orderCount }}</strong><small :class="comparisonClass(salesAnalysis.comparison.orderCountPercent)">较上期 {{ percent(salesAnalysis.comparison.orderCountPercent) }}</small></article>
          <article><span>销售件数</span><strong>{{ number(salesAnalysis.metrics.unitsSold) }}</strong><small :class="comparisonClass(salesAnalysis.comparison.unitsSoldPercent)">较上期 {{ percent(salesAnalysis.comparison.unitsSoldPercent) }}</small></article>
          <article><span>平均客单价</span><strong>{{ money(salesAnalysis.metrics.averageOrderValue) }}</strong><small :class="comparisonClass(salesAnalysis.comparison.averageOrderValuePercent)">较上期 {{ percent(salesAnalysis.comparison.averageOrderValuePercent) }}</small></article>
          <article><span>退款金额</span><strong>{{ money(salesAnalysis.metrics.refunds) }}</strong><small>销售总额 {{ money(salesAnalysis.metrics.grossRevenue) }}</small></article>
        </div>

        <div class="sales-dashboard-grid">
          <section class="system-card sales-trend-card"><div class="card-title"><div><h3>{{ singleDaySales ? '当日销售走势' : '销售趋势' }}</h3><p>{{ singleDaySales ? '每 3 小时汇总净销售额' : `${salesAnalysis.period.from} 至 ${salesAnalysis.period.to}` }}</p></div></div><p v-if="salesTrendSeries.length === 1" class="scope-note">当前只有 1 个有记录的统计时段，尚不足以形成趋势。</p><div v-if="salesTrendSeries.length && salesAnalysis.dataAvailable" class="trend-line-chart sales-line-chart"><svg viewBox="-150 0 1160 230" role="img" aria-label="查询期间销售走势"><defs><linearGradient id="sales-area" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#6d7cff" stop-opacity=".4"/><stop offset="100%" stop-color="#6d7cff" stop-opacity="0"/></linearGradient></defs><g class="chart-grid"><line v-for="y in [40,82,124,166,210]" :key="y" x1="0" :y1="y" x2="1000" :y2="y" /></g><g class="chart-values"><text v-for="y in [40,124,210]" :key="y" x="-12" :y="y + 5" text-anchor="end">{{ money(maxSalesTrend * (210 - y) / 170) }}</text></g><path :d="areaPath(salesTrendPoints)" fill="url(#sales-area)"/><polyline :points="linePath(salesTrendPoints)"/><circle v-for="(point,index) in salesTrendPoints" :key="index" :cx="point.x" :cy="point.y" r="4"><title>{{ salesTrendSeries[index].label }} · {{ money(point.value) }}</title></circle></svg><div class="trend-axis"><span v-for="item in salesTrendSeries.filter((_,index,rows) => index === 0 || index === rows.length - 1 || index % Math.max(1, Math.ceil(rows.length / 5)) === 0)" :key="item.label">{{ item.label.length > 5 ? item.label.slice(5) : item.label }}</span></div></div><p v-else class="system-empty">所选日期暂无 POS 销售数据。</p><details v-if="salesAnalysis.dataAvailable" class="trend-data"><summary>查看趋势数值</summary><p class="scope-note">按返回的统计时段展示，未返回的日期不自动补零。</p><dl><div v-for="(item,index) in salesTrendSeries" :key="index"><dt>{{ item.label }}</dt><dd>{{ money(item.revenue) }}</dd></div></dl></details></section>
          <div class="sales-side-column">
            <details class="system-card source-quality"><summary>本次查询的数据范围</summary><div class="card-title"><div><h3>数据可用情况</h3><p>帮助判断分析结果是否完整</p></div></div><dl><div><dt>已读取订单</dt><dd>{{ salesAnalysis.sourceQuality.orders }}</dd></div><div><dt>商品销售行</dt><dd>{{ salesAnalysis.sourceQuality.activeItems }}</dd></div><div><dt>已关联商品</dt><dd>{{ salesAnalysis.sourceQuality.mappedItems }}</dd></div><div><dt>待人工确认</dt><dd>{{ salesAnalysis.sourceQuality.reviewRequiredItems }}</dd></div></dl><button v-if="canSection('system')" type="button" class="text-action" @click="openDataCenter('issues')">查看关联异常 →</button></details>
            <section v-if="!singleDaySales" class="system-card hourly-card"><div class="card-title"><div><h3>销售时段概览</h3><p>每 3 小时汇总</p></div></div><div class="time-bucket-grid"><article v-for="item in salesTimeBuckets" :key="item.label"><span>{{ item.label }}</span><strong>{{ money(item.revenue) }}</strong><small>{{ item.orders }} 单</small></article></div></section>
          </div>
          <section class="system-card sales-ranking"><div class="card-title"><div><h3>热销商品</h3><p>{{ salesAnalysis.period.from }} 至 {{ salesAnalysis.period.to }} · 按销售金额排序</p></div></div><ol v-if="salesAnalysis.topProducts.length"><li v-for="(item,index) in salesAnalysis.topProducts.slice(0,10)" :key="item.productName"><b>{{ index + 1 }}</b><span><strong>{{ item.productName }}</strong><small>{{ item.brandName }} · {{ number(item.quantity) }} 件</small></span><em>{{ money(item.revenue) }}</em></li></ol><p v-else class="system-empty">暂无商品排行。</p></section>
          <section class="system-card sales-ranking"><div class="card-title"><div><h3>品牌销售贡献</h3><p>按商品销售金额排序，未分摊订单级退款；品牌优先取正式资料，缺失时由名称识别</p></div></div><ol v-if="salesAnalysis.topBrands.length"><li v-for="(item,index) in salesAnalysis.topBrands.slice(0,10)" :key="item.brandName"><b>{{ index + 1 }}</b><span><strong>{{ item.brandName }}</strong><small>{{ number(item.quantity) }} 件</small></span><em>{{ money(item.revenue) }}</em></li></ol><p v-else class="system-empty">同步销售数据后显示品牌排行。</p></section>
        </div>
      </template>
    </section>

    <section v-else-if="activeSection === 'products'" class="products-page">
      <div class="period-shortcuts" role="group" aria-label="快捷日期"><span>快捷日期</span><button type="button" @click="setDateRange('products', 'today')">今天</button><button type="button" @click="setDateRange('products', 'week')">近7天</button><button type="button" @click="setDateRange('products', 'month')">本月</button><small>修改条件后点击更新分析</small></div>
      <form class="product-filter-panel" @submit.prevent="loadProductsBrands">
        <label>开始日期<input v-model="productFrom" type="date" @click="openNativePicker" /></label>
        <label>结束日期<input v-model="productTo" type="date" @click="openNativePicker" /></label>
        <label>商品搜索<input v-model="productQuery" placeholder="名称、SKU或条码" /></label>
        <label>品牌<input v-model="productBrand" placeholder="全部品牌" /></label>
        <label>品类<input v-model="productCategory" placeholder="全部品类" /></label>
        <button type="submit" :disabled="productsLoading">{{ productsLoading ? '查询中…' : '更新分析' }}</button><button class="secondary-action" type="button" @click="clearProductFilters">清除商品条件</button>
      </form>
      <details class="analysis-method"><summary>商品分析口径</summary><p>本页仅展示经营数据，不提供商品新增、售价或条码维护。销售金额按已关联正式商品的明细累计，可能与订单净销售额不同；库存是当前余额，不是所选日期的历史库存。</p><p>品牌及品类筛选读取正式商品字段。展示名称可能来自名称识别；商品主档分类不等同于健康需求或人群标签。</p><p v-if="productsBrands && !productsBrands.marginAvailable">{{ productsBrands.marginNotice }}</p><button v-if="canSection('system')" class="text-action" type="button" @click="openDataCenter()">查看正式资料完整度 →</button></details>
      <template v-if="productsBrands">
        <div class="product-kpis">
          <article><span>启用商品</span><strong>{{ productsBrands.summary.productCount }}</strong><small>所选条件下的正式商品</small></article>
          <article><span>有销售商品</span><strong>{{ productsBrands.summary.soldProductCount }}</strong><small>销售 {{ number(productsBrands.summary.unitsSold) }} 件</small></article>
          <article><span>商品销售额</span><strong>{{ money(productsBrands.summary.salesRevenue) }}</strong><small>{{ productsBrands.period.from }} 至 {{ productsBrands.period.to }}</small></article>
          <article><span>当前库存</span><strong>{{ number(productsBrands.summary.currentInventory) }} 件</strong><small>来自正式库存表</small></article>
          <article><span>缺货/低库存</span><strong>{{ productsBrands.summary.lowStockProducts }}</strong><small>按现有最低库存配置判断</small></article>
        </div>
        <div class="view-switcher" role="group" aria-label="商品分析视图"><button type="button" :aria-pressed="productView === 'products'" @click="productView = 'products'">商品明细</button><button type="button" :aria-pressed="productView === 'brands'" @click="productView = 'brands'">品牌结构</button><button type="button" :aria-pressed="productView === 'categories'" @click="productView = 'categories'">品类结构</button></div>
        <div v-show="productView !== 'products'" class="product-analysis-grid">
          <section v-show="productView === 'brands'" class="system-card product-ranking"><div class="card-title"><div><h3>品牌销售与库存结构</h3><p>销售与当前库存关联</p></div></div><ol v-if="productsBrands.brands.length"><li v-for="(item,index) in productsBrands.brands.slice(0,10)" :key="item.name"><b>{{ index + 1 }}</b><span><strong>{{ item.name }}</strong><small>{{ item.productCount }} 种 · 销售 {{ number(item.unitsSold) }} 件 · 库存 {{ number(item.currentInventory) }} 件</small></span><em>{{ money(item.salesRevenue) }}</em></li></ol><p v-else class="system-empty">暂无品牌数据。</p></section>
          <section v-show="productView === 'categories'" class="system-card product-ranking"><div class="card-title"><div><h3>商品主档品类结构</h3><p>按商品销售额排序</p></div></div><ol v-if="productsBrands.categories.length"><li v-for="(item,index) in productsBrands.categories.slice(0,10)" :key="item.name"><b>{{ index + 1 }}</b><span><strong>{{ item.name }}</strong><small>{{ item.productCount }} 种 · 销售 {{ number(item.unitsSold) }} 件</small></span><em>{{ money(item.salesRevenue) }}</em></li></ol><p v-else class="system-empty">暂无品类数据。</p></section>
        </div>
        <section v-show="productView === 'products'" class="system-card product-table-card">
          <div class="card-title"><div><h3>商品销售与库存明细</h3><p>销售来自POS，库存来自正式库存系统；比例不等同于标准库存周转率</p></div><span>{{ productsBrands.products.length }} 种</span></div>
          <div class="product-table-wrap management-detail-scroll"><table><thead><tr><th>商品</th><th>品牌 / 品类</th><th>销售件数</th><th>销售额</th><th>当前库存</th><th title="期间销量除以当前库存，不等于库存周转率">期间销量 / 当前库存</th><th>当前库存状态</th></tr></thead><tbody><tr v-for="item in pagedProductDetails" :key="item.productId"><td><strong>{{ item.productName }}</strong><small>{{ item.sku }}{{ item.barcode ? ` · ${item.barcode}` : ' · 无条码' }}</small></td><td><strong>{{ item.brandName }}</strong><small>{{ item.categoryName }}</small></td><td>{{ number(item.unitsSold) }}</td><td>{{ money(item.salesRevenue) }}</td><td>{{ number(item.currentInventory) }}</td><td>{{ item.salesToStockRatio === null ? '—' : number(item.salesToStockRatio) }}</td><td><b :class="['stock-badge', item.stockStatus.toLowerCase()]">{{ item.stockStatus === 'IN_STOCK' ? '正常' : item.stockStatus === 'LOW' ? '低库存' : '缺货' }}</b></td></tr></tbody></table><p v-if="!productsBrands.products.length" class="system-empty">当前筛选条件没有商品。</p></div>
          <div class="inventory-table-pagination"><span>共 {{ productsBrands.products.length }} 种商品</span><label>每页<select v-model.number="productDetailPageSize"><option :value="50">50</option><option :value="100">100</option></select></label><div><button type="button" :disabled="productDetailPage <= 1" @click="productDetailPage--">上一页</button><b>{{ productDetailPage }} / {{ productDetailPageCount }}</b><button type="button" :disabled="productDetailPage >= productDetailPageCount" @click="productDetailPage++">下一页</button></div></div>
        </section>
      </template>
    </section>

    <section v-else-if="activeSection === 'inventory'" class="inventory-operations-page">
      <form class="inventory-operation-filters" @submit.prevent="loadInventoryOperations">
        <label>销量观察期<select v-model.number="inventoryLookbackDays"><option :value="30">最近30天</option><option :value="60">最近60天</option><option :value="90">最近90天</option><option :value="180">最近180天</option><option :value="365">最近365天</option></select></label>
        <label>查询商品范围<input v-model="inventoryQuery" placeholder="名称、品牌、SKU或条码" /></label>
        <button type="submit" :disabled="inventoryLoading">{{ inventoryLoading ? '分析中…' : '更新分析' }}</button><button class="secondary-action" type="button" @click="inventoryQuery = ''">清除查询范围</button>
      </form>
      <p v-if="inventoryLoading" class="inventory-load-status" role="status">正在更新库存分析，请稍候…</p>
      <p v-else-if="!inventoryOperations && !error" class="system-empty">选择观察期并查询，查看当前门店的库存经营情况。</p>
      <details v-if="inventoryOperations" class="inventory-method-note"><summary>统计口径与数据来源</summary><p>{{ inventoryOperations.turnoverNotice }}</p><p>库存来自正式库存系统，销量来自已同步的 POS 订单。若销售历史未补齐，无销量不代表实际未售出，覆盖天数和滞销结论仅供关注。</p><p>缺货指启用商品的当前库存为零，不等于必须采购。积压筛选为覆盖超过90天，滞销按既有多条件规则判断，两类可以重叠。</p></details><p v-if="inventoryOperations" class="scope-note">销量基于已同步记录；补货或清库存前请核对销售历史。<button v-if="canSection('system')" type="button" class="text-action" @click="openDataCenter('sync')">查看同步记录 →</button></p>
      <template v-if="inventoryOperations">
        <div class="inventory-operation-kpis">
          <article><span>当前库存</span><strong>{{ number(inventoryOperations.summary.totalInventory) }} 件</strong><small>{{ inventoryOperations.summary.stockedProducts }} 种有库存商品</small></article>
          <article><button class="kpi-filter" type="button" @click="inventoryStatusFilter = 'OUT_OF_STOCK'; inventoryPage = 1" aria-label="筛选缺货商品"><span>缺货商品</span><strong>{{ inventoryOperations.summary.outOfStockProducts }}</strong><small>启用但当前库存为0</small></button></article>
          <article><button class="kpi-filter" type="button" @click="inventoryStatusFilter = 'LOW'; inventoryPage = 1" aria-label="筛选低库存商品"><span>低库存商品</span><strong>{{ inventoryOperations.summary.lowStockProducts }}</strong><small>达到已配置最低库存</small></button></article>
          <article><button class="kpi-filter" type="button" @click="inventoryStatusFilter = 'SLOW'; inventoryPage = 1" aria-label="筛选滞销关注"><span>滞销关注</span><strong>{{ inventoryOperations.summary.slowMovingProducts }}</strong><small>有库存且销量不足</small></button></article>
          <article><span>观察商品</span><strong>{{ inventoryOperations.summary.productCount }}</strong><small>最近 {{ inventoryOperations.period.lookbackDays }} 天POS销量</small></article>
        </div>
        <details class="inventory-analysis-disclosure">
        <summary>库存覆盖结构 <span>查看有库存商品预计可售天数</span></summary>
        <div class="inventory-operation-grid">
          <section class="system-card coverage-card"><div class="card-title"><div><h3>库存覆盖结构</h3><p>{{ inventoryOperations.coverageNotice }}</p></div></div><div class="donut-analysis coverage-donut"><div class="donut-chart" :style="{ background: coverageGradient }"><div><strong>{{ coverageTotal }}</strong><span>商品种数</span></div></div><div class="donut-legend"><div class="expired"><i></i><span>无销售</span><strong>{{ inventoryOperations.coverageBuckets.noSales }}</strong></div><div class="healthy"><i></i><span>不足30天</span><strong>{{ inventoryOperations.coverageBuckets.under30 }}</strong></div><div class="medium"><i></i><span>30–90天</span><strong>{{ inventoryOperations.coverageBuckets.days30To90 }}</strong></div><div class="overstock"><i></i><span>超过90天</span><strong>{{ inventoryOperations.coverageBuckets.over90 }}</strong></div></div></div></section>
        </div>
        </details>
        <section class="system-card product-table-card inventory-detail-card" :aria-busy="inventoryLoading">
          <div class="card-title"><div><h3>销售与库存关联明细</h3><p>{{ inventoryOperations.period.from }} 至 {{ inventoryOperations.period.to }} · 库存为当前余额</p></div><span>{{ filteredInventoryProducts.length }} / {{ inventoryOperations.products.length }} 种</span></div>
          <p class="scope-note">以下筛选只作用于已查询结果；各状态可能重叠，数量不可相加。</p><div class="inventory-status-tabs" aria-label="库存状态快捷筛选">
            <button type="button" :class="{ active: inventoryStatusFilter === 'ALL' }" @click="inventoryStatusFilter = 'ALL'">全部 <b>{{ inventoryStatusCounts.ALL }}</b></button>
            <button type="button" :class="{ active: inventoryStatusFilter === 'SLOW' }" @click="inventoryStatusFilter = 'SLOW'">滞销 <b>{{ inventoryStatusCounts.SLOW }}</b></button>
            <button type="button" :class="{ active: inventoryStatusFilter === 'OUT_OF_STOCK' }" @click="inventoryStatusFilter = 'OUT_OF_STOCK'">缺货 <b>{{ inventoryStatusCounts.OUT_OF_STOCK }}</b></button>
            <button type="button" :class="{ active: inventoryStatusFilter === 'LOW' }" @click="inventoryStatusFilter = 'LOW'">低库存 <b>{{ inventoryStatusCounts.LOW }}</b></button>
            <button type="button" :class="{ active: inventoryStatusFilter === 'OVERSTOCK' }" @click="inventoryStatusFilter = 'OVERSTOCK'">积压 <b>{{ inventoryStatusCounts.OVERSTOCK }}</b></button>
            <button type="button" :class="{ active: inventoryStatusFilter === 'NO_MINIMUM' }" @click="inventoryStatusFilter = 'NO_MINIMUM'">未设最低库存 <b>{{ inventoryStatusCounts.NO_MINIMUM }}</b></button>
          </div>
          <div class="inventory-detail-filters">
            <label>筛选当前结果<input v-model="inventoryTableQuery" type="search" placeholder="在已查询商品内筛选" /></label>
            <label>品牌<select v-model="inventoryBrandFilter"><option value="">全部品牌</option><option v-for="brand in inventoryBrands" :key="brand" :value="brand">{{ brand }}</option></select></label>
            <label>商品分类<select v-model="inventoryCategoryFilter"><option value="">全部分类</option><option v-for="category in inventoryCategories" :key="category" :value="category">{{ category }}</option></select></label>
            <label>排序<select v-model="inventorySort"><option value="INVENTORY_DESC">库存从高到低</option><option value="SALES_DESC">销量从高到低</option><option value="COVERAGE_DESC">覆盖天数从高到低</option><option value="LAST_SALE_ASC">最久未销售优先</option><option value="NAME_ASC">商品名称排序</option></select></label>
          </div>
          <button class="text-action clear-table-filter" type="button" @click="clearInventoryFilters">清除表格筛选</button><div class="product-table-wrap inventory-scroll-table"><table><thead><tr><th>商品</th><th>库存</th><th>最低库存</th><th>观察期销量</th><th>日均销量</th><th>覆盖天数</th><th>最后销售</th><th>状态</th></tr></thead><tbody><tr v-for="item in pagedInventoryProducts" :key="item.productId"><td><strong>{{ item.productName }}</strong><small>{{ item.brandName }} · {{ item.categoryName }}</small></td><td>{{ number(item.currentInventory) }}</td><td>{{ item.minimumStock ?? '未配置' }}</td><td>{{ number(item.soldUnits) }}</td><td>{{ number(item.dailyVelocity) }}</td><td>{{ item.coverageDays === null ? '无销量' : `${number(item.coverageDays)} 天` }}</td><td>{{ item.daysSinceLastSale === null ? '无记录' : `${item.daysSinceLastSale} 天前` }}</td><td><b :class="['stock-badge', item.stockStatus.toLowerCase()]">{{ item.stockStatus === 'IN_STOCK' ? (item.slowMoving ? '滞销关注' : '正常') : item.stockStatus === 'LOW' ? '低库存' : '缺货' }}</b></td></tr></tbody></table><p v-if="!pagedInventoryProducts.length" class="system-empty">当前筛选条件没有商品。</p></div>
          <div class="inventory-table-pagination">
            <span>显示 {{ filteredInventoryProducts.length ? (inventoryPage - 1) * inventoryPageSize + 1 : 0 }}–{{ Math.min(inventoryPage * inventoryPageSize, filteredInventoryProducts.length) }} / 共 {{ filteredInventoryProducts.length }} 种商品</span>
            <label>每页<select v-model.number="inventoryPageSize"><option :value="20">20</option><option :value="50">50</option><option :value="100">100</option></select></label>
            <div><button type="button" :disabled="inventoryPage <= 1" @click="inventoryPage--">上一页</button><b>{{ inventoryPage }} / {{ inventoryPageCount }}</b><button type="button" :disabled="inventoryPage >= inventoryPageCount" @click="inventoryPage++">下一页</button></div>
          </div>
        </section>
      </template>
    </section>

    <section v-else-if="activeSection === 'customers'" class="product-insight-page">
      <p v-if="productInsights" class="management-alert pending"><strong>分析口径</strong><span>{{ productInsights.disclaimer }}</span></p>
      <form class="insight-search" @submit.prevent="loadProductInsights"><label>商品搜索<input v-model="insightQuery" placeholder="商品名称、品牌或SKU" /></label><button type="submit" :disabled="insightLoading">{{ insightLoading ? '查询中…' : '查询商品' }}</button></form>
      <template v-if="productInsights">
        <p class="inline-notice">当前查询最多返回 200 种商品，以下分页和覆盖统计仅针对已返回商品，并非全店总数。已审核与待复核可能重叠，“未标记”接口统计暂待核对。</p>
        <div class="view-switcher" role="group" aria-label="分类与标签视图"><button type="button" :aria-pressed="tagView === 'products'" @click="tagView = 'products'">商品标记</button><button type="button" :aria-pressed="tagView === 'dictionary'" @click="tagView = 'dictionary'">标签字典</button></div>
        <div v-show="tagView === 'products'" class="insight-kpis"><article><span>已返回商品</span><strong>{{ productInsights.coverage.productCount }}</strong><small>当前筛选范围</small></article><article><span>已审核标记</span><strong>{{ productInsights.coverage.approvedProducts }}</strong><small>覆盖率 {{ productInsights.coverage.approvedCoveragePercent }}%</small></article><article><span>待复核</span><strong>{{ productInsights.coverage.pendingProducts }}</strong><small>不得直接用于正式分析</small></article><article><span>未标记（待核对）</span><strong>{{ productInsights.coverage.untaggedProducts }}</strong><small>后续逐步人工补充</small></article></div>
        <section v-show="tagView === 'dictionary'" class="system-card taxonomy-card"><div class="card-title"><div><h3>小程序分类与经营标签</h3><p>小程序分类作为正式标签来源；点击标签可编辑、排序或停用</p></div><span>{{ productInsights.tags.length }} 个</span></div><div class="taxonomy-columns management-detail-scroll"><article v-for="dimension in productInsights.dimensions" :key="dimension.code"><h4>{{ dimension.name }}</h4><div class="taxonomy-list"><div v-for="root in productInsights.tagTree.filter(item => item.dimension === dimension.code)" :key="root.id" :class="{ inactive: root.status === 'INACTIVE' }"><button type="button" :disabled="!managementAccess?.capabilities.permissionsManage" @click="editInsightTag(root)"><strong>{{ root.name }}</strong><small>{{ root.source === 'MINIPROGRAM' ? `小程序分类 #${root.externalId}` : '人工标签' }} · {{ root.status === 'ACTIVE' ? '启用' : '已停用' }}</small></button><ul v-if="root.children.length"><li v-for="child in root.children" :key="child.id" :class="{ inactive: child.status === 'INACTIVE' }"><button type="button" :disabled="!managementAccess?.capabilities.permissionsManage" @click="editInsightTag(child)">{{ child.name }}</button></li></ul></div><p v-if="!productInsights.tagTree.some(item => item.dimension === dimension.code)">暂无标签</p></div></article></div><p class="detail-scroll-hint">分类区域固定高度；可在区域内滚动查看全部 {{ productInsights.tags.length }} 个标签。</p></section>
        <div v-if="managementAccess?.capabilities.permissionsManage && tagView === 'dictionary'" class="dictionary-actions"><button class="secondary-action" type="button" @click="resetInsightTagEditor(); tagEditorOpen = true">新增标签</button><span class="scope-note">标签仅用于商品经营描述，不会自动改写商品主档品类。</span></div>
        <section v-if="managementAccess?.capabilities.permissionsManage && tagView === 'dictionary' && tagEditorOpen" class="system-card tag-definition-editor"><div class="card-title"><div><h3>{{ editingTagId ? '编辑标签' : '新增标签' }}</h3><p>由你定义名称、类型、上级、排序和启停状态，不需要填写技术代码</p></div><button type="button" class="editor-reset" @click="resetInsightTagEditor">关闭编辑</button></div><div class="tag-definition-form"><label>标签名称<input v-model="newTagName" maxlength="120" placeholder="例如：中老年营养" /></label><label>标签类型<select v-model="newTagDimension"><option v-for="dimension in productInsights.dimensions" :key="dimension.code" :value="dimension.code">{{ dimension.name }}</option></select></label><label>上级分类<select v-model="newTagParentId"><option value="">无上级（一级标签）</option><option v-for="tag in productInsights.tags.filter(item => !item.parentId && item.id !== editingTagId)" :key="tag.id" :value="tag.id">{{ tag.name }}</option></select></label><label>说明<input v-model="newTagDescription" maxlength="255" placeholder="选填：这个标签的使用口径" /></label><label>排序<input v-model.number="newTagSortOrder" type="number" /></label><label>状态<select v-model="newTagStatus"><option value="ACTIVE">启用</option><option value="INACTIVE">停用</option></select></label><button type="button" :disabled="insightLoading || !newTagName.trim()" @click="saveInsightTag">{{ editingTagId ? '保存修改' : '新增标签' }}</button></div></section>
        <details v-if="managementAccess?.capabilities.permissionsManage && tagView === 'products'" class="system-card insight-editor"><summary>给商品添加经营标签</summary><div class="card-title"><div><h3>标记商品需求与适用人群</h3><p>选择正式商品与启用标签，并填写判断依据</p></div></div><div class="insight-editor-form"><label>商品<select v-model="insightProductId"><option value="">请选择商品</option><option v-for="item in productInsights.products" :key="item.productId" :value="item.productId">{{ item.productName }}</option></select></label><label>标签<select v-model="insightTagCode"><option value="">请选择标签</option><optgroup v-for="dimension in productInsights.dimensions" :key="dimension.code" :label="dimension.name"><option v-for="tag in productInsights.tags.filter(item => item.dimension === dimension.code && item.status === 'ACTIVE')" :key="tag.code" :value="tag.code">{{ tag.parentId ? `${productInsights.tags.find(parent => parent.id === tag.parentId)?.name} / ` : '' }}{{ tag.name }}</option></optgroup></select></label><label>置信度<select v-model="insightConfidence"><option value="LOW">低</option><option value="MEDIUM">中</option><option value="HIGH">高</option></select></label><label class="evidence-field">判断依据<input v-model="insightEvidence" maxlength="255" placeholder="例如：商品明确标注儿童配方；鱼油主要对应心血管需求" /></label><button type="button" :disabled="insightLoading || !insightProductId || !insightTagCode" @click="assignInsightTag">保存标签</button></div></details><p v-if="insightMessage" class="insight-success" role="status">{{ insightMessage }}</p>
        <section v-show="tagView === 'products'" class="system-card insight-product-list"><div class="card-title"><div><h3>商品标签覆盖</h3><p>仅已审核标签进入后续消费需求分析</p></div><span>{{ productInsights.products.length }} 种</span></div><div class="insight-products management-detail-scroll"><article v-for="item in pagedInsightProducts" :key="item.productId"><div><strong>{{ item.productName }}</strong><small>{{ item.brandName }} · {{ item.categoryName }} · {{ item.sku }}</small></div><div class="insight-tags"><span v-for="assignment in item.assignments" :key="assignment.id" :class="assignment.reviewStatus.toLowerCase()"><b>{{ assignment.tag.name }}</b><small>{{ assignment.confidence === 'HIGH' ? '高' : assignment.confidence === 'MEDIUM' ? '中' : '低' }}置信度 · {{ assignment.reviewStatus === 'APPROVED' ? '已审核' : '待复核' }}</small></span><em v-if="!item.assignments.length">尚未标记</em></div></article></div><div class="inventory-table-pagination"><span>共 {{ productInsights.products.length }} 种商品</span><label>每页<select v-model.number="insightDetailPageSize"><option :value="50">50</option><option :value="100">100</option></select></label><div><button type="button" :disabled="insightDetailPage <= 1" @click="insightDetailPage--">上一页</button><b>{{ insightDetailPage }} / {{ insightDetailPageCount }}</b><button type="button" :disabled="insightDetailPage >= insightDetailPageCount" @click="insightDetailPage++">下一页</button></div></div></section>
      </template>
    </section>

    <section v-else-if="activeSection === 'stores'" class="store-comparison-page">
      <div class="period-shortcuts" role="group" aria-label="快捷日期"><span>快捷日期</span><button type="button" @click="setDateRange('stores', 'today')">今天</button><button type="button" @click="setDateRange('stores', 'week')">近7天</button><button type="button" @click="setDateRange('stores', 'month')">本月</button><small>修改条件后点击更新分析</small></div>
      <form class="store-comparison-filters" @submit.prevent="loadStoreComparison"><label>开始日期<input v-model="storeFrom" type="date" @click="openNativePicker" /></label><label>结束日期<input v-model="storeTo" type="date" @click="openNativePicker" /></label><button type="submit" :disabled="storeLoading">{{ storeLoading ? '查询中…' : '更新分析' }}</button></form>
      <p v-if="storeComparison?.comparisonNotice" class="management-alert pending"><strong>单店模式</strong><span>{{ storeComparison.comparisonNotice }}</span></p>
      <template v-if="storeComparison">
        <div class="store-kpis"><article><span>启用门店</span><strong>{{ storeComparison.storeCount }}</strong><small>{{ storeComparison.comparisonAvailable ? '已启用多店比较' : '当前为单店经营基线' }}</small></article><article><span>销售额</span><strong>{{ money(storeComparison.stores.reduce((sum,item) => sum + item.sales.netRevenue, 0)) }}</strong><small>{{ storeComparison.period.from }} 至 {{ storeComparison.period.to }}</small></article><article><span>订单</span><strong>{{ storeComparison.stores.reduce((sum,item) => sum + item.sales.orderCount, 0) }}</strong><small>全部正式门店</small></article><article><span>库存</span><strong>{{ number(storeComparison.stores.reduce((sum,item) => sum + item.inventory.totalQuantity, 0)) }} 件</strong><small>正式库存余额</small></article></div>
        <div v-if="!storeComparison.comparisonAvailable" class="store-card-grid"><article v-for="item in storeComparison.stores" :key="item.store.id" class="system-card store-result-card" :class="{ selected: item.selected }"><div class="card-title"><div><h3>{{ item.store.name }}</h3><p>{{ item.store.code }}</p></div><span v-if="item.selected">当前门店</span></div><dl><div><dt>净销售额</dt><dd>{{ money(item.sales.netRevenue) }}</dd></div><div><dt>订单数</dt><dd>{{ item.sales.orderCount }}</dd></div><div><dt>平均客单价</dt><dd>{{ money(item.sales.averageOrderValue) }}</dd></div><div><dt>销售件数</dt><dd>{{ number(item.sales.unitsSold) }}</dd></div><div><dt>库存</dt><dd>{{ number(item.inventory.totalQuantity) }}</dd></div><div><dt>缺货 / 低库存</dt><dd>{{ item.inventory.outOfStockProducts }} / {{ item.inventory.lowStockProducts }}</dd></div></dl></article></div>
        <section v-if="storeComparison.comparisonAvailable" class="system-card store-comparison-table"><div class="card-title"><div><h3>门店经营比较</h3><p>销售按所选期间统计；库存为当前余额，库存高低不代表经营优劣</p></div></div><div class="product-table-wrap management-detail-scroll"><table><thead><tr><th>门店</th><th>净销售额</th><th>订单</th><th>客单价</th><th>销售件数</th><th>当前库存</th><th>缺货 / 低库存</th></tr></thead><tbody><tr v-for="item in storeComparison.stores" :key="item.store.id"><td><strong>{{ item.store.name }}</strong><small>{{ item.store.code }}{{ item.selected ? ' · 当前门店' : '' }}</small></td><td>{{ money(item.sales.netRevenue) }}</td><td>{{ item.sales.orderCount }}</td><td>{{ money(item.sales.averageOrderValue) }}</td><td>{{ number(item.sales.unitsSold) }}</td><td>{{ number(item.inventory.totalQuantity) }}</td><td>{{ item.inventory.outOfStockProducts }} / {{ item.inventory.lowStockProducts }}</td></tr></tbody></table></div></section>
        <details v-if="storeComparison.comparisonAvailable" class="system-card store-ranking-card"><summary>查看分项排行</summary><div class="card-title"><div><h3>门店经营排行</h3><p>多门店时自动形成正式排行；单店时作为后续比较基线</p></div></div><div class="store-rankings"><div><h4>按净销售额</h4><ol><li v-for="(item,index) in storeComparison.ranking.byRevenue" :key="item.storeId"><b>{{ index + 1 }}</b><span>{{ item.storeName }}</span><em>{{ money(item.value) }}</em></li></ol></div><div><h4>按订单数</h4><ol><li v-for="(item,index) in storeComparison.ranking.byOrders" :key="item.storeId"><b>{{ index + 1 }}</b><span>{{ item.storeName }}</span><em>{{ number(item.value) }}</em></li></ol></div><div><h4>库存分布（按数量）</h4><ol><li v-for="(item,index) in storeComparison.ranking.byInventory" :key="item.storeId"><b>{{ index + 1 }}</b><span>{{ item.storeName }}</span><em>{{ number(item.value) }} 件</em></li></ol></div></div></details>
      </template>
    </section>

    <section v-else-if="activeSection === 'system'" class="pos-management">
      <div class="view-switcher" role="group" aria-label="数据中心视图"><button type="button" :aria-pressed="systemView === 'sync'" @click="systemView = 'sync'">POS 同步</button><button type="button" :aria-pressed="systemView === 'quality'" @click="systemView = 'quality'">数据检查</button><button v-if="managementAccess?.capabilities.posIssues" type="button" :aria-pressed="systemView === 'issues'" @click="systemView = 'issues'">异常记录</button></div>
      <p class="scope-note">“刷新状态”只查询现有数据；只有“开始同步”会读取 POS 订单。</p>
      <p v-if="posMessage" class="management-alert inventory-source"><strong>同步完成</strong><span>{{ posMessage }}</span></p>
      <p class="management-alert pending"><strong>观察模式</strong><span>手动同步只读取POS订单并写入观察区，不会直接扣减正式库存，也不需要操作POS收银机。</span></p>



      <section v-if="managementAccess?.capabilities.posSync" v-show="systemView === 'sync'" class="system-card manual-sync-card primary-sync-card">
        <div class="card-title"><div><h3>同步 POS 销售订单</h3><p>选择营业日期，由当前服务器主动读取 POS 接口</p></div><span>不扣减正式库存</span></div>
        <div class="primary-sync-controls"><label>营业日期<input v-model="syncDate" type="date" :disabled="posRunning || posStatus?.running" @click="openNativePicker" /></label><button type="button" :disabled="posRunning || posStatus?.running || !syncDate" @click="runManualSync">{{ posRunning ? '正在同步…' : '开始同步' }}</button></div>
        <label class="reconcile-option"><input v-model="reconcile" type="checkbox" :disabled="posRunning || posStatus?.running" /><span><strong>重新核对当天订单</strong><small>只在退款、取消或订单状态发生变化时勾选；日常同步不需勾选。</small></span></label>
      </section>

      <div v-show="systemView === 'sync'" class="pos-status-grid">
        <article><span>同步状态</span><strong :class="posLoadError || posStatus?.latestRun?.status === 'FAILED' ? 'status-warning' : posStatus?.running ? 'status-running' : ''">{{ posLoading ? '加载中' : posLoadError ? '加载失败' : !posStatus ? '未获取' : posStatus.running ? '正在同步' : posStatus.latestRun?.status === 'FAILED' ? '最近失败' : '空闲' }}</strong><small>最近成功或失败结果见下方记录</small></article>
        <article><span>POS订单</span><strong>{{ posLoading || posLoadError ? '—' : (posCheck?.orders.total ?? '—') }}</strong><small>最近订单：{{ dateTime(posCheck?.orders.lastOrderedAt ?? null) }}</small></article>
        <article><span>商品映射率</span><strong>{{ posLoading || posLoadError || !posCheck ? '—' : `${posCheck.items.mappingCoveragePercent}%` }}</strong><small>{{ posCheck?.items.mapped ?? '—' }} / {{ posCheck?.items.total ?? '—' }} 条销售明细已关联</small></article>
        <article><span>待处理异常</span><strong class="status-warning">{{ posLoading || posLoadError ? '—' : (posCheck?.issues.total ?? '—') }}</strong><small>商品、退款和人工复核事项</small></article>
      </div>

      <section v-if="systemView === 'quality'" class="system-card foundation-check">
        <div class="card-title"><div><h3>正式资料与数据可用情况</h3><p>从经营总览集中到此处；统计基于正式资料，不将名称识别当成已维护资料</p></div><button v-if="canSection('overview')" type="button" class="secondary-action" :disabled="loading" @click="loadOverview">{{ loading ? '检查中…' : '更新资料检查' }}</button></div>
        <template v-if="foundation && canSection('overview')">
          <p class="scope-note">检查快照：{{ dateTime(foundation.generatedAt) }} · 当前库存更新：{{ dateTime(foundation.quality.inventory.latestUpdatedAt) }}</p>
          <div class="quality-metrics">
            <article><span>有正库存 / 启用商品</span><strong>{{ foundation.quality.inventory.productCount }} / {{ foundation.quality.catalog.productCount }} 种</strong></article>
            <article><span>正式品牌字段完整率</span><strong>{{ foundation.quality.catalog.brandCoveragePercent }}%</strong></article>
            <article><span>商品主档品类完整率</span><strong>{{ foundation.quality.catalog.categoryCoveragePercent }}%</strong></article>
            <article><span>售价完整率</span><strong>{{ foundation.quality.catalog.sellingPriceCoveragePercent }}%</strong></article>
            <article><span>条码覆盖（可选）</span><strong>{{ foundation.quality.catalog.barcodeCoveragePercent }}%</strong></article>
            <article><span>最低库存配置覆盖</span><strong>{{ foundation.quality.catalog.minimumStockCoveragePercent }}%</strong></article>
            <article><span>POS 商品关联率</span><strong>{{ foundation.quality.sales.mappingCoveragePercent }}%</strong><small>{{ foundation.quality.sales.mappedOrderItemCount }} / {{ foundation.quality.sales.orderItemCount }} 条销售明细</small></article>
          </div>
          <div class="readiness-list"><div v-for="domain in foundation.domains.filter(item => ['OVERVIEW', 'INVENTORY_OPERATIONS', 'SALES'].includes(item.code))" :key="domain.code"><span>{{ domainLabel(domain.code) }}</span><b :class="domain.status.toLowerCase()">{{ readinessLabel(domain.status) }}</b><small>{{ domain.gaps.join('；') || '当前基础指标可以使用' }}</small></div></div>
          <p class="scope-note">条码不是库存商品的必填条件；无条码商品正常计入库存。品牌榜可以使用名称识别结果，但这里的完整率和品牌筛选依据正式字段。健康需求、人群等标签不自动写入商品主档品类。</p>
        </template>
        <p v-else class="system-empty">{{ canSection('overview') ? '尚未取得资料检查快照，请点击更新资料检查。' : '当前账号没有全店资料检查权限。' }}</p>
      </section>

      <div v-show="systemView === 'quality'" class="pos-system-grid">
        <section v-if="managementAccess?.capabilities.posIssues" class="system-card health-check-card">
          <div class="card-title"><div><h3>数据检查</h3><p>检查时间：{{ dateTime(posCheck?.checkedAt ?? null) }}</p></div><span>{{ posLoading ? '加载中' : posLoadError ? '加载失败' : !posCheck ? '未获取' : posCheck.readiness === 'READY' ? '可用于分析' : posCheck.readiness === 'NEEDS_REVIEW' ? '需要处理' : '等待数据' }}</span></div>
          <ul><li v-for="check in posCheck?.checks ?? []" :key="check.code"><b :class="check.passed ? 'pass' : 'fail'">{{ check.passed ? '✓' : '!' }}</b><span>{{ check.message }}</span></li></ul>
        </section>
      </div>

      <section v-if="managementAccess?.capabilities.posIssues" v-show="systemView === 'issues'" class="system-card issue-card"><p class="scope-note">当前显示接口返回的前 20 条异常；不是全部异常列表。此处仅查看，关联和退款处理仍需按既有流程完成。</p>
        <div class="card-title"><div><h3>异常记录</h3><p>未映射商品、需复核商品与待处理退款</p></div><span>{{ posIssues?.summary.itemIssues ?? 0 }} 项商品 · {{ posIssues?.summary.pendingRefunds ?? 0 }} 笔退款</span></div>
        <div class="issue-table-wrap management-detail-scroll">
          <table v-if="posIssues?.itemIssues.items.length"><thead><tr><th>订单</th><th>时间</th><th>POS商品</th><th>数量</th><th>类型</th><th>原因</th></tr></thead><tbody><tr v-for="item in posIssues.itemIssues.items" :key="item.id"><td>{{ item.orderNo }}</td><td>{{ dateTime(item.orderedAt) }}</td><td><strong>{{ item.productName || '未命名商品' }}</strong><small>{{ item.externalProductId }}{{ item.barcode ? ` · ${item.barcode}` : '' }}</small></td><td>{{ item.quantity }}</td><td>{{ item.disposition === 'UNMAPPED' ? '未映射' : '需复核' }}</td><td>{{ item.reason || '—' }}</td></tr></tbody></table>
          <p v-else class="system-empty">{{ posLoading ? '正在加载异常记录…' : posLoadError || !posIssues ? '尚未取得异常记录，不能判断是否存在异常。' : '当前没有未映射或需复核的销售商品。' }}</p>
        </div>
        <div v-if="posIssues?.pendingRefunds.items.length" class="refund-list management-detail-scroll"><article v-for="refund in posIssues.pendingRefunds.items" :key="refund.id"><strong>订单 {{ refund.orderNo }}</strong><span>退款 {{ money(Number(refund.amount)) }}</span><small>{{ refund.reason }}</small></article></div>
      </section>

      <section v-if="managementAccess?.capabilities.posSync" v-show="systemView === 'sync'" class="system-card history-card">
        <div class="card-title"><div><h3>最近同步历史</h3><p>保留最近20次运行结果</p></div><span title="同步游标对应的来源订单时间，不代表该期间数据已全部同步">最近来源时间：{{ dateTime(posStatus?.cursor?.lastSourceTimestamp ?? null) }}</span></div>
        <div class="sync-history management-detail-scroll" v-if="posStatus?.history.length"><article v-for="run in posStatus.history" :key="run.id"><b :class="run.status.toLowerCase()">{{ run.status === 'SUCCEEDED' ? '成功' : run.status === 'FAILED' ? '失败' : '运行中' }}</b><span><strong>{{ run.requestedFrom || '未指定日期' }}</strong><small>{{ dateTime(run.startedAt) }} · 订单 {{ run.ordersObserved }} · 明细 {{ run.itemsObserved }} · 异常 {{ run.exceptionsCount }}</small></span><em>{{ run.errorMessage || `新增 ${run.ordersInserted}，更新 ${run.ordersUpdated}，跳过 ${run.ordersSkipped}` }}</em></article></div>
        <p v-else class="system-empty">{{ posLoading ? '正在加载同步记录…' : posLoadError || !posStatus ? '同步记录未获取，请重试。' : '尚无POS同步运行记录。' }}</p>
      </section>
      <details v-if="managementAccess" class="system-card access-summary-card"><summary>当前账号权限（仅展示）</summary><div class="card-title"><div><h3>当前账号经营权限</h3><p>{{ managementAccess.administrator ? '管理员自动拥有全部经营权限' : `角色：${managementAccess.roleCodes.join('、')}` }}</p></div><span>{{ managementAccess.grantedPermissionCodes.length }} 项</span></div><div class="access-capabilities"><b :class="{ granted: managementAccess.capabilities.overviewView }">经营总览</b><b :class="{ granted: managementAccess.capabilities.salesView }">销售与商品</b><b :class="{ granted: managementAccess.capabilities.inventoryView }">库存经营</b><b :class="{ granted: managementAccess.capabilities.posSync }">POS同步</b><b :class="{ granted: managementAccess.capabilities.posIssues }">异常记录</b><b :class="{ granted: managementAccess.capabilities.permissionsManage }">权限管理</b></div></details>
    </section>

    <section v-else class="planned-section">
      <div class="planned-icon">◫</div>
      <p>MODULE STRUCTURE READY</p>
      <h3>{{ currentSection.label }}</h3>
      <span>{{ currentSection.description }}已经作为独立功能区预留。接入对应数据接口后，这里会展示专属图表、筛选条件和明细表，不会继续堆放到经营总览。</span>
    </section>
    </main>

    <nav class="management-mobile-nav" aria-label="手机经营管理导航">
      <button :class="{ active: activeSection === 'overview' }" :disabled="!canSection('overview')" @click="selectSection('overview')"><span>⌂</span>总览</button>
      <button :class="{ active: activeSection === 'sales' }" :disabled="!canSection('sales')" @click="selectSection('sales')"><span>↗</span>销售</button>
      <button :class="{ active: activeSection === 'products' }" :disabled="!canSection('products')" @click="selectSection('products')"><span>◇</span>商品</button>
      <button :class="{ active: activeSection === 'inventory' }" :disabled="!canSection('inventory')" @click="selectSection('inventory')"><span>▦</span>库存</button>
      <button :class="{ active: ['customers', 'stores', 'system'].includes(activeSection) }" :aria-expanded="showMobileMore" @click="showMobileMore = true"><span>•••</span>更多</button>
    </nav>

    <div v-if="showMobileMore" class="management-more-overlay" role="presentation" @click.self="showMobileMore = false">
      <section class="management-more-sheet" role="dialog" aria-modal="true" aria-label="更多经营模块">
        <header><div><small>MORE MODULES</small><h2>更多经营模块</h2></div><button type="button" aria-label="关闭更多模块" @click="showMobileMore = false">×</button></header>
        <div>
          <button v-for="section in sections.filter((item) => ['customers', 'stores', 'system'].includes(item.id))" :key="section.id" type="button" :disabled="!canSection(section.id)" @click="selectSection(section.id)"><span>{{ section.id === 'customers' ? '◫' : section.id === 'stores' ? '⌘' : '⚙' }}</span><strong>{{ section.label }}</strong><small>{{ canSection(section.id) ? section.description : '当前账号无权限' }}</small></button>
        </div>
      </section>
    </div>
  </section>
</template>

<style scoped src="./inventory-master.css"></style>

<style scoped>
/* finesse · product-ui · evidence-first management cockpit */
.management-workspace{display:grid;grid-template-columns:230px minmax(0,1fr);gap:18px;color:#17243a}.management-sidebar{display:flex;flex-direction:column;min-height:720px;padding:18px 12px;border:1px solid #dce8f7;border-radius:22px;background:linear-gradient(180deg,#13243f,#0d1a30);box-shadow:0 18px 45px rgb(28 52 89 / 15%)}.sidebar-heading{display:grid;gap:5px;padding:8px 10px 18px;color:#fff}.sidebar-heading strong{font-size:20px}.sidebar-heading small{overflow:hidden;color:#9eb2d0;text-overflow:ellipsis;white-space:nowrap}.management-sidebar nav{display:grid;gap:5px}.management-sidebar button{position:relative;display:grid;gap:3px;width:100%;padding:12px;border:0;border-radius:13px;color:#dbe8fa;background:transparent;text-align:left}.management-sidebar button span{font-weight:850}.management-sidebar button small{color:#8fa4c2;font-size:11px}.management-sidebar button em{position:absolute;top:10px;right:9px;padding:2px 5px;border-radius:7px;color:#93a7c5;background:rgb(255 255 255 / 8%);font-size:9px;font-style:normal}.management-sidebar button.locked{opacity:.48;cursor:not-allowed}.management-sidebar button.locked em{color:#ffd8a8;background:rgb(255 174 66 / 12%)}.management-sidebar button.active{color:#fff;background:linear-gradient(135deg,#1eb6ed,#3868f4);box-shadow:0 10px 22px rgb(26 103 226 / 28%)}.management-sidebar button.active small,.management-sidebar button.active em{color:#eaf6ff}.management-sidebar>p{margin:auto 8px 4px;color:#7187a8;font-size:10px;line-height:1.7}.management-content{display:grid;align-content:start;gap:18px;min-width:0}.management-heading{display:flex;align-items:end;justify-content:space-between;gap:24px;padding:24px 26px;border:1px solid #dce8f7;border-radius:24px;background:linear-gradient(135deg,#f8fcff,#eef5ff 55%,#eefbf8);box-shadow:0 18px 45px rgb(46 88 145 / 10%)}.management-heading p{margin:0 0 5px;color:#2188f3;font-size:12px;font-weight:900;letter-spacing:.15em}.management-heading h2{margin:0;font-size:30px}.management-heading span{display:block;margin-top:6px;color:#6d7b91}.management-filters{display:flex;align-items:end;gap:10px}.management-filters label{display:grid;gap:6px;color:#69778d;font-size:12px;font-weight:800}.management-filters input,.management-filters button{min-height:42px;border:1px solid #cfddf0;border-radius:12px;background:#fff;padding:0 14px;font:inherit}.management-filters button{color:#fff;border:0;background:linear-gradient(135deg,#17b8f4,#3567f4);font-weight:850}.management-alert{display:flex;gap:8px;padding:15px 18px;border-radius:16px}.management-alert span{color:#59677b}.management-alert.pending{background:#fff8df;border:1px solid #f4d982}.management-alert.error{color:#9c2f38;background:#fff0f1;border:1px solid #f2bcc1}.management-kpis{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:12px}.management-kpis article{display:grid;gap:8px;min-height:120px;padding:18px;border:1px solid #dfebf8;border-radius:19px;background:linear-gradient(145deg,#fff,#f4f8ff);box-shadow:0 12px 28px rgb(43 75 120 / 8%)}.management-kpis span{color:#68778d;font-size:13px;font-weight:800}.management-kpis strong{font-size:25px}.management-kpis small{color:#728097}.management-kpis .up{color:#159766}.management-kpis .down{color:#d3535a}.management-kpis .inventory-kpi{background:linear-gradient(145deg,#ecf6ff,#eaf2ff)}.management-kpis .expiry-kpi{background:linear-gradient(145deg,#fff7ec,#fff0f1)}.management-grid{display:grid;grid-template-columns:1.35fr .65fr;gap:16px}.management-card{min-height:280px;padding:22px;border:1px solid #dfe9f6;border-radius:22px;background:rgb(255 255 255 / 92%);box-shadow:0 14px 35px rgb(39 73 116 / 9%)}.card-title{display:flex;justify-content:space-between;gap:12px}.card-title h3{margin:0;font-size:19px}.card-title p{margin:5px 0 0;color:#8290a3;font-size:13px}.card-title>span{color:#d05b68;font-weight:750}.bar-chart{display:flex;align-items:end;gap:8px;height:210px;margin-top:20px;padding:20px 8px 0;border-bottom:1px solid #dce5f1;overflow-x:auto}.bar-column{display:grid;align-items:end;gap:7px;min-width:28px;height:100%;text-align:center}.bar-column b{position:relative;display:block;min-height:5px;border-radius:7px 7px 2px 2px;background:linear-gradient(180deg,#24b9ef,#4264f0)}.bar-column i{display:none;position:absolute;bottom:calc(100% + 5px);left:50%;transform:translateX(-50%);padding:4px 6px;border-radius:6px;color:#fff;background:#17243a;font-size:10px;font-style:normal;white-space:nowrap}.bar-column:hover i{display:block}.bar-column small{font-size:10px;color:#8390a2}.expiry-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:24px}.expiry-grid div{display:grid;gap:8px;padding:18px;border-radius:16px}.expiry-grid strong{font-size:27px}.expired{color:#a8444e;background:#fff0f1}.urgent{color:#b46623;background:#fff3e5}.warning{color:#947112;background:#fff9dc}.early{color:#277493;background:#eaf8ff}.ranking ol{display:grid;gap:5px;margin:16px 0 0;padding:0;list-style:none}.ranking li{display:grid;grid-template-columns:30px 1fr auto;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid #edf1f6}.ranking li>b{display:grid;place-items:center;width:26px;height:26px;border-radius:8px;color:#2878ec;background:#e8f2ff}.ranking li span{display:grid;gap:3px;min-width:0}.ranking li span strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.ranking li small{color:#8490a0}.ranking li em{color:#25334a;font-style:normal;font-weight:850}.management-empty{display:grid;place-items:center;min-height:190px;color:#8995a6}.sync-note{margin:0;color:#8490a0;font-size:12px;text-align:right}.planned-section{display:grid;place-items:center;min-height:520px;padding:50px;border:1px dashed #bfd0e8;border-radius:24px;background:linear-gradient(145deg,#fbfdff,#f2f7ff);text-align:center}.planned-icon{display:grid;width:62px;height:62px;place-items:center;border-radius:18px;color:#fff;background:linear-gradient(135deg,#17b8f4,#3567f4);font-size:28px}.planned-section>p{margin:18px 0 5px;color:#3381e5;font-size:11px;font-weight:900;letter-spacing:.14em}.planned-section h3{margin:0;font-size:28px}.planned-section>span{max-width:650px;margin:12px 0 25px;color:#6b7b91;line-height:1.7}.planned-modules{display:flex;justify-content:center;flex-wrap:wrap;gap:9px}.planned-modules b{padding:9px 13px;border:1px solid #d6e3f4;border-radius:999px;color:#53667f;background:#fff;font-size:12px}
.management-workspace{align-items:stretch;min-height:calc(100dvh - 112px)}
.management-sidebar{position:sticky;top:12px;min-height:0;max-height:calc(100vh - 24px);overflow-y:auto;scrollbar-width:thin;scrollbar-color:#355170 transparent}
.sync-required-alert{align-items:center}.sync-required-alert span{flex:1}.sync-required-alert button{flex:0 0 auto;min-height:38px;padding:0 14px;border:1px solid #3b95ff;border-radius:10px;color:#fff;background:linear-gradient(135deg,#16b9ee,#3768f4);font:inherit;font-size:12px;font-weight:850;cursor:pointer}.sync-required-alert button:hover{filter:brightness(1.08)}
.primary-sync-card{gap:12px;border-color:#285779;background:linear-gradient(135deg,#102535,#101a2a)}.primary-sync-controls{display:grid;grid-template-columns:minmax(190px,320px) minmax(150px,220px);align-items:end;gap:12px}.primary-sync-controls label{display:grid;gap:7px;color:#90a0b6;font-size:12px;font-weight:850}.primary-sync-controls input{min-height:46px;padding:0 13px;border-radius:12px}.primary-sync-controls button{min-height:46px;border:0;border-radius:12px;color:#fff;background:linear-gradient(135deg,#14b8ef,#3c66f2);font:inherit;font-weight:900;cursor:pointer;box-shadow:0 10px 24px rgb(28 116 234 / 24%)}.primary-sync-controls button:disabled{opacity:.55;cursor:not-allowed}.primary-sync-card .reconcile-option{max-width:760px}.pos-system-grid:has(> :only-child){grid-template-columns:1fr}
.sidebar-heading{gap:4px;margin:0 8px 12px;padding:8px 2px 18px;border-bottom:1px solid rgb(255 255 255 / 12%)}
.sidebar-heading p{margin:0;color:#58a8ff;font-size:10px;font-weight:900;letter-spacing:.14em}
.sidebar-heading strong{font-size:18px}
.sidebar-heading small{color:#8298b9;white-space:nowrap}
.management-content{grid-template-rows:auto minmax(0,1fr);min-height:100%}
/* Overview has multiple direct grid rows; notices must retain their content height. */
.management-content.overview-content{grid-template-rows:none;grid-auto-rows:max-content}
.overview-content>.management-alert{margin:0;align-items:center;flex-wrap:wrap;min-width:0}
.overview-content>.management-alert>strong{flex-shrink:0}
.overview-content>.management-alert>span{flex:1 1 240px;min-width:0;overflow-wrap:anywhere}
.planned-section{height:100%}
.management-alert.inventory-source{border:1px solid #a7dfd0;color:#176d5d;background:#effbf7}.inventory-truth-panel{display:grid;gap:18px;padding:22px;border:1px solid #d7e7f5;border-radius:22px;background:linear-gradient(145deg,#fff,#f2f9ff 62%,#effbf7);box-shadow:0 14px 35px rgb(39 73 116 / 8%)}.inventory-truth-panel>.card-title>span{color:#21876f}.inventory-truth-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.inventory-truth-grid article{display:grid;align-content:start;gap:9px;min-height:128px;padding:17px;border:1px solid #dce8f4;border-radius:17px;background:rgb(255 255 255 / 88%)}.inventory-truth-grid article>span{color:#63748b;font-size:13px;font-weight:850}.inventory-truth-grid article>strong{font-size:23px}.inventory-truth-grid article>small{color:#7b899c;line-height:1.5}.coverage-row{display:grid;grid-template-columns:32px minmax(40px,1fr) 42px;align-items:center;gap:7px}.coverage-row small{color:#728198}.coverage-row b{display:block;height:7px;overflow:hidden;border-radius:999px;background:#e6edf6}.coverage-row i{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,#21b9e9,#3d6cf1)}.coverage-row em{color:#506078;font-size:11px;font-style:normal;text-align:right}.readiness-list{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.readiness-list>div{display:grid;grid-template-columns:1fr auto;gap:5px 10px;padding:13px 15px;border-radius:14px;background:#f7faff}.readiness-list span{font-weight:850}.readiness-list b{padding:3px 7px;border-radius:999px;font-size:10px}.readiness-list b.ready{color:#167a5e;background:#dcf6ec}.readiness-list b.partial{color:#2871c8;background:#e6f1ff}.readiness-list b.waiting_for_data{color:#9a6b16;background:#fff2cc}.readiness-list b.blocked{color:#a3444d;background:#ffe6e8}.readiness-list small{grid-column:1/-1;color:#7a889b;line-height:1.45}.inventory-note{margin:0;padding-top:2px;color:#67788e;font-size:12px}
.pos-management{display:grid;align-content:start;gap:16px}.pos-status-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.pos-status-grid article,.system-card{border:1px solid #dce8f5;border-radius:20px;background:rgb(255 255 255 / 94%);box-shadow:0 12px 30px rgb(39 73 116 / 8%)}.pos-status-grid article{display:grid;gap:8px;min-height:116px;padding:18px}.pos-status-grid span{color:#69788d;font-size:13px;font-weight:800}.pos-status-grid strong{font-size:25px}.pos-status-grid small{color:#7e8b9d}.status-ok{color:#168264}.status-running{color:#2875d7}.status-warning{color:#bd6a22}.pos-system-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:16px}.system-card{padding:21px}.manual-sync-card{display:grid;align-content:start;gap:14px}.manual-sync-card>label:not(.reconcile-option){display:grid;gap:7px;color:#617187;font-size:12px;font-weight:850}.manual-sync-card input[type=date]{min-height:44px;padding:0 12px;border:1px solid #d4e0ef;border-radius:12px;background:#f9fbfe;font:inherit}.manual-sync-card>button{min-height:46px;border:0;border-radius:13px;color:#fff;background:linear-gradient(135deg,#18b6ef,#3769f3);font-weight:850}.manual-sync-card>button:disabled{opacity:.55}.manual-sync-card>p{margin:0;color:#78879a;font-size:12px;line-height:1.55}.reconcile-option{display:flex;align-items:flex-start;gap:10px;padding:12px;border-radius:13px;background:#f4f8fd}.reconcile-option input{margin-top:3px}.reconcile-option span{display:grid;gap:3px}.reconcile-option small{color:#7b899d;line-height:1.45}.health-check-card ul{display:grid;gap:9px;margin:18px 0 0;padding:0;list-style:none}.health-check-card li{display:flex;align-items:center;gap:10px;padding:10px;border-radius:12px;background:#f7faff}.health-check-card li b{display:grid;flex:0 0 auto;width:25px;height:25px;place-items:center;border-radius:8px}.health-check-card li b.pass{color:#197a61;background:#dcf6ec}.health-check-card li b.fail{color:#a6641e;background:#fff0d6}.issue-card,.history-card{display:grid;gap:15px}.issue-table-wrap{max-width:100%;overflow-x:auto}.issue-table-wrap table{width:100%;min-width:820px;border-collapse:collapse}.issue-table-wrap th,.issue-table-wrap td{padding:11px 10px;border-bottom:1px solid #e9eff6;text-align:left}.issue-table-wrap td>strong,.issue-table-wrap td>small{display:block}.issue-table-wrap td>small{margin-top:3px;color:#8290a2}.system-empty{display:grid;min-height:100px;place-items:center;margin:0;color:#8491a3}.refund-list{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px}.refund-list article{display:grid;gap:5px;padding:12px;border-radius:13px;background:#fff2f3}.refund-list span{color:#bd4b55;font-weight:850}.refund-list small{color:#7d899a}.sync-history{display:grid;gap:8px}.sync-history article{display:grid;grid-template-columns:68px minmax(200px,1fr) minmax(180px,.8fr);align-items:center;gap:12px;padding:12px;border-radius:13px;background:#f7faff}.sync-history article>b{padding:6px 8px;border-radius:9px;font-size:11px;text-align:center}.sync-history b.succeeded{color:#14795c;background:#dcf6ec}.sync-history b.failed{color:#a44049;background:#ffe7e9}.sync-history b.running{color:#276fc5;background:#e6f1ff}.sync-history article>span{display:grid;gap:3px}.sync-history small,.sync-history em{color:#7d899b;font-size:11px;font-style:normal}.sync-history em{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.access-summary-card{display:grid;gap:14px}.access-capabilities{display:flex;flex-wrap:wrap;gap:8px}.access-capabilities b{padding:8px 11px;border-radius:999px;color:#8a96a7;background:#eef2f6;font-size:12px}.access-capabilities b.granted{color:#146f5a;background:#dcf6ec}
.sales-analysis-page{display:grid;align-content:start;gap:14px}.sales-filter-panel{display:grid;grid-template-columns:repeat(5,minmax(120px,1fr)) auto;align-items:end;gap:10px;padding:17px;border:1px solid #dce8f5;border-radius:19px;background:rgb(255 255 255 / 94%)}.sales-filter-panel label{display:grid;gap:6px;color:#68788e;font-size:12px;font-weight:850}.sales-filter-panel input,.sales-filter-panel select{width:100%;min-width:0;min-height:42px;padding:0 11px;border:1px solid #d4e0ef;border-radius:11px;background:#f9fbfe;font:inherit}.sales-filter-panel button{min-height:42px;padding:0 17px;border:0;border-radius:11px;color:#fff;background:linear-gradient(135deg,#18b6ef,#3769f3);font-weight:850;white-space:nowrap}.sales-kpis{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:11px}.sales-kpis article{display:grid;gap:6px;min-height:96px;padding:15px;border:1px solid #dce8f5;border-radius:18px;background:linear-gradient(145deg,#fff,#f4f8ff)}.sales-kpis span{color:#68778c;font-size:13px;font-weight:850}.sales-kpis strong{font-size:23px}.sales-kpis small{color:#7d899b}.sales-kpis small.up{color:#16815f}.sales-kpis small.down{color:#bf4f58}.sales-dashboard-grid{display:grid;grid-template-columns:1.35fr .65fr;gap:15px}.sales-trend-card{min-height:300px}.sales-side-column{display:grid;align-content:start;gap:15px}.sales-side-column .system-card{min-height:0;padding:16px}.sales-side-column .card-title h3{font-size:16px}.source-quality dl{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:12px 0 0}.source-quality dl>div{display:grid;gap:3px;padding:10px;border-radius:12px;background:#f3f7fc}.source-quality dt{color:#748398;font-size:11px}.source-quality dd{margin:0;font-size:19px;font-weight:850}.time-bucket-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px;margin-top:11px}.time-bucket-grid article{display:grid;gap:2px;min-width:0;padding:7px;border:1px solid #25334a;border-radius:9px;background:#0d1828}.time-bucket-grid span{color:#7fd9ea;font-size:10px}.time-bucket-grid strong{overflow:hidden;color:#e7effb;font-size:11px;text-overflow:ellipsis;white-space:nowrap}.time-bucket-grid small{color:#74849a;font-size:9px}.sales-ranking{min-height:0}.sales-ranking ol{display:grid;gap:3px;max-height:330px;margin:12px 0 0;padding:0 5px 0 0;overflow-y:auto;list-style:none;scrollbar-color:#34455f transparent}.sales-ranking li{display:grid;grid-template-columns:27px minmax(0,1fr) auto;align-items:center;gap:9px;padding:8px 0;border-bottom:1px solid #edf1f6}.sales-ranking li>b{display:grid;width:25px;height:25px;place-items:center;border-radius:8px;color:#2878ec;background:#e8f2ff}.sales-ranking li span{display:grid;gap:3px;min-width:0}.sales-ranking li span strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.sales-ranking li small{color:#8290a2}.sales-ranking li em{font-style:normal;font-weight:850}
.products-page{display:grid;align-content:start;gap:16px}.product-filter-panel{display:grid;grid-template-columns:repeat(5,minmax(120px,1fr)) auto;align-items:end;gap:10px;padding:17px;border:1px solid #dce8f5;border-radius:19px;background:rgb(255 255 255 / 94%)}.product-filter-panel label{display:grid;gap:6px;color:#68788e;font-size:12px;font-weight:850}.product-filter-panel input{width:100%;min-width:0;min-height:42px;padding:0 11px;border:1px solid #d4e0ef;border-radius:11px;background:#f9fbfe;font:inherit}.product-filter-panel button{min-height:42px;padding:0 17px;border:0;border-radius:11px;color:#fff;background:linear-gradient(135deg,#18b6ef,#3769f3);font-weight:850}.product-kpis{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:11px}.product-kpis article{display:grid;gap:8px;min-height:112px;padding:17px;border:1px solid #dce8f5;border-radius:18px;background:linear-gradient(145deg,#fff,#f4f8ff)}.product-kpis span{color:#68778c;font-size:13px;font-weight:850}.product-kpis strong{font-size:23px}.product-kpis small{color:#7d899b}.product-analysis-grid{display:grid;grid-template-columns:1fr 1fr .8fr;gap:15px}.product-ranking ol{display:grid;gap:5px;margin:14px 0 0;padding:0;list-style:none}.product-ranking li{display:grid;grid-template-columns:27px minmax(0,1fr) auto;align-items:center;gap:9px;padding:9px 0;border-bottom:1px solid #edf1f6}.product-ranking li>b{display:grid;width:25px;height:25px;place-items:center;border-radius:8px;color:#2878ec;background:#e8f2ff}.product-ranking li span{display:grid;gap:3px;min-width:0}.product-ranking li span strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.product-ranking li small{color:#8290a2}.product-ranking li em{font-style:normal;font-weight:850}.product-table-card{display:grid;gap:15px}.product-table-wrap{max-width:100%;overflow-x:auto}.product-table-wrap table{width:100%;min-width:920px;border-collapse:collapse}.product-table-wrap th,.product-table-wrap td{padding:11px 10px;border-bottom:1px solid #e9eff6;text-align:left}.product-table-wrap td>strong,.product-table-wrap td>small{display:block}.product-table-wrap td>small{margin-top:3px;color:#8290a2}.stock-badge{display:inline-block;padding:5px 8px;border-radius:999px;font-size:11px}.stock-badge.in_stock{color:#14795c;background:#dcf6ec}.stock-badge.low{color:#a6641e;background:#fff0d6}.stock-badge.out_of_stock{color:#a44049;background:#ffe7e9}
.inventory-operations-page{display:grid;align-content:start;gap:16px}.inventory-operation-filters{display:grid;grid-template-columns:minmax(160px,.5fr) minmax(240px,1.5fr) auto;align-items:end;gap:10px;padding:17px;border:1px solid #dce8f5;border-radius:19px;background:rgb(255 255 255 / 94%)}.inventory-operation-filters label{display:grid;gap:6px;color:#68788e;font-size:12px;font-weight:850}.inventory-operation-filters input,.inventory-operation-filters select{width:100%;min-width:0;min-height:42px;padding:0 11px;border:1px solid #d4e0ef;border-radius:11px;background:#f9fbfe;font:inherit}.inventory-operation-filters button{min-height:42px;padding:0 18px;border:0;border-radius:11px;color:#fff;background:linear-gradient(135deg,#18b6ef,#3769f3);font-weight:850}.inventory-operation-kpis{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:11px}.inventory-operation-kpis article{display:grid;gap:8px;min-height:112px;padding:17px;border:1px solid #dce8f5;border-radius:18px;background:linear-gradient(145deg,#fff,#f4f8ff)}.inventory-operation-kpis span{color:#68778c;font-size:13px;font-weight:850}.inventory-operation-kpis strong{font-size:23px}.inventory-operation-kpis small{color:#7d899b}.inventory-operation-grid{display:grid;grid-template-columns:.8fr 1fr 1fr;gap:15px}.coverage-buckets{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:16px}.coverage-buckets article{display:grid;gap:6px;padding:14px;border-radius:14px;background:#f3f7fc}.coverage-buckets span{color:#718097;font-size:12px}.coverage-buckets strong{font-size:24px}.inventory-alert-list ol{display:grid;gap:4px;margin:14px 0 0;padding:0;list-style:none}.inventory-alert-list li{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:center;padding:10px 0;border-bottom:1px solid #edf1f6}.inventory-alert-list li span{display:grid;gap:3px;min-width:0}.inventory-alert-list li strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.inventory-alert-list li small{color:#8290a2}.inventory-alert-list li em{color:#2b4261;font-style:normal;font-weight:850;white-space:nowrap}
.management-detail-scroll{max-height:520px;overflow:auto;overscroll-behavior:contain;scrollbar-gutter:stable}.management-detail-scroll thead{position:sticky;z-index:2;top:0;background:#edf3fa;box-shadow:0 1px 0 #dbe5f0}.detail-scroll-hint{margin:0;color:#7c899c;font-size:11px}.inventory-detail-card{min-width:0}.inventory-status-tabs{display:flex;gap:8px;max-width:100%;padding:2px 0 5px;overflow-x:auto;scrollbar-width:thin}.inventory-status-tabs button{display:inline-flex;flex:0 0 auto;align-items:center;gap:7px;min-height:38px;padding:8px 12px;border:1px solid #d9e5f2;border-radius:11px;color:#627187;background:#f7faff;font-weight:800;cursor:pointer;transition:color .18s ease,border-color .18s ease,background .18s ease,transform .18s ease}.inventory-status-tabs button:hover{transform:translateY(-1px);border-color:#92c8ff}.inventory-status-tabs button.active{color:#fff;border-color:transparent;background:linear-gradient(135deg,#18b6ef,#3769f3);box-shadow:0 7px 18px rgb(44 121 236 / 20%)}.inventory-status-tabs button b{display:grid;min-width:23px;height:23px;padding:0 6px;place-items:center;border-radius:999px;color:inherit;background:rgb(128 151 181 / 14%);font-size:11px}.inventory-status-tabs button.active b{background:rgb(255 255 255 / 20%)}.inventory-detail-filters{display:grid;grid-template-columns:minmax(220px,1.5fr) repeat(3,minmax(150px,1fr));gap:10px;padding:13px;border:1px solid #e0e9f3;border-radius:15px;background:#f5f8fc}.inventory-detail-filters label{display:grid;gap:6px;color:#68788e;font-size:11px;font-weight:850}.inventory-detail-filters input,.inventory-detail-filters select{width:100%;min-width:0;min-height:40px;padding:0 10px;border:1px solid #d4e0ef;border-radius:10px;background:#fff;color:#172235;font:inherit}.inventory-scroll-table{max-height:520px;overflow:auto;overscroll-behavior:contain;scrollbar-gutter:stable}.inventory-scroll-table thead{position:sticky;z-index:2;top:0;background:#edf3fa;box-shadow:0 1px 0 #dbe5f0}.inventory-scroll-table tbody tr{transition:background .15s ease}.inventory-scroll-table tbody tr:hover{background:#f4f9ff}.inventory-table-pagination{display:flex;align-items:center;justify-content:space-between;gap:12px;color:#6d7d92;font-size:12px}.inventory-table-pagination>label{display:flex;align-items:center;gap:7px}.inventory-table-pagination select{min-height:34px;padding:0 24px 0 9px;border:1px solid #d4e0ef;border-radius:9px;background:#fff}.inventory-table-pagination>div{display:flex;align-items:center;gap:9px}.inventory-table-pagination button{min-height:34px;padding:0 12px;border:1px solid #cfe0f3;border-radius:9px;color:#246dc8;background:#eef6ff;font-weight:800}.inventory-table-pagination button:disabled{opacity:.42;cursor:not-allowed}.inventory-table-pagination b{min-width:55px;text-align:center}
.store-comparison-page{display:grid;align-content:start;gap:16px}.store-comparison-filters{display:grid;grid-template-columns:minmax(160px,1fr) minmax(160px,1fr) auto;align-items:end;gap:10px;padding:17px;border:1px solid #dce8f5;border-radius:19px;background:rgb(255 255 255 / 94%)}.store-comparison-filters label{display:grid;gap:6px;color:#68788e;font-size:12px;font-weight:850}.store-comparison-filters input{min-height:42px;padding:0 11px;border:1px solid #d4e0ef;border-radius:11px;background:#f9fbfe;font:inherit}.store-comparison-filters button{min-height:42px;padding:0 18px;border:0;border-radius:11px;color:#fff;background:linear-gradient(135deg,#18b6ef,#3769f3);font-weight:850}.store-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:11px}.store-kpis article{display:grid;gap:8px;min-height:112px;padding:17px;border:1px solid #dce8f5;border-radius:18px;background:linear-gradient(145deg,#fff,#f4f8ff)}.store-kpis span{color:#68778c;font-size:13px;font-weight:850}.store-kpis strong{font-size:23px}.store-kpis small{color:#7d899b}.store-card-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:15px}.store-result-card.selected{border-color:#76baff;background:linear-gradient(145deg,#fff,#edf6ff)}.store-result-card dl{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin:18px 0 0}.store-result-card dl>div{display:grid;gap:5px;padding:13px;border-radius:13px;background:#f4f8fd}.store-result-card dt{color:#738198;font-size:11px}.store-result-card dd{margin:0;font-size:18px;font-weight:850}.store-ranking-card{display:grid;gap:14px}.store-rankings{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}.store-rankings>div{padding:14px;border-radius:14px;background:#f5f8fc}.store-rankings h4{margin:0 0 10px}.store-rankings ol{display:grid;gap:8px;margin:0;padding:0;list-style:none}.store-rankings li{display:grid;grid-template-columns:25px minmax(0,1fr) auto;align-items:center;gap:8px}.store-rankings li>b{display:grid;width:24px;height:24px;place-items:center;border-radius:7px;color:#2878ec;background:#e8f2ff}.store-rankings li span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.store-rankings li em{font-style:normal;font-weight:850}
.product-insight-page{display:grid;align-content:start;gap:16px}.insight-search{display:grid;grid-template-columns:minmax(240px,1fr) auto;align-items:end;gap:10px;padding:17px;border:1px solid #dce8f5;border-radius:19px;background:#fff}.insight-search label,.insight-editor-form label{display:grid;gap:6px;color:#68788e;font-size:12px;font-weight:850}.insight-search input,.insight-editor-form input,.insight-editor-form select{width:100%;min-width:0;min-height:42px;padding:0 11px;border:1px solid #d4e0ef;border-radius:11px;background:#f9fbfe;font:inherit}.insight-search button,.insight-editor-form button{min-height:42px;padding:0 18px;border:0;border-radius:11px;color:#fff;background:linear-gradient(135deg,#18b6ef,#3769f3);font-weight:850}.insight-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:11px}.insight-kpis article{display:grid;gap:8px;min-height:110px;padding:17px;border:1px solid #dce8f5;border-radius:18px;background:linear-gradient(145deg,#fff,#f4f8ff)}.insight-kpis span{color:#68778c;font-size:13px;font-weight:850}.insight-kpis strong{font-size:23px}.insight-kpis small{color:#7d899b}.insight-editor{display:grid;gap:15px}.insight-editor-form{display:grid;grid-template-columns:1.3fr 1fr .55fr 1.6fr auto;align-items:end;gap:10px}.insight-success{margin:0;color:#15755d}.insight-product-list{display:grid;gap:15px}.insight-products{display:grid;gap:8px}.insight-products>article{display:grid;grid-template-columns:minmax(220px,.8fr) minmax(300px,1.5fr);gap:14px;padding:14px;border-radius:14px;background:#f6f9fd}.insight-products>article>div:first-child{display:grid;gap:4px}.insight-products small{color:#7d899b}.insight-tags{display:flex;flex-wrap:wrap;align-items:center;gap:7px}.insight-tags span{display:grid;gap:2px;padding:7px 10px;border-radius:11px;background:#eef3f8}.insight-tags span.approved{color:#166e59;background:#dcf6ec}.insight-tags span.pending{color:#96671b;background:#fff1ce}.insight-tags em{color:#8a96a6;font-style:normal}
.taxonomy-card,.tag-definition-editor{display:grid;gap:15px}.taxonomy-columns{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:11px}.taxonomy-columns>article{padding:14px;border-radius:15px;background:#f6f9fd}.taxonomy-columns h4{margin:0 0 10px}.taxonomy-list{display:grid;gap:7px}.taxonomy-list>div{display:grid;gap:3px;padding:9px;border-radius:11px;background:#fff}.taxonomy-list button{display:grid;width:100%;gap:3px;padding:0;border:0;color:inherit;background:transparent;text-align:left;cursor:pointer}.taxonomy-list button:disabled{cursor:default}.taxonomy-list small,.taxonomy-list p{margin:0;color:#7d899b}.taxonomy-list ul{display:flex;flex-wrap:wrap;gap:5px;margin:5px 0 0;padding:0;list-style:none}.taxonomy-list li{padding:4px 7px;border-radius:8px;color:#356078;background:#e8f7fb;font-size:11px}.taxonomy-list .inactive{opacity:.48}.tag-definition-form{display:grid;grid-template-columns:1fr .7fr 1fr 1.3fr .45fr .55fr auto;align-items:end;gap:10px}.tag-definition-form label{display:grid;gap:6px;color:#68788e;font-size:12px;font-weight:850}.tag-definition-form input,.tag-definition-form select{width:100%;min-width:0;min-height:42px;padding:0 11px;border:1px solid #d4e0ef;border-radius:11px;background:#f9fbfe;font:inherit}.tag-definition-form button,.editor-reset{min-height:42px;padding:0 18px;border:0;border-radius:11px;color:#fff;background:linear-gradient(135deg,#18b6ef,#3769f3);font-weight:850}.editor-reset{min-height:34px;color:#2571cc;background:#e8f3ff}
/* Dark analytics cockpit: charts preserve visual semantics, tables preserve density. */
.management-workspace{--dash-bg:#070d18;--dash-panel:#0d1524;--dash-panel-2:#111c2e;--dash-line:#202c40;--dash-text:#eef4ff;--dash-muted:#8795aa;--dash-cyan:#29d3e2;--dash-blue:#6880ff;--dash-green:#3dd9a2;--dash-amber:#f4b860;--dash-red:#ff7080;position:relative;padding:18px;border:1px solid #172237;border-radius:26px;color:var(--dash-text);background:radial-gradient(circle at 72% -10%,rgb(69 102 189 / 21%),transparent 34%),radial-gradient(circle at 20% 15%,rgb(31 200 211 / 10%),transparent 26%),var(--dash-bg);box-shadow:0 28px 80px rgb(0 0 0 / 35%)}
.management-sidebar{border-color:#1b2940;background:linear-gradient(180deg,#101c30,#091221);box-shadow:inset 0 1px 0 rgb(255 255 255 / 3%),0 20px 50px rgb(0 0 0 / 28%)}.management-sidebar button{color:#c6d2e5}.management-sidebar button small{color:#71829d}.management-sidebar button.active{background:linear-gradient(135deg,#176c8b,#4a58ca);box-shadow:0 10px 28px rgb(37 150 193 / 22%)}
.management-heading{border-color:var(--dash-line);background:linear-gradient(135deg,#101a2b,#0c1422 58%,#10212a);box-shadow:inset 0 1px 0 rgb(255 255 255 / 4%),0 18px 42px rgb(0 0 0 / 22%)}.management-heading p{color:var(--dash-cyan)}.management-heading h2{color:var(--dash-text)}.management-heading span{color:var(--dash-muted)}
.management-workspace input,.management-workspace select{color:var(--dash-text);border-color:#28364c;background:#0a1220;color-scheme:dark}.management-workspace input::placeholder{color:#5e6d83}.management-filters label,.sales-filter-panel label,.product-filter-panel label,.inventory-operation-filters label,.store-comparison-filters label,.insight-search label,.insight-editor-form label,.tag-definition-form label,.manual-sync-card>label:not(.reconcile-option),.inventory-detail-filters label{color:#8998ae}.management-filters input,.sales-filter-panel input,.sales-filter-panel select,.product-filter-panel input,.inventory-operation-filters input,.inventory-operation-filters select,.store-comparison-filters input,.insight-search input,.insight-editor-form input,.insight-editor-form select,.tag-definition-form input,.tag-definition-form select,.inventory-detail-filters input,.inventory-detail-filters select,.manual-sync-card input[type=date]{border-color:#28364c;background:#0a1220;color:var(--dash-text)}
.management-workspace input:not([type=checkbox]),.management-workspace select{border-color:#31435f!important;background:#101b2d!important;color:#f4f7ff!important;-webkit-text-fill-color:#f4f7ff!important}.management-workspace input:not([type=checkbox]):hover,.management-workspace select:hover{border-color:#49617f!important}.management-workspace input:not([type=checkbox]):focus,.management-workspace select:focus{outline:0;border-color:#25c7df!important;background:#101b2d!important;color:#fff!important;-webkit-text-fill-color:#fff!important;box-shadow:0 0 0 3px rgb(37 199 223 / 16%)}.management-workspace input[type=date],.management-workspace input[type=month]{min-width:148px;cursor:pointer;color-scheme:dark!important}.management-workspace input[type=date]::-webkit-calendar-picker-indicator,.management-workspace input[type=month]::-webkit-calendar-picker-indicator{opacity:.95;cursor:pointer;filter:invert(92%) sepia(8%) saturate(451%) hue-rotate(178deg) brightness(105%)}.management-workspace input[type=date]::-webkit-datetime-edit,.management-workspace input[type=month]::-webkit-datetime-edit,.management-workspace input[type=date]::-webkit-datetime-edit-text,.management-workspace input[type=month]::-webkit-datetime-edit-text,.management-workspace input[type=date]::-webkit-datetime-edit-month-field,.management-workspace input[type=date]::-webkit-datetime-edit-day-field,.management-workspace input[type=date]::-webkit-datetime-edit-year-field,.management-workspace input[type=month]::-webkit-datetime-edit-month-field,.management-workspace input[type=month]::-webkit-datetime-edit-year-field{color:#f4f7ff!important;-webkit-text-fill-color:#f4f7ff!important}.management-workspace input:disabled,.management-workspace select:disabled{opacity:.55;cursor:not-allowed}
.sales-filter-panel,.product-filter-panel,.inventory-operation-filters,.store-comparison-filters,.insight-search,.inventory-detail-filters{border-color:var(--dash-line);background:#0c1422}.system-card,.management-card,.pos-status-grid article,.inventory-truth-panel{color:var(--dash-text);border-color:var(--dash-line);background:linear-gradient(145deg,#111b2b,#0c1422);box-shadow:inset 0 1px 0 rgb(255 255 255 / 3%),0 15px 35px rgb(0 0 0 / 20%)}
.management-kpis article,.sales-kpis article,.product-kpis article,.inventory-operation-kpis article,.store-kpis article,.insight-kpis article,.inventory-truth-grid article{color:var(--dash-text);border-color:var(--dash-line);background:linear-gradient(145deg,#131e30,#0c1524);box-shadow:inset 0 1px 0 rgb(255 255 255 / 4%),0 12px 28px rgb(0 0 0 / 18%);transition:transform .2s ease,border-color .2s ease}.management-kpis article:hover,.sales-kpis article:hover,.product-kpis article:hover,.inventory-operation-kpis article:hover,.store-kpis article:hover,.insight-kpis article:hover{transform:translateY(-2px);border-color:#35516f}.management-kpis .inventory-kpi{background:linear-gradient(145deg,#11283a,#101b32)}.management-kpis .expiry-kpi{background:linear-gradient(145deg,#2a1d2a,#171625)}
.management-kpis span,.sales-kpis span,.product-kpis span,.inventory-operation-kpis span,.store-kpis span,.insight-kpis span,.inventory-truth-grid article>span,.pos-status-grid span{color:#8c9ab0}.management-kpis small,.sales-kpis small,.product-kpis small,.inventory-operation-kpis small,.store-kpis small,.insight-kpis small,.inventory-truth-grid article>small,.pos-status-grid small,.card-title p,.sync-note,.detail-scroll-hint{color:var(--dash-muted)}.card-title h3,.product-table-wrap td,.issue-table-wrap td{color:var(--dash-text)}.card-title>span{color:var(--dash-cyan)}
.management-alert.pending{color:#f1c670;border-color:#574b2a;background:#1d1b15}.management-alert.pending span{color:#b7a67d}.management-alert.inventory-source{color:#62d7b4;border-color:#225a4d;background:#0d211e}.management-alert.inventory-source span{color:#8fb9ad}.management-alert.error{color:#ff8b99;border-color:#66313a;background:#26151a}
.trend-line-chart{display:grid;gap:8px;margin-top:18px;min-height:230px}.trend-line-chart svg{display:block;width:100%;height:230px;overflow:visible}.trend-line-chart .chart-grid line{stroke:#233047;stroke-width:1}.trend-line-chart polyline{fill:none;stroke:var(--dash-cyan);stroke-width:5;stroke-linecap:round;stroke-linejoin:round;filter:drop-shadow(0 0 8px rgb(41 211 226 / 40%))}.sales-line-chart polyline{stroke:var(--dash-blue)}.trend-line-chart circle{fill:#0b1422;stroke:var(--dash-cyan);stroke-width:4;transition:r .15s ease}.sales-line-chart circle{stroke:var(--dash-blue)}.trend-line-chart circle:hover{r:7}.trend-axis{display:flex;justify-content:space-between;color:#6f7f95;font-size:10px}.bar-chart{border-color:#28364b}.hour-bars,.sales-line-bars{border-color:#28364b}.hour-bars b{background:linear-gradient(180deg,var(--dash-cyan),#3369e7);box-shadow:0 0 12px rgb(41 211 226 / 15%)}
.donut-analysis{display:grid;grid-template-columns:minmax(130px,.8fr) minmax(150px,1fr);align-items:center;gap:20px;margin-top:22px}.donut-chart{display:grid;width:150px;max-width:100%;aspect-ratio:1;place-items:center;margin:auto;border-radius:50%;box-shadow:0 0 28px rgb(50 173 220 / 12%);animation:donut-reveal .65s ease both}.donut-chart::before{content:"";grid-area:1/1;width:68%;aspect-ratio:1;border:1px solid #223149;border-radius:50%;background:#0d1625;box-shadow:inset 0 0 24px rgb(0 0 0 / 25%)}.donut-chart>div{z-index:1;grid-area:1/1;display:grid;gap:2px;text-align:center}.donut-chart strong{font-size:24px}.donut-chart span{color:#7d8ca2;font-size:10px}.donut-legend{display:grid;gap:7px}.donut-legend>div{display:grid;grid-template-columns:9px minmax(0,1fr) auto;align-items:center;gap:8px;padding:7px 9px;border:1px solid #1c293c;border-radius:10px;background:#0c1523}.donut-legend i{width:8px;height:8px;border-radius:50%;background:#7d8ca2}.donut-legend span{color:#91a0b4;font-size:11px}.donut-legend strong{font-size:13px}.donut-legend .expired i{background:#ff7080}.donut-legend .urgent i{background:#f59c61}.donut-legend .warning i{background:#efd56a}.donut-legend .early i{background:#45c6e4}.donut-legend .healthy i{background:#3dd9a2}.donut-legend .medium i{background:#6880ff}.donut-legend .overstock i{background:#f4b860}.coverage-donut{grid-template-columns:1fr}.coverage-donut .donut-chart{width:132px}.coverage-donut .donut-legend{width:100%}@keyframes donut-reveal{from{opacity:0;transform:scale(.9) rotate(-12deg)}to{opacity:1;transform:none}}
.product-table-wrap th,.product-table-wrap td,.issue-table-wrap th,.issue-table-wrap td{border-color:#202c40}.product-table-wrap th,.issue-table-wrap th,.management-detail-scroll thead{color:#8fa0b8;background:#111c2d}.product-table-wrap tbody tr:hover,.inventory-scroll-table tbody tr:hover{background:#121f32}.product-table-wrap td>small,.issue-table-wrap td>small{color:#718198}.inventory-detail-filters{background:#0a1220}.inventory-status-tabs button{color:#8f9eb2;border-color:#29374c;background:#0d1726}.inventory-status-tabs button.active{color:#fff;background:linear-gradient(135deg,#167d96,#4d5fe0)}.inventory-table-pagination{color:#8493a8}.inventory-table-pagination select{color:var(--dash-text);border-color:#29374c;background:#0a1220}.inventory-table-pagination button{color:#91dcf2;border-color:#28465a;background:#102435}
.coverage-buckets article,.source-quality dl>div,.store-result-card dl>div,.store-rankings>div,.readiness-list>div,.reconcile-option,.health-check-card li,.sync-history article,.insight-products>article,.taxonomy-columns>article{background:#101a2a}.taxonomy-list>div{background:#0b1422}.taxonomy-list li{color:#7cdcec;background:#102936}.product-ranking li,.sales-ranking li,.ranking li,.inventory-alert-list li{border-color:#202c40}.product-ranking li>b,.sales-ranking li>b,.ranking li>b,.store-rankings li>b{color:#7ce6f2;background:#123141}.product-ranking li em,.sales-ranking li em,.ranking li em,.inventory-alert-list li em{color:#dce8f9}.insight-tags span{background:#172235}.insight-tags span.approved{color:#61dbb3;background:#123229}.insight-tags span.pending{color:#f0c66e;background:#302817}
.expired{color:#ff8290;background:#2a171d}.urgent{color:#f4a969;background:#2d2118}.warning{color:#efd56a;background:#2a2818}.early{color:#69cde8;background:#122a34}.refund-list article{background:#28171c}.refund-list span{color:#ff8290}.stock-badge.in_stock{color:#59d9af;background:#123128}.stock-badge.low{color:#f5bd70;background:#332616}.stock-badge.out_of_stock{color:#ff8390;background:#331920}.system-empty,.management-empty{color:#66768d}
.management-detail-scroll{scrollbar-color:#34455f #0a1220}.management-detail-scroll::-webkit-scrollbar{width:9px;height:9px}.management-detail-scroll::-webkit-scrollbar-track{background:#0a1220}.management-detail-scroll::-webkit-scrollbar-thumb{border:2px solid #0a1220;border-radius:999px;background:#34455f}
@media(prefers-reduced-motion:reduce){.management-workspace *{scroll-behavior:auto!important;transition:none!important}.trend-line-chart polyline{filter:none}}
@media(max-width:1200px){.management-workspace{grid-template-columns:200px minmax(0,1fr)}.management-kpis{grid-template-columns:repeat(3,minmax(0,1fr))}}
@media(max-width:1200px){.sales-filter-panel{grid-template-columns:repeat(3,minmax(120px,1fr))}.sales-kpis{grid-template-columns:repeat(3,minmax(0,1fr))}}
@media(max-width:1200px){.product-filter-panel{grid-template-columns:repeat(3,minmax(120px,1fr))}.product-kpis{grid-template-columns:repeat(3,minmax(0,1fr))}.product-analysis-grid{grid-template-columns:1fr 1fr}.product-analysis-grid .source-quality{grid-column:1/-1}}
@media(max-width:1200px){.inventory-operation-kpis{grid-template-columns:repeat(3,minmax(0,1fr))}.inventory-operation-grid{grid-template-columns:1fr 1fr}.coverage-card{grid-column:1/-1}}
@media(max-width:1200px){.inventory-detail-filters{grid-template-columns:1fr 1fr}}
@media(max-width:1200px){.store-result-card dl{grid-template-columns:1fr 1fr}}
@media(max-width:1200px){.taxonomy-columns{grid-template-columns:repeat(2,minmax(0,1fr))}.tag-definition-form,.insight-editor-form{grid-template-columns:1fr 1fr 1fr}.insight-editor-form .evidence-field{grid-column:1/3}}
@media(max-width:960px){.management-workspace{grid-template-columns:1fr;gap:12px}.management-sidebar{position:static;display:block;min-height:0;max-height:none;padding:10px;overflow:visible}.sidebar-heading{padding:5px 7px 10px}.management-sidebar nav{display:flex;gap:6px;overflow-x:auto;scrollbar-width:none}.management-sidebar nav::-webkit-scrollbar{display:none}.management-sidebar button{flex:0 0 auto;width:auto;min-width:118px;padding:10px}.management-sidebar button small,.management-sidebar button em,.management-sidebar>p{display:none}.management-content{gap:12px}.management-grid{grid-template-columns:1fr}.management-heading{flex-wrap:wrap}.inventory-truth-grid,.pos-status-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.readiness-list{grid-template-columns:1fr}.pos-system-grid,.sales-dashboard-grid{grid-template-columns:1fr}.refund-list{grid-template-columns:1fr 1fr}.hourly-card{grid-column:auto}}
@media(max-width:720px){.management-heading{display:grid;align-items:start;padding:16px}.management-heading h2{font-size:24px}.management-filters{display:grid;grid-template-columns:minmax(0,1fr) auto;width:100%}.management-filters label{min-width:0}.management-filters input{width:100%;min-width:0}.management-kpis{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.management-kpis article{min-width:0;min-height:104px;padding:13px}.management-kpis strong{overflow-wrap:anywhere;font-size:20px}.management-card{min-width:0;min-height:240px;padding:15px}.sales-trend{overflow:hidden}.expiry-grid{margin-top:18px}.ranking li{grid-template-columns:28px minmax(0,1fr) auto}.ranking li em{font-size:11px}.planned-section{height:auto;min-height:380px;padding:28px 16px}}
@media(max-width:720px){.primary-sync-controls{grid-template-columns:1fr}.sync-required-alert{align-items:flex-start;flex-wrap:wrap}.sync-required-alert button{width:100%}}
@media(max-width:720px){.donut-analysis{grid-template-columns:1fr}.donut-chart{width:138px}.trend-line-chart,.trend-line-chart svg{min-height:190px;height:190px}}
@media(max-width:720px){.sync-history article{grid-template-columns:58px minmax(0,1fr)}.sync-history em{grid-column:1/-1;white-space:normal}.refund-list{grid-template-columns:1fr}.system-card{padding:15px}.sales-filter-panel{grid-template-columns:1fr 1fr}.sales-kpis{grid-template-columns:1fr 1fr}.hour-bars{min-width:600px}.hourly-card{overflow-x:auto}}
@media(max-width:720px){.product-filter-panel{grid-template-columns:1fr 1fr}.product-kpis{grid-template-columns:1fr 1fr}.product-analysis-grid{grid-template-columns:1fr}.product-analysis-grid .source-quality{grid-column:auto}}
@media(max-width:720px){.inventory-operation-filters{grid-template-columns:1fr 1fr}.inventory-operation-filters button{grid-column:1/-1}.inventory-operation-kpis{grid-template-columns:1fr 1fr}.inventory-operation-grid{grid-template-columns:1fr}.coverage-card{grid-column:auto}}
@media(max-width:720px){.inventory-detail-filters{grid-template-columns:1fr}.inventory-scroll-table,.management-detail-scroll{max-height:58vh}.inventory-table-pagination{align-items:flex-start;flex-wrap:wrap}.inventory-table-pagination>div{width:100%;justify-content:space-between}.inventory-table-pagination button{flex:1}.inventory-status-tabs{margin-inline:-2px}}
@media(max-width:720px){.store-comparison-filters{grid-template-columns:1fr 1fr}.store-comparison-filters button{grid-column:1/-1}.store-kpis,.store-card-grid,.store-rankings{grid-template-columns:1fr 1fr}.store-rankings>div:last-child{grid-column:1/-1}}
@media(max-width:720px){.taxonomy-columns{grid-template-columns:1fr}.insight-kpis{grid-template-columns:1fr 1fr}.tag-definition-form,.insight-editor-form{grid-template-columns:1fr 1fr}.insight-editor-form .evidence-field{grid-column:1/-1}.insight-products>article{grid-template-columns:1fr}}
@media(max-width:390px){.management-sidebar button{min-width:102px}.management-heading{padding:14px}.management-heading h2{font-size:22px}.management-filters{grid-template-columns:1fr}.management-kpis{grid-template-columns:1fr 1fr}.management-kpis article{padding:11px}.management-kpis strong{font-size:18px}.expiry-grid{grid-template-columns:1fr 1fr;gap:7px}.expiry-grid div{padding:13px}.inventory-truth-panel{padding:14px}.inventory-truth-grid,.pos-status-grid{grid-template-columns:1fr}.inventory-truth-grid article{min-height:auto}.pos-status-grid article{min-height:auto}.sales-filter-panel,.sales-kpis{grid-template-columns:1fr}}
@media(max-width:390px){.product-filter-panel,.product-kpis{grid-template-columns:1fr}}
@media(max-width:390px){.inventory-operation-filters,.inventory-operation-kpis{grid-template-columns:1fr}.inventory-operation-filters button{grid-column:auto}}
@media(max-width:390px){.store-comparison-filters,.store-kpis,.store-card-grid,.store-rankings,.store-result-card dl{grid-template-columns:1fr}.store-comparison-filters button,.store-rankings>div:last-child{grid-column:auto}}
@media(max-width:390px){.insight-search,.insight-kpis,.tag-definition-form,.insight-editor-form{grid-template-columns:1fr}.insight-editor-form .evidence-field{grid-column:auto}}
.management-mobile-nav,.management-more-overlay{display:none}
.management-workspace .store-result-card.selected{color:var(--dash-text)!important;border-color:#287a91!important;background:linear-gradient(145deg,#102737,#101b2c)!important;box-shadow:inset 0 1px 0 rgb(86 222 228 / 9%),0 14px 34px rgb(0 0 0 / 24%)!important}
.management-workspace .store-result-card.selected .card-title h3{color:#edf7ff}.management-workspace .store-result-card.selected .card-title p{color:#7f91aa}.management-workspace .store-result-card.selected .card-title>span{color:#45d5df}
.management-workspace .store-result-card.selected dl>div{border:1px solid #1e3046!important;background:#0d1828!important}.management-workspace .store-result-card.selected dt{color:#7e8fa7!important}.management-workspace .store-result-card.selected dd{color:#edf4ff!important}
.management-workspace :is(.management-heading,.management-card,.system-card,.inventory-truth-panel,.sales-filter-panel,.product-filter-panel,.inventory-operation-filters,.store-comparison-filters,.insight-search,.inventory-detail-filters,.planned-section,.taxonomy-columns>article,.insight-products>article,.readiness-list>div,.source-quality dl>div,.store-rankings>div,.health-check-card li,.sync-history article){border-color:#202c40}
.management-workspace :is(.planned-section,.taxonomy-columns>article,.insight-products>article,.readiness-list>div,.source-quality dl>div,.store-rankings>div,.health-check-card li,.sync-history article){color:var(--dash-text);background:#101a2a}
.management-workspace :is(.taxonomy-list>div,.coverage-buckets article,.store-result-card dl>div){border:1px solid #1d2a3e;background:#0c1625}
.management-workspace :is(table,th,td,tr){border-color:#202c40}.management-workspace :is(th,thead){background:#111c2d}.management-workspace :is(.inventory-status-tabs button,.inventory-table-pagination button,.editor-reset){border-color:#293b54}
/* Feedback motion: section context, live charts and operator controls. */
.management-content>:is(template,.sales-analysis-page,.products-page,.inventory-operations-page,.product-insight-page,.store-comparison-page,.pos-management,.planned-section){transform-origin:50% 0}
.sales-analysis-page,.products-page,.inventory-operations-page,.product-insight-page,.store-comparison-page,.pos-management,.planned-section{animation:management-section-enter .32s cubic-bezier(.22,1,.36,1) both}
.management-heading{position:relative}.management-heading::after{position:absolute;right:18px;bottom:-1px;left:18px;height:1px;content:"";background:linear-gradient(90deg,transparent,var(--dash-cyan) 35%,var(--dash-blue) 68%,transparent);opacity:.34;transform:scaleX(.45);transform-origin:center;transition:opacity .25s ease,transform .35s ease}
.management-heading:hover::after{opacity:.7;transform:scaleX(1)}
.management-sidebar button:not(:disabled){cursor:pointer;transition:color .18s ease,background .22s ease,transform .18s ease,box-shadow .22s ease}.management-sidebar button:not(:disabled):hover{transform:translateX(3px);background:#13233a}.management-sidebar button.active:not(:disabled):hover{background:linear-gradient(135deg,#176c8b,#4a58ca)}
.management-filters button,.sales-filter-panel button,.product-filter-panel button,.inventory-operation-filters button,.store-comparison-filters button,.insight-search button,.primary-sync-controls button{position:relative;overflow:hidden;transition:transform .16s ease,filter .18s ease,box-shadow .2s ease}.management-filters button:not(:disabled):hover,.sales-filter-panel button:not(:disabled):hover,.product-filter-panel button:not(:disabled):hover,.inventory-operation-filters button:not(:disabled):hover,.store-comparison-filters button:not(:disabled):hover,.insight-search button:not(:disabled):hover,.primary-sync-controls button:not(:disabled):hover{transform:translateY(-1px);filter:brightness(1.08);box-shadow:0 10px 24px rgb(30 132 226 / 22%)}.management-filters button:not(:disabled):active,.sales-filter-panel button:not(:disabled):active,.product-filter-panel button:not(:disabled):active,.inventory-operation-filters button:not(:disabled):active,.store-comparison-filters button:not(:disabled):active,.insight-search button:not(:disabled):active,.primary-sync-controls button:not(:disabled):active{transform:translateY(1px) scale(.985)}
.management-filters button:disabled{padding-right:38px}.management-filters button:disabled::after{position:absolute;top:50%;right:14px;width:13px;height:13px;margin-top:-7px;border:2px solid rgb(255 255 255 / 25%);border-top-color:#fff;border-radius:50%;content:"";animation:management-spin .75s linear infinite}
.management-kpis article,.sales-kpis article,.product-kpis article,.inventory-operation-kpis article,.store-kpis article,.insight-kpis article{animation:management-card-enter .36s cubic-bezier(.22,1,.36,1) both}.management-kpis article:nth-child(2),.sales-kpis article:nth-child(2),.product-kpis article:nth-child(2),.inventory-operation-kpis article:nth-child(2),.store-kpis article:nth-child(2),.insight-kpis article:nth-child(2){animation-delay:.035s}.management-kpis article:nth-child(3),.sales-kpis article:nth-child(3),.product-kpis article:nth-child(3),.inventory-operation-kpis article:nth-child(3),.store-kpis article:nth-child(3),.insight-kpis article:nth-child(3){animation-delay:.07s}.management-kpis article:nth-child(n+4),.sales-kpis article:nth-child(n+4),.product-kpis article:nth-child(n+4),.inventory-operation-kpis article:nth-child(n+4),.store-kpis article:nth-child(n+4),.insight-kpis article:nth-child(n+4){animation-delay:.105s}
.trend-line-chart polyline{stroke-dasharray:1400;stroke-dashoffset:1400;animation:management-line-draw .9s .12s cubic-bezier(.22,1,.36,1) forwards}.trend-line-chart circle{opacity:0;animation:management-point-in .22s .75s ease forwards}.hour-bars b,.bar-column b{transform:scaleY(0);transform-origin:bottom;animation:management-bar-grow .55s .18s cubic-bezier(.22,1,.36,1) forwards}
.system-card,.management-card{transition:border-color .2s ease,box-shadow .22s ease,transform .2s ease}.system-card:hover,.management-card:hover{border-color:#304660;box-shadow:inset 0 1px 0 rgb(255 255 255 / 4%),0 18px 40px rgb(0 0 0 / 25%)}
@keyframes management-section-enter{from{opacity:0;transform:translateY(9px)}to{opacity:1;transform:none}}
@keyframes management-card-enter{from{opacity:0;transform:translateY(7px) scale(.99)}to{opacity:1;transform:none}}
@keyframes management-line-draw{to{stroke-dashoffset:0}}
@keyframes management-point-in{from{opacity:0;transform:scale(.4);transform-origin:center}to{opacity:1;transform:scale(1)}}
@keyframes management-bar-grow{to{transform:scaleY(1)}}
@keyframes management-spin{to{transform:rotate(360deg)}}
@media(prefers-reduced-motion:reduce){.management-workspace *{animation:none!important;transition:none!important}.trend-line-chart polyline{stroke-dashoffset:0}}
@media(min-width:961px){
  .management-workspace{grid-template-rows:minmax(0,1fr);height:100%;min-height:0;padding:12px;border-radius:0;overflow:hidden}
  .management-sidebar{top:0;height:100%;max-height:none;min-height:0;overflow-y:auto}
  .management-content{height:100%;min-height:0;gap:12px;padding-right:3px;overflow-y:auto;overscroll-behavior:contain;scrollbar-gutter:stable}
  .management-heading{position:sticky;z-index:12;top:0;min-height:92px;padding:16px 18px;border-radius:18px}
  .management-heading h2{font-size:26px}.management-heading span{margin-top:3px;font-size:13px}
  .management-alert{padding:11px 14px;border-radius:13px}
  .management-kpis,.sales-kpis,.product-kpis,.inventory-operation-kpis,.store-kpis,.insight-kpis{gap:8px}
  .management-kpis article,.sales-kpis article,.product-kpis article,.inventory-operation-kpis article,.store-kpis article,.insight-kpis article{min-height:92px;padding:13px;border-radius:15px}
  .management-kpis strong,.sales-kpis strong,.product-kpis strong,.inventory-operation-kpis strong,.store-kpis strong,.insight-kpis strong{font-size:21px}
  .system-card,.management-card,.inventory-truth-panel{padding:16px;border-radius:18px}
  .sales-filter-panel,.product-filter-panel,.inventory-operation-filters,.store-comparison-filters,.insight-search,.inventory-detail-filters{padding:12px;border-radius:15px}
  .trend-line-chart{min-height:clamp(160px,24vh,230px)}.trend-line-chart svg{height:clamp(160px,24vh,230px)}
  .sales-dashboard-grid{gap:10px}.time-bucket-grid{gap:5px}.time-bucket-grid article{padding:6px}
  .sales-ranking ol,.product-ranking ol,.ranking ol,.inventory-alert-list ol{max-height:clamp(210px,35vh,360px);overflow-y:auto;overscroll-behavior:contain;scrollbar-gutter:stable}
  .product-analysis-grid,.inventory-operation-grid{min-height:0;align-items:stretch}.product-analysis-grid>.system-card,.inventory-operation-grid>.system-card{min-height:0;max-height:clamp(300px,50vh,520px);overflow:hidden}
  .product-analysis-grid ol,.inventory-operation-grid ol{max-height:calc(clamp(300px,50vh,520px) - 78px);overflow-y:auto}
  .management-detail-scroll,.inventory-scroll-table{max-height:clamp(300px,52vh,560px)}
}
@media(min-width:961px) and (max-height:820px){
  .management-workspace{gap:10px;padding:9px}.management-sidebar{padding:12px 9px;border-radius:17px}.sidebar-heading{padding-bottom:10px}.management-sidebar button{padding:8px 10px}
  .management-heading{min-height:76px;padding:11px 15px}.management-heading h2{font-size:23px}.management-heading p{margin-bottom:2px}.management-heading span{font-size:11px}
  .management-content{gap:9px}.management-alert{padding:8px 12px;font-size:12px}
  .management-kpis article,.sales-kpis article,.product-kpis article,.inventory-operation-kpis article,.store-kpis article,.insight-kpis article{min-height:78px;gap:4px;padding:10px}.management-kpis strong,.sales-kpis strong,.product-kpis strong,.inventory-operation-kpis strong,.store-kpis strong,.insight-kpis strong{font-size:18px}
  .system-card,.management-card,.inventory-truth-panel{padding:12px}.card-title h3{font-size:16px}.card-title p{margin-top:2px;font-size:11px}
  .trend-line-chart,.trend-line-chart svg{min-height:145px;height:145px}.sales-ranking ol,.product-ranking ol,.ranking ol,.inventory-alert-list ol{max-height:230px}
}
@media(max-width:720px){
  .management-workspace{padding:10px 10px calc(82px + env(safe-area-inset-bottom));border-radius:18px}
  .management-sidebar{display:none}
  .management-mobile-nav{position:fixed;z-index:40;right:0;bottom:0;left:0;display:grid;grid-template-columns:repeat(5,minmax(0,1fr));padding:6px 8px max(6px,env(safe-area-inset-bottom));border-top:1px solid #213149;background:rgb(8 15 27 / 96%);box-shadow:0 -12px 32px rgb(0 0 0 / 34%);backdrop-filter:blur(18px)}
  .management-mobile-nav button{display:grid;min-width:0;min-height:56px;place-items:center;gap:1px;padding:5px 2px;color:#77879e;border:0;border-radius:11px;background:transparent;font:inherit;font-size:10px;font-weight:800}
  .management-mobile-nav button span{color:inherit;font-size:20px;line-height:1}.management-mobile-nav button.active{color:#ecf8ff;background:linear-gradient(145deg,#146d89,#4959c8);box-shadow:inset 0 1px 0 rgb(255 255 255 / 12%)}
  .management-more-overlay{position:fixed;z-index:45;inset:0;display:flex;align-items:flex-end;padding:14px 12px calc(76px + env(safe-area-inset-bottom));background:rgb(2 7 15 / 72%);backdrop-filter:blur(8px)}
  .management-more-sheet{width:100%;padding:18px;border:1px solid #26364d;border-radius:22px;background:#0b1422;box-shadow:0 24px 60px rgb(0 0 0 / 50%)}
  .management-more-sheet>header{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:14px}.management-more-sheet h2{margin:3px 0 0;font-size:22px}.management-more-sheet header small{color:#72839b;font-size:10px;font-weight:900;letter-spacing:.14em}
  .management-more-sheet>header>button{display:grid;width:44px;min-height:44px;place-items:center;padding:0;color:#eef4ff;border:1px solid #2a3a51;border-radius:50%;background:#111d2e;font-size:24px}
  .management-more-sheet>div{display:grid;grid-template-columns:1fr 1fr;gap:9px}.management-more-sheet>div>button{display:grid;grid-template-columns:36px minmax(0,1fr);gap:2px 10px;min-height:86px;padding:12px;color:#eef4ff;border:1px solid #223149;border-radius:15px;background:#111c2d;text-align:left}
  .management-more-sheet>div>button>span{grid-row:1/3;align-self:center;color:#35d2e1;font-size:24px;text-align:center}.management-more-sheet>div>button strong{align-self:end}.management-more-sheet>div>button small{align-self:start;overflow:hidden;color:#8190a6;font-size:10px;text-overflow:ellipsis;white-space:nowrap}.management-more-sheet>div>button:disabled{opacity:.45}
  .management-heading,.management-alert,.management-card,.system-card{scroll-margin-top:12px}.management-kpis strong,.sales-kpis strong,.product-kpis strong,.inventory-operation-kpis strong,.store-kpis strong,.insight-kpis strong,td{font-variant-numeric:tabular-nums}
}
</style>

<style scoped src="./management-decision.css"></style>
