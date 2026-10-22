// State, data loading and actions of the management center, shared by
// ManagementDashboard.vue (shell and navigation) and the page components in pages/.
import { computed, inject, onBeforeUnmount, onMounted, provide, ref, watch, type InjectionKey } from 'vue';
import { storeToday } from '../store-date';

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
type PosReviewLine = { itemId: string; orderNo: string; orderedAt: string; sourceName: string | null; productId: string | null; productName: string | null; reason: PosInventoryIssue['reason']; required: number; applied: number; remaining: number; availableStock: number; canReapply: boolean };
type PosUnlistedStock = { products: { productId: string; sku: string; productName: string; englishName: string | null; barcodes: string[]; stock: number; createdAt: string }[]; totalUnits: number };
type PosReapplyResult = { lines: number; completed: number; stillShort: number; unitsApplied: number; skipped: { itemId: string; reason: string }[] };
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
  products: InventoryOperationRow[];
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
type OverviewTrendPeriod = 'WEEK' | 'MONTH' | 'YEAR';
type OverviewHotPeriod = 'DAY' | 'MONTH' | 'QUARTER' | 'YEAR';
type ManagementSection = 'overview' | 'sales' | 'products' | 'inventory' | 'procurement' | 'customers' | 'stores' | 'system';
export type ManagementDashboardProps = { apiBaseUrl: string; token: string; storeId: string; storeName: string; administrator?: boolean };
export type ManagementDashboardEmit = (event: 'open-report', view: 'receipts' | 'expiry' | 'movements') => void;

