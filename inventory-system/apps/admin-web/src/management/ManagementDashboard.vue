<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';

type SalesSummary = {
  period: string; revenue: number; refunds: number; netRevenue: number; orderCount: number;
  unitsSold: number; averageOrderValue: number;
  dailySales: { date: string; revenue: number; orders: number }[];
  topProducts: { productId: string | null; productName: string; brandName: string; quantity: number; revenue: number }[];
  topBrands: { brandName: string; quantity: number; revenue: number }[];
};
type Overview = {
  store: { id: string; name: string }; currency: string;
  period: { date: string; previousDate: string }; salesAvailable: boolean; lastPosSyncAt: string | null;
  sales: {
    current: SalesSummary; previous: SalesSummary;
    comparison: { netRevenuePercent: number | null; orderCountPercent: number | null; unitsSoldPercent: number | null; averageOrderValuePercent: number | null };
  };
  inventory: {
    productCount: number; batchCount: number; totalQuantity: number; expiryAttentionQuantity: number;
    expiry: { expired: number; urgent: number; warning: number; early: number };
    activity: {
      openReceiptCount: number; stocktakeAdjustmentsToday: number; movementCountToday: number;
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
  items: { total: number; mappable?: number; nonInventory?: number; mapped: number; unmapped: number; reviewRequired: number; inactive: number; mappingCoveragePercent: number };
  issues: { total: number; pendingRefundReviews: number; failedSyncRuns: number };
  checks: { code: string; passed: boolean; message: string }[];
};
type PosSyncRun = {
  id: string; status: 'RUNNING' | 'SUCCEEDED' | 'FAILED'; requestedFrom: string | null; requestedTo: string | null;
  startedAt: string; finishedAt: string | null; ordersObserved: number; ordersInserted: number; ordersUpdated: number;
  ordersSkipped: number; itemsObserved: number; exceptionsCount: number; errorCode: string | null; errorMessage: string | null;
};
type PosRealtimeStatus = { enabled: boolean; intervalMinutes: number; lastTickAt: string | null; lastSuccessAt: string | null; lastError: string | null; lastApplied: { storeId: string; appliedOrders: number; unitsApplied: number; reviewLines: number; shortfallUnits: number } | null };
type PosSyncStatus = { running: boolean; realtime?: PosRealtimeStatus; cursor: { lastSourceTimestamp: string | null; updatedAt: string } | null; latestRun: PosSyncRun | null; history: PosSyncRun[] };
type PosSyncIssues = {
  summary: { itemIssues: number; pendingRefunds: number; failedRuns: number };
  itemIssues: { items: { id: string; orderNo: string; orderedAt: string; externalProductId: string; productName: string | null; barcode: string | null; quantity: string; disposition: string; reason: string | null }[]; pagination: { total: number } };
  pendingRefunds: { items: { id: string; orderNo: string; orderedAt: string; amount: string; reason: string; createdAt: string }[]; pagination: { total: number } };
  failedRuns: { id: string; requestedFrom: string | null; startedAt: string; errorCode: string | null; errorMessage: string | null }[];
};
type BarcodeAudit = {
  generatedAt: string;
  summary: { duplicateBarcodes: number; duplicateNameConflicts: number; localBarcodeMismatches: number; unmappedBarcodes: number };
  duplicateBarcodes: { barcode: string; externalProductCount: number; localProductCount: number; nameConflict: boolean; mappings: { externalProductId: string; sourceName: string | null; productId: string | null; productName: string }[] }[];
  localBarcodeMismatches: { barcode: string; externalProductId: string; sourceName: string | null; productId: string; productName: string; productBarcodes: string[] }[];
  unmappedBarcodes: { barcode: string; occurrences: number; units: number; dispositions: string[]; products: { externalProductId: string; sourceName: string | null }[] }[];
};
type PosInventoryIssue = {
  orderId: string; orderNo: string; reason: 'UNMAPPED' | 'REVIEW_REQUIRED' | 'RETURN_LINE' | 'INVALID_QUANTITY' | 'INSUFFICIENT_INVENTORY' | 'ALREADY_APPLIED' | 'CONCURRENT_CHANGE'; itemId?: string;
  productId?: string; required?: number; available?: number;
};
type PosInventoryPreview = {
  mode: 'PREVIEW'; period: { from: string; toExclusive: string };
  summary: { ordersScanned: number; eligibleOrders: number; unitsPlanned: number; reviewRequiredOrders: number; blockedOrders: number; reviewLines: number; shortfallUnits: number };
  issues: PosInventoryIssue[];
};
type PosInventoryApplyResult = {
  mode: 'APPLIED'; period: { from: string; toExclusive: string };
  summary: { ordersScanned: number; appliedOrders: number; unitsApplied: number; blockedOrders: number; reviewLines: number; shortfallUnits: number };
  issues: PosInventoryIssue[];
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
  topProducts: { productId: string | null; productName: string; brandName: string; categoryName: string; quantity: number; revenue: number }[];
  topBrands: { brandName: string; quantity: number; revenue: number }[];
  topCategories: { categoryName: string; quantity: number; revenue: number }[];
  sourceQuality: { orders: number; activeItems: number; mappedItems: number; reviewRequiredItems: number };
};
type ProductsBrands = {
  currency: string; period: { from: string; to: string };
  summary: { productCount: number; soldProductCount: number; unitsSold: number; salesRevenue: number; currentInventory: number; inStockProducts: number; outOfStockProducts: number; lowStockProducts: number; minimumStockConfiguredProducts: number };
  products: { productId: string; sku: string; productName: string; brandName: string; categoryName: string; barcode: string | null; unitsSold: number; salesRevenue: number; currentInventory: number; minimumStock: number | null; sellingPriceCents: number | null; stockStatus: 'OUT_OF_STOCK' | 'LOW' | 'IN_STOCK'; shortageVisible?: boolean; salesToStockRatio: number | null }[];
  brands: { name: string; productCount: number; unitsSold: number; salesRevenue: number; currentInventory: number }[];
  categories: { name: string; productCount: number; unitsSold: number; salesRevenue: number; currentInventory: number }[];
  catalogQuality: { withBrand: number; brandCoveragePercent: number; withCategory: number; categoryCoveragePercent: number; withBarcode: number; barcodeCoveragePercent: number; barcodeOptional: boolean };
  mappingQuality: { activeItems: number; mappedItems: number; unmappedOrReviewItems: number; coveragePercent: number };
  officialCostAvailable: boolean; marginAvailable: boolean; marginNotice: string;
};
type InventoryOperations = {
  period: { lookbackDays: number; from: string; to: string };
  salesCoverage: { observedDays: number; reliable: boolean; firstObservedSaleAt: string | null; lastObservedSaleAt: string | null; minimumReliableDays: number };
  summary: { productCount: number; stockedProducts: number; totalInventory: number; outOfStockProducts: number; lowStockProducts: number; slowMovingProducts: number; expiredBatches?: number; expiredUnits?: number };
  coverageBuckets: { noSales: number; under30: number; days30To90: number; over90: number };
  alerts: InventoryOperationRow[]; slowMoving: InventoryOperationRow[]; products: InventoryOperationRow[];
  turnoverAvailable: boolean; turnoverNotice: string; coverageNotice: string;
  defaultMinimumStock: number; shortageNotice: string;
};
type InventoryOperationRow = {
  productId: string; sku: string; productName: string; brandName: string; categoryName: string;
  currentInventory: number; minimumStock: number | null; configuredMinimumStock: number | null; minimumStockSource: 'DEFAULT' | 'MANUAL' | 'NONE'; coreProduct?: boolean; posMapped?: boolean; soldUnits: number; dailyVelocity: number; coverageDays: number | null; shortageVisible: boolean;
  lastSoldAt: string | null; daysSinceLastSale: number | null; lastMovementAt: string | null; inventoryUpdatedAt: string | null;
  stockStatus: 'OUT_OF_STOCK' | 'LOW' | 'IN_STOCK'; slowMoving: boolean;
  replenishmentHidden: boolean; replenishmentHiddenUntil: string | null; directShipExcluded: boolean;
};
type PurchaseSource = 'MANUAL' | 'OUT_OF_STOCK' | 'LOW_STOCK' | 'HOT_SALES' | 'WEEKLY_FORECAST';
type PurchaseSuggestion = { productId: string; sku: string; barcode: string | null; productName: string; brandName: string; categoryName: string; currentInventory: number; minimumStock: number | null; recent28DayQty: number; weeklyVelocity: number; coverageWeeks: number | null; targetWeeks: number | null; targetInventory: number; suggestedQuantity: number; source: PurchaseSource; priority: 'THIS_WEEK' | 'FOLLOW_UP'; alreadyIncluded: boolean; ignored: boolean; ignoredReason: string | null; ignoredAt: string | null; recentReceivedQty?: number; lastReceivedAt?: string | null };
type PurchaseSuggestions = { generatedAt: string; inventoryLatestUpdatedAt: string | null; period: { from: string; to: string }; calculation: string; summary: { products: number; suggestedUnits: number; thisWeekProducts: number; followUpProducts: number; alreadyIncluded: number; ignored: number; arrived?: number }; suggestions: PurchaseSuggestion[]; ignoredSuggestions: PurchaseSuggestion[]; arrivedSuggestions?: PurchaseSuggestion[] };
type PurchaseOrderItem = { id: string; productId: string; sku: string; barcode: string | null; productName: string; brandName: string; categoryName: string; source: PurchaseSource; currentInventory: number; recentSevenDayQty: number; suggestedQuantity: number; orderedQuantity: number; receivedQuantity: number; supplierName: string | null; unitCostCents: number | null; caseSize: number | null; notes: string | null };
type PurchaseOrder = { id: string; orderNo: string; weekStart: string; status: 'DRAFT' | 'CONFIRMED' | 'ORDERED' | 'PARTIALLY_RECEIVED' | 'RECEIVED' | 'CANCELLED'; createdAt: string; updatedAt: string; confirmedAt: string | null; orderedAt: string | null; summary: { productCount: number; suggestedUnits: number; orderedUnits: number; receivedUnits: number; totalCostCents: number }; items: PurchaseOrderItem[] };
type CurrentPurchaseOrder = { generatedAt?: string; inventoryLatestUpdatedAt?: string | null; currency: string; order: PurchaseOrder | null };
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
const overview = ref<Overview | null>(null);
const foundation = ref<DataFoundation | null>(null);
const loading = ref(false);
const error = ref('');
const posCheck = ref<PosDataCheck | null>(null);
const posStatus = ref<PosSyncStatus | null>(null);
const posIssues = ref<PosSyncIssues | null>(null);
const barcodeAudit = ref<BarcodeAudit | null>(null);
const posLoading = ref(false);
const posRunning = ref(false);
const posMessage = ref('');
const syncDate = ref(new Intl.DateTimeFormat('en-CA', { timeZone: 'Pacific/Auckland', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()));
const reconcile = ref(false);
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Pacific/Auckland', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const posInventoryFrom = ref(`${today.slice(0, 7)}-01`);
const posInventoryTo = ref(today);
const posInventoryPreview = ref<PosInventoryPreview | null>(null);
const posInventoryApplyResult = ref<PosInventoryApplyResult | null>(null);
const posInventoryPreviewLoading = ref(false);
const posInventoryConfirmOpen = ref(false);
const posInventoryApplyState = ref<'idle' | 'loading' | 'success'>('idle');
const salesFrom = ref(today);
const salesTo = ref(today);
const salesDimension = ref<'DAY' | 'WEEK' | 'MONTH'>('DAY');
const salesBrand = ref('');
const salesCategory = ref('');
const salesAnalysis = ref<SalesAnalysis | null>(null);
const salesLoading = ref(false);
type OverviewTrendPeriod = 'WEEK' | 'MONTH' | 'YEAR';
type OverviewHotPeriod = 'DAY' | 'MONTH' | 'QUARTER' | 'YEAR';
const overviewTrendPeriods: { key: OverviewTrendPeriod; label: string }[] = [{ key: 'WEEK', label: '本周' }, { key: 'MONTH', label: '当月' }, { key: 'YEAR', label: '当年' }];
const overviewHotPeriods: { key: OverviewHotPeriod; label: string }[] = [{ key: 'DAY', label: '当日' }, { key: 'MONTH', label: '当月' }, { key: 'QUARTER', label: '季度' }, { key: 'YEAR', label: '年度' }];
const overviewTrendPeriod = ref<OverviewTrendPeriod>('MONTH');
const overviewHotPeriod = ref<OverviewHotPeriod>('MONTH');
const overviewTrendAnalysis = ref<SalesAnalysis | null>(null);
const overviewHotAnalysis = ref<SalesAnalysis | null>(null);
const overviewWidgetsLoading = ref(false);
const overviewWidgetError = ref('');
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
const inventoryPageSize = ref(54);
const pageGuideOpen = ref(false);
const minimumStockDialog = ref<{ product: InventoryOperationRow | null; value: string } | null>(null);
const minimumStockSaving = ref(false);
const inventoryActionProductId = ref('');
const purchaseSuggestions = ref<PurchaseSuggestions | null>(null);
const currentPurchaseOrder = ref<CurrentPurchaseOrder | null>(null);
const purchaseLoading = ref(false);
const purchaseMessage = ref('');
const purchaseMessageTone = ref<'success' | 'error'>('success');
const purchaseActionProductId = ref('');
let purchaseMessageTimer: ReturnType<typeof setTimeout> | undefined;
const purchaseView = ref<'suggestions' | 'order'>('suggestions');
const purchaseConfirm = ref<null | { title: string; description: string; confirmLabel: string; tone: 'primary' | 'danger'; action: () => Promise<void> }>(null);
const purchaseConfirmBusy = ref(false);
const showIgnoredSuggestions = ref(false);
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
type ManagementSection = 'overview' | 'sales' | 'products' | 'inventory' | 'procurement' | 'customers' | 'stores' | 'system';
const activeSection = ref<ManagementSection>('overview');
const showMobileMore = ref(false);
const allSections: { id: ManagementSection; label: string; description: string; ready: boolean }[] = [
  { id: 'overview', label: '经营总览', description: '核心指标与经营提醒', ready: true },
  { id: 'sales', label: '销售分析', description: '销售趋势、时段与上期比较', ready: true },
  { id: 'products', label: '商品分析', description: '商品、品牌与品类表现', ready: true },
  { id: 'inventory', label: '库存经营', description: '覆盖、滞销与低库存', ready: true },
  { id: 'procurement', label: '本周进货', description: '进货建议、草稿与订货状态', ready: true },
  { id: 'customers', label: '分类与标签', description: '商品标记与标签字典', ready: true },
  { id: 'stores', label: '门店对比', description: '门店经营基线与比较', ready: true },
  { id: 'system', label: '数据中心', description: 'POS 同步、检查与异常', ready: true },
];
const navigationGroups = [
  { label: '经营分析', ids: ['overview', 'sales', 'products', 'inventory', 'procurement', 'stores'] },
  { label: '资料维护', ids: ['customers'] },
  { label: '系统支持', ids: ['system'] },
];
const canSection = (id: ManagementSection) => {
  if (props.administrator) return true;
  if (!managementAccess.value) return id === 'overview';
  const capability = managementAccess.value.capabilities;
  if (id === 'overview' || id === 'stores') return capability.overviewView;
  if (id === 'sales' || id === 'products') return capability.salesView;
  if (id === 'inventory' || id === 'procurement') return capability.inventoryView;
  if (id === 'system') return capability.posSync || capability.posIssues || capability.permissionsManage;
  return capability.salesView;
};
const sections = computed(() => allSections);
const currentSection = computed(() => allSections.find((item) => item.id === activeSection.value) ?? allSections[0]);
const pageGuides: Record<ManagementSection, { purpose: string; includes: string[]; decision: string; details?: string[] }> = {
  overview: { purpose: '快速判断今日经营状态与需要优先处理的事项。', includes: ['今日销售与昨日比较', '当前库存与临期', '今日库存作业待办', '可切换周期的销售趋势与热销商品'], decision: '适合作为每日入口；详细原因继续进入销售、商品或库存页面。' },
  sales: { purpose: '回答卖了多少、何时卖、哪些商品贡献销售。', includes: ['销售趋势', '订单与客单价', '时段分布', '商品及品牌排行'], decision: '适合复盘销售变化；毛利和商品级退款在成本与退款数据完整前不作结论。' },
  products: { purpose: '从商品、品牌和品类角度查看销售与当前库存结构。', includes: ['商品明细', '品牌结构', '品类结构', '资料与映射质量'], decision: '适合调整商品结构；售价、条码和商品主档仍在商品维护流程处理。' },
  inventory: { purpose: '识别缺货、低库存和滞销风险，帮助决定哪些商品需要补货或暂时隐藏提醒。', includes: ['库存状态', '观察期销量', '最低库存阈值', '最后销售时间'], decision: '缺货只统计最近120天有销售的零库存商品；未单独设置时最低库存按20件判断。', details: ['库存来自正式库存系统，销量来自已同步的 POS 订单。', '销售历史不足时，不生成库存覆盖天数和滞销结论，避免把缺少数据误判为没有销售。', '名称含 stage、数字+tins 或数字+bag 的直邮奶粉不进入补货提醒。点击“忽略”会持续隐藏，点击“下周显示”会在7天后自动恢复。'] },
  procurement: { purpose: '把缺货、低库存和销售速度转为一张可确认的本周进货单。', includes: ['近7天进货建议', '进货数量与供应商', '草稿确认与已订货状态', '到货后转入正式入库流程'], decision: '加入进货单不会增加库存；只有完成扫码入库才改变正式库存。' },
  customers: { purpose: '维护商品经营分类、需求、人群倾向和营销标签。', includes: ['标签字典', '商品标签覆盖', '审核状态', '人工判断依据'], decision: '这是商品经营画像，不代表顾客真实身份，也不替代商品主档品类。' },
  stores: { purpose: '当前先保存单店经营基线，未来增加门店后再横向比较。', includes: ['单店销售基线', '订单与客单价', '库存与缺货', '后续多店排行'], decision: '目前只有一家门店，本页暂不作为重点开发模块。' },
  system: { purpose: '确认经营分析所依赖的数据是否已同步且足够可信。', includes: ['POS同步', '资料完整度', '商品映射', '异常与同步历史'], decision: '适合排查数据问题；同步保持观察模式，不直接修改正式库存。' },
};
const currentGuide = computed(() => pageGuides[activeSection.value]);
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
  salesFrom.value = overview.value.period.date;
  salesTo.value = overview.value.period.date;
  salesBrand.value = ''; salesCategory.value = ''; salesDimension.value = 'DAY';
  selectSection('sales');
}
function clearSalesFilters() { salesBrand.value = ''; salesCategory.value = ''; }
function clearProductFilters() { productQuery.value = ''; productBrand.value = ''; productCategory.value = ''; }
function setDateRange(target: 'sales' | 'products' | 'stores', preset: 'today' | 'week' | 'month' | 'year') {
  const weekStart = new Date(`${today}T00:00:00Z`);
  weekStart.setUTCDate(weekStart.getUTCDate() - 6);
  const from = preset === 'today' ? today : preset === 'week' ? weekStart.toISOString().slice(0, 10) : preset === 'year' ? `${today.slice(0, 4)}-01-01` : `${today.slice(0, 7)}-01`;
  if (target === 'sales') {
    salesFrom.value = from; salesTo.value = today;
    salesDimension.value = preset === 'year' ? 'MONTH' : 'DAY';
  }
  if (target === 'products') { productFrom.value = from; productTo.value = today; }
  if (target === 'stores') { storeFrom.value = from; storeTo.value = today; }
}
async function openInventoryAlert(status: 'OUT_OF_STOCK' | 'LOW') {
  inventoryStatusFilter.value = status;
  inventoryPage.value = 1;
  selectSection('inventory');
  if (!inventoryOperations.value) await loadInventoryOperations();
}
function clearInventoryFilters() {
  inventoryTableQuery.value = ''; inventoryBrandFilter.value = ''; inventoryCategoryFilter.value = ''; inventoryStatusFilter.value = 'ALL';
}
const pageBusy = computed(() => ({ overview: loading.value, sales: salesLoading.value, products: productsLoading.value, inventory: inventoryLoading.value, procurement: purchaseLoading.value, customers: insightLoading.value, stores: storeLoading.value, system: posLoading.value }[activeSection.value]));
function retryCurrentPage() {
  const loaders = { overview: loadOverview, sales: loadSalesAnalysis, products: loadProductsBrands, inventory: loadInventoryOperations, procurement: loadProcurement, customers: loadProductInsights, stores: loadStoreComparison, system: loadSystemManagement };
  void loaders[activeSection.value]();
}
const overviewTrendSeries = computed(() => overviewTrendAnalysis.value?.trend
  ?? overview.value?.sales.current.dailySales.map((item) => ({ period: item.date, revenue: item.revenue, orders: item.orders, units: 0 }))
  ?? []);
const maxDailyRevenue = computed(() => Math.max(1, ...overviewTrendSeries.value.map((item) => item.revenue)));
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
const overviewTrendPoints = computed(() => chartPoints(overviewTrendSeries.value.map((item) => item.revenue), maxDailyRevenue.value));
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
  const products = (inventoryOperations.value?.products ?? []).filter((item) => !item.replenishmentHidden && !item.directShipExcluded);
  return {
    ALL: products.length,
    SLOW: products.filter((item) => item.slowMoving).length,
    OUT_OF_STOCK: products.filter((item) => item.stockStatus === 'OUT_OF_STOCK' && item.shortageVisible).length,
    LOW: products.filter((item) => item.stockStatus === 'LOW').length,
    OVERSTOCK: products.filter((item) => item.coverageDays !== null && item.coverageDays > 90).length,
    NO_MINIMUM: products.filter((item) => item.configuredMinimumStock === null).length,
  };
});
const filteredInventoryProducts = computed(() => {
  const query = inventoryTableQuery.value.trim().toLowerCase();
  const rows = (inventoryOperations.value?.products ?? []).filter((item) => {
    if (item.replenishmentHidden || item.directShipExcluded) return false;
    if (query && ![item.productName, item.brandName, item.categoryName, item.sku].some((value) => value?.toLowerCase().includes(query))) return false;
    if (inventoryBrandFilter.value && item.brandName !== inventoryBrandFilter.value) return false;
    if (inventoryCategoryFilter.value && item.categoryName !== inventoryCategoryFilter.value) return false;
    if (inventoryStatusFilter.value === 'SLOW' && !item.slowMoving) return false;
    if (inventoryStatusFilter.value === 'OUT_OF_STOCK' && !(item.stockStatus === 'OUT_OF_STOCK' && item.shortageVisible)) return false;
    if (inventoryStatusFilter.value === 'LOW' && item.stockStatus !== 'LOW') return false;
    if (inventoryStatusFilter.value === 'OVERSTOCK' && !(item.coverageDays !== null && item.coverageDays > 90)) return false;
    if (inventoryStatusFilter.value === 'NO_MINIMUM' && item.configuredMinimumStock !== null) return false;
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
const thisWeekPurchaseSuggestions = computed(() => (purchaseSuggestions.value?.suggestions ?? []).filter((item) => item.priority === 'THIS_WEEK'));
const followUpPurchaseSuggestions = computed(() => (purchaseSuggestions.value?.suggestions ?? []).filter((item) => item.priority === 'FOLLOW_UP'));

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
    const [overviewData, foundationData, purchaseOrderData] = await Promise.all([
      managementRequest<Overview>(`/management/overview?storeId=${encodeURIComponent(props.storeId)}&date=${today}`),
      managementRequest<DataFoundation>(`/management/data-foundation?storeId=${encodeURIComponent(props.storeId)}`),
      canSection('inventory') ? managementRequest<CurrentPurchaseOrder>(`/management/purchase-orders/current?storeId=${encodeURIComponent(props.storeId)}`).catch(() => null) : Promise.resolve(null),
    ]);
    overview.value = overviewData;
    foundation.value = foundationData;
    if (purchaseOrderData) currentPurchaseOrder.value = purchaseOrderData;
    if (canSection('sales')) void Promise.all([loadOverviewTrend(), loadOverviewHotProducts()]);
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : '经营数据加载失败';
  } finally {
    loading.value = false;
  }
}

async function refreshOverviewRealtime() {
  if (!props.storeId) return;
  if (!managementAccess.value?.capabilities.posSync) {
    await loadOverview();
    return;
  }
  loading.value = true;
  error.value = '';
  try {
    await managementRequest(`/management/pos-sync/run?storeId=${encodeURIComponent(props.storeId)}`, {
      method: 'POST', body: JSON.stringify({ date: today, reconcile: false }),
    });
    await loadOverview();
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : '今日实时数据刷新失败';
  } finally {
    loading.value = false;
  }
}

function isoDate(date: Date) { return date.toISOString().slice(0, 10); }
function overviewRange(period: OverviewTrendPeriod | OverviewHotPeriod) {
  const end = new Date(`${today}T00:00:00Z`);
  const start = new Date(end);
  if (period === 'DAY') return { from: today, to: today, dimension: 'DAY' as const };
  if (period === 'WEEK') {
    const weekday = start.getUTCDay();
    start.setUTCDate(start.getUTCDate() - (weekday === 0 ? 6 : weekday - 1));
  }
  if (period === 'MONTH') start.setUTCDate(1);
  if (period === 'QUARTER') { start.setUTCMonth(Math.floor(start.getUTCMonth() / 3) * 3, 1); }
  if (period === 'YEAR') start.setUTCMonth(0, 1);
  return { from: isoDate(start), to: today, dimension: period === 'YEAR' ? 'MONTH' as const : 'DAY' as const };
}
async function loadOverviewTrend() {
  if (!props.storeId || !canSection('sales')) return;
  overviewWidgetsLoading.value = true; overviewWidgetError.value = '';
  try {
    const range = overviewRange(overviewTrendPeriod.value);
    const params = new URLSearchParams({ storeId: props.storeId, ...range });
    const result = await managementRequest<SalesAnalysis>(`/management/sales-analysis?${params.toString()}`);
    if (!result?.metrics || !Array.isArray(result.trend)) throw new Error('销售趋势数据格式不完整');
    overviewTrendAnalysis.value = result;
  } catch (reason) { overviewWidgetError.value = reason instanceof Error ? reason.message : '销售趋势加载失败'; }
  finally { overviewWidgetsLoading.value = false; }
}
async function loadOverviewHotProducts() {
  if (!props.storeId || !canSection('sales')) return;
  overviewWidgetsLoading.value = true; overviewWidgetError.value = '';
  try {
    const range = overviewRange(overviewHotPeriod.value);
    const params = new URLSearchParams({ storeId: props.storeId, ...range });
    const result = await managementRequest<SalesAnalysis>(`/management/sales-analysis?${params.toString()}`);
    if (!Array.isArray(result?.topProducts)) throw new Error('热销商品数据格式不完整');
    overviewHotAnalysis.value = result;
  } catch (reason) { overviewWidgetError.value = reason instanceof Error ? reason.message : '热销商品加载失败'; }
  finally { overviewWidgetsLoading.value = false; }
}
function selectOverviewTrend(period: OverviewTrendPeriod) { overviewTrendPeriod.value = period; void loadOverviewTrend(); }
function selectOverviewHot(period: OverviewHotPeriod) { overviewHotPeriod.value = period; void loadOverviewHotProducts(); }

async function managementRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${props.apiBaseUrl}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${props.token}`, ...(init?.headers ?? {}) },
  });
  const responseText = await response.text();
  let body: { message?: string | string[]; data?: T } = {};
  if (responseText.trim()) {
    try {
      body = JSON.parse(responseText);
    } catch {
      throw new Error(response.ok
        ? '经营 API 返回了无法识别的数据，请重启前后端服务'
        : `经营 API 暂时不可用（HTTP ${response.status}），请检查后端和数据库是否已启动`);
    }
  }
  if (!response.ok) throw new Error(Array.isArray(body.message) ? body.message.join('，') : body.message || '请求失败');
  if (!responseText.trim()) throw new Error('经营 API 返回空响应，请检查后端和数据库是否已启动');
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
    if (managementAccess.value?.capabilities.posIssues) {
      [posIssues.value, barcodeAudit.value] = await Promise.all([
        managementRequest<PosSyncIssues>(`/management/pos-sync/issues?storeId=${store}&page=1&pageSize=20`),
        managementRequest<BarcodeAudit>(`/management/barcode-audit?storeId=${store}`),
      ]);
    }
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

function posInventoryIssueLabel(issue: PosInventoryIssue) {
  if (issue.reason === 'INSUFFICIENT_INVENTORY') return `库存不足：需要 ${number(issue.required ?? 0)} 件，已扣 ${number(issue.available ?? 0)} 件，缺口待复核`;
  if (issue.reason === 'UNMAPPED') return '商品未映射到本地库存商品，此行待复核，其余商品照常扣减';
  if (issue.reason === 'REVIEW_REQUIRED') return '此销售行待人工确认，其余商品照常扣减';
  if (issue.reason === 'RETURN_LINE') return '冲减/退货行，不扣库存，待复核';
  if (issue.reason === 'INVALID_QUANTITY') return '数量不是正整数，此行待复核';
  if (issue.reason === 'CONCURRENT_CHANGE') return '扣减时库存刚好变化，本单未写入，下次自动重试';
  return '订单已处理，无需重复扣库';
}

async function previewPosInventory() {
  if (!props.storeId || !posInventoryFrom.value || !posInventoryTo.value) return;
  posInventoryPreviewLoading.value = true;
  error.value = '';
  try {
    const params = new URLSearchParams({ storeId: props.storeId, from: posInventoryFrom.value, to: posInventoryTo.value });
    posInventoryPreview.value = await managementRequest<PosInventoryPreview>(`/management/pos-inventory/preview?${params.toString()}`);
  } catch (reason) {
    posInventoryPreview.value = null;
    error.value = reason instanceof Error ? reason.message : '正式扣库预览生成失败';
  } finally {
    posInventoryPreviewLoading.value = false;
  }
}

function openPosInventoryConfirmation() {
  if (!posInventoryPreview.value?.summary.eligibleOrders || posInventoryApplyState.value !== 'idle') return;
  posInventoryConfirmOpen.value = true;
}

async function applyPosInventory() {
  if (!props.storeId || !posInventoryPreview.value || posInventoryApplyState.value !== 'idle') return;
  posInventoryApplyState.value = 'loading';
  error.value = '';
  try {
    const result = await managementRequest<PosInventoryApplyResult>(`/management/pos-inventory/apply?storeId=${encodeURIComponent(props.storeId)}`, {
      method: 'POST', body: JSON.stringify({ from: posInventoryFrom.value, to: posInventoryTo.value, confirm: true }),
    });
    posInventoryApplyResult.value = result;
    posInventoryApplyState.value = 'success';
    purchaseSuggestions.value = null;
    await Promise.all([
      loadPosManagement(),
      canSection('overview') ? loadOverview() : Promise.resolve(),
    ]);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    posInventoryConfirmOpen.value = false;
    posInventoryApplyState.value = 'idle';
    await previewPosInventory();
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : '正式库存扣减失败';
    posInventoryApplyState.value = 'idle';
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
    const [operations, order] = await Promise.all([
      managementRequest<InventoryOperations>(`/management/inventory-operations?${params.toString()}`),
      managementRequest<CurrentPurchaseOrder>(`/management/purchase-orders/current?storeId=${encodeURIComponent(props.storeId)}`).catch(() => null),
    ]);
    inventoryOperations.value = operations;
    if (order) currentPurchaseOrder.value = order;
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : '库存经营分析加载失败';
  } finally {
    inventoryLoading.value = false;
  }
}

async function configureMinimumStock(product?: InventoryOperationRow) {
  const current = product?.minimumStock ?? inventoryOperations.value?.defaultMinimumStock ?? 20;
  minimumStockDialog.value = { product: product ?? null, value: String(current) };
}

async function saveMinimumStock() {
  if (!props.storeId || !minimumStockDialog.value) return;
  const minimumStock = Number(minimumStockDialog.value.value);
  if (!Number.isInteger(minimumStock) || minimumStock < 0 || minimumStock > 100000) { error.value = '最低库存必须是0至100000之间的整数'; return; }
  const product = minimumStockDialog.value.product;
  minimumStockSaving.value = true; error.value = '';
  try {
    await managementRequest(`/management/inventory-operations/minimum-stock?storeId=${encodeURIComponent(props.storeId)}`, { method: 'POST', body: JSON.stringify({ productId: product?.productId, minimumStock }) });
    minimumStockDialog.value = null;
    await loadInventoryOperations();
  } catch (reason) { error.value = reason instanceof Error ? reason.message : '最低库存配置失败'; }
  finally { minimumStockSaving.value = false; }
}

async function setInventoryVisibility(item: InventoryOperationRow, mode: 'IGNORE' | 'NEXT_WEEK') {
  if (!props.storeId) return;
  inventoryActionProductId.value = item.productId; error.value = '';
  try {
    await managementRequest(`/management/inventory-operations/visibility?storeId=${encodeURIComponent(props.storeId)}`, { method: 'POST', body: JSON.stringify({ productId: item.productId, mode }) });
    await loadInventoryOperations();
  } catch (reason) { error.value = reason instanceof Error ? reason.message : '库存提醒处理失败'; }
  finally { inventoryActionProductId.value = ''; }
}

async function loadProcurement() {
  if (!props.storeId) return;
  purchaseLoading.value = true; error.value = '';
  try {
    const store = encodeURIComponent(props.storeId);
    const [suggestions, order] = await Promise.all([
      managementRequest<PurchaseSuggestions>(`/management/purchase-suggestions?storeId=${store}`),
      managementRequest<CurrentPurchaseOrder>(`/management/purchase-orders/current?storeId=${store}`),
    ]);
    purchaseSuggestions.value = suggestions;
    currentPurchaseOrder.value = order;
  } catch (reason) { error.value = reason instanceof Error ? reason.message : '进货数据加载失败'; }
  finally { purchaseLoading.value = false; }
}

async function addToPurchaseOrder(productId: string | null, source: PurchaseSource, quantity?: number) {
  if (!props.storeId || !productId) return;
  const status = currentPurchaseOrder.value?.order?.status;
  if (status === 'CANCELLED') {
    purchaseConfirm.value = {
      title: '恢复本周进货单并加入商品',
      description: '本周进货单已经取消。恢复后会保留原有商品，并把这件商品加入草稿；库存不会因此改变。',
      confirmLabel: '恢复并加入', tone: 'primary', action: () => performAddToPurchaseOrder(productId, source, quantity, true),
    };
    return;
  }
  if (status && status !== 'DRAFT') {
    const message = '本周进货单已确认或已订货，请先在“本周进货”中退回草稿再添加商品';
    error.value = message;
    showPurchaseMessage(message, 'error');
    return;
  }
  await performAddToPurchaseOrder(productId, source, quantity, false);
}

async function performAddToPurchaseOrder(productId: string, source: PurchaseSource, quantity?: number, reopen = false) {
  purchaseLoading.value = true; purchaseActionProductId.value = productId; purchaseMessage.value = ''; error.value = '';
  try {
    if (reopen) {
      const restoredOrder = await managementRequest<PurchaseOrder>(`/management/purchase-orders/status?storeId=${encodeURIComponent(props.storeId)}`, { method: 'POST', body: JSON.stringify({ status: 'DRAFT' }) });
      currentPurchaseOrder.value = { ...currentPurchaseOrder.value, currency: currentPurchaseOrder.value?.currency ?? 'NZD', order: restoredOrder };
    }
    const order = await managementRequest<PurchaseOrder>(`/management/purchase-orders/items?storeId=${encodeURIComponent(props.storeId)}`, { method: 'POST', body: JSON.stringify({ productId, source, quantity }) });
    currentPurchaseOrder.value = { ...currentPurchaseOrder.value, currency: currentPurchaseOrder.value?.currency ?? 'NZD', order };
    showPurchaseMessage('商品已加入本周进货单');
    if (purchaseSuggestions.value) {
      const row = purchaseSuggestions.value.suggestions.find((item) => item.productId === productId);
      if (row) row.alreadyIncluded = true;
    }
  } catch (reason) {
    const message = reason instanceof Error ? reason.message : '加入进货单失败';
    error.value = message;
    showPurchaseMessage(message, 'error');
  }
  finally { purchaseLoading.value = false; purchaseActionProductId.value = ''; }
}

function showPurchaseMessage(message: string, tone: 'success' | 'error' = 'success') {
  if (purchaseMessageTimer) clearTimeout(purchaseMessageTimer);
  purchaseMessage.value = message;
  purchaseMessageTone.value = tone;
  purchaseMessageTimer = setTimeout(() => { purchaseMessage.value = ''; }, 3200);
}

function isProductInCurrentOrder(productId: string | null) {
  return Boolean(productId && currentPurchaseOrder.value?.order?.status !== 'CANCELLED' && currentPurchaseOrder.value?.order?.items.some((item) => item.productId === productId));
}

async function ignorePurchaseSuggestion(item: PurchaseSuggestion) {
  if (!props.storeId) return;
  const reason = window.prompt(`忽略“${item.productName}”的进货建议。可填写原因：`, '当前库存足够') ?? null;
  if (reason === null) return;
  purchaseLoading.value = true; purchaseMessage.value = ''; error.value = '';
  try {
    await managementRequest(`/management/purchase-suggestions/ignore?storeId=${encodeURIComponent(props.storeId)}`, { method: 'POST', body: JSON.stringify({ productId: item.productId, reason }) });
    showPurchaseMessage(`${item.productName} 已忽略`);
    await loadProcurement();
  } catch (reasonValue) { error.value = reasonValue instanceof Error ? reasonValue.message : '忽略进货建议失败'; }
  finally { purchaseLoading.value = false; }
}

async function restorePurchaseSuggestion(item: PurchaseSuggestion) {
  if (!props.storeId) return;
  purchaseLoading.value = true; purchaseMessage.value = ''; error.value = '';
  try {
    await managementRequest(`/management/purchase-suggestions/restore?storeId=${encodeURIComponent(props.storeId)}`, { method: 'POST', body: JSON.stringify({ productId: item.productId }) });
    showPurchaseMessage(`${item.productName} 已恢复到进货建议`);
    await loadProcurement();
  } catch (reasonValue) { error.value = reasonValue instanceof Error ? reasonValue.message : '恢复进货建议失败'; }
  finally { purchaseLoading.value = false; }
}

async function savePurchaseItem(item: PurchaseOrderItem) {
  if (!props.storeId) return;
  purchaseLoading.value = true; purchaseMessage.value = ''; error.value = '';
  try {
    const order = await managementRequest<PurchaseOrder>(`/management/purchase-orders/items/update?storeId=${encodeURIComponent(props.storeId)}`, { method: 'POST', body: JSON.stringify({ itemId: item.id, orderedQuantity: item.orderedQuantity, supplierName: item.supplierName, unitCostCents: item.unitCostCents, caseSize: item.caseSize, notes: item.notes }) });
    currentPurchaseOrder.value = { currency: currentPurchaseOrder.value?.currency ?? 'NZD', order };
    showPurchaseMessage(`${item.productName} 已保存`);
  } catch (reason) { error.value = reason instanceof Error ? reason.message : '进货商品保存失败'; }
  finally { purchaseLoading.value = false; }
}

async function removePurchaseItem(item: PurchaseOrderItem) {
  if (!props.storeId) return;
  purchaseConfirm.value = {
    title: `移除“${item.productName}”`,
    description: '商品会从本周进货单移除，但不会删除商品资料，也不会改变当前库存。',
    confirmLabel: '确认移除', tone: 'danger', action: () => performRemovePurchaseItem(item),
  };
}

async function performRemovePurchaseItem(item: PurchaseOrderItem) {
  purchaseLoading.value = true; purchaseMessage.value = ''; error.value = '';
  try {
    const order = await managementRequest<PurchaseOrder>(`/management/purchase-orders/items/remove?storeId=${encodeURIComponent(props.storeId)}`, { method: 'POST', body: JSON.stringify({ itemId: item.id }) });
    currentPurchaseOrder.value = { currency: currentPurchaseOrder.value?.currency ?? 'NZD', order };
    showPurchaseMessage('商品已从本周进货单移除');
    const suggestion = purchaseSuggestions.value?.suggestions.find((row) => row.productId === item.productId);
    if (suggestion) suggestion.alreadyIncluded = false;
  } catch (reason) { error.value = reason instanceof Error ? reason.message : '移除进货商品失败'; }
  finally { purchaseLoading.value = false; }
}

async function changePurchaseStatus(status: 'DRAFT' | 'CONFIRMED' | 'ORDERED' | 'CANCELLED') {
  if (!props.storeId) return;
  const consequence = status === 'CONFIRMED' ? '确认后将暂时锁定商品和数量。' : status === 'ORDERED' ? '标记已订货后，仍需到货并扫码入库才会增加库存。' : status === 'CANCELLED' ? '取消后本周进货单不能继续使用。' : '退回草稿后可以继续修改。';
  purchaseConfirm.value = {
    title: status === 'CANCELLED' ? '取消本周进货单' : `${purchaseStatusLabel(status)}确认`,
    description: consequence,
    confirmLabel: status === 'CANCELLED' ? '确认取消' : '确认操作',
    tone: status === 'CANCELLED' ? 'danger' : 'primary',
    action: () => performPurchaseStatusChange(status),
  };
}

async function performPurchaseStatusChange(status: 'DRAFT' | 'CONFIRMED' | 'ORDERED' | 'CANCELLED') {
  purchaseLoading.value = true; purchaseMessage.value = ''; error.value = '';
  try {
    const order = await managementRequest<PurchaseOrder>(`/management/purchase-orders/status?storeId=${encodeURIComponent(props.storeId)}`, { method: 'POST', body: JSON.stringify({ status }) });
    currentPurchaseOrder.value = { currency: currentPurchaseOrder.value?.currency ?? 'NZD', order };
    showPurchaseMessage('进货单状态已更新');
  } catch (reason) { error.value = reason instanceof Error ? reason.message : '进货单状态更新失败'; }
  finally { purchaseLoading.value = false; }
}

async function confirmPurchaseAction() {
  if (!purchaseConfirm.value || purchaseConfirmBusy.value) return;
  const action = purchaseConfirm.value.action;
  purchaseConfirmBusy.value = true;
  try { await action(); purchaseConfirm.value = null; }
  finally { purchaseConfirmBusy.value = false; }
}

function escapeXml(value: unknown) {
  return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

function exportPurchaseOrderExcel() {
  const order = currentPurchaseOrder.value?.order;
  if (!order?.items.length) return;
  const headers = ['序号', '商品名称', 'SKU/条码', '来源', '当前库存', '近7天销量', '建议数量', '确定进货数量', '供应商', '单件进价(NZ$)', '整箱规格', '预计金额(NZ$)', '备注'];
  const rows = order.items.map((item, index) => [index + 1, item.productName, item.barcode || item.sku, purchaseSourceLabel(item.source), item.currentInventory, item.recentSevenDayQty, item.suggestedQuantity, item.orderedQuantity, item.supplierName || '', item.unitCostCents == null ? '' : (item.unitCostCents / 100).toFixed(2), item.caseSize ?? '', item.unitCostCents == null ? '' : ((item.unitCostCents * item.orderedQuantity) / 100).toFixed(2), item.notes || '']);
  const tableRows = [headers, ...rows].map((row) => `<Row>${row.map((cell) => `<Cell><Data ss:Type="${typeof cell === 'number' ? 'Number' : 'String'}">${escapeXml(cell)}</Data></Cell>`).join('')}</Row>`).join('');
  const xml = `<?xml version="1.0"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="本周进货单"><Table>${tableRows}</Table></Worksheet></Workbook>`;
  const url = URL.createObjectURL(new Blob(['\ufeff', xml], { type: 'application/vnd.ms-excel;charset=utf-8' }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = `${order.orderNo}-本周进货单.xls`; anchor.click(); URL.revokeObjectURL(url);
  showPurchaseMessage('进货单 Excel 已生成');
}

function openProcurement(view: 'suggestions' | 'order' = 'order') { purchaseView.value = view; selectSection('procurement'); }
function purchaseSourceLabel(source: PurchaseSource) { return ({ MANUAL: '人工加入', OUT_OF_STOCK: '缺货', LOW_STOCK: '低库存', HOT_SALES: '热销商品', WEEKLY_FORECAST: '一周销量缺口' })[source]; }
function purchaseStatusLabel(status: PurchaseOrder['status']) { return ({ DRAFT: '草稿', CONFIRMED: '已确认', ORDERED: '已订货', PARTIALLY_RECEIVED: '部分到货', RECEIVED: '全部到货', CANCELLED: '已取消' })[status]; }

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

watch(productDetailPageSize, () => { productDetailPage.value = 1; });
watch(productDetailPageCount, (count) => { if (productDetailPage.value > count) productDetailPage.value = count; });
watch(insightDetailPageSize, () => { insightDetailPage.value = 1; });
watch(insightDetailPageCount, (count) => { if (insightDetailPage.value > count) insightDetailPage.value = count; });
watch([inventoryTableQuery, inventoryBrandFilter, inventoryCategoryFilter, inventoryStatusFilter, inventorySort, inventoryPageSize], () => { inventoryPage.value = 1; });
watch([posInventoryFrom, posInventoryTo], () => { posInventoryPreview.value = null; posInventoryApplyResult.value = null; });
watch(inventoryPageCount, (count) => { if (inventoryPage.value > count) inventoryPage.value = count; });
watch(activeSection, (section) => {
  if (section === 'system') void loadSystemManagement();
  if (section === 'sales') void loadSalesAnalysis();
  if (section === 'products') void loadProductsBrands();
  if (section === 'inventory') void loadInventoryOperations();
  if (section === 'procurement') void loadProcurement();
  if (section === 'stores') void loadStoreComparison();
  if (section === 'customers') void loadProductInsights();
});
onMounted(async () => { await loadManagementAccess(); if (canSection('overview')) await loadOverview(); });
onBeforeUnmount(() => { if (purchaseMessageTimer) clearTimeout(purchaseMessageTimer); });
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
          <span>{{ section.label }}</span><small>{{ section.description }}</small><i v-if="activeSection === section.id" class="nav-current-marker" aria-hidden="true">›</i><em v-if="!canSection(section.id)">无权限</em><em v-else-if="!section.ready">规划中</em>
        </button>
        </section>
      </nav>
      <p>正式数据来自 Homi 数据库<br />POS 数据同步后自动更新</p>
    </aside>

    <main class="management-content" :class="{ 'overview-content': activeSection === 'overview' }">
    <header class="management-heading">
      <div><p>MANAGEMENT / {{ activeSection.toUpperCase() }}</p><h2>{{ currentSection.label }}</h2><span>{{ overview?.store.name || storeName }} · {{ currentSection.description }}</span></div>
      <div v-if="activeSection === 'overview'" class="management-filters"><label>经营日期<strong>{{ today }}</strong></label><button type="button" :disabled="loading" @click="refreshOverviewRealtime">{{ loading ? '同步中…' : '刷新今日数据' }}</button></div>
      <div v-else-if="activeSection === 'system'" class="management-filters"><button type="button" :disabled="posLoading || posRunning" @click="loadSystemManagement">{{ posLoading ? '加载中…' : '刷新状态' }}</button></div>
    </header>

    <button class="page-guide-fab" type="button" aria-label="查看本页说明" :aria-expanded="pageGuideOpen" @click="pageGuideOpen = !pageGuideOpen"><img src="/sunshine-fern-assistant.png" alt="" /><span aria-hidden="true"></span><b>页面说明</b></button>
    <Transition name="guide-pop"><aside v-if="pageGuideOpen" class="page-guide-popover" aria-label="本页包含什么"><header><span><small>阳光小助手 · 本页包含什么</small><strong>{{ currentSection.label }}怎么读</strong></span><button type="button" aria-label="关闭页面说明" @click="pageGuideOpen = false">×</button></header><p>{{ currentGuide.purpose }}</p><ul><li v-for="item in currentGuide.includes" :key="item">{{ item }}</li></ul><div v-if="currentGuide.details?.length" class="guide-details"><p v-for="detail in currentGuide.details" :key="detail">{{ detail }}</p></div><b>{{ currentGuide.decision }}</b></aside></Transition>

    <Teleport to="body"><Transition name="modal-pop"><div v-if="minimumStockDialog" class="management-modal-backdrop" @click.self="minimumStockDialog = null"><form class="minimum-stock-dialog" @submit.prevent="saveMinimumStock"><header><span><small>库存提醒设置</small><strong>{{ minimumStockDialog.product ? minimumStockDialog.product.productName : '统一设置最低库存' }}</strong></span><button type="button" aria-label="关闭最低库存设置" @click="minimumStockDialog = null">×</button></header><p>库存低于这个数量时标记为低库存。这里只改变提醒阈值，不会修改真实库存。</p><label>最低库存数量<input v-model="minimumStockDialog.value" type="number" min="0" max="100000" step="1" autofocus /></label><div v-if="!minimumStockDialog.product" class="dialog-scope-note"><strong>统一应用</strong><span>保存后会更新当前门店全部启用商品。</span></div><footer><button class="dialog-cancel" type="button" @click="minimumStockDialog = null">暂不修改</button><button class="dialog-confirm" type="submit" :disabled="minimumStockSaving">{{ minimumStockSaving ? '保存中…' : '保存阈值' }}</button></footer></form></div></Transition></Teleport>
    <Teleport to="body"><Transition name="toast-pop"><p v-if="purchaseMessage" :class="['purchase-toast', purchaseMessageTone]" :role="purchaseMessageTone === 'error' ? 'alert' : 'status'">{{ purchaseMessage }}</p></Transition></Teleport>
    <Teleport to="body"><Transition name="modal-pop"><div v-if="purchaseConfirm" class="management-modal-backdrop" @click.self="purchaseConfirm = null"><section class="purchase-confirm-dialog" role="dialog" aria-modal="true" aria-label="进货单操作确认"><header><span><small>本周进货单</small><strong>{{ purchaseConfirm.title }}</strong></span><button type="button" aria-label="关闭进货单确认框" @click="purchaseConfirm = null">×</button></header><p>{{ purchaseConfirm.description }}</p><footer><button class="dialog-cancel" type="button" @click="purchaseConfirm = null">暂不操作</button><button :class="['dialog-confirm', { danger: purchaseConfirm.tone === 'danger' }]" type="button" :disabled="purchaseConfirmBusy" @click="confirmPurchaseAction">{{ purchaseConfirmBusy ? '处理中…' : purchaseConfirm.confirmLabel }}</button></footer></section></div></Transition></Teleport>
    <Teleport to="body"><Transition name="modal-pop"><div v-if="posInventoryConfirmOpen" class="management-modal-backdrop" @click.self="posInventoryApplyState === 'idle' && (posInventoryConfirmOpen = false)"><section class="purchase-confirm-dialog pos-inventory-confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="pos-inventory-confirm-title"><header><span><small>POS 正式库存</small><strong id="pos-inventory-confirm-title">确认按销量扣减库存</strong></span><button type="button" aria-label="关闭正式扣库确认框" :disabled="posInventoryApplyState !== 'idle'" @click="posInventoryConfirmOpen = false">×</button></header><p>将为 {{ posInventoryPreview?.summary.eligibleOrders ?? 0 }} 张已付款且无退款的订单写入销售出库流水，共扣减 {{ number(posInventoryPreview?.summary.unitsPlanned ?? 0) }} 件。每行商品按临期优先分配批次；未映射或库存不足的行进入复核，其余商品照常扣减，不会产生负库存。</p><dl class="confirm-impact"><div><dt>处理日期</dt><dd>{{ posInventoryFrom }} 至 {{ posInventoryTo }}</dd></div><div><dt>进入复核</dt><dd>{{ posInventoryPreview?.summary.reviewLines ?? 0 }} 行明细 · 缺口 {{ number(posInventoryPreview?.summary.shortfallUnits ?? 0) }} 件 · {{ posInventoryPreview?.summary.reviewRequiredOrders ?? 0 }} 张整单待复核</dd></div></dl><footer><button class="dialog-cancel" type="button" :disabled="posInventoryApplyState !== 'idle'" @click="posInventoryConfirmOpen = false">返回检查</button><button class="dialog-confirm morph-submit" :class="`is-${posInventoryApplyState}`" type="button" :disabled="posInventoryApplyState !== 'idle'" :aria-label="posInventoryApplyState === 'loading' ? '正在扣减库存' : posInventoryApplyState === 'success' ? '库存扣减成功' : '确认扣减库存'" @click="applyPosInventory"><span v-if="posInventoryApplyState === 'idle'">确认扣减库存</span><i v-else-if="posInventoryApplyState === 'loading'" aria-hidden="true"></i><b v-else aria-hidden="true">✓</b></button></footer></section></div></Transition></Teleport>

    <div v-if="error" class="management-alert error" role="alert"><span>{{ error }}。本次数据未能更新，已显示的内容可能不是最新结果。</span><button class="text-action" type="button" :disabled="pageBusy" @click="retryCurrentPage">重新加载</button></div>
    <p v-if="pageBusy" class="page-load-status" role="status">正在更新{{ currentSection.label }}…</p>
    <template v-if="activeSection === 'overview'">
    <p v-if="overview && !overview.salesAvailable" class="management-alert pending sync-required-alert"><strong>POS 销售数据尚未同步</strong><span>当前销售卡片显示为 0，“刷新数据”只查询本地数据库，不会从 POS 拉取订单，也不会使用演示数据。</span><button type="button" :disabled="!canSection('system')" @click="openDataCenter('sync')">前往 POS 同步</button></p>
    <div class="data-freshness" aria-label="数据更新时间"><span>库存更新：{{ dateTime(foundation?.quality.inventory.latestUpdatedAt ?? null) }}</span><span>POS 最近成功同步：{{ dateTime(overview?.lastPosSyncAt ?? null) }}</span><button v-if="canSection('system')" class="text-action" type="button" @click="openDataCenter()">查看数据检查</button></div>

    <template v-if="overview">
      <div class="overview-metric-strip" aria-label="经营核心指标">
        <article><i class="metric-symbol sales">$</i><span>今日净销售额<strong>{{ money(overview.sales.current.netRevenue) }}</strong><small :class="comparisonClass(overview.sales.comparison.netRevenuePercent)">较昨日 {{ percent(overview.sales.comparison.netRevenuePercent) }}</small></span></article>
        <article><i class="metric-symbol orders">#</i><span>今日订单<strong>{{ overview.sales.current.orderCount }} 单</strong><small :class="comparisonClass(overview.sales.comparison.orderCountPercent)">较昨日 {{ percent(overview.sales.comparison.orderCountPercent) }}</small></span></article>
        <article><i class="metric-symbol units">∑</i><span>今日销售件数<strong>{{ number(overview.sales.current.unitsSold) }} 件</strong><small :class="comparisonClass(overview.sales.comparison.unitsSoldPercent)">较昨日 {{ percent(overview.sales.comparison.unitsSoldPercent) }}</small></span></article>
        <article><i class="metric-symbol average">Ø</i><span>今日平均客单价<strong>{{ money(overview.sales.current.averageOrderValue) }}</strong><small :class="comparisonClass(overview.sales.comparison.averageOrderValuePercent)">较昨日 {{ percent(overview.sales.comparison.averageOrderValuePercent) }}</small></span></article>
        <article><i class="metric-symbol stock">▦</i><span>当前库存<strong>{{ number(overview.inventory.totalQuantity) }} 件</strong><small>{{ overview.inventory.productCount }} 种商品</small></span></article>
        <article><i class="metric-symbol expiry">!</i><span>到期关注<strong>{{ number(overview.inventory.expiryAttentionQuantity) }} 件</strong><small>{{ overview.inventory.batchCount }} 个库存批次</small></span></article>
      </div>

      <p v-if="overviewWidgetError" class="inline-notice">{{ overviewWidgetError }}，仍显示最近一次成功结果。</p>
      <div class="overview-command-grid">
        <section class="management-card overview-sales-card">
          <header class="overview-card-header"><div><small>NET SALES</small><h3>销售趋势</h3><p>{{ overviewTrendAnalysis?.period.from ?? overview.period.date }} 至 {{ overviewTrendAnalysis?.period.to ?? today }}</p></div><div class="overview-header-actions"><div class="period-tabs" role="group" aria-label="销售趋势周期"><button v-for="item in overviewTrendPeriods" :key="item.key" type="button" :aria-pressed="overviewTrendPeriod === item.key" :disabled="overviewWidgetsLoading" @click="selectOverviewTrend(item.key)">{{ item.label }}</button></div><button v-if="canSection('sales')" class="text-action" type="button" @click="openSalesFromOverview">销售详情 →</button></div></header>
          <div class="trend-primary"><strong>{{ money(overviewTrendAnalysis?.metrics.netRevenue ?? overview.sales.current.netRevenue) }}</strong><span>{{ overviewTrendAnalysis?.metrics.orderCount ?? overview.sales.current.orderCount }} 单 · {{ number(overviewTrendAnalysis?.metrics.unitsSold ?? overview.sales.current.unitsSold) }} 件</span></div>
          <p v-if="overviewTrendSeries.length === 1" class="scope-note">当前只有 1 个有记录的日期，尚不足以形成完整趋势。</p><div v-if="overviewTrendSeries.length" :key="overviewTrendPeriod" class="trend-line-chart overview-line-chart">
            <svg viewBox="-150 0 1160 230" role="img" aria-label="销售趋势折线图"><defs><linearGradient id="overview-area" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#24d6e5" stop-opacity=".4"/><stop offset="100%" stop-color="#24d6e5" stop-opacity="0"/></linearGradient></defs><g class="chart-grid"><line v-for="y in [40,82,124,166,210]" :key="y" x1="0" :y1="y" x2="1000" :y2="y" /></g><g class="chart-values"><text v-for="y in [40,124,210]" :key="y" x="-12" :y="y + 5" text-anchor="end">{{ money(maxDailyRevenue * (210 - y) / 170) }}</text></g><path :d="areaPath(overviewTrendPoints)" fill="url(#overview-area)"/><polyline :points="linePath(overviewTrendPoints)"/><circle v-for="(point,index) in overviewTrendPoints" :key="index" :cx="point.x" :cy="point.y" r="4"><title>{{ overviewTrendSeries[index].period }} · {{ money(point.value) }}</title></circle></svg>
            <div class="trend-axis"><span v-for="item in overviewTrendSeries.filter((_,index,rows) => index === 0 || index === rows.length - 1 || index % Math.max(1, Math.ceil(rows.length / 5)) === 0)" :key="item.period">{{ item.period.length > 7 ? item.period.slice(5) : item.period }}</span></div>
          </div><p v-else class="management-empty">所选周期暂无已同步销售记录。</p>
        </section>

        <section class="management-card expiry-earnings-card">
          <header class="overview-card-header"><div><small>EXPIRY WATCH</small><h3>库存临期预警</h3><p>按批次风险分层</p></div><button class="text-action" type="button" @click="emit('open-report', 'expiry')">查看明细 →</button></header>
          <button class="expiry-earning-row expired" type="button" @click="emit('open-report', 'expiry')"><span>已过期<small>立即隔离处理</small></span><strong>{{ overview.inventory.expiry.expired }}</strong><i><b></b><b></b><b></b></i></button>
          <button class="expiry-earning-row urgent" type="button" @click="emit('open-report', 'expiry')"><span>紧急临期<small>优先检查与销售</small></span><strong>{{ overview.inventory.expiry.urgent }}</strong><i><b></b><b></b><b></b></i></button>
          <button class="expiry-earning-row warning" type="button" @click="emit('open-report', 'expiry')"><span>临期预警<small>进入近期处理清单</small></span><strong>{{ overview.inventory.expiry.warning }}</strong><i><b></b><b></b><b></b></i></button>
          <button class="expiry-earning-row early" type="button" @click="emit('open-report', 'expiry')"><span>提前关注<small>持续观察周转</small></span><strong>{{ overview.inventory.expiry.early }}</strong><i><b></b><b></b><b></b></i></button>
        </section>
      </div>

      <section class="overview-action-rail action-list" aria-label="经营关注与待办"><h3 class="visually-hidden">经营关注与待办</h3>
        <button type="button" @click="emit('open-report', 'receipts')"><i>↧</i><span>待提交入库单<small>查看未完成的入库作业</small></span><strong>{{ overview.inventory.activity.openReceiptCount }} 单</strong></button>
        <button type="button" @click="emit('open-report', 'expiry')"><i>⌛</i><span>到期关注<small>处理临期与过期批次</small></span><strong>{{ number(overview.inventory.expiryAttentionQuantity) }} 件</strong></button>
        <button type="button" @click="emit('open-report', 'movements')"><i>⇄</i><span>今日库存作业<small>含盘点修正 {{ overview.inventory.activity.stocktakeAdjustmentsToday }} 笔</small></span><strong>{{ overview.inventory.activity.movementCountToday }} 笔流水</strong></button>
        <button type="button" @click="openProcurement('order')"><i>↧</i><span>本周进货单<small>查看建议、确认数量与订货状态</small></span><strong>{{ currentPurchaseOrder?.order?.summary.productCount ?? 0 }} 种</strong></button>
      </section>

      <section class="management-card hot-products-card">
        <header class="overview-card-header"><div><small>TOP PRODUCTS</small><h3>热销产品 20</h3><p>按销售金额排序，快速识别主力商品</p></div><div class="period-tabs" role="group" aria-label="热销商品周期"><button v-for="item in overviewHotPeriods" :key="item.key" type="button" :aria-pressed="overviewHotPeriod === item.key" :disabled="overviewWidgetsLoading" @click="selectOverviewHot(item.key)">{{ item.label }}</button></div></header>
        <div v-if="(overviewHotAnalysis?.topProducts ?? overview.sales.current.topProducts).length" :key="overviewHotPeriod" class="hot-products-grid"><article v-for="(item,index) in (overviewHotAnalysis?.topProducts ?? overview.sales.current.topProducts).slice(0,20)" :key="`${item.productName}-${index}`"><b class="rank-badge" :class="{ podium:index<3 }">{{ String(index+1).padStart(2,'0') }}</b><span><strong>{{ item.productName }}</strong><small>{{ item.brandName || '未设置品牌' }}</small></span><em>{{ number(item.quantity) }} 件</em><strong>{{ money(item.revenue) }}</strong><button class="table-action" type="button" :disabled="purchaseLoading || !item.productId || isProductInCurrentOrder(item.productId)" @click="addToPurchaseOrder(item.productId,'HOT_SALES')">{{ isProductInCurrentOrder(item.productId) ? '已加入' : '加入' }}</button></article></div><p v-else class="management-empty">所选周期暂无商品销售排行。</p>
      </section>
    </template>
    </template>

    <section v-else-if="activeSection === 'sales'" class="sales-analysis-page">
      <div class="period-shortcuts" role="group" aria-label="快捷日期"><span>默认显示今天</span><button type="button" @click="setDateRange('sales', 'today')">今天</button><button type="button" @click="setDateRange('sales', 'week')">近7天</button><button type="button" @click="setDateRange('sales', 'month')">本月</button><button type="button" @click="setDateRange('sales', 'year')">本年</button><small>快捷日期会同时选择合适的统计维度；自定义日期后可手动调整</small></div>
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
        <p v-if="productsBrands.mappingQuality?.activeItems && productsBrands.mappingQuality.coveragePercent < 100" class="management-alert pending"><strong>商品映射尚未完成</strong><span>当前销售明细映射率 {{ productsBrands.mappingQuality.coveragePercent }}%，未映射销售不会进入商品与品牌统计。</span><button v-if="canSection('system')" type="button" @click="openDataCenter('issues')">查看异常</button></p>
        <div class="product-kpis">
          <article><span>启用商品</span><strong>{{ productsBrands.summary.productCount }}</strong><small>所选条件下的正式商品</small></article>
          <article><span>有销售商品</span><strong>{{ productsBrands.summary.soldProductCount }}</strong><small>销售 {{ number(productsBrands.summary.unitsSold) }} 件</small></article>
          <article><span>商品销售额</span><strong>{{ money(productsBrands.summary.salesRevenue) }}</strong><small>{{ productsBrands.period.from }} 至 {{ productsBrands.period.to }}</small></article>
          <article><span>当前库存</span><strong>{{ number(productsBrands.summary.currentInventory) }} 件</strong><small>{{ productsBrands.summary.inStockProducts }} 种有正库存</small></article>
          <article><button class="kpi-filter" type="button" @click="openInventoryAlert('OUT_OF_STOCK')"><span>缺货商品</span><strong>{{ productsBrands.summary.outOfStockProducts }}</strong><small>近180天有销售的零库存商品</small></button></article>
          <article><button class="kpi-filter" type="button" @click="openInventoryAlert('LOW')"><span>低库存商品</span><strong>{{ productsBrands.summary.lowStockProducts }}</strong><small>{{ productsBrands.summary.minimumStockConfiguredProducts ? '按已配置最低库存判断' : '尚未配置最低库存阈值' }}</small></button></article>
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
      <p v-if="inventoryOperations && !inventoryOperations.salesCoverage.reliable" class="management-alert pending"><strong>销售历史不足</strong><span>{{ inventoryOperations.coverageNotice }} 缺货与低库存仍可使用，但积压和滞销需要等待更多销售历史。</span></p>
      <template v-if="inventoryOperations">
        <p v-if="inventoryOperations.summary.expiredUnits" class="management-alert pending" role="status"><strong>已过期库存</strong><span>{{ inventoryOperations.summary.expiredBatches }} 个批次共 {{ number(inventoryOperations.summary.expiredUnits) }} 件已过期，请在库存系统「临期提醒 · 已过期」中处理。</span></p>
        <div class="inventory-operation-kpis">
          <article><span>当前库存</span><strong>{{ number(inventoryOperations.summary.totalInventory) }} 件</strong><small>{{ inventoryOperations.summary.stockedProducts }} 种有库存商品</small></article>
          <article><button class="kpi-filter" type="button" @click="inventoryStatusFilter = 'OUT_OF_STOCK'; inventoryPage = 1" aria-label="筛选缺货商品"><span>缺货商品</span><strong>{{ inventoryOperations.summary.outOfStockProducts }}</strong><small>零库存且120天内有销售</small></button></article>
          <article><button class="kpi-filter" type="button" @click="inventoryStatusFilter = 'LOW'; inventoryPage = 1" aria-label="筛选低库存商品"><span>低库存商品</span><strong>{{ inventoryOperations.summary.lowStockProducts }}</strong><small>核心品牌与绵羊油默认20件</small></button></article>
          <article><button class="kpi-filter" type="button" @click="inventoryStatusFilter = 'SLOW'; inventoryPage = 1" aria-label="筛选滞销关注"><span>滞销关注</span><strong>{{ inventoryOperations.summary.slowMovingProducts }}</strong><small>有库存且销量不足</small></button></article>
          <article><span>观察商品</span><strong>{{ inventoryOperations.summary.productCount }}</strong><small>已观察 {{ inventoryOperations.salesCoverage.observedDays }} 天POS销售跨度</small></article>
        </div>
        <section class="system-card product-table-card inventory-detail-card" :aria-busy="inventoryLoading">
          <div class="card-title"><div><h3>销售与库存关联明细</h3><p>{{ inventoryOperations.period.from }} 至 {{ inventoryOperations.period.to }} · 库存为当前余额</p></div><div class="minimum-stock-tools"><span>{{ filteredInventoryProducts.length }} / {{ inventoryOperations.products.length }} 种</span><button class="table-action" type="button" @click="configureMinimumStock()">统一设置最低库存</button></div></div>
          <div class="inventory-status-tabs" aria-label="库存状态快捷筛选">
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
          <button class="text-action clear-table-filter" type="button" @click="clearInventoryFilters">清除筛选</button><div class="product-table-wrap inventory-scroll-table"><table><thead><tr><th>商品</th><th>库存</th><th>最低库存</th><th>观察期销量</th><th>日均销量</th><th>最后销售</th><th>状态与操作</th></tr></thead><tbody><tr v-for="item in pagedInventoryProducts" :key="item.productId"><td><strong>{{ item.productName }}</strong><small>{{ item.brandName }} · {{ item.categoryName }}<template v-if="item.posMapped === false"> · <b class="pos-unmapped-tag">POS未映射</b></template></small></td><td>{{ number(item.currentInventory) }}</td><td><button class="minimum-stock-value" type="button" @click="configureMinimumStock(item)">{{ item.minimumStock ?? '—' }} <small>{{ item.minimumStockSource === 'MANUAL' ? '单独' : item.minimumStockSource === 'DEFAULT' ? '默认' : '不提醒' }}</small></button></td><td>{{ number(item.soldUnits) }}</td><td>{{ number(item.dailyVelocity) }}</td><td>{{ item.daysSinceLastSale === null ? '无记录' : `${item.daysSinceLastSale} 天前` }}</td><td><div class="inventory-row-actions"><b :class="['stock-badge', item.stockStatus.toLowerCase()]">{{ item.stockStatus === 'IN_STOCK' ? (item.slowMoving ? '滞销关注' : '正常') : item.stockStatus === 'LOW' ? '低库存' : item.shortageVisible ? '缺货' : '长期停卖' }}</b><button type="button" :disabled="inventoryActionProductId === item.productId" @click="setInventoryVisibility(item, 'IGNORE')">忽略</button><button type="button" :disabled="inventoryActionProductId === item.productId" @click="setInventoryVisibility(item, 'NEXT_WEEK')">下周显示</button><button class="table-action muted" type="button" @click="configureMinimumStock(item)">设阈值</button><button v-if="item.stockStatus !== 'IN_STOCK' && (item.stockStatus !== 'OUT_OF_STOCK' || item.shortageVisible)" :class="['table-action', { 'is-added': isProductInCurrentOrder(item.productId) }]" type="button" :disabled="purchaseLoading || isProductInCurrentOrder(item.productId)" @click="addToPurchaseOrder(item.productId, item.stockStatus === 'OUT_OF_STOCK' ? 'OUT_OF_STOCK' : 'LOW_STOCK')">{{ purchaseActionProductId === item.productId ? '加入中…' : isProductInCurrentOrder(item.productId) ? '已在进货单' : '加入进货单' }}</button></div></td></tr></tbody></table><p v-if="!pagedInventoryProducts.length" class="system-empty">当前筛选条件没有需要处理的商品。</p></div>
          <div class="inventory-table-pagination">
            <span>显示 {{ filteredInventoryProducts.length ? (inventoryPage - 1) * inventoryPageSize + 1 : 0 }}–{{ Math.min(inventoryPage * inventoryPageSize, filteredInventoryProducts.length) }} / 共 {{ filteredInventoryProducts.length }} 种商品</span>
            <label>每页<select v-model.number="inventoryPageSize"><option :value="18">18</option><option :value="54">54</option></select></label>
            <div><button type="button" :disabled="inventoryPage <= 1" @click="inventoryPage--">上一页</button><b>{{ inventoryPage }} / {{ inventoryPageCount }}</b><button type="button" :disabled="inventoryPage >= inventoryPageCount" @click="inventoryPage++">下一页</button></div>
          </div>
        </section>
      </template>
    </section>

    <section v-else-if="activeSection === 'procurement'" class="procurement-page">
      <div class="procurement-tabs" role="tablist" aria-label="进货管理视图"><button type="button" :class="{ active: purchaseView === 'suggestions' }" @click="purchaseView = 'suggestions'">进货建议 <b>{{ purchaseSuggestions?.summary.products ?? 0 }}</b></button><button type="button" :class="{ active: purchaseView === 'order' }" @click="purchaseView = 'order'">本周进货单 <b>{{ currentPurchaseOrder?.order?.summary.productCount ?? 0 }}</b></button></div>
      <p class="management-alert pending"><strong>库存安全</strong><span>加入或确认进货单不会改变库存。商品到货后仍需进入扫码入库，填写批次和到期日期，库存才会正式增加。</span></p>

      <template v-if="purchaseView === 'suggestions'">
        <section class="procurement-summary" v-if="purchaseSuggestions"><article><span>全部备货候选</span><strong>{{ purchaseSuggestions.summary.products }} 种</strong><small>4–6 周覆盖，不是一周必须买完</small></article><article><span>本周优先</span><strong>{{ purchaseSuggestions.summary.thisWeekProducts }} 种</strong><small>缺货、不足1周或低于阈值</small></article><article><span>后续跟进</span><strong>{{ purchaseSuggestions.summary.followUpProducts }} 种</strong><small>可分批加入进货单</small></article><article><span>已忽略</span><strong>{{ purchaseSuggestions.summary.ignored }} 种</strong><small>可随时恢复</small></article></section>
        <section class="system-card procurement-table-card" v-if="purchaseSuggestions">
          <div class="card-title"><div><h3>库存覆盖进货建议</h3><p>{{ purchaseSuggestions.calculation }}</p><small class="inventory-source-time">本页库存读取：{{ dateTime(purchaseSuggestions.generatedAt) }} · 最近库存变更：{{ dateTime(purchaseSuggestions.inventoryLatestUpdatedAt) }}</small></div><div class="purchase-suggestion-actions"><button class="text-action" type="button" @click="showIgnoredSuggestions = !showIgnoredSuggestions">{{ showIgnoredSuggestions ? '查看当前建议' : `查看已忽略 (${purchaseSuggestions.summary.ignored})` }}</button><button class="text-action" type="button" @click="purchaseView = 'order'">查看本周进货单 →</button></div></div>
          <div class="purchase-suggestion-scroll">
            <template v-if="!showIgnoredSuggestions">
              <section v-if="thisWeekPurchaseSuggestions.length" class="suggestion-priority-group"><header><span><b>本周优先</b><small>库存风险较高，建议先处理</small></span><em>{{ thisWeekPurchaseSuggestions.length }} 种</em></header><div class="purchase-suggestion-grid"><article v-for="item in thisWeekPurchaseSuggestions" :key="item.productId"><header><strong>{{ item.productName }}</strong><small>{{ item.brandName }}</small></header><dl><div class="inventory-focus"><dt>库存</dt><dd>{{ number(item.currentInventory) }}</dd></div><div><dt>周销量</dt><dd>{{ number(item.weeklyVelocity) }}</dd></div><div class="suggested"><dt>建议进货</dt><dd>{{ number(item.suggestedQuantity) }}</dd></div></dl><footer><button class="table-action" type="button" :disabled="purchaseLoading || item.alreadyIncluded" @click="addToPurchaseOrder(item.productId, item.source, item.suggestedQuantity)">{{ item.alreadyIncluded ? '已加入' : '加入进货单' }}</button><button class="table-action muted" type="button" :disabled="purchaseLoading" @click="ignorePurchaseSuggestion(item)">忽略</button></footer></article></div></section>
              <section v-if="followUpPurchaseSuggestions.length" class="suggestion-priority-group follow-up"><header><span><b>后续跟进</b><small>备货周期候选，可按预算分批处理</small></span><em>{{ followUpPurchaseSuggestions.length }} 种</em></header><div class="purchase-suggestion-grid"><article v-for="item in followUpPurchaseSuggestions" :key="item.productId"><header><strong>{{ item.productName }}</strong><small>{{ item.brandName }}</small></header><dl><div class="inventory-focus"><dt>库存</dt><dd>{{ number(item.currentInventory) }}</dd></div><div><dt>周销量</dt><dd>{{ number(item.weeklyVelocity) }}</dd></div><div class="suggested"><dt>建议进货</dt><dd>{{ number(item.suggestedQuantity) }}</dd></div></dl><footer><button class="table-action" type="button" :disabled="purchaseLoading || item.alreadyIncluded" @click="addToPurchaseOrder(item.productId, item.source, item.suggestedQuantity)">{{ item.alreadyIncluded ? '已加入' : '加入进货单' }}</button><button class="table-action muted" type="button" :disabled="purchaseLoading" @click="ignorePurchaseSuggestion(item)">忽略</button></footer></article></div></section>
            <details v-if="purchaseSuggestions.arrivedSuggestions?.length" class="suggestion-priority-group arrived-group"><summary><span><b>已到货</b><small>近7天已入库，不再建议进货</small></span><em>{{ purchaseSuggestions.arrivedSuggestions.length }} 种</em></summary><div class="purchase-suggestion-grid"><article v-for="item in purchaseSuggestions.arrivedSuggestions" :key="item.productId"><header><strong>{{ item.productName }}</strong><small>{{ item.brandName }}</small></header><dl><div class="inventory-focus"><dt>库存</dt><dd>{{ number(item.currentInventory) }}</dd></div><div><dt>周销量</dt><dd>{{ number(item.weeklyVelocity) }}</dd></div><div><dt>近7天入库</dt><dd>{{ number(item.recentReceivedQty ?? 0) }}</dd></div><div><dt>入库时间</dt><dd>{{ item.lastReceivedAt ? new Date(item.lastReceivedAt).toLocaleDateString('zh-CN') : '—' }}</dd></div></dl></article></div></details>
            </template>
            <div v-else class="purchase-suggestion-grid"><article v-for="item in purchaseSuggestions.ignoredSuggestions" :key="item.productId"><header><strong>{{ item.productName }}</strong><small>{{ item.brandName }}</small></header><dl><div class="inventory-focus"><dt>库存</dt><dd>{{ number(item.currentInventory) }}</dd></div><div><dt>周销量</dt><dd>{{ number(item.weeklyVelocity) }}</dd></div><div class="suggested"><dt>建议进货</dt><dd>{{ number(item.suggestedQuantity) }}</dd></div></dl><small v-if="item.ignoredReason">忽略原因：{{ item.ignoredReason }}</small><footer><button class="table-action" type="button" :disabled="purchaseLoading" @click="restorePurchaseSuggestion(item)">恢复建议</button></footer></article></div>
            <p v-if="!(showIgnoredSuggestions ? purchaseSuggestions.ignoredSuggestions : purchaseSuggestions.suggestions).length" class="system-empty">{{ showIgnoredSuggestions ? '当前没有已忽略的建议。' : '当前没有需要补货的商品。' }}</p>
          </div>
        </section>
      </template>

      <template v-else>
        <section v-if="currentPurchaseOrder?.order" class="procurement-summary"><article><span>进货单状态</span><strong>{{ purchaseStatusLabel(currentPurchaseOrder.order.status) }}</strong><small>{{ currentPurchaseOrder.order.orderNo }}</small></article><article><span>商品与件数</span><strong>{{ currentPurchaseOrder.order.summary.productCount }} 种 · {{ number(currentPurchaseOrder.order.summary.orderedUnits) }} 件</strong><small>系统建议 {{ number(currentPurchaseOrder.order.summary.suggestedUnits) }} 件</small></article><article><span>预计金额</span><strong>{{ money(currentPurchaseOrder.order.summary.totalCostCents / 100) }}</strong><small>仅统计已填写进价</small></article></section>
        <section v-if="currentPurchaseOrder?.order" class="system-card purchase-order-card"><div class="card-title"><div><h3>本周进货单</h3><p>周起始 {{ currentPurchaseOrder.order.weekStart }} · {{ currentPurchaseOrder.order.orderNo }}</p><small v-if="currentPurchaseOrder.generatedAt" class="inventory-source-time">实时库存读取：{{ dateTime(currentPurchaseOrder.generatedAt) }} · 最近库存变更：{{ dateTime(currentPurchaseOrder.inventoryLatestUpdatedAt ?? null) }}</small></div><div class="purchase-order-actions"><button class="secondary" type="button" :disabled="!currentPurchaseOrder.order.items.length" @click="exportPurchaseOrderExcel">导出 Excel</button><button v-if="currentPurchaseOrder.order.status === 'DRAFT'" type="button" :disabled="purchaseLoading || !currentPurchaseOrder.order.items.length" @click="changePurchaseStatus('CONFIRMED')">确认进货单</button><button v-if="currentPurchaseOrder.order.status === 'CONFIRMED'" class="secondary" type="button" :disabled="purchaseLoading" @click="changePurchaseStatus('DRAFT')">退回草稿</button><button v-if="currentPurchaseOrder.order.status === 'CANCELLED'" class="secondary" type="button" :disabled="purchaseLoading" @click="changePurchaseStatus('DRAFT')">恢复为草稿</button><button v-if="currentPurchaseOrder.order.status === 'CONFIRMED'" type="button" :disabled="purchaseLoading" @click="changePurchaseStatus('ORDERED')">标记已订货</button><button v-if="['DRAFT','CONFIRMED','ORDERED'].includes(currentPurchaseOrder.order.status)" class="danger" type="button" :disabled="purchaseLoading" @click="changePurchaseStatus('CANCELLED')">取消进货单</button></div></div>
          <div class="purchase-order-table-wrap"><table class="purchase-order-table"><thead><tr><th>商品</th><th>数量与供应商</th><th>进价与整箱</th><th>备注与操作</th></tr></thead><tbody><tr v-for="item in currentPurchaseOrder.order.items" :key="item.id"><td><strong>{{ item.productName }}</strong><small>{{ item.barcode || item.sku }} · {{ purchaseSourceLabel(item.source) }}</small><em>实时库存 {{ item.currentInventory }} · 近7天 {{ item.recentSevenDayQty }} · 建议 {{ item.suggestedQuantity }}</em></td><td><label>进货数量<input v-model.number="item.orderedQuantity" type="number" min="1" inputmode="numeric" :disabled="currentPurchaseOrder.order.status !== 'DRAFT'" /></label><label>供应商<input v-model="item.supplierName" type="text" maxlength="120" placeholder="可稍后填写" :disabled="currentPurchaseOrder.order.status !== 'DRAFT'" /></label></td><td><label>单件进价（分）<input v-model.number="item.unitCostCents" type="number" min="0" inputmode="numeric" placeholder="可选" :disabled="currentPurchaseOrder.order.status !== 'DRAFT'" /></label><label>整箱规格<input v-model.number="item.caseSize" type="number" min="1" inputmode="numeric" placeholder="可选" :disabled="currentPurchaseOrder.order.status !== 'DRAFT'" /></label></td><td><label>备注<input v-model="item.notes" type="text" maxlength="255" placeholder="采购或到货说明" :disabled="currentPurchaseOrder.order.status !== 'DRAFT'" /></label><div v-if="currentPurchaseOrder.order.status === 'DRAFT'" class="purchase-row-actions"><button type="button" :disabled="purchaseLoading" @click="savePurchaseItem(item)">保存</button><button class="danger" type="button" :disabled="purchaseLoading" @click="removePurchaseItem(item)">移除</button></div></td></tr></tbody></table></div>
        </section>
        <section v-else class="system-card procurement-empty"><h3>本周还没有进货单</h3><p>先从进货建议、缺货列表或热销商品中加入商品。</p><button type="button" @click="purchaseView = 'suggestions'">查看进货建议</button></section>
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
        <section v-show="tagView === 'products'" class="system-card insight-product-list"><div class="card-title"><div><h3>商品标签覆盖</h3><p>展示全部启用商品；仅已审核标签进入后续消费需求分析</p></div><span>{{ productInsights.products.length }} 种</span></div><div class="insight-products management-detail-scroll"><article v-for="item in pagedInsightProducts" :key="item.productId"><div><strong>{{ item.productName }}</strong><small>{{ item.brandName }} · {{ item.categoryName }} · {{ item.sku }}</small></div><div class="insight-tags"><span v-for="assignment in item.assignments" :key="assignment.id" :class="assignment.reviewStatus.toLowerCase()"><b>{{ assignment.tag.name }}</b><small>{{ assignment.confidence === 'HIGH' ? '高' : assignment.confidence === 'MEDIUM' ? '中' : '低' }}置信度 · {{ assignment.reviewStatus === 'APPROVED' ? '已审核' : '待复核' }}</small></span><em v-if="!item.assignments.length">尚未标记</em></div></article></div><div class="inventory-table-pagination"><span>共 {{ productInsights.products.length }} 种商品</span><label>每页<select v-model.number="insightDetailPageSize"><option :value="50">50</option><option :value="100">100</option></select></label><div><button type="button" :disabled="insightDetailPage <= 1" @click="insightDetailPage--">上一页</button><b>{{ insightDetailPage }} / {{ insightDetailPageCount }}</b><button type="button" :disabled="insightDetailPage >= insightDetailPageCount" @click="insightDetailPage++">下一页</button></div></div></section>
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
      <p class="management-alert pending"><strong>分步处理</strong><span>“开始同步”只读取 POS 订单，不修改库存。需要先生成下方扣库预览，再由管理员明确确认，才会写入正式库存流水。</span></p>



      <section v-if="managementAccess?.capabilities.posSync" v-show="systemView === 'sync'" class="system-card manual-sync-card primary-sync-card">
        <div class="card-title"><div><h3>同步 POS 销售订单</h3><p>选择营业日期，由当前服务器主动读取 POS 接口</p></div><span>不扣减正式库存</span></div>
        <div class="sync-control-row"><div class="primary-sync-controls"><label>营业日期<input v-model="syncDate" type="date" :disabled="posRunning || posStatus?.running" @click="openNativePicker" /></label><button type="button" :disabled="posRunning || posStatus?.running || !syncDate" @click="runManualSync">{{ posRunning ? '正在同步…' : '开始同步' }}</button></div><label class="reconcile-option"><input v-model="reconcile" type="checkbox" :disabled="posRunning || posStatus?.running" /><span><strong>重新核对当天订单</strong><small>仅在退款、取消或状态变化时勾选</small></span></label></div>
      </section>

      <div v-show="systemView === 'sync'" class="pos-status-grid">
        <article><span>同步状态</span><strong :class="posLoadError || posStatus?.latestRun?.status === 'FAILED' ? 'status-warning' : posStatus?.running ? 'status-running' : ''">{{ posLoading ? '加载中' : posLoadError ? '加载失败' : !posStatus ? '未获取' : posStatus.running ? '正在同步' : posStatus.latestRun?.status === 'FAILED' ? '最近失败' : '空闲' }}</strong><small>最近成功或失败结果见下方记录</small></article>
        <article><span>POS订单</span><strong>{{ posLoading || posLoadError ? '—' : (posCheck?.orders.total ?? '—') }}</strong><small>最近订单：{{ dateTime(posCheck?.orders.lastOrderedAt ?? null) }}</small></article>
        <article><span>商品映射率</span><strong>{{ posLoading || posLoadError || !posCheck ? '—' : `${posCheck.items.mappingCoveragePercent}%` }}</strong><small>{{ posCheck?.items.mapped ?? '—' }} / {{ posCheck?.items.mappable ?? posCheck?.items.total ?? '—' }} 条商品销售明细已关联</small></article>
        <article><span>实时同步</span><strong :class="posStatus?.realtime?.lastError ? 'status-warning' : ''">{{ posLoading || posLoadError || !posStatus?.realtime ? '—' : posStatus.realtime.enabled ? `每 ${posStatus.realtime.intervalMinutes} 分钟` : '未开启' }}</strong><small v-if="posLoading || posLoadError || !posStatus?.realtime">状态未知</small><small v-else-if="posStatus.realtime.lastError">{{ posStatus.realtime.lastError }}</small><small v-else-if="posStatus?.realtime?.enabled">上次 {{ dateTime(posStatus.realtime.lastSuccessAt) }}<template v-if="posStatus.realtime.lastApplied"> · 扣减 {{ number(posStatus.realtime.lastApplied.unitsApplied) }} 件</template></small><small v-else>需手动同步与扣库</small></article>
        <article><span>待处理异常</span><strong class="status-warning">{{ posLoading || posLoadError ? '—' : (posCheck?.issues.total ?? '—') }}</strong><small>商品、退款和人工复核事项</small></article>
      </div>

      <section v-if="managementAccess?.capabilities.posSync" v-show="systemView === 'sync'" class="system-card pos-inventory-application-card">
        <div class="card-title"><div><h3>按实际销量扣减正式库存</h3><p>仅处理已付款、无退款、已关联商品的正常销售；按临期优先分配库存批次</p></div><span>预览不会改库存</span></div>
        <form class="pos-inventory-range" @submit.prevent="previewPosInventory"><label>开始日期<input v-model="posInventoryFrom" type="date" :max="posInventoryTo" :disabled="posInventoryPreviewLoading || posInventoryApplyState !== 'idle'" @click="openNativePicker" /></label><label>结束日期<input v-model="posInventoryTo" type="date" :min="posInventoryFrom" :max="today" :disabled="posInventoryPreviewLoading || posInventoryApplyState !== 'idle'" @click="openNativePicker" /></label><button type="submit" :disabled="posInventoryPreviewLoading || posInventoryApplyState !== 'idle' || !posInventoryFrom || !posInventoryTo">{{ posInventoryPreviewLoading ? '生成中…' : '生成扣库预览' }}</button></form>
        <p class="scope-note">系统会自动避开正式库存基准之前的历史销量，单次最多处理 31 天；重复执行不会重复扣减已处理订单。</p>
        <p v-if="posInventoryApplyResult" class="management-alert inventory-source" role="status"><strong>正式扣库完成</strong><span>已处理 {{ posInventoryApplyResult.summary.appliedOrders }} 张订单，共扣减 {{ number(posInventoryApplyResult.summary.unitsApplied) }} 件；{{ posInventoryApplyResult.summary.reviewLines }} 行明细进入复核（缺口 {{ number(posInventoryApplyResult.summary.shortfallUnits) }} 件）。</span></p>
        <template v-if="posInventoryPreview">
          <div class="pos-inventory-preview-summary" aria-label="正式扣库预览结果"><article><span>扫描订单</span><strong>{{ posInventoryPreview.summary.ordersScanned }}</strong><small>所选日期内正常候选</small></article><article class="ready"><span>可安全扣库</span><strong>{{ posInventoryPreview.summary.eligibleOrders }} 张</strong><small>{{ number(posInventoryPreview.summary.unitsPlanned) }} 件商品</small></article><article class="blocked"><span>明细待复核</span><strong>{{ posInventoryPreview.summary.reviewLines }} 行</strong><small>缺口 {{ number(posInventoryPreview.summary.shortfallUnits) }} 件，其余照常扣减</small></article><article><span>待人工复核</span><strong>{{ posInventoryPreview.summary.reviewRequiredOrders }} 张</strong><small>不会进入本次扣库</small></article></div>
          <div class="pos-inventory-commit"><span><strong v-if="posInventoryPreview.summary.eligibleOrders">预览已就绪</strong><strong v-else>暂无可扣订单</strong><small>{{ posInventoryPreview.summary.eligibleOrders ? `确认后将写入 ${posInventoryPreview.summary.eligibleOrders} 张订单的销售出库流水。` : '当前没有待扣订单。' }}</small></span><button type="button" :disabled="!posInventoryPreview.summary.eligibleOrders || posInventoryApplyState !== 'idle'" @click="openPosInventoryConfirmation">确认正式扣库</button></div>
          <details v-if="posInventoryPreview.issues.length" class="pos-inventory-issues"><summary>查看被拦截订单（{{ posInventoryPreview.issues.length }}）</summary><div class="management-detail-scroll"><article v-for="issue in posInventoryPreview.issues" :key="issue.orderId"><span><strong>订单 {{ issue.orderNo }}</strong><small v-if="issue.productId">商品 ID {{ issue.productId }}</small></span><em>{{ posInventoryIssueLabel(issue) }}</em></article></div></details>
        </template>
        <p v-else class="pos-inventory-empty">选择日期并生成预览后，系统会列出可以扣减的订单、件数和被拦截原因。这里不会自动写入库存。</p>
      </section>

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
        <section v-if="barcodeAudit" class="barcode-audit-panel">
          <header><span><b>条码映射审计</b><small>只列出需人工定义的条码，系统不会自动合并商品</small></span><em>{{ dateTime(barcodeAudit.generatedAt) }}</em></header>
          <div class="barcode-audit-summary"><article><span>POS重复条码</span><strong>{{ barcodeAudit.summary.duplicateBarcodes }}</strong></article><article><span>名称冲突</span><strong>{{ barcodeAudit.summary.duplicateNameConflicts }}</strong></article><article><span>本地映射不一致</span><strong>{{ barcodeAudit.summary.localBarcodeMismatches }}</strong></article><article><span>未映射条码</span><strong>{{ barcodeAudit.summary.unmappedBarcodes }}</strong></article></div>
          <div class="barcode-audit-scroll">
            <article v-for="row in barcodeAudit.duplicateBarcodes" :key="`duplicate-${row.barcode}`" class="barcode-audit-row"><span><b>{{ row.barcode }}</b><small>{{ row.externalProductCount }} 个 POS 商品{{ row.nameConflict ? ' · 名称冲突' : '' }}</small></span><div><p v-for="mapping in row.mappings" :key="mapping.externalProductId"><strong>{{ mapping.sourceName || '未命名 POS 商品' }}</strong><small>{{ mapping.externalProductId }} → {{ mapping.productName }}{{ mapping.productId ? ` (${mapping.productId})` : '' }}</small></p></div></article>
            <article v-for="row in barcodeAudit.localBarcodeMismatches" :key="`mismatch-${row.externalProductId}`" class="barcode-audit-row warning"><span><b>{{ row.barcode }}</b><small>映射与本地主条码不一致</small></span><div><p><strong>{{ row.sourceName || '未命名 POS 商品' }}</strong><small>{{ row.externalProductId }} → {{ row.productName }} · 本地条码 {{ row.productBarcodes.join('、') || '无' }}</small></p></div></article>
            <article v-for="row in barcodeAudit.unmappedBarcodes" :key="`unmapped-${row.barcode}`" class="barcode-audit-row unresolved"><span><b>{{ row.barcode }}</b><small>{{ row.occurrences }} 次 · {{ number(row.units) }} 件 · 待定义</small></span><div><p v-for="product in row.products" :key="product.externalProductId"><strong>{{ product.sourceName || '未命名 POS 商品' }}</strong><small>{{ product.externalProductId }}</small></p></div></article>
            <p v-if="!barcodeAudit.duplicateBarcodes.length && !barcodeAudit.localBarcodeMismatches.length && !barcodeAudit.unmappedBarcodes.length" class="system-empty">当前没有发现条码映射异常。</p>
          </div>
        </section>
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
      <button :class="{ active: ['procurement', 'customers', 'stores', 'system'].includes(activeSection) }" :aria-expanded="showMobileMore" @click="showMobileMore = true"><span>•••</span>更多</button>
    </nav>

    <div v-if="showMobileMore" class="management-more-overlay" role="presentation" @click.self="showMobileMore = false">
      <section class="management-more-sheet" role="dialog" aria-modal="true" aria-label="更多经营模块">
        <header><div><small>MORE MODULES</small><h2>更多经营模块</h2></div><button type="button" aria-label="关闭更多模块" @click="showMobileMore = false">×</button></header>
        <div>
          <button v-for="section in sections.filter((item) => ['procurement', 'customers', 'stores', 'system'].includes(item.id))" :key="section.id" type="button" :disabled="!canSection(section.id)" @click="selectSection(section.id)"><span>{{ section.id === 'procurement' ? '↧' : section.id === 'customers' ? '◫' : section.id === 'stores' ? '⌘' : '⚙' }}</span><strong>{{ section.label }}</strong><small>{{ canSection(section.id) ? section.description : '当前账号无权限' }}</small></button>
        </div>
      </section>
    </div>
  </section>
</template>

<style scoped src="./inventory-master.css"></style>

<style scoped>
.kpi-filter{display:grid;width:100%;height:100%;gap:8px;padding:0;border:0;color:inherit;background:transparent;text-align:left;cursor:pointer}.kpi-filter:hover span{color:#36d4df}.kpi-filter:focus-visible{outline:2px solid #32c9dc;outline-offset:5px;border-radius:8px}
/* finesse-ui · operations cockpit · compact command strip / responsive navigation / feedback motion */
/* finesse · product-ui · evidence-first management cockpit */
.management-workspace{display:grid;grid-template-columns:230px minmax(0,1fr);gap:18px;color:#17243a}.management-sidebar{display:flex;flex-direction:column;min-height:720px;padding:18px 12px;border:1px solid #dce8f7;border-radius:22px;background:linear-gradient(180deg,#13243f,#0d1a30);box-shadow:0 18px 45px rgb(28 52 89 / 15%)}.sidebar-heading{display:grid;gap:5px;padding:8px 10px 18px;color:#fff}.sidebar-heading strong{font-size:20px}.sidebar-heading small{overflow:hidden;color:#9eb2d0;text-overflow:ellipsis;white-space:nowrap}.management-sidebar nav{display:grid;gap:5px}.management-sidebar button{position:relative;display:grid;gap:3px;width:100%;padding:12px 32px 12px 12px;border:0;border-radius:13px;color:#dbe8fa;background:transparent;text-align:left}.management-sidebar button span{font-weight:850}.management-sidebar button small{color:#8fa4c2;font-size:11px}.management-sidebar button em{position:absolute;top:10px;right:9px;padding:2px 5px;border-radius:7px;color:#93a7c5;background:rgb(255 255 255 / 8%);font-size:9px;font-style:normal}.management-sidebar .nav-current-marker{position:absolute;top:50%;right:12px;display:grid;width:20px;height:20px;place-items:center;border:1px solid rgb(255 255 255 / 35%);border-radius:999px;color:#fff;background:rgb(255 255 255 / 16%);font-size:20px;font-style:normal;line-height:1;transform:translateY(-50%);pointer-events:none}.management-sidebar button.locked{opacity:.48;cursor:not-allowed}.management-sidebar button.locked em{color:#ffd8a8;background:rgb(255 174 66 / 12%)}.management-sidebar button.active{color:#fff;background:linear-gradient(135deg,#1eb6ed,#3868f4);box-shadow:0 10px 22px rgb(26 103 226 / 28%)}.management-sidebar button.active small,.management-sidebar button.active em{color:#eaf6ff}.management-sidebar>p{margin:auto 8px 4px;color:#7187a8;font-size:10px;line-height:1.7}.management-content{display:grid;align-content:start;gap:18px;min-width:0}.management-heading{display:flex;align-items:end;justify-content:space-between;gap:24px;padding:24px 26px;border:1px solid #dce8f7;border-radius:24px;background:linear-gradient(135deg,#f8fcff,#eef5ff 55%,#eefbf8);box-shadow:0 18px 45px rgb(46 88 145 / 10%)}.management-heading p{margin:0 0 5px;color:#2188f3;font-size:12px;font-weight:900;letter-spacing:.15em}.management-heading h2{margin:0;font-size:30px}.management-heading span{display:block;margin-top:6px;color:#6d7b91}.management-filters{display:flex;align-items:end;gap:10px}.management-filters label{display:grid;gap:6px;color:#69778d;font-size:12px;font-weight:800}.management-filters input,.management-filters button{min-height:42px;border:1px solid #cfddf0;border-radius:12px;background:#fff;padding:0 14px;font:inherit}.management-filters button{color:#fff;border:0;background:linear-gradient(135deg,#17b8f4,#3567f4);font-weight:850}.management-alert{display:flex;gap:8px;padding:15px 18px;border-radius:16px}.management-alert span{color:#59677b}.management-alert.pending{background:#fff8df;border:1px solid #f4d982}.management-alert.error{color:#9c2f38;background:#fff0f1;border:1px solid #f2bcc1}.management-kpis{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:12px}.management-kpis article{display:grid;gap:8px;min-height:120px;padding:18px;border:1px solid #dfebf8;border-radius:19px;background:linear-gradient(145deg,#fff,#f4f8ff);box-shadow:0 12px 28px rgb(43 75 120 / 8%)}.management-kpis span{color:#68778d;font-size:13px;font-weight:800}.management-kpis strong{font-size:25px}.management-kpis small{color:#728097}.management-kpis .up{color:#159766}.management-kpis .down{color:#d3535a}.management-kpis .inventory-kpi{background:linear-gradient(145deg,#ecf6ff,#eaf2ff)}.management-kpis .expiry-kpi{background:linear-gradient(145deg,#fff7ec,#fff0f1)}.management-grid{display:grid;grid-template-columns:1.35fr .65fr;gap:16px}.management-card{min-height:280px;padding:22px;border:1px solid #dfe9f6;border-radius:22px;background:rgb(255 255 255 / 92%);box-shadow:0 14px 35px rgb(39 73 116 / 9%)}.card-title{display:flex;justify-content:space-between;gap:12px}.card-title h3{margin:0;font-size:19px}.card-title p{margin:5px 0 0;color:#8290a3;font-size:13px}.card-title>span{color:#d05b68;font-weight:750}.bar-chart{display:flex;align-items:end;gap:8px;height:210px;margin-top:20px;padding:20px 8px 0;border-bottom:1px solid #dce5f1;overflow-x:auto}.bar-column{display:grid;align-items:end;gap:7px;min-width:28px;height:100%;text-align:center}.bar-column b{position:relative;display:block;min-height:5px;border-radius:7px 7px 2px 2px;background:linear-gradient(180deg,#24b9ef,#4264f0)}.bar-column i{display:none;position:absolute;bottom:calc(100% + 5px);left:50%;transform:translateX(-50%);padding:4px 6px;border-radius:6px;color:#fff;background:#17243a;font-size:10px;font-style:normal;white-space:nowrap}.bar-column:hover i{display:block}.bar-column small{font-size:10px;color:#8390a2}.expiry-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:24px}.expiry-grid div{display:grid;gap:8px;padding:18px;border-radius:16px}.expiry-grid strong{font-size:27px}.expired{color:#a8444e;background:#fff0f1}.urgent{color:#b46623;background:#fff3e5}.warning{color:#947112;background:#fff9dc}.early{color:#277493;background:#eaf8ff}.ranking ol{display:grid;gap:5px;margin:16px 0 0;padding:0;list-style:none}.ranking li{display:grid;grid-template-columns:30px 1fr auto;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid #edf1f6}.ranking li>b{display:grid;place-items:center;width:26px;height:26px;border-radius:8px;color:#2878ec;background:#e8f2ff}.ranking li span{display:grid;gap:3px;min-width:0}.ranking li span strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.ranking li small{color:#8490a0}.ranking li em{color:#25334a;font-style:normal;font-weight:850}.management-empty{display:grid;place-items:center;min-height:190px;color:#8995a6}.sync-note{margin:0;color:#8490a0;font-size:12px;text-align:right}.planned-section{display:grid;place-items:center;min-height:520px;padding:50px;border:1px dashed #bfd0e8;border-radius:24px;background:linear-gradient(145deg,#fbfdff,#f2f7ff);text-align:center}.planned-icon{display:grid;width:62px;height:62px;place-items:center;border-radius:18px;color:#fff;background:linear-gradient(135deg,#17b8f4,#3567f4);font-size:28px}.planned-section>p{margin:18px 0 5px;color:#3381e5;font-size:11px;font-weight:900;letter-spacing:.14em}.planned-section h3{margin:0;font-size:28px}.planned-section>span{max-width:650px;margin:12px 0 25px;color:#6b7b91;line-height:1.7}.planned-modules{display:flex;justify-content:center;flex-wrap:wrap;gap:9px}.planned-modules b{padding:9px 13px;border:1px solid #d6e3f4;border-radius:999px;color:#53667f;background:#fff;font-size:12px}
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
.page-guide{padding:14px 16px;border:1px solid var(--dash-line);border-radius:18px;background:linear-gradient(145deg,#101b2b,#0b1422)}.page-guide summary{cursor:pointer;color:var(--dash-cyan);font-weight:850}.page-guide>div{display:grid;grid-template-columns:minmax(180px,.9fr) minmax(280px,1.4fr);gap:10px 24px;margin-top:12px}.page-guide p,.page-guide strong{margin:0;color:var(--dash-muted);font-size:13px}.page-guide strong{color:#b7c7dd}.page-guide ul{display:flex;flex-wrap:wrap;gap:7px;margin:0;padding:0;list-style:none}.page-guide li{padding:5px 9px;border:1px solid #26364d;border-radius:999px;color:#b9c8dc;background:#101d30;font-size:12px}
@media(max-width:720px){.page-guide>div{grid-template-columns:1fr}.page-guide ul{gap:5px}}
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

/* Overview composition mirrors the supplied dashboard reference while preserving the existing data contract. */
.overview-metric-strip{display:grid;grid-template-columns:repeat(6,minmax(148px,1fr));gap:8px;overflow-x:auto;padding:2px 0 5px;scrollbar-width:thin;scroll-snap-type:x proximity}
.overview-metric-strip article{position:relative;display:grid;grid-template-columns:38px minmax(0,1fr);align-items:center;gap:10px;min-width:0;min-height:76px;padding:11px 12px;border:1px solid #1f2d42;border-radius:13px;background:linear-gradient(150deg,#111b2b,#0a121f);box-shadow:inset 0 1px 0 rgb(255 255 255 / 4%);scroll-snap-align:start;animation:management-card-enter .35s cubic-bezier(.22,1,.36,1) both;transition:border-color .2s ease,transform .2s ease,background .2s ease}
.overview-metric-strip article:hover{transform:translateY(-2px);border-color:#35516f;background:#122037}.overview-metric-strip article:nth-child(2){animation-delay:.035s}.overview-metric-strip article:nth-child(3){animation-delay:.07s}.overview-metric-strip article:nth-child(4){animation-delay:.105s}.overview-metric-strip article:nth-child(5){animation-delay:.14s}.overview-metric-strip article:nth-child(6){animation-delay:.175s}
.metric-symbol{display:grid;width:36px;height:36px;place-items:center;border:1px solid rgb(255 255 255 / 10%);border-radius:50%;color:#fff;background:#315ed0;box-shadow:0 0 18px rgb(49 94 208 / 24%);font-size:16px;font-style:normal;font-weight:900}.metric-symbol.orders{background:#12a8c8}.metric-symbol.units{background:#6f5ce2}.metric-symbol.average{background:#d89d22}.metric-symbol.stock{background:#249c75}.metric-symbol.expiry{background:#d04c68}
.overview-metric-strip article>span{display:grid;min-width:0;gap:2px;color:#8391a6;font-size:10px;font-weight:750;white-space:nowrap}.overview-metric-strip strong{overflow:visible;color:#f2f7ff;font-size:clamp(12px,.92vw,15px);font-variant-numeric:tabular-nums;letter-spacing:-.035em;text-overflow:clip;white-space:nowrap}.overview-metric-strip article:first-child strong{font-size:clamp(11px,.84vw,14px)}.overview-metric-strip small{overflow:hidden;color:#69798f;font-size:9px;text-overflow:ellipsis}.overview-metric-strip .up{color:#43d8a2}.overview-metric-strip .down{color:#ff7b88}
.overview-command-grid{display:grid;grid-template-columns:minmax(0,1.72fr) minmax(260px,.68fr);gap:12px}.overview-command-grid>.management-card{min-height:0;padding:17px;border-radius:16px}.overview-card-header{display:flex;align-items:flex-start;justify-content:space-between;gap:14px}.overview-card-header small{color:#41cedc;font-size:9px;font-weight:900;letter-spacing:.15em}.overview-card-header h3{margin:4px 0 2px;color:#f2f7ff;font-size:17px}.overview-card-header p{margin:0;color:#738299;font-size:11px}
.overview-header-actions{display:flex;align-items:center;gap:10px}.visually-hidden{position:absolute!important;width:1px!important;height:1px!important;padding:0!important;margin:-1px!important;overflow:hidden!important;clip:rect(0,0,0,0)!important;white-space:nowrap!important;border:0!important}
.period-tabs{display:flex;flex-wrap:wrap;gap:4px;padding:3px;border:1px solid #202f44;border-radius:10px;background:#09111d}.period-tabs button{min-height:30px;padding:5px 10px;border:0;border-radius:7px;color:#75849a;background:transparent;font:inherit;font-size:11px;font-weight:800;cursor:pointer;transition:color .18s ease,background .18s ease,transform .16s ease}.period-tabs button:hover{color:#d8e7fa}.period-tabs button:active{transform:scale(.96)}.period-tabs button[aria-pressed=true]{color:#f5fbff;background:linear-gradient(135deg,#176c8b,#475bc8);box-shadow:0 5px 14px rgb(27 116 169 / 24%)}.period-tabs button:disabled{cursor:wait}
.trend-primary{display:flex;align-items:baseline;gap:12px;margin-top:14px}.trend-primary strong{color:#38d4df;font-size:clamp(25px,3vw,40px);font-variant-numeric:tabular-nums;letter-spacing:-.035em}.trend-primary span{color:#78889e;font-size:11px}.overview-line-chart{min-height:190px;margin-top:2px}.overview-line-chart svg{height:190px}.overview-line-chart polyline{stroke-width:4}.overview-line-chart circle{animation-delay:.72s}
.expiry-earnings-card{display:grid;align-content:start;gap:0}.expiry-earning-row{display:grid;grid-template-columns:minmax(0,1fr) auto 56px;align-items:center;gap:9px;min-height:66px;padding:10px 2px;color:inherit;border:0;border-bottom:1px solid #1c293c;background:transparent;text-align:left;cursor:pointer;transition:background .18s ease,padding .18s ease}.expiry-earning-row:last-child{border-bottom:0}.expiry-earning-row:hover{padding-inline:8px;background:rgb(255 255 255 / 2%)}.expiry-earning-row span{display:grid;gap:3px;color:#dce6f4;font-size:12px;font-weight:800}.expiry-earning-row small{color:#69798f;font-size:9px;font-weight:500}.expiry-earning-row>strong{font-size:22px;font-variant-numeric:tabular-nums}.expiry-earning-row>i{display:flex;height:30px;align-items:end;justify-content:flex-end;gap:3px}.expiry-earning-row>i b{width:10px;border-radius:3px 3px 1px 1px;background:currentColor;opacity:.55;transform-origin:bottom;animation:management-bar-grow .5s cubic-bezier(.22,1,.36,1) both}.expiry-earning-row>i b:nth-child(1){height:35%}.expiry-earning-row>i b:nth-child(2){height:72%;animation-delay:.08s}.expiry-earning-row>i b:nth-child(3){height:48%;animation-delay:.16s}.expiry-earning-row.expired{color:#ff7080}.expiry-earning-row.urgent{color:#f4a969}.expiry-earning-row.warning{color:#efd56a}.expiry-earning-row.early{color:#69cde8}
.overview-action-rail{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}.overview-action-rail button{display:grid;grid-template-columns:34px minmax(0,1fr) auto;align-items:center;gap:10px;min-width:0;padding:12px 13px;color:#edf4ff;border:1px solid #202f44;border-radius:13px;background:linear-gradient(145deg,#111b2b,#0c1523);font:inherit;text-align:left;cursor:pointer;transition:transform .18s ease,border-color .18s ease}.overview-action-rail button:hover{transform:translateY(-2px);border-color:#35516f}.overview-action-rail i{display:grid;width:32px;height:32px;place-items:center;border-radius:9px;color:#43d9e5;background:#12313d;font-size:17px;font-style:normal}.overview-action-rail span{display:grid;min-width:0;gap:3px;font-size:12px;font-weight:800}.overview-action-rail small{overflow:hidden;color:#718198;font-size:9px;font-weight:500;text-overflow:ellipsis;white-space:nowrap}.overview-action-rail strong{color:#dbe7f7;font-size:15px;font-variant-numeric:tabular-nums;white-space:nowrap}
.hot-products-card{min-height:0!important;padding:17px!important;border-radius:16px!important}.hot-product-table-wrap{margin-top:12px;overflow-x:auto;border:1px solid #1d2a3e;border-radius:11px}.hot-product-table-wrap table{width:100%;min-width:670px;border-collapse:collapse}.hot-product-table-wrap th{padding:9px 12px;color:#718198;background:#0b1422!important;font-size:9px;font-weight:800;letter-spacing:.06em;text-align:left}.hot-product-table-wrap td{padding:9px 12px;color:#93a2b6;border-top:1px solid #1b283a;font-size:11px}.hot-product-table-wrap tr{transition:background .16s ease}.hot-product-table-wrap tbody tr:hover{background:#111e31}.hot-product-table-wrap td:nth-child(2){min-width:230px;color:#e5edf8}.hot-product-table-wrap td:nth-last-child(-n+2),.hot-product-table-wrap th:nth-last-child(-n+2){text-align:right;white-space:nowrap}.rank-badge{display:grid;width:28px;height:24px;place-items:center;border-radius:7px;color:#6d829e;background:#142033;font-size:10px}.rank-badge.podium{color:#78e8f1;background:#123340}.sales-share{display:block;width:100%;height:2px;margin-top:6px;border-radius:99px;background:#172338;overflow:hidden}.sales-share i{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,#2cd5df,#6975f4);animation:overview-share-in .55s cubic-bezier(.22,1,.36,1) both;transform-origin:left}.hot-product-table-wrap td:last-child strong{color:#51d7c1}.hot-product-table-wrap tbody{animation:management-section-enter .25s ease both}@keyframes overview-share-in{from{transform:scaleX(0)}to{transform:scaleX(1)}}

@media(max-width:1280px) and (min-width:721px){
  .management-workspace{grid-template-columns:minmax(0,1fr)!important;grid-template-rows:auto minmax(0,1fr)!important;height:100%!important;gap:10px!important;overflow:hidden!important}
  .management-sidebar{position:static!important;display:grid!important;grid-template-columns:auto minmax(0,1fr);align-items:center;height:auto!important;max-height:none!important;padding:8px 10px!important;border-radius:14px!important;overflow:hidden!important}.sidebar-heading{margin:0!important;padding:5px 12px!important;border-right:1px solid #223149}.sidebar-heading strong{font-size:14px}.sidebar-heading small,.management-sidebar>p,.navigation-group h3{display:none}.management-sidebar nav{display:flex!important;gap:5px;min-width:0;overflow-x:auto!important;scrollbar-width:none}.management-sidebar nav::-webkit-scrollbar{display:none}.navigation-group{display:contents!important}.management-sidebar button{flex:0 0 auto!important;width:auto!important;min-width:auto!important;padding:9px 12px!important;white-space:nowrap}.management-sidebar button span{font-size:12px}.management-sidebar button small,.management-sidebar button em{display:none}.management-content{height:100%!important;overflow-y:auto!important}.management-heading{position:static!important}
  .overview-metric-strip{grid-template-columns:repeat(6,minmax(154px,1fr))}.overview-command-grid{grid-template-columns:minmax(0,1.4fr) minmax(250px,.7fr)}
}
@media(max-width:900px){.overview-command-grid{grid-template-columns:minmax(0,1fr)}.expiry-earnings-card{grid-template-columns:repeat(2,minmax(0,1fr))}.expiry-earnings-card .overview-card-header{grid-column:1/-1}.expiry-earning-row:nth-of-type(2n){border-left:1px solid #1c293c}.overview-action-rail{grid-template-columns:1fr}}
@media(max-width:720px){.overview-metric-strip{margin-inline:-1px;grid-template-columns:repeat(6,minmax(152px,1fr))}.overview-command-grid>.management-card,.hot-products-card{padding:14px!important}.overview-card-header{display:grid}.period-tabs{width:max-content;max-width:100%;overflow-x:auto;flex-wrap:nowrap}.expiry-earnings-card{grid-template-columns:1fr}.expiry-earnings-card .overview-card-header{grid-column:auto}.expiry-earning-row:nth-of-type(2n){border-left:0}.overview-action-rail button{min-height:68px}.trend-primary{align-items:flex-start;flex-direction:column;gap:2px}.overview-line-chart,.overview-line-chart svg{min-height:170px;height:170px}.hot-products-card .overview-card-header{gap:10px}}
@media(max-width:420px){.overview-metric-strip{grid-template-columns:repeat(6,minmax(144px,1fr))}.overview-action-rail button{grid-template-columns:32px minmax(0,1fr)}.overview-action-rail strong{grid-column:2}.overview-card-header h3{font-size:16px}}
@media(prefers-reduced-motion:reduce){.overview-metric-strip article,.expiry-earning-row>i b,.sales-share i,.hot-product-table-wrap tbody{animation:none!important}.overview-line-chart polyline{stroke-dashoffset:0}}

/* finesse · register=product · A=steel-cyan · B=800/500 · C=workflow-list · D=feedback-only · E=tinted-dark-panels · SOUL=5 SPECTACLE=2 DENSITY=8 */
.procurement-page{display:grid;align-content:start;gap:14px}.procurement-tabs{display:flex;gap:6px;padding:4px;border:1px solid #202f44;border-radius:13px;background:#09111d}.procurement-tabs button{min-height:42px;padding:8px 15px;color:#8090a7;border:0;border-radius:9px;background:transparent;font:inherit;font-weight:850}.procurement-tabs button.active{color:#effcff;background:linear-gradient(135deg,#176c8b,#475bc8)}.procurement-tabs b{margin-left:6px;font-variant-numeric:tabular-nums}.procurement-summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.procurement-summary article{display:grid;gap:5px;min-height:96px;padding:15px;border:1px solid #202f44;border-radius:15px;background:linear-gradient(145deg,#111b2b,#0c1422)}.procurement-summary span,.procurement-summary small{color:#8291a7;font-size:11px}.procurement-summary strong{color:#edf6ff;font-size:20px;font-variant-numeric:tabular-nums}.procurement-table-card{display:grid;gap:13px}.procurement-table-card table{min-width:860px}.purchase-source{display:inline-flex;padding:5px 8px;color:#6fe3eb;border-radius:8px;background:#12313d;font-size:10px}.table-action{min-height:34px;padding:6px 10px;color:#eafaff;border:1px solid #2c6980;border-radius:9px;background:#123746;font:inherit;font-size:11px;font-weight:850;white-space:nowrap}.table-action:disabled{cursor:not-allowed;opacity:.48}.purchase-order-card{display:grid;gap:15px}.purchase-order-actions{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:7px}.purchase-order-actions button,.purchase-order-list footer button,.procurement-empty button{min-height:40px;padding:8px 13px;color:#effbff;border:1px solid #23758e;border-radius:10px;background:#176c8b;font:inherit;font-weight:850}.purchase-order-actions .secondary{color:#b9c8db;border-color:#314058;background:#101b2a}.purchase-order-actions .danger,.purchase-order-list footer .danger{color:#ffabb3;border-color:#60313b;background:#28171e}.purchase-order-list{display:grid;gap:10px}.purchase-order-list>article{display:grid;gap:13px;padding:15px;border:1px solid #202f44;border-radius:15px;background:#0b1422}.purchase-order-list header{display:flex;align-items:flex-start;justify-content:space-between;gap:15px}.purchase-order-list header>div{display:grid;gap:4px}.purchase-order-list header strong{color:#edf5ff}.purchase-order-list header small,.purchase-order-list header>b{color:#8493a9;font-size:11px}.purchase-item-fields{display:grid;grid-template-columns:minmax(110px,.7fr) minmax(170px,1.2fr) minmax(140px,.8fr) minmax(110px,.7fr);gap:9px}.purchase-item-fields label{display:grid;gap:5px;color:#8493a9;font-size:10px;font-weight:800}.purchase-item-fields input{width:100%;min-height:40px;padding:8px 10px;color:#edf5ff;border:1px solid #29384f;border-radius:9px;background:#09111d;font:inherit}.purchase-item-fields input:focus{outline:0;border-color:#36c7d5;box-shadow:0 0 0 3px rgb(54 199 213 / 13%)}.purchase-item-fields input:disabled{opacity:.68}.purchase-notes{grid-column:1/-1}.purchase-order-list footer{display:flex;align-items:center;justify-content:flex-end;gap:8px}.purchase-order-list footer span{margin-right:auto;color:#8090a7;font-size:11px}.procurement-empty{display:grid;min-height:220px;place-items:center;align-content:center;gap:9px;text-align:center}.procurement-empty h3,.procurement-empty p{margin:0}.procurement-empty p{color:#8291a7}.management-alert.success{color:#82e5bd;border-color:#235b4d;background:#102820}
.purchase-suggestion-actions,.row-actions{display:flex;flex-wrap:wrap;align-items:center;gap:7px}.table-action.muted{color:#a8b5c7;border-color:#334157;background:#111b2a}.procurement-table-card td small{display:block;margin-top:3px;color:#7f8ea4;font-size:10px}
@media(max-width:1100px){.purchase-item-fields{grid-template-columns:repeat(2,minmax(0,1fr))}.purchase-notes{grid-column:1/-1}.overview-action-rail{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:720px){.procurement-summary{grid-template-columns:1fr}.purchase-order-card{padding:12px}.purchase-order-card>.card-title,.purchase-order-list header{display:grid}.purchase-order-actions{justify-content:flex-start}.purchase-item-fields{grid-template-columns:1fr}.purchase-notes{grid-column:auto}.purchase-order-list footer{flex-wrap:wrap}.purchase-order-list footer span{width:100%;margin:0}.procurement-tabs button{flex:1;min-width:0}.table-action{min-height:44px}}

/* Compact management shell, floating page help, and dense procurement cards. */
.management-heading{min-height:64px!important;padding:10px 16px!important;border-radius:14px!important}.management-heading p{margin:0 0 1px;font-size:8px}.management-heading h2{font-size:21px!important}.management-heading span{font-size:11px!important}.page-guide-fab{position:fixed;z-index:30;right:24px;bottom:28px;display:grid;width:54px;height:54px;place-items:center;padding:5px;color:#eafbff;border:1px solid #2f7890;border-radius:50%;background:linear-gradient(145deg,#176c8b,#4a58ca);box-shadow:0 14px 34px rgb(20 91 143 / 34%);font:inherit}.page-guide-fab span{font-size:20px}.page-guide-fab b{position:absolute;right:58px;padding:6px 9px;color:#c8d6e8;border:1px solid #2a3a51;border-radius:8px;background:#101a2a;font-size:10px;white-space:nowrap;opacity:0;transform:translateX(5px);transition:.18s}.page-guide-fab:hover b,.page-guide-fab:focus-visible b{opacity:1;transform:none}.page-guide-popover{position:fixed;z-index:29;right:24px;bottom:92px;width:min(360px,calc(100vw - 32px));padding:16px;border:1px solid #2a3b53;border-radius:16px;background:#0d1726;box-shadow:0 22px 60px rgb(0 0 0 / 38%)}.page-guide-popover header{display:flex;align-items:center;justify-content:space-between}.page-guide-popover header button{width:36px;height:36px;padding:0;border-radius:50%}.page-guide-popover p,.page-guide-popover>b{color:#aebdd0;font-size:12px}.page-guide-popover ul{display:flex;flex-wrap:wrap;gap:6px;padding:0;list-style:none}.page-guide-popover li{padding:5px 8px;border:1px solid #2c3d55;border-radius:999px;color:#bfd0e4;font-size:10px}.minimum-stock-tools{display:flex;align-items:center;gap:9px}.minimum-stock-value{display:inline-flex;align-items:center;gap:5px;min-height:32px;padding:4px 8px;color:#eaf6ff;border:1px solid #30445f;border-radius:8px;background:#111e30}.minimum-stock-value small{color:#6edce3}.pos-unmapped-tag{padding:1px 5px;border-radius:5px;color:#f5c26b;background:rgb(245 194 107 / 14%);font-size:9px;font-weight:800}.purchase-suggestion-grid{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:8px}.purchase-suggestion-grid>article{display:grid;align-content:start;gap:9px;min-width:0;min-height:220px;padding:12px;border:1px solid #202f44;border-radius:13px;background:#0c1624}.purchase-suggestion-grid header{display:grid;gap:3px;min-width:0}.purchase-suggestion-grid header strong,.purchase-suggestion-grid header small{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.purchase-suggestion-grid header small,.purchase-suggestion-grid>article>p,.purchase-suggestion-grid>article>small{color:#7f90a8;font-size:9px}.purchase-suggestion-grid dl{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:0}.purchase-suggestion-grid dl div{padding:7px;border-radius:8px;background:#111d2d}.purchase-suggestion-grid dt{color:#77889f;font-size:8px}.purchase-suggestion-grid dd{margin:2px 0 0;color:#eef6ff;font-size:12px;font-weight:850}.purchase-suggestion-grid .suggested{background:#12313d}.purchase-suggestion-grid .suggested dd{color:#66e0e7}.purchase-suggestion-grid footer{display:flex;gap:5px;margin-top:auto}.purchase-suggestion-grid footer button{flex:1;min-width:0;padding-inline:5px}
@media(max-width:1500px){.purchase-suggestion-grid{grid-template-columns:repeat(4,minmax(0,1fr))}}@media(max-width:1050px){.purchase-suggestion-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}@media(max-width:720px){.purchase-suggestion-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.page-guide-fab{right:16px;bottom:82px}.page-guide-popover{right:16px;bottom:144px}.minimum-stock-tools{align-items:flex-end;flex-direction:column}}@media(max-width:420px){.purchase-suggestion-grid{grid-template-columns:1fr}}

:root:not([data-theme="dark"]) .management-workspace{--dash-bg:#f5f5fb;--dash-panel:#ffffff;--dash-line:#e4e5f0;--dash-text:#252d4a;--dash-muted:#7d849e;--dash-cyan:#6d63dc;--dash-blue:#7569e8;background:linear-gradient(145deg,#f8f8fc,#f2f3fa);color:#252d4a}.management-workspace:where(:root:not([data-theme="dark"]) *){}
:root:not([data-theme="dark"]) .management-workspace :is(.management-sidebar,.management-heading,.management-card,.system-card,.inventory-truth-panel,.sales-filter-panel,.product-filter-panel,.inventory-operation-filters,.store-comparison-filters,.insight-search,.inventory-detail-filters,.procurement-summary article,.purchase-suggestion-grid>article,.page-guide-popover){color:#203047;border-color:#d8e2ec;background:#fff;box-shadow:0 8px 24px rgb(75 99 130 / 8%)}
:root:not([data-theme="dark"]) .management-workspace :is(h2,h3,strong,dd,th){color:#24314d}:root:not([data-theme="dark"]) .management-workspace :is(p,small,span,dt){color:#718096}:root:not([data-theme="dark"]) .management-workspace :is(input,select){color:#2d3854;border-color:#d9e2ec;background:#f7f9fc}:root:not([data-theme="dark"]) .management-workspace table{background:#fff}:root:not([data-theme="dark"]) .management-workspace :is(th,thead){background:#f5f7fb}:root:not([data-theme="dark"]) .management-workspace td{border-color:#e5ebf2}:root:not([data-theme="dark"]) .management-sidebar button.active{background:linear-gradient(135deg,#6e5bd7,#8a72e7)}:root:not([data-theme="dark"]) .management-sidebar button:not(.active){color:#64748b;background:transparent}:root:not([data-theme="dark"]) .purchase-suggestion-grid dl div{background:#f5f7fb}:root:not([data-theme="dark"]) .purchase-suggestion-grid .suggested{background:#f0edff}:root:not([data-theme="dark"]) .purchase-suggestion-grid .suggested dd{color:#6757d9}:root:not([data-theme="dark"]) .minimum-stock-value{color:#34425b;border-color:#d8e2ec;background:#f6f8fb}:root:not([data-theme="dark"]) .pos-unmapped-tag{color:#9a5b00;background:#fff3dc}:root:not([data-theme="dark"]) .page-guide-fab{background:linear-gradient(145deg,#6d5cdb,#8d79e9)}
:root:not([data-theme="dark"]) .management-workspace .management-sidebar{background:#fff;border-color:#e6e6f1;box-shadow:0 14px 36px rgb(67 70 125 / 8%)}
:root:not([data-theme="dark"]) .management-workspace .sidebar-heading strong{color:#2a3150}:root:not([data-theme="dark"]) .management-workspace .sidebar-heading small,:root:not([data-theme="dark"]) .management-workspace .management-sidebar>p{color:#9298ad}
:root:not([data-theme="dark"]) .management-workspace .management-heading{background:linear-gradient(135deg,#fff,#fbfbff 62%,#f5f2ff);border-color:#e8e7f3}
:root:not([data-theme="dark"]) .management-workspace .overview-metric-strip article{border-color:#e6e6f0;background:#fff;box-shadow:0 8px 20px rgb(71 70 120 / 7%)}
:root:not([data-theme="dark"]) .management-workspace .overview-metric-strip article:hover{border-color:#cbc7ee;background:#fcfbff}
:root:not([data-theme="dark"]) .management-workspace .overview-metric-strip article>span,:root:not([data-theme="dark"]) .management-workspace .overview-metric-strip small{color:#858ca5}:root:not([data-theme="dark"]) .management-workspace .overview-metric-strip strong{color:#252d4a}
:root:not([data-theme="dark"]) .management-workspace .management-card,:root:not([data-theme="dark"]) .management-workspace .system-card{border-color:#e7e7f1;background:#fff;box-shadow:0 10px 28px rgb(67 70 125 / 7%)}
:root:not([data-theme="dark"]) .management-workspace .overview-card-header small{color:#7165dc}:root:not([data-theme="dark"]) .management-workspace .overview-card-header h3{color:#252d4a}:root:not([data-theme="dark"]) .management-workspace .overview-card-header p{color:#8a91a8}
:root:not([data-theme="dark"]) .management-workspace .period-tabs{border-color:#e4e4ee;background:#f7f7fb}:root:not([data-theme="dark"]) .management-workspace .period-tabs button{color:#747b94}:root:not([data-theme="dark"]) .management-workspace .period-tabs button:hover{color:#50489f}:root:not([data-theme="dark"]) .management-workspace .period-tabs button[aria-pressed=true]{color:#fff;background:linear-gradient(135deg,#7165df,#5969d9)}
:root:not([data-theme="dark"]) .management-workspace .trend-primary strong{color:#2f385a}:root:not([data-theme="dark"]) .management-workspace .chart-grid line{stroke:#ebeaf3}:root:not([data-theme="dark"]) .management-workspace .chart-values text{fill:#969bb0}
:root:not([data-theme="dark"]) .management-workspace .expiry-earning-row{border-bottom-color:#eeeef5;background:transparent}:root:not([data-theme="dark"]) .management-workspace .expiry-earning-row:hover{background:#faf9ff}:root:not([data-theme="dark"]) .management-workspace .expiry-earning-row span{color:#39415f}
:root:not([data-theme="dark"]) .management-workspace .overview-action-rail button{color:#303854;border-color:#e5e5ef;background:#fff;box-shadow:0 8px 20px rgb(67 70 125 / 6%)}:root:not([data-theme="dark"]) .management-workspace .overview-action-rail button:hover{border-color:#cbc7ee}:root:not([data-theme="dark"]) .management-workspace .overview-action-rail i{color:#655bd4;background:#eeecff}:root:not([data-theme="dark"]) .management-workspace .overview-action-rail strong{color:#303854}
:root:not([data-theme="dark"]) .management-workspace .hot-product-table-wrap{border-color:#e6e6f0}:root:not([data-theme="dark"]) .management-workspace .hot-product-table-wrap th{color:#888fa6;background:#f8f8fb!important}:root:not([data-theme="dark"]) .management-workspace .hot-product-table-wrap td{color:#68718e;border-top-color:#ececf3}:root:not([data-theme="dark"]) .management-workspace .hot-product-table-wrap tbody tr:hover{background:#faf9ff}:root:not([data-theme="dark"]) .management-workspace .hot-product-table-wrap td:nth-child(2){color:#303854}:root:not([data-theme="dark"]) .management-workspace .rank-badge{color:#6d7190;background:#f0f0f7}:root:not([data-theme="dark"]) .management-workspace .rank-badge.podium{color:#6258d0;background:#eeecff}:root:not([data-theme="dark"]) .management-workspace .sales-share{background:#eeeef5}:root:not([data-theme="dark"]) .management-workspace .hot-product-table-wrap td:last-child strong{color:#655bd4}
:root:not([data-theme="dark"]) .management-workspace .metric-symbol{border-color:#fff;box-shadow:0 5px 14px rgb(76 74 148 / 15%)}:root:not([data-theme="dark"]) .management-workspace .metric-symbol.sales{background:#6672e8}:root:not([data-theme="dark"]) .management-workspace .metric-symbol.orders{background:#a99bf2}:root:not([data-theme="dark"]) .management-workspace .metric-symbol.units{background:#7c6ce3}:root:not([data-theme="dark"]) .management-workspace .metric-symbol.average{background:#f1b8c6}:root:not([data-theme="dark"]) .management-workspace .metric-symbol.stock{background:#8fd8c2}:root:not([data-theme="dark"]) .management-workspace .metric-symbol.expiry{background:#ee9cae}
:root:not([data-theme="dark"]) .management-workspace :is(.sales-kpis,.product-kpis,.inventory-operation-kpis,.store-kpis,.insight-kpis,.inventory-truth-grid) article{
  color:#303854;border-color:rgb(211 208 239 / 88%);background:linear-gradient(145deg,rgb(255 255 255 / 96%),rgb(241 239 255 / 86%));
  box-shadow:inset 0 1px 0 #fff,0 10px 25px rgb(91 82 160 / 9%);backdrop-filter:blur(16px)
}
:root:not([data-theme="dark"]) .management-workspace :is(.sales-kpis,.product-kpis,.inventory-operation-kpis,.store-kpis,.insight-kpis,.inventory-truth-grid) article:hover{border-color:#bbb4ec;box-shadow:inset 0 1px 0 #fff,0 14px 30px rgb(91 82 160 / 14%)}
:root:not([data-theme="dark"]) .management-workspace :is(.sales-kpis,.product-kpis,.inventory-operation-kpis,.store-kpis,.insight-kpis,.inventory-truth-grid) :is(span,small){color:#77809a}
:root:not([data-theme="dark"]) .management-workspace :is(.sales-kpis,.product-kpis,.inventory-operation-kpis,.store-kpis,.insight-kpis,.inventory-truth-grid) strong{color:#2e3656}
:root:not([data-theme="dark"]) .management-workspace :is(.sales-filter-panel,.product-filter-panel,.inventory-operation-filters,.store-comparison-filters,.insight-search){border-color:#dfdced;background:linear-gradient(145deg,rgb(255 255 255 / 94%),rgb(245 243 255 / 88%));box-shadow:0 10px 26px rgb(91 82 160 / 7%);backdrop-filter:blur(16px)}
:root:not([data-theme="dark"]) .management-workspace :is(.sales-filter-panel,.product-filter-panel,.inventory-operation-filters,.store-comparison-filters,.insight-search) :is(input,select){color:#303854!important;border-color:#ddd9ef!important;background:rgb(255 255 255 / 84%)!important;box-shadow:inset 0 1px 2px rgb(64 62 105 / 5%)}
:root:not([data-theme="dark"]) .management-workspace :is(.sales-filter-panel,.product-filter-panel,.inventory-operation-filters,.store-comparison-filters,.insight-search) label{color:#707891}
:root:not([data-theme="dark"]) .management-workspace :is(.sales-filter-panel,.product-filter-panel,.inventory-operation-filters,.store-comparison-filters,.insight-search)>button:not(.secondary-action){border:1px solid rgb(255 255 255 / 76%);background:linear-gradient(135deg,#8b79ed,#6875e4);box-shadow:inset 0 1px 0 rgb(255 255 255 / 42%),0 7px 16px rgb(100 88 209 / 22%)}
:root:not([data-theme="dark"]) .management-workspace .secondary-action{color:#625a9c!important;border:1px solid #d8d3ec!important;background:rgb(247 245 255 / 92%)!important;box-shadow:inset 0 1px 0 #fff!important}
:root:not([data-theme="dark"]) .management-workspace :is(.time-bucket-grid article,.coverage-buckets article,.source-quality dl>div,.store-result-card dl>div,.store-rankings>div,.insight-products>article,.insight-tags span){color:#38415f;border-color:#e2dfef;background:linear-gradient(145deg,#fbfaff,#f1effb)}
:root:not([data-theme="dark"]) .management-workspace .time-bucket-grid :is(span,strong,small){color:#56607e}
:root:not([data-theme="dark"]) .management-workspace :is(.analysis-method,.inline-notice,.scope-note){color:#69728d;border-color:#dfddec;background:rgb(249 248 255 / 88%)}
:root:not([data-theme="dark"]) .management-workspace .table-action:not(.muted){color:#fff;border-color:rgb(255 255 255 / 68%);background:linear-gradient(135deg,rgb(151 130 239 / 96%),rgb(103 116 226 / 96%));box-shadow:inset 0 1px 0 rgb(255 255 255 / 48%),0 5px 12px rgb(103 91 200 / 24%);backdrop-filter:blur(12px);transform:translateY(-1px)}
:root:not([data-theme="dark"]) .management-workspace .table-action:not(.muted):hover{background:linear-gradient(135deg,#a18cf1,#6d78e6);box-shadow:inset 0 1px 0 rgb(255 255 255 / 56%),0 8px 17px rgb(103 91 200 / 29%);transform:translateY(-2px)}
:root:not([data-theme="dark"]) .management-workspace .table-action:not(.muted):active{box-shadow:inset 0 2px 5px rgb(65 54 145 / 18%);transform:translateY(0)}
:root:not([data-theme="dark"]) .management-workspace .table-action.muted{color:#686e88;border-color:#deddeb;background:#f5f4fa;box-shadow:inset 0 1px 0 #fff}
:root:not([data-theme="dark"]) .management-workspace :is(.procurement-tabs,.purchase-order-list>article){border-color:#dfddec;background:#f8f7fd}
:root:not([data-theme="dark"]) .management-workspace .procurement-tabs button{color:#727992}:root:not([data-theme="dark"]) .management-workspace .procurement-tabs button.active{color:#fff;background:linear-gradient(135deg,#8b79ed,#6875e4)}
:root:not([data-theme="dark"]) .management-workspace .purchase-item-fields input{color:#303854;border-color:#dedbec;background:#fff}

/* Light mode: aqua glass system inspired by the supplied Payrix reference. */
:root:not([data-theme="dark"]) .management-workspace{
  --dash-bg:#edf5f6;--dash-panel:rgb(255 255 255 / 78%);--dash-line:#c9dfe2;--dash-text:#173244;--dash-muted:#6d8791;--dash-cyan:#18a8b7;--dash-blue:#3f7ec8;
  background:
    radial-gradient(circle at 18% 2%,rgb(42 190 203 / 22%),transparent 28%),
    radial-gradient(circle at 72% 18%,rgb(255 170 71 / 10%),transparent 18%),
    linear-gradient(145deg,#e8f4f5 0%,#f4f8f7 46%,#eaf2f3 100%);color:var(--dash-text);border:0;outline:0;box-shadow:none
}
:root:not([data-theme="dark"]) .management-workspace :is(.management-sidebar,.management-heading,.management-card,.system-card,.inventory-truth-panel,.sales-filter-panel,.product-filter-panel,.inventory-operation-filters,.store-comparison-filters,.insight-search,.inventory-detail-filters,.procurement-summary article,.purchase-suggestion-grid>article,.page-guide-popover,.planned-section,.taxonomy-columns>article,.insight-products>article,.readiness-list>div,.source-quality dl>div,.store-rankings>div,.health-check-card li,.sync-history article){
  color:var(--dash-text);border-color:rgb(255 255 255 / 88%);background:linear-gradient(145deg,rgb(255 255 255 / 91%),rgb(239 248 248 / 74%));
  box-shadow:inset 0 0 0 1px rgb(157 196 201 / 35%),inset 0 1px 0 #fff,0 13px 30px rgb(37 104 114 / 10%);backdrop-filter:blur(20px) saturate(120%)
}
:root:not([data-theme="dark"]) .management-workspace :is(h2,h3,strong,dd,th){color:#183548}
:root:not([data-theme="dark"]) .management-workspace :is(p,small,span,dt){color:#6d8590}
:root:not([data-theme="dark"]) .management-workspace .management-sidebar{border-color:rgb(255 255 255 / 90%);background:rgb(250 254 253 / 78%)}
:root:not([data-theme="dark"]) .management-workspace .management-sidebar button:not(.active){color:#57717c;background:transparent}
:root:not([data-theme="dark"]) .management-workspace .management-sidebar button:not(.active):hover{color:#153f4c;background:rgb(207 237 239 / 60%)}
:root:not([data-theme="dark"]) .management-workspace .management-sidebar button.active{color:#fff;background:linear-gradient(135deg,#18b5c2,#4084cb);box-shadow:inset 0 1px 0 rgb(255 255 255 / 45%),0 8px 20px rgb(29 139 159 / 20%)}
:root:not([data-theme="dark"]) .management-workspace .management-sidebar button.active :is(span,small,em){color:#fff}
:root:not([data-theme="dark"]) .management-workspace .management-heading{border-color:rgb(255 255 255 / 90%);background:linear-gradient(120deg,rgb(255 255 255 / 88%),rgb(224 244 245 / 68%))}
:root:not([data-theme="dark"]) .management-workspace .management-heading::after{background:linear-gradient(90deg,transparent,#20b5bf 42%,#ffad4d 70%,transparent)}
:root:not([data-theme="dark"]) .management-workspace :is(input,select,textarea),
:root:not([data-theme="dark"]) .management-workspace :is(.sales-filter-panel,.product-filter-panel,.inventory-operation-filters,.store-comparison-filters,.insight-search,.inventory-detail-filters) :is(input,select){color:#183548!important;border-color:#c8dfe2!important;background:rgb(255 255 255 / 76%)!important;box-shadow:inset 0 1px 2px rgb(31 95 105 / 5%)!important}
:root:not([data-theme="dark"]) .management-workspace :is(input,select,textarea){opacity:1!important;-webkit-text-fill-color:#183548!important;color-scheme:light!important}
:root:not([data-theme="dark"]) .management-workspace :is(input,textarea)::placeholder{color:#5f7a84!important;opacity:1!important;-webkit-text-fill-color:#5f7a84!important}
:root:not([data-theme="dark"]) .management-workspace :is(.management-kpis,.sales-kpis,.product-kpis,.inventory-operation-kpis,.store-kpis,.insight-kpis,.inventory-truth-grid,.overview-metric-strip) article{
  color:#173244;border-color:rgb(255 255 255 / 92%);background:linear-gradient(145deg,rgb(255 255 255 / 92%),rgb(226 244 245 / 72%));
  box-shadow:inset 0 0 0 1px rgb(161 201 205 / 32%),inset 0 1px 0 #fff,0 10px 25px rgb(37 104 114 / 9%)
}
:root:not([data-theme="dark"]) .management-workspace :is(.management-kpis,.sales-kpis,.product-kpis,.inventory-operation-kpis,.store-kpis,.insight-kpis,.inventory-truth-grid,.overview-metric-strip) article:hover{border-color:#fff;background:linear-gradient(145deg,#fff,rgb(218 242 244 / 82%));box-shadow:inset 0 0 0 1px rgb(112 187 194 / 45%),0 15px 32px rgb(37 104 114 / 14%)}
:root:not([data-theme="dark"]) .management-workspace :is(.management-kpis,.sales-kpis,.product-kpis,.inventory-operation-kpis,.store-kpis,.insight-kpis,.inventory-truth-grid,.overview-metric-strip) :is(strong,dd){color:#173548}
:root:not([data-theme="dark"]) .management-workspace :is(.management-filters button,.sales-filter-panel>button:not(.secondary-action),.product-filter-panel>button:not(.secondary-action),.inventory-operation-filters>button:not(.secondary-action),.store-comparison-filters>button:not(.secondary-action),.insight-search>button:not(.secondary-action),.primary-sync-controls button,.purchase-order-actions button,.procurement-empty button,.table-action:not(.muted)){
  color:#fff!important;border:1px solid rgb(255 255 255 / 72%)!important;border-radius:12px;background:linear-gradient(135deg,#1db7c4,#467fce)!important;box-shadow:inset 0 1px 0 rgb(255 255 255 / 52%),0 7px 17px rgb(27 132 155 / 24%)!important
}
:root:not([data-theme="dark"]) .management-workspace :is(.management-filters button,.sales-filter-panel>button:not(.secondary-action),.product-filter-panel>button:not(.secondary-action),.inventory-operation-filters>button:not(.secondary-action),.store-comparison-filters>button:not(.secondary-action),.insight-search>button:not(.secondary-action),.primary-sync-controls button,.purchase-order-actions button,.procurement-empty button,.table-action:not(.muted)):hover{filter:brightness(1.05);transform:translateY(-2px);box-shadow:inset 0 1px 0 rgb(255 255 255 / 58%),0 10px 22px rgb(27 132 155 / 28%)!important}
:root:not([data-theme="dark"]) .management-workspace :is(.secondary-action,.table-action.muted,.editor-reset){color:#426d78!important;border-color:#c9dfe2!important;background:rgb(255 255 255 / 68%)!important;box-shadow:inset 0 1px 0 #fff!important}
:root:not([data-theme="dark"]) .management-workspace :is(.period-tabs,.procurement-tabs,.inventory-status-tabs,.product-tabs,.insight-tabs){border-color:rgb(255 255 255 / 88%);background:rgb(222 241 242 / 62%);box-shadow:inset 0 0 0 1px rgb(155 196 201 / 28%)}
:root:not([data-theme="dark"]) .management-workspace :is(.period-tabs,.procurement-tabs,.inventory-status-tabs,.product-tabs,.insight-tabs) button{color:#68818b;background:transparent}
:root:not([data-theme="dark"]) .management-workspace :is(.period-tabs,.procurement-tabs,.inventory-status-tabs,.product-tabs,.insight-tabs) button:is(.active,[aria-pressed=true]){color:#17404b;background:rgb(255 255 255 / 88%);box-shadow:0 5px 14px rgb(36 105 116 / 13%)}
:root:not([data-theme="dark"]) .management-workspace :is(.management-alert.pending,.sync-required-alert,.analysis-method,.inline-notice,.scope-note){color:#496871!important;border-color:rgb(255 255 255 / 84%)!important;background:linear-gradient(105deg,rgb(225 246 247 / 86%),rgb(255 247 223 / 75%))!important;box-shadow:inset 0 0 0 1px rgb(168 205 208 / 32%)}
:root:not([data-theme="dark"]) .management-workspace :is(.management-alert.pending,.sync-required-alert,.analysis-method,.inline-notice,.scope-note) :is(span,strong,p){color:#496871!important}
:root:not([data-theme="dark"]) .management-workspace :is(.time-bucket-grid article,.coverage-buckets article,.source-quality dl>div,.store-result-card dl>div,.store-rankings>div,.insight-products>article,.insight-tags span,.taxonomy-list>div,.purchase-suggestion-grid dl div){color:#284b59;border-color:#d3e6e8;background:rgb(237 247 247 / 80%)}
:root:not([data-theme="dark"]) .management-workspace .purchase-suggestion-grid .suggested{background:linear-gradient(135deg,rgb(207 241 241 / 92%),rgb(229 239 255 / 90%))}
:root:not([data-theme="dark"]) .management-workspace .purchase-suggestion-grid .suggested dd{color:#167f8e}
:root:not([data-theme="dark"]) .management-workspace .store-result-card.selected{color:#173548!important;border-color:rgb(255 255 255 / 92%)!important;background:linear-gradient(145deg,rgb(255 255 255 / 92%),rgb(218 242 244 / 80%))!important;box-shadow:inset 0 0 0 1px rgb(81 169 180 / 40%),0 16px 34px rgb(37 104 114 / 14%)!important}
:root:not([data-theme="dark"]) .management-workspace .store-result-card.selected .card-title h3,:root:not([data-theme="dark"]) .management-workspace .store-result-card.selected dd{color:#173548!important}
:root:not([data-theme="dark"]) .management-workspace .store-result-card.selected :is(.card-title p,dt){color:#6d8791!important}
:root:not([data-theme="dark"]) .management-workspace .store-result-card.selected dl>div{border-color:#d3e6e8!important;background:rgb(255 255 255 / 64%)!important}
:root:not([data-theme="dark"]) .management-workspace table{color:#244554;background:rgb(255 255 255 / 67%)}
:root:not([data-theme="dark"]) .management-workspace :is(th,thead){color:#526e79;background:rgb(220 240 242 / 72%)!important}
:root:not([data-theme="dark"]) .management-workspace td{color:#315461;border-color:#d8e7e9}
:root:not([data-theme="dark"]) .management-workspace tbody tr:hover{background:rgb(221 243 244 / 55%)}
:root:not([data-theme="dark"]) .management-workspace .page-guide-fab{border-color:rgb(255 255 255 / 75%);background:linear-gradient(145deg,#1cb5c1,#4580cb);box-shadow:inset 0 1px 0 rgb(255 255 255 / 46%),0 12px 28px rgb(28 132 153 / 27%)}
:root:not([data-theme="dark"]) .management-workspace .metric-symbol.sales{background:#318ed0}:root:not([data-theme="dark"]) .management-workspace .metric-symbol.orders{background:#20b0bd}:root:not([data-theme="dark"]) .management-workspace .metric-symbol.units{background:#7188dc}:root:not([data-theme="dark"]) .management-workspace .metric-symbol.average{background:#f2aa48}:root:not([data-theme="dark"]) .management-workspace .metric-symbol.stock{background:#3db396}:root:not([data-theme="dark"]) .management-workspace .metric-symbol.expiry{background:#e67d8a}

/* Dense operational refinements: visible native dates, compact explanations and decision-first cards. */
.management-heading>div:first-child>span{display:none}.management-heading{min-height:58px!important}.management-heading h2{font-size:20px!important}
.hot-products-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;margin-top:14px}.hot-products-grid article{display:grid;grid-template-columns:34px minmax(0,1fr) auto auto auto;align-items:center;gap:10px;min-width:0;padding:9px 10px;border-bottom:1px solid var(--dash-line)}.hot-products-grid article>span{display:grid;min-width:0;gap:2px}.hot-products-grid article>span strong,.hot-products-grid article>span small{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.hot-products-grid article>em{color:var(--dash-muted);font-size:11px;font-style:normal}.hot-products-grid article>strong{font-size:12px}.hot-products-grid .table-action{min-height:32px;padding:4px 10px}
.purchase-suggestion-grid>article{min-height:178px;padding:13px}.purchase-suggestion-grid header strong{font-size:14px;line-height:1.35}.purchase-suggestion-grid dl{grid-template-columns:repeat(3,minmax(0,1fr))}.purchase-suggestion-grid dl div{display:grid;align-content:center;min-height:55px}.purchase-suggestion-grid dl .inventory-focus dd,.purchase-suggestion-grid dl .suggested dd{font-size:18px}.purchase-suggestion-grid>article>p{display:none}
.purchase-suggestion-grid header strong,.purchase-suggestion-grid header small{overflow:visible;text-overflow:clip;white-space:normal;overflow-wrap:anywhere}.purchase-suggestion-grid header strong{min-height:32px;font-size:12px;line-height:1.28}.purchase-suggestion-grid header small{font-size:9px;line-height:1.25}.purchase-suggestion-grid>article{min-height:188px}.purchase-suggestion-grid footer button{font-size:10px}
.page-guide-fab{top:52%;right:24px;bottom:auto;width:74px;height:74px;padding:0;border:0!important;background:transparent!important;box-shadow:none!important;transform:translateY(-50%);overflow:visible}.page-guide-fab img{position:relative;z-index:2;width:72px;height:72px;object-fit:contain;filter:drop-shadow(0 8px 12px rgb(32 108 95 / 24%));animation:assistant-float 3.8s ease-in-out infinite}.page-guide-fab span{position:absolute;z-index:1;width:62px;height:62px;border-radius:50%;background:radial-gradient(circle,rgb(255 217 91 / 70%),rgb(255 217 91 / 0) 68%);animation:assistant-rays 9s ease-in-out infinite}.page-guide-fab b{right:76px}.page-guide-popover{top:50%;right:112px;bottom:auto;transform:translateY(-50%)}
@keyframes assistant-float{0%,100%{transform:translateY(0) rotate(-1deg)}50%{transform:translateY(-8px) rotate(1deg)}}@keyframes assistant-rays{0%,55%,100%{opacity:0;transform:scale(.72)}60%,82%{opacity:.82;transform:scale(1.45)}93%{opacity:0;transform:scale(1.9)}}
@media(max-width:900px){.hot-products-grid{grid-template-columns:1fr}.hot-products-grid article{grid-template-columns:30px minmax(0,1fr) auto auto}.hot-products-grid article>em{display:none}}
:root:not([data-theme="dark"]) .management-workspace input[type="date"]{color:#183548!important;-webkit-text-fill-color:#183548!important;opacity:1!important;color-scheme:light!important}
:root:not([data-theme="dark"]) .management-workspace input[type="date"]::-webkit-date-and-time-value{color:#183548!important;-webkit-text-fill-color:#183548!important;opacity:1!important;text-align:left}
:root:not([data-theme="dark"]) .management-workspace input[type="date"]::-webkit-calendar-picker-indicator{opacity:.75;filter:none}
:root:not([data-theme="dark"]) .management-workspace .product-kpis{grid-template-columns:repeat(6,minmax(0,1fr))}
:root:not([data-theme="dark"]) .management-workspace .clear-table-filter{padding:4px 0!important;color:#168d9b!important;border:0!important;background:transparent!important;box-shadow:none!important}
:root:not([data-theme="dark"]) .management-workspace .stock-badge{color:#56477f!important;border:1px solid rgb(174 155 224 / 38%);background:linear-gradient(135deg,#f4efff,#ded5fb)!important;box-shadow:inset 0 1px 0 #fff}
:root:not([data-theme="dark"]) .management-workspace :is(.primary-sync-card,.pos-status-grid article,.reconcile-option){color:#173548;border-color:rgb(255 255 255 / 90%);background:linear-gradient(145deg,rgb(255 255 255 / 92%),rgb(222 243 244 / 78%));box-shadow:inset 0 0 0 1px rgb(157 196 201 / 32%),0 10px 24px rgb(37 104 114 / 9%)}
:root:not([data-theme="dark"]) .management-workspace :is(.primary-sync-card,.pos-status-grid article,.reconcile-option) :is(strong,span,small){color:#315767}
:root:not([data-theme="dark"]) .management-workspace .reconcile-option input{accent-color:#21a8b5}

/* Dense single-row summaries, theme-matched actions and legible procurement cards. */
@media(min-width:1101px){.overview-action-rail{grid-template-columns:repeat(4,minmax(0,1fr))!important}.product-kpis{grid-template-columns:repeat(6,minmax(0,1fr))!important}.product-kpis article{min-width:0;padding-inline:13px}.product-kpis strong{font-size:clamp(17px,1.35vw,23px)}}
.stock-status-actions>span{display:flex;gap:5px}.management-workspace .stock-status-actions button,.management-workspace .table-action{border-color:rgb(127 126 221 / 38%);background:linear-gradient(135deg,rgb(74 68 157 / 78%),rgb(28 135 160 / 72%));color:#f2f3ff;box-shadow:inset 0 1px 0 rgb(255 255 255 / 15%),0 5px 14px rgb(2 10 27 / 26%)}
.management-workspace .stock-status-actions button:hover,.management-workspace .table-action:not(:disabled):hover{border-color:rgb(166 162 246 / 56%);filter:brightness(1.09)}
:root:not([data-theme="dark"]) .management-workspace .stock-status-actions button,:root:not([data-theme="dark"]) .management-workspace .table-action:not(.muted){border-color:rgb(255 255 255 / 78%);background:linear-gradient(135deg,rgb(176 151 244 / 96%),rgb(105 149 232 / 94%));color:#fff;box-shadow:inset 0 1px 0 rgb(255 255 255 / 52%),0 6px 16px rgb(106 96 194 / 22%)}
.purchase-suggestion-grid>article{border-color:#30425c;background:linear-gradient(145deg,#111f32,#0d1828);box-shadow:inset 0 1px 0 rgb(255 255 255 / 5%),0 8px 20px rgb(0 0 0 / 18%)}.purchase-suggestion-grid header strong{color:#f2f7ff;font-size:14px;font-weight:900}.purchase-suggestion-grid header small{color:#9dacc0;font-size:10px}.purchase-suggestion-grid dl div{border:1px solid rgb(87 111 145 / 18%);background:#152238}.purchase-suggestion-grid dt{color:#9aabc0;font-size:9px}.purchase-suggestion-grid dd{color:#f4f8ff;font-size:14px}.purchase-suggestion-grid .inventory-focus{background:#19263a}.purchase-suggestion-grid .suggested{background:linear-gradient(145deg,#14394a,#15314b)}.purchase-suggestion-grid .suggested dd{color:#6fe7ed}.purchase-suggestion-grid footer button{font-size:11px;font-weight:900}
:root:not([data-theme="dark"]) .management-workspace .purchase-suggestion-grid>article{border-color:rgb(171 197 213 / 62%);background:linear-gradient(145deg,rgb(255 255 255 / 96%),rgb(234 244 248 / 92%));box-shadow:inset 0 1px 0 #fff,0 9px 22px rgb(57 98 116 / 10%)}:root:not([data-theme="dark"]) .management-workspace .purchase-suggestion-grid header strong{color:#18394a}:root:not([data-theme="dark"]) .management-workspace .purchase-suggestion-grid header small{color:#65808c}:root:not([data-theme="dark"]) .management-workspace .purchase-suggestion-grid dl div{border-color:rgb(183 213 218 / 52%);background:rgb(237 247 247 / 88%)}:root:not([data-theme="dark"]) .management-workspace .purchase-suggestion-grid dt{color:#5d7984}:root:not([data-theme="dark"]) .management-workspace .purchase-suggestion-grid dd{color:#18394a}:root:not([data-theme="dark"]) .management-workspace .purchase-suggestion-grid .suggested{background:linear-gradient(135deg,rgb(222 211 255 / 92%),rgb(211 235 255 / 92%))}:root:not([data-theme="dark"]) .management-workspace .purchase-suggestion-grid .suggested dd{color:#6552c5}
.sync-control-row{display:grid;grid-template-columns:minmax(340px,540px) minmax(280px,1fr);align-items:end;gap:12px}.sync-control-row .primary-sync-controls{grid-template-columns:minmax(190px,1fr) minmax(150px,220px)}.sync-control-row .reconcile-option{min-height:46px;margin:0;align-items:center;padding:8px 12px}.sync-control-row .reconcile-option input{margin:0}.sync-control-row .reconcile-option span{display:flex;align-items:center;gap:9px;min-width:0}.sync-control-row .reconcile-option small{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pos-inventory-application-card{display:grid;gap:14px}.pos-inventory-range{display:grid;grid-template-columns:minmax(160px,220px) minmax(160px,220px) minmax(160px,220px);align-items:end;gap:10px}.pos-inventory-range label{display:grid;gap:6px;color:#91a1b8;font-size:11px;font-weight:800}.pos-inventory-range input,.pos-inventory-range button{min-height:44px;padding:0 12px;border:1px solid #30425c;border-radius:11px;font:inherit}.pos-inventory-range input{color:#edf6ff;background:#0a1422}.pos-inventory-range button,.pos-inventory-commit button{color:#fff;border:0;background:linear-gradient(135deg,#176f8f,#4c5bc9);font-weight:900;white-space:nowrap;cursor:pointer}.pos-inventory-range button:disabled,.pos-inventory-commit button:disabled{opacity:.5;cursor:not-allowed}.pos-inventory-preview-summary{display:grid;grid-template-columns:1.1fr 1.25fr 1.25fr 1.1fr;gap:8px}.pos-inventory-preview-summary article{display:grid;gap:5px;min-height:92px;padding:13px;border:1px solid #24354e;border-radius:14px;background:#0d1828}.pos-inventory-preview-summary span{color:#91a2b8;font-size:10px;font-weight:800}.pos-inventory-preview-summary strong{color:#edf5ff;font-size:21px;font-variant-numeric:tabular-nums}.pos-inventory-preview-summary small{color:#718299;font-size:9px}.pos-inventory-preview-summary .ready{border-color:rgb(62 203 134 / 28%);background:linear-gradient(145deg,rgb(23 108 107 / 20%),#0d1828)}.pos-inventory-preview-summary .ready strong{color:#69e0b0}.pos-inventory-preview-summary .blocked{border-color:rgb(255 98 87 / 25%)}.pos-inventory-preview-summary .blocked strong{color:#ff8077}.pos-inventory-commit{display:flex;align-items:center;justify-content:space-between;gap:18px;padding:14px 16px;border:1px solid #2a3d58;border-radius:15px;background:#0b1626}.pos-inventory-commit>span{display:grid;gap:4px}.pos-inventory-commit strong{color:#eaf3ff}.pos-inventory-commit small{color:#8292a9}.pos-inventory-commit button{min-height:44px;padding:0 16px}.pos-inventory-issues{border-top:1px solid #25364e;padding-top:10px}.pos-inventory-issues summary{color:#aebdd1;font-size:12px;font-weight:850;cursor:pointer}.pos-inventory-issues>div{display:grid;max-height:240px;margin-top:10px}.pos-inventory-issues article{display:grid;grid-template-columns:minmax(180px,.55fr) minmax(260px,1fr);gap:12px;padding:9px 10px;border-bottom:1px solid #213149}.pos-inventory-issues article span{display:grid;gap:2px}.pos-inventory-issues article strong{color:#dfeafb;font-size:11px}.pos-inventory-issues article small{color:#71839c;font-size:9px}.pos-inventory-issues article em{color:#f0b277;font-size:11px;font-style:normal}.pos-inventory-empty{display:grid;min-height:88px;place-items:center;margin:0;border:1px dashed #2b3c55;border-radius:14px;color:#8191a7;font-size:12px;text-align:center}.confirm-impact{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:16px 0 0}.confirm-impact div{padding:11px;border:1px solid rgb(255 255 255 / 18%);border-radius:12px;background:rgb(255 255 255 / 8%)}.confirm-impact dt{color:rgb(255 255 255 / 66%);font-size:10px}.confirm-impact dd{margin:4px 0 0;font-size:12px;font-weight:800}.morph-submit{width:148px;min-width:44px;transition:width .3s cubic-bezier(.34,1.56,.64,1),border-radius .3s cubic-bezier(.34,1.56,.64,1),background .2s ease,transform .2s ease}.morph-submit.is-loading,.morph-submit.is-success{width:44px;padding:0;border-radius:50%}.morph-submit i{display:block;width:17px;height:17px;margin:auto;border:2px solid rgb(255 255 255 / 36%);border-top-color:#fff;border-radius:50%;animation:management-spin .7s linear infinite}.morph-submit.is-success{color:#fff!important;background:#31a871!important}.morph-submit b{font-size:22px;line-height:1}
:root:not([data-theme="dark"]) .management-workspace .pos-inventory-application-card{border-color:rgb(255 255 255 / 90%);background:linear-gradient(145deg,rgb(255 255 255 / 92%),rgb(222 243 244 / 78%));box-shadow:inset 0 0 0 1px rgb(157 196 201 / 32%),0 10px 24px rgb(37 104 114 / 9%)}:root:not([data-theme="dark"]) .management-workspace .pos-inventory-range label{color:#587480}:root:not([data-theme="dark"]) .management-workspace .pos-inventory-range input{color:#183548;border-color:#cfe2e5;background:rgb(255 255 255 / 82%)}:root:not([data-theme="dark"]) .management-workspace .pos-inventory-preview-summary article{border-color:#d7e6e9;background:rgb(242 249 249 / 88%)}:root:not([data-theme="dark"]) .management-workspace .pos-inventory-preview-summary span,:root:not([data-theme="dark"]) .management-workspace .pos-inventory-preview-summary small{color:#617d87}:root:not([data-theme="dark"]) .management-workspace .pos-inventory-preview-summary strong{color:#18394a}:root:not([data-theme="dark"]) .management-workspace .pos-inventory-preview-summary .ready{border-color:rgb(42 151 116 / 26%);background:linear-gradient(145deg,rgb(221 245 239 / 95%),rgb(239 248 248 / 90%))}:root:not([data-theme="dark"]) .management-workspace .pos-inventory-preview-summary .ready strong{color:#19795e}:root:not([data-theme="dark"]) .management-workspace .pos-inventory-preview-summary .blocked strong{color:#b64f4c}:root:not([data-theme="dark"]) .management-workspace .pos-inventory-commit{border-color:#d5e5e8;background:rgb(244 249 249 / 86%)}:root:not([data-theme="dark"]) .management-workspace .pos-inventory-commit strong{color:#173b49}:root:not([data-theme="dark"]) .management-workspace .pos-inventory-commit small{color:#68838c}:root:not([data-theme="dark"]) .management-workspace .pos-inventory-empty{color:#67808a;border-color:#cbdfe2}:root:not([data-theme="dark"]) .management-workspace .pos-inventory-issues{border-color:#d4e4e7}:root:not([data-theme="dark"]) .management-workspace .pos-inventory-issues article{border-color:#dce9eb}:root:not([data-theme="dark"]) .management-workspace .pos-inventory-issues article strong{color:#284b59}:root:not([data-theme="dark"]) .management-workspace .pos-inventory-issues article em{color:#a65f2a}:root:not([data-theme="dark"]) .confirm-impact div{border-color:rgb(75 74 140 / 14%);background:rgb(255 255 255 / 46%)}:root:not([data-theme="dark"]) .confirm-impact dt{color:#6f7290}
:root:not([data-theme="dark"]) .management-workspace .sales-ranking li span strong{color:#19795e!important}:root:not([data-theme="dark"]) .management-workspace .sales-ranking li em{color:#7659cf!important;font-weight:900}
.purchase-toast{position:fixed;z-index:1400;top:92px;left:50%;max-width:min(620px,calc(100vw - 32px));margin:0;padding:12px 20px;border:1px solid rgb(191 179 255 / 34%);border-radius:999px;background:linear-gradient(135deg,rgb(83 69 170 / 96%),rgb(26 139 157 / 94%));box-shadow:inset 0 1px 0 rgb(255 255 255 / 20%),0 16px 38px rgb(0 0 0 / 28%);color:#f7f7ff;font-size:13px;font-weight:850;white-space:normal;transform:translateX(-50%);backdrop-filter:blur(16px)}.purchase-toast.error{border-color:rgb(255 144 151 / 54%);background:linear-gradient(135deg,rgb(146 45 69 / 97%),rgb(112 42 84 / 96%))}
:root:not([data-theme="dark"]) .purchase-toast{border-color:rgb(255 255 255 / 84%);background:linear-gradient(135deg,rgb(185 156 244 / 94%),rgb(111 163 231 / 94%));box-shadow:inset 0 1px 0 rgb(255 255 255 / 58%),0 14px 32px rgb(103 92 188 / 22%);color:#fff}:root:not([data-theme="dark"]) .purchase-toast.error{border-color:rgb(255 171 178 / 78%);background:linear-gradient(135deg,rgb(211 86 111 / 96%),rgb(166 70 115 / 96%))}.toast-pop-enter-active,.toast-pop-leave-active{transition:opacity .18s ease,transform .22s cubic-bezier(.2,.8,.2,1)}.toast-pop-enter-from,.toast-pop-leave-to{opacity:0;transform:translate(-50%,-10px) scale(.96)}

/* One purchase-order module with four compact information columns. */
.purchase-order-table-wrap{max-height:min(520px,58dvh);overflow:auto;border:1px solid #263751;border-radius:16px;scrollbar-gutter:stable}.purchase-order-table{width:100%;min-width:980px;border-collapse:separate;border-spacing:0}.purchase-order-table th{position:sticky;z-index:2;top:0;padding:11px 12px;color:#9eacc0;background:#101b2b;text-align:left;font-size:11px}.purchase-order-table td{padding:10px 12px;border-top:1px solid #223149;vertical-align:top}.purchase-order-table td:first-child{width:27%}.purchase-order-table td:nth-child(2){width:25%}.purchase-order-table td:nth-child(3){width:22%}.purchase-order-table td:nth-child(4){width:26%}.purchase-order-table td>strong,.purchase-order-table td>small,.purchase-order-table td>em{display:block}.purchase-order-table td>strong{color:#edf6ff;font-size:13px;line-height:1.35}.purchase-order-table td>small,.purchase-order-table td>em{margin-top:3px;color:#91a0b4;font-size:9px;font-style:normal}.purchase-order-table td label{display:grid;grid-template-columns:88px minmax(0,1fr);align-items:center;gap:6px;margin-bottom:6px;color:#91a0b4;font-size:9px}.purchase-order-table input{min-width:0;height:34px;padding:6px 8px;color:#edf5ff;border:1px solid #30415b;border-radius:8px;background:#09121f}.purchase-row-actions{display:flex;justify-content:flex-end;gap:6px}.purchase-row-actions button{min-height:32px;padding:5px 10px;border-radius:8px}.purchase-confirm-dialog{width:min(520px,calc(100vw - 30px));padding:24px;border:1px solid rgb(174 193 255 / 28%);border-radius:25px;background:linear-gradient(135deg,rgb(96 61 203 / 94%),rgb(67 78 189 / 93%) 50%,rgb(16 197 184 / 86%));box-shadow:inset 0 1px rgb(255 255 255 / 24%),0 30px 85px rgb(0 0 0 / 48%);color:#fff;backdrop-filter:blur(28px) saturate(135%)}.purchase-confirm-dialog header{display:flex;align-items:flex-start;justify-content:space-between;gap:16px}.purchase-confirm-dialog header span{display:grid;gap:4px}.purchase-confirm-dialog header small{color:rgb(255 255 255 / 72%);letter-spacing:.15em}.purchase-confirm-dialog header strong{font-size:22px}.purchase-confirm-dialog header>button{width:38px;height:38px;padding:0;border:1px solid rgb(255 255 255 / 28%);border-radius:50%;color:#fff;background:rgb(255 255 255 / 13%)}.purchase-confirm-dialog p{color:rgb(255 255 255 / 82%);line-height:1.7}.purchase-confirm-dialog footer{display:flex;justify-content:flex-end;gap:8px;margin-top:20px}.purchase-confirm-dialog footer button{min-height:42px;padding:8px 15px;border-radius:12px}.purchase-confirm-dialog .dialog-cancel{color:#fff;border:1px solid rgb(255 255 255 / 32%);background:rgb(255 255 255 / 12%)}.purchase-confirm-dialog .dialog-confirm{color:#25304a;border:0;background:#fff}.purchase-confirm-dialog .dialog-confirm.danger{color:#fff;background:#d95d72}
:root:not([data-theme="dark"]) .management-workspace .purchase-order-table-wrap{border-color:#dfe3ef;background:rgb(255 255 255 / 70%)}:root:not([data-theme="dark"]) .management-workspace .purchase-order-table th{color:#65748b;background:rgb(244 246 252 / 96%)}:root:not([data-theme="dark"]) .management-workspace .purchase-order-table td{border-color:#e6e9f2}:root:not([data-theme="dark"]) .management-workspace .purchase-order-table td>strong{color:#27334d}:root:not([data-theme="dark"]) .management-workspace .purchase-order-table input{color:#303854;border-color:#dcdfea;background:#fff}:root:not([data-theme="dark"]) .purchase-confirm-dialog{border-color:rgb(255 255 255 / 88%);background:linear-gradient(135deg,rgb(244 224 255 / 96%),rgb(225 229 255 / 95%) 52%,rgb(196 223 255 / 94%));box-shadow:inset 0 1px #fff,0 28px 72px rgb(103 92 188 / 24%);color:#25304a}:root:not([data-theme="dark"]) .purchase-confirm-dialog header small,:root:not([data-theme="dark"]) .purchase-confirm-dialog p{color:#66708b}:root:not([data-theme="dark"]) .purchase-confirm-dialog header>button{color:#34405d;border-color:rgb(95 92 160 / 18%);background:rgb(255 255 255 / 55%)}:root:not([data-theme="dark"]) .purchase-confirm-dialog .dialog-cancel{color:#4b5570;border-color:#d5d7e6;background:rgb(255 255 255 / 58%)}:root:not([data-theme="dark"]) .purchase-confirm-dialog .dialog-confirm{color:#fff;background:linear-gradient(135deg,#8e6dde,#6f9fe8)}
@media(max-width:720px){.purchase-order-table{min-width:760px}.purchase-confirm-dialog{padding:20px}.purchase-order-table-wrap{max-height:62dvh}.pos-inventory-range{grid-template-columns:1fr}.pos-inventory-preview-summary{grid-template-columns:1fr 1fr}.pos-inventory-commit{align-items:stretch;flex-direction:column}.pos-inventory-commit button{width:100%}.pos-inventory-issues article{grid-template-columns:1fr}.confirm-impact{grid-template-columns:1fr}}
@media(max-width:900px){.sync-control-row{grid-template-columns:1fr}.sync-control-row .primary-sync-controls{grid-template-columns:minmax(0,1fr) minmax(130px,.55fr)}}
@media(prefers-reduced-motion:reduce){.page-guide-fab img,.page-guide-fab span{animation:none}}
@media(max-width:720px){.page-guide-fab{top:58%;right:12px;bottom:auto}.page-guide-popover{top:50%;right:16px;bottom:auto;transform:translateY(-50%)}}

/* Keep decision controls on one row and let the table scroll horizontally on narrow screens. */
.inventory-scroll-table table{min-width:1160px}.inventory-scroll-table th:last-child,.inventory-scroll-table td:last-child{min-width:390px}.inventory-row-actions{display:flex;align-items:center;gap:6px;flex-wrap:nowrap;white-space:nowrap}.inventory-row-actions>button{min-height:34px;padding:5px 9px;border:1px solid rgb(127 126 221 / 38%);border-radius:9px;background:linear-gradient(135deg,rgb(74 68 157 / 78%),rgb(28 135 160 / 72%));color:#f2f3ff;font:inherit;font-size:11px;font-weight:850}.inventory-row-actions>button:disabled{cursor:not-allowed;opacity:.58}.inventory-row-actions .stock-badge{flex:0 0 auto}.inventory-row-actions .table-action{flex:0 0 auto}.inventory-row-actions .table-action.is-added{border-color:rgb(67 216 162 / 34%);background:rgb(26 118 88 / 32%);color:#78e8bc}.inventory-source-time{display:block;margin-top:7px;color:#74869d;font-size:10px;font-weight:700}
:root:not([data-theme="dark"]) .management-workspace .inventory-row-actions>button{border-color:rgb(255 255 255 / 78%);background:linear-gradient(135deg,rgb(176 151 244 / 96%),rgb(105 149 232 / 94%));color:#fff;box-shadow:inset 0 1px 0 rgb(255 255 255 / 52%),0 6px 16px rgb(106 96 194 / 18%)}

/* All replenishment candidates stay inside one bounded work area instead of being silently sliced. */
.procurement-summary{grid-template-columns:repeat(4,minmax(0,1fr))}.purchase-suggestion-scroll{display:grid;gap:15px;max-height:min(620px,64dvh);overflow:auto;overscroll-behavior:contain;padding-right:5px;scrollbar-gutter:stable}.suggestion-priority-group{display:grid;gap:9px}.suggestion-priority-group>header{position:sticky;z-index:3;top:0;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 12px;border:1px solid #2a3c55;border-radius:12px;background:rgb(13 24 40 / 96%);backdrop-filter:blur(14px)}.suggestion-priority-group>header span{display:grid;gap:2px}.suggestion-priority-group>header b{color:#eef7ff;font-size:13px}.suggestion-priority-group>header small{color:#8fa0b6;font-size:9px}.suggestion-priority-group>header em{padding:5px 8px;border-radius:999px;color:#72e2e8;background:#123640;font-size:10px;font-style:normal;font-weight:900}.suggestion-priority-group.follow-up>header em{color:#c5b8ff;background:#272341}.arrived-group>summary{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 12px;border:1px solid #2a3c55;border-radius:12px;cursor:pointer;list-style:none}.arrived-group>summary::-webkit-details-marker{display:none}.arrived-group>summary span{display:grid;gap:2px}.arrived-group>summary b{color:#eef7ff;font-size:13px}.arrived-group>summary small{color:#8fa0b6;font-size:9px}.arrived-group>summary em{padding:5px 8px;border-radius:999px;color:#8fe3a8;background:#173826;font-size:10px;font-style:normal;font-weight:900}
:root:not([data-theme="dark"]) .management-workspace .suggestion-priority-group>header{border-color:#d7e5e8;background:rgb(244 250 250 / 96%)}:root:not([data-theme="dark"]) .management-workspace .suggestion-priority-group>header b{color:#18394a}:root:not([data-theme="dark"]) .management-workspace .suggestion-priority-group>header small{color:#68838d}

/* Read-only barcode audit: compact evidence rows for manual product decisions. */
.barcode-audit-panel{display:grid;gap:10px;padding:14px;border:1px solid #283950;border-radius:15px;background:#0a1422}.barcode-audit-panel>header{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.barcode-audit-panel>header span{display:grid;gap:3px}.barcode-audit-panel>header b{color:#edf6ff}.barcode-audit-panel>header small,.barcode-audit-panel>header em{color:#8293aa;font-size:10px;font-style:normal}.barcode-audit-summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px}.barcode-audit-summary article{display:grid;gap:4px;padding:10px;border:1px solid #25364e;border-radius:10px;background:#101c2d}.barcode-audit-summary span{color:#8fa1b8;font-size:9px}.barcode-audit-summary strong{color:#eef6ff;font-size:18px}.barcode-audit-scroll{display:grid;max-height:360px;overflow:auto;scrollbar-gutter:stable}.barcode-audit-row{display:grid;grid-template-columns:minmax(170px,.35fr) minmax(0,1fr);gap:12px;padding:10px;border-bottom:1px solid #213149}.barcode-audit-row>span{display:grid;align-content:start;gap:3px}.barcode-audit-row>span b{color:#75e1e6;font-size:12px}.barcode-audit-row>span small{color:#8495aa;font-size:9px}.barcode-audit-row>div{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}.barcode-audit-row p{display:grid;gap:2px;margin:0;padding:7px 9px;border-radius:8px;background:#111e30}.barcode-audit-row p strong{overflow:hidden;color:#dde8f6;font-size:10px;text-overflow:ellipsis;white-space:nowrap}.barcode-audit-row p small{overflow:hidden;color:#71849c;font-size:8px;text-overflow:ellipsis;white-space:nowrap}.barcode-audit-row.warning>span b{color:#f2b36f}.barcode-audit-row.unresolved>span b{color:#d4b2ff}
:root:not([data-theme="dark"]) .management-workspace .barcode-audit-panel{border-color:#d7e6e9;background:rgb(246 251 251 / 92%)}:root:not([data-theme="dark"]) .management-workspace .barcode-audit-panel>header b,:root:not([data-theme="dark"]) .management-workspace .barcode-audit-summary strong,:root:not([data-theme="dark"]) .management-workspace .barcode-audit-row p strong{color:#254957}:root:not([data-theme="dark"]) .management-workspace .barcode-audit-summary article,:root:not([data-theme="dark"]) .management-workspace .barcode-audit-row p{border-color:#d9e8ea;background:rgb(255 255 255 / 82%)}:root:not([data-theme="dark"]) .management-workspace .barcode-audit-row{border-color:#dce9eb}
@media(max-width:900px){.procurement-summary,.barcode-audit-summary{grid-template-columns:repeat(2,minmax(0,1fr))}.barcode-audit-row{grid-template-columns:1fr}.barcode-audit-row>div{grid-template-columns:1fr}}
@media(max-width:720px){.procurement-summary,.barcode-audit-summary{grid-template-columns:1fr}.purchase-suggestion-scroll{max-height:none;overflow:visible}.suggestion-priority-group>header{position:static}}
</style>

<style scoped src="./management-decision.css"></style>