export function useManagementDashboard(props: Readonly<ManagementDashboardProps>, emit: ManagementDashboardEmit) {

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
  const posReviewLines = ref<PosReviewLine[] | null>(null);
  const posUnlistedStock = ref<PosUnlistedStock | null>(null);
  const posReapplyLoading = ref(false);
  const posReapplyResult = ref<PosReapplyResult | null>(null);
  const posIssues = ref<PosSyncIssues | null>(null);
  const barcodeAudit = ref<BarcodeAudit | null>(null);
  const posLoading = ref(false);
  const posRunning = ref(false);
  const posMessage = ref('');
  const syncDate = ref(storeToday());
  const reconcile = ref(false);
  const today = storeToday();
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
    inventory: { purpose: '识别缺货、低库存和滞销风险，帮助决定哪些商品需要补货或暂时隐藏提醒。', includes: ['库存状态', '观察期销量', '最低库存阈值', '最后销售时间'], decision: '缺货只统计近180天有销售的零库存商品；低库存只提醒核心品牌与绵羊油（默认20件）及单独设置了最低库存的商品。', details: ['库存来自正式库存系统，销量来自已同步的 POS 订单。', '销售历史不足时，不生成库存覆盖天数和滞销结论，避免把缺少数据误判为没有销售。', '名称含 stage、数字+tins 或数字+bag 的直邮奶粉不进入补货提醒。点击“忽略”会持续隐藏，点击“下周显示”会在7天后自动恢复。'] },
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
  const STOCK_STATUS_LABEL: Record<'OUT_OF_STOCK' | 'LOW' | 'IN_STOCK', string> = { IN_STOCK: '正常', LOW: '低库存', OUT_OF_STOCK: '缺货' };

  function inventoryStatusLabel(item: InventoryOperationRow) {
    if (item.stockStatus === 'IN_STOCK') return item.slowMoving ? '滞销关注' : '正常';
    if (item.stockStatus === 'LOW') return '低库存';
    return item.shortageVisible ? '缺货' : '长期停卖';
  }

  const posSyncState = computed(() => {
    const status = posStatus.value;
    const tone = posLoadError.value || status?.latestRun?.status === 'FAILED' ? 'status-warning' : status?.running ? 'status-running' : '';
    if (posLoading.value) return { label: '加载中', tone };
    if (posLoadError.value) return { label: '加载失败', tone };
    if (!status) return { label: '未获取', tone };
    if (status.running) return { label: '正在同步', tone };
    return { label: status.latestRun?.status === 'FAILED' ? '最近失败' : '空闲', tone };
  });

  const POS_READINESS_LABEL: Record<string, string> = { READY: '可用于分析', NEEDS_REVIEW: '需要处理' };
  const posReadinessLabel = computed(() => {
    if (posLoading.value) return '加载中';
    if (posLoadError.value) return '加载失败';
    if (!posCheck.value) return '未获取';
    return POS_READINESS_LABEL[posCheck.value.readiness] ?? '等待数据';
  });

  const realtimeSyncLabel = computed(() => {
    const realtime = posStatus.value?.realtime;
    if (posLoading.value || posLoadError.value || !realtime) return '—';
    return realtime.enabled ? `每 ${realtime.intervalMinutes} 分钟` : '未开启';
  });

  function clearSalesFilters() { salesBrand.value = ''; salesCategory.value = ''; }
  function clearProductFilters() { productQuery.value = ''; productBrand.value = ''; productCategory.value = ''; }
  function setDateRange(target: 'sales' | 'products' | 'stores', preset: 'today' | 'week' | 'month' | 'year') {
    const weekStart = new Date(`${today}T00:00:00Z`);
    weekStart.setUTCDate(weekStart.getUTCDate() - 6);
    const presetStart = { today, week: weekStart.toISOString().slice(0, 10), month: `${today.slice(0, 7)}-01`, year: `${today.slice(0, 4)}-01-01` };
    const from = presetStart[preset];
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
      if (managementAccess.value?.capabilities.posSync) {
        posStatus.value = await managementRequest<PosSyncStatus>(`/management/pos-sync/status?storeId=${store}`);
        [posReviewLines.value, posUnlistedStock.value] = await Promise.all([
          managementRequest<{ lines: PosReviewLine[] }>(`/management/pos-inventory/review-lines?storeId=${store}`).then((data) => data.lines),
          managementRequest<PosUnlistedStock>(`/management/pos-mapping/unlisted-stock?storeId=${store}`),
        ]);
      }
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

  // Short lines are re-applied only when someone decides the stock was really there (e.g. goods arrived later).
  async function reapplyReviewLines(itemIds: string[]) {
    if (!props.storeId || !itemIds.length || posReapplyLoading.value) return;
    posReapplyLoading.value = true;
    error.value = '';
    try {
      posReapplyResult.value = await managementRequest<PosReapplyResult>(`/management/pos-inventory/review-lines/reapply?storeId=${encodeURIComponent(props.storeId)}`, {
        method: 'POST', body: JSON.stringify({ itemIds, confirm: true }),
      });
      purchaseSuggestions.value = null;
      await loadPosManagement();
    } catch (reason) {
      error.value = reason instanceof Error ? reason.message : '复核明细重新扣减失败';
    } finally {
      posReapplyLoading.value = false;
    }
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

  const PURCHASE_STATUS_CONSEQUENCE: Record<'DRAFT' | 'CONFIRMED' | 'ORDERED' | 'CANCELLED', string> = {
    CONFIRMED: '确认后将暂时锁定商品和数量。',
    ORDERED: '标记已订货后，仍需到货并扫码入库才会增加库存。',
    CANCELLED: '取消后本周进货单不能继续使用。',
    DRAFT: '退回草稿后可以继续修改。',
  };

  async function changePurchaseStatus(status: 'DRAFT' | 'CONFIRMED' | 'ORDERED' | 'CANCELLED') {
    if (!props.storeId) return;
    const consequence = PURCHASE_STATUS_CONSEQUENCE[status];
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

  // Excel 2003 XML: opens in Excel and Numbers, and keeps barcodes as text instead of numbers.
  function downloadSpreadsheet(fileName: string, sheetName: string, rows: (string | number)[][]) {
    const tableRows = rows.map((row) => `<Row>${row.map((cell) => `<Cell><Data ss:Type="${typeof cell === 'number' ? 'Number' : 'String'}">${escapeXml(cell)}</Data></Cell>`).join('')}</Row>`).join('');
    const xml = `<?xml version="1.0"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="${escapeXml(sheetName)}"><Table>${tableRows}</Table></Worksheet></Workbook>`;
    const url = URL.createObjectURL(new Blob(['\ufeff', xml], { type: 'application/vnd.ms-excel;charset=utf-8' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = fileName; anchor.click(); URL.revokeObjectURL(url);
  }

  function exportPurchaseOrderExcel() {
    const order = currentPurchaseOrder.value?.order;
    if (!order?.items.length) return;
    const headers = ['序号', '商品名称', 'SKU/条码', '来源', '当前库存', '近7天销量', '建议数量', '确定进货数量', '供应商', '单件进价(NZ$)', '整箱规格', '预计金额(NZ$)', '备注'];
    const rows = order.items.map((item, index) => [index + 1, item.productName, item.barcode || item.sku, purchaseSourceLabel(item.source), item.currentInventory, item.recentSevenDayQty, item.suggestedQuantity, item.orderedQuantity, item.supplierName || '', item.unitCostCents == null ? '' : (item.unitCostCents / 100).toFixed(2), item.caseSize ?? '', item.unitCostCents == null ? '' : ((item.unitCostCents * item.orderedQuantity) / 100).toFixed(2), item.notes || '']);
    downloadSpreadsheet(`${order.orderNo}-本周进货单.xls`, '本周进货单', [headers, ...rows]);
    showPurchaseMessage('进货单 Excel 已生成');
  }

  function exportUnlistedStockExcel() {
    const products = posUnlistedStock.value?.products;
    if (!products?.length) return;
    const headers = ['序号', '商品名称', '英文名称', '条码', '本地SKU', '当前库存'];
    const rows = products.map((item, index) => [index + 1, item.productName, item.englishName || '', item.barcodes.join(' / '), item.sku, item.stock]);
    downloadSpreadsheet(`${props.storeName || '门店'}-POS未建档商品.xls`, 'POS未建档商品', [headers, ...rows]);
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
  return {
    productView, tagView, tagEditorOpen, systemView, posLoadError, overview, foundation, loading, error, posCheck,
    posStatus, posReviewLines, posUnlistedStock, posReapplyLoading, posReapplyResult, posIssues, barcodeAudit,
    posLoading, posRunning, posMessage, syncDate, reconcile, today, posInventoryFrom, posInventoryTo,
    posInventoryPreview, posInventoryApplyResult, posInventoryPreviewLoading, posInventoryConfirmOpen,
    posInventoryApplyState, salesFrom, salesTo, salesDimension, salesBrand, salesCategory, salesAnalysis,
    salesLoading, overviewTrendPeriods, overviewHotPeriods, overviewTrendPeriod, overviewHotPeriod,
    overviewTrendAnalysis, overviewHotAnalysis, overviewWidgetsLoading, overviewWidgetError, productFrom, productTo,
    productQuery, productBrand, productCategory, productsBrands, productsLoading, productDetailPage,
    productDetailPageSize, inventoryLookbackDays, inventoryQuery, inventoryOperations, inventoryLoading,
    inventoryTableQuery, inventoryBrandFilter, inventoryCategoryFilter, inventoryStatusFilter, inventorySort,
    inventoryPage, inventoryPageSize, pageGuideOpen, minimumStockDialog, minimumStockSaving,
    inventoryActionProductId, purchaseSuggestions, currentPurchaseOrder, purchaseLoading, purchaseMessage,
    purchaseMessageTone, purchaseActionProductId, purchaseView, purchaseConfirm, purchaseConfirmBusy,
    showIgnoredSuggestions, storeFrom, storeTo, storeComparison, storeLoading, managementAccess, insightQuery,
    productInsights, insightLoading, insightProductId, insightTagCode, insightConfidence, insightEvidence,
    insightMessage, insightDetailPage, insightDetailPageSize, newTagName, newTagDimension, newTagParentId,
    newTagDescription, editingTagId, newTagSortOrder, newTagStatus, activeSection, showMobileMore, allSections,
    navigationGroups, canSection, sections, currentSection, pageGuides, currentGuide, selectSection, openDataCenter,
    openSalesFromOverview, STOCK_STATUS_LABEL, inventoryStatusLabel, posSyncState,
    POS_READINESS_LABEL, posReadinessLabel, realtimeSyncLabel, clearSalesFilters, clearProductFilters, setDateRange,
    openInventoryAlert, clearInventoryFilters, pageBusy, retryCurrentPage, overviewTrendSeries, maxDailyRevenue,
    salesTimeBuckets, singleDaySales, salesTrendSeries, maxSalesTrend, chartPoints, overviewTrendPoints,
    salesTrendPoints, linePath, areaPath, conicGradient, expiryTotal, expiryGradient, productDetailPageCount,
    pagedProductDetails, insightDetailPageCount, pagedInsightProducts, inventoryBrands, inventoryCategories,
    inventoryStatusCounts, filteredInventoryProducts, inventoryPageCount, pagedInventoryProducts,
    thisWeekPurchaseSuggestions, followUpPurchaseSuggestions, money, number, percent, comparisonClass, dateTime,
    readinessLabel, domainLabel, openNativePicker, loadOverview, refreshOverviewRealtime, isoDate, overviewRange,
    loadOverviewTrend, loadOverviewHotProducts, selectOverviewTrend, selectOverviewHot, managementRequest,
    loadManagementAccess, loadPosManagement, loadSystemManagement, runManualSync, posInventoryIssueLabel,
    previewPosInventory, openPosInventoryConfirmation, reapplyReviewLines, applyPosInventory, loadSalesAnalysis,
    loadProductsBrands, loadInventoryOperations, configureMinimumStock, saveMinimumStock, setInventoryVisibility,
    loadProcurement, addToPurchaseOrder, performAddToPurchaseOrder, showPurchaseMessage, isProductInCurrentOrder,
    ignorePurchaseSuggestion, restorePurchaseSuggestion, savePurchaseItem, removePurchaseItem,
    performRemovePurchaseItem, PURCHASE_STATUS_CONSEQUENCE, changePurchaseStatus, performPurchaseStatusChange,
    confirmPurchaseAction, escapeXml, downloadSpreadsheet, exportPurchaseOrderExcel, exportUnlistedStockExcel,
    openProcurement, purchaseSourceLabel, purchaseStatusLabel, loadStoreComparison, loadProductInsights,
    assignInsightTag, editInsightTag, resetInsightTagEditor, saveInsightTag, emit
  };
}

export type ManagementDashboardContext = ReturnType<typeof useManagementDashboard>;
const managementDashboardKey: InjectionKey<ManagementDashboardContext> = Symbol('management-dashboard');
export function provideManagementDashboard(context: ManagementDashboardContext) { provide(managementDashboardKey, context); }
export function useManagementContext() {
  const context = inject(managementDashboardKey);
  if (!context) throw new Error('Management page components must be rendered inside ManagementDashboard');
  return context;
}
