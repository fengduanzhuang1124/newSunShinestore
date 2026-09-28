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
const inventoryLookbackDays = ref(90);
const inventoryQuery = ref('');
const inventoryOperations = ref<InventoryOperations | null>(null);
const inventoryLoading = ref(false);
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
const newTagName = ref('');
const newTagDimension = ref<InsightDimension>('HEALTH_NEED');
const newTagParentId = ref('');
const newTagDescription = ref('');
const editingTagId = ref('');
const newTagSortOrder = ref(0);
const newTagStatus = ref<'ACTIVE' | 'INACTIVE'>('ACTIVE');
type ManagementSection = 'overview' | 'sales' | 'products' | 'inventory' | 'customers' | 'stores' | 'system';
const activeSection = ref<ManagementSection>('overview');
const allSections: { id: ManagementSection; label: string; description: string; ready: boolean }[] = [
  { id: 'overview', label: '经营总览', description: '核心指标与经营提醒', ready: true },
  { id: 'sales', label: '销售分析', description: '趋势、时段与同比环比', ready: true },
  { id: 'products', label: '商品与品牌', description: '销售、库存与资料质量', ready: true },
  { id: 'inventory', label: '库存经营', description: '覆盖、滞销与低库存', ready: true },
  { id: 'customers', label: '消费人群倾向', description: '商品需求标签与人工复核', ready: true },
  { id: 'stores', label: '门店对比', description: '门店经营基线与比较', ready: true },
  { id: 'system', label: '数据与权限', description: 'POS 同步与管理权限', ready: true },
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
const maxDailyRevenue = computed(() => Math.max(1, ...(overview.value?.sales.current.dailySales.map((item) => item.revenue) ?? [1])));
const maxSalesTrend = computed(() => Math.max(1, ...(salesAnalysis.value?.trend.map((item) => item.revenue) ?? [1])));
const maxHourlyRevenue = computed(() => Math.max(1, ...(salesAnalysis.value?.hourlySales.map((item) => item.revenue) ?? [1])));

const money = (value: number) => new Intl.NumberFormat('zh-CN', {
  style: 'currency', currency: overview.value?.currency || 'NZD', maximumFractionDigits: 2,
}).format(value);
const number = (value: number) => new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 2 }).format(value);
const percent = (value: number | null) => value === null ? '暂无上月基数' : `${value >= 0 ? '+' : ''}${value}%`;
const comparisonClass = (value: number | null) => value === null ? 'neutral' : value >= 0 ? 'up' : 'down';
const dateTime = (value: string | null) => value ? new Date(value).toLocaleString('zh-CN') : '尚无记录';
const readinessLabel = (status: DataFoundation['domains'][number]['status']) => ({ READY: '可用', PARTIAL: '逐步完善', WAITING_FOR_DATA: '等待数据', BLOCKED: '缺少基础数据' }[status]);
const domainLabel = (code: string) => ({ OVERVIEW: '经营总览', INVENTORY_OPERATIONS: '库存经营', SALES: '销售数据' }[code] ?? code);

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
  try {
    const store = encodeURIComponent(props.storeId);
    if (managementAccess.value?.capabilities.posIssues) posCheck.value = await managementRequest<PosDataCheck>(`/management/pos-sync/check?storeId=${store}`);
    if (managementAccess.value?.capabilities.posSync) posStatus.value = await managementRequest<PosSyncStatus>(`/management/pos-sync/status?storeId=${store}`);
    if (managementAccess.value?.capabilities.posIssues) posIssues.value = await managementRequest<PosSyncIssues>(`/management/pos-sync/issues?storeId=${store}&page=1&pageSize=20`);
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : 'POS管理数据加载失败';
  } finally {
    posLoading.value = false;
  }
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
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : '商品与品牌分析加载失败';
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
  editingTagId.value = tag.id; newTagName.value = tag.name; newTagDimension.value = tag.dimension;
  newTagParentId.value = tag.parentId ?? ''; newTagDescription.value = tag.description ?? '';
  newTagSortOrder.value = tag.sortOrder; newTagStatus.value = tag.status;
}

function resetInsightTagEditor() {
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
watch(activeSection, (section) => {
  if (section === 'system') void loadPosManagement();
  if (section === 'sales') void loadSalesAnalysis();
  if (section === 'products') void loadProductsBrands();
  if (section === 'inventory') void loadInventoryOperations();
  if (section === 'stores') void loadStoreComparison();
  if (section === 'customers') void loadProductInsights();
});
onMounted(async () => { await loadManagementAccess(); if (canSection('overview')) await loadOverview(); });
</script>

<template>
  <section class="management-workspace">
    <aside class="management-sidebar">
      <div class="sidebar-heading">
        <p>MANAGEMENT</p>
        <strong>经营功能导航</strong>
        <small>选择下面的分析模块</small>
      </div>
      <nav aria-label="经营管理功能">
        <button v-for="section in sections" :key="section.id" type="button" :disabled="!canSection(section.id)" :class="{ active: activeSection === section.id, locked: !canSection(section.id) }" :title="canSection(section.id) ? section.description : '当前账号没有此模块权限'" @click="activeSection = section.id">
          <span>{{ section.label }}</span><small>{{ section.description }}</small><em v-if="!canSection(section.id)">无权限</em><em v-else-if="!section.ready">规划中</em>
        </button>
      </nav>
      <p>正式数据来自 Homi 数据库<br />POS 数据同步后自动更新</p>
    </aside>

    <main class="management-content">
    <header class="management-heading">
      <div><p>MANAGEMENT / {{ activeSection.toUpperCase() }}</p><h2>{{ currentSection.label }}</h2><span>{{ overview?.store.name || storeName }} · {{ currentSection.description }}</span></div>
      <div v-if="activeSection === 'overview'" class="management-filters"><label>统计月份<input v-model="month" type="month" /></label><button type="button" :disabled="loading" @click="loadOverview">{{ loading ? '加载中…' : '刷新数据' }}</button></div>
      <div v-else-if="activeSection === 'sales'" class="management-filters"><button type="button" :disabled="salesLoading" @click="loadSalesAnalysis">{{ salesLoading ? '加载中…' : '刷新销售' }}</button></div>
      <div v-else-if="activeSection === 'products'" class="management-filters"><button type="button" :disabled="productsLoading" @click="loadProductsBrands">{{ productsLoading ? '加载中…' : '刷新商品' }}</button></div>
      <div v-else-if="activeSection === 'inventory'" class="management-filters"><button type="button" :disabled="inventoryLoading" @click="loadInventoryOperations">{{ inventoryLoading ? '加载中…' : '刷新库存' }}</button></div>
      <div v-else-if="activeSection === 'stores'" class="management-filters"><button type="button" :disabled="storeLoading" @click="loadStoreComparison">{{ storeLoading ? '加载中…' : '刷新门店' }}</button></div>
      <div v-else-if="activeSection === 'customers'" class="management-filters"><button type="button" :disabled="insightLoading" @click="loadProductInsights">{{ insightLoading ? '加载中…' : '刷新标签' }}</button></div>
      <div v-else-if="activeSection === 'system'" class="management-filters"><button type="button" :disabled="posLoading || posRunning" @click="loadPosManagement">{{ posLoading ? '加载中…' : '刷新状态' }}</button></div>
    </header>

    <p v-if="error" class="management-alert error">{{ error }}</p>
    <template v-if="activeSection === 'overview'">
    <p v-if="overview && !overview.salesAvailable" class="management-alert pending"><strong>POS 销售数据尚未同步</strong><span>当前销售卡片显示为 0，库存与临期数据仍来自正式库存数据库，不会使用演示数据。</span></p>
    <p v-if="foundation" class="management-alert inventory-source"><strong>正式库存数据</strong><span>库存更新时间：{{ dateTime(foundation.quality.inventory.latestUpdatedAt) }}。盘库可以继续进行，页面会按数据库中的最新结果更新。</span></p>

    <template v-if="overview">
      <div class="management-kpis">
        <article><span>本月净销售额</span><strong>{{ money(overview.sales.current.netRevenue) }}</strong><small :class="comparisonClass(overview.sales.comparison.netRevenuePercent)">较上月 {{ percent(overview.sales.comparison.netRevenuePercent) }}</small></article>
        <article><span>本月订单</span><strong>{{ overview.sales.current.orderCount }}</strong><small :class="comparisonClass(overview.sales.comparison.orderCountPercent)">较上月 {{ percent(overview.sales.comparison.orderCountPercent) }}</small></article>
        <article><span>销售件数</span><strong>{{ number(overview.sales.current.unitsSold) }}</strong><small :class="comparisonClass(overview.sales.comparison.unitsSoldPercent)">较上月 {{ percent(overview.sales.comparison.unitsSoldPercent) }}</small></article>
        <article><span>平均客单价</span><strong>{{ money(overview.sales.current.averageOrderValue) }}</strong><small :class="comparisonClass(overview.sales.comparison.averageOrderValuePercent)">较上月 {{ percent(overview.sales.comparison.averageOrderValuePercent) }}</small></article>
        <article class="inventory-kpi"><span>当前库存</span><strong>{{ number(overview.inventory.totalQuantity) }} 件</strong><small>{{ overview.inventory.productCount }} 种商品 · {{ overview.inventory.batchCount }} 个批次</small></article>
        <article class="expiry-kpi"><span>到期关注</span><strong>{{ number(overview.inventory.expiryAttentionQuantity) }} 件</strong><small>已过期、紧急、预警及提前关注</small></article>
      </div>

      <section v-if="foundation" class="inventory-truth-panel">
        <div class="card-title"><div><h3>真实库存基础</h3><p>只统计当前正式数据库，不补充演示数据</p></div><span>{{ foundation.overallStatus === 'PARTIALLY_READY' ? '数据逐步完善中' : '盘库录入中' }}</span></div>
        <div class="inventory-truth-grid">
          <article>
            <span>库存覆盖</span><strong>{{ foundation.quality.inventory.productCount }} / {{ foundation.quality.catalog.productCount }} 种</strong>
            <small>已有正库存商品 / 已启用商品</small>
          </article>
          <article>
            <span>资料完整度</span>
            <div class="coverage-row"><small>品牌</small><b><i :style="{ width: `${foundation.quality.catalog.brandCoveragePercent}%` }"></i></b><em>{{ foundation.quality.catalog.brandCoveragePercent }}%</em></div>
            <div class="coverage-row"><small>品类</small><b><i :style="{ width: `${foundation.quality.catalog.categoryCoveragePercent}%` }"></i></b><em>{{ foundation.quality.catalog.categoryCoveragePercent }}%</em></div>
            <div class="coverage-row"><small>售价</small><b><i :style="{ width: `${foundation.quality.catalog.sellingPriceCoveragePercent}%` }"></i></b><em>{{ foundation.quality.catalog.sellingPriceCoveragePercent }}%</em></div>
          </article>
          <article>
            <span>本月库存作业</span><strong>{{ overview.inventory.activity.movementCountThisMonth }} 笔流水</strong>
            <small>其中盘点修正 {{ overview.inventory.activity.stocktakeAdjustmentsThisMonth }} 笔</small>
          </article>
          <article>
            <span>待提交入库单</span><strong>{{ overview.inventory.activity.openReceiptCount }} 单</strong>
            <small>最近库存流水：{{ dateTime(overview.inventory.activity.latestMovement?.createdAt ?? null) }}</small>
          </article>
        </div>
        <div class="readiness-list">
          <div v-for="domain in foundation.domains.filter((item) => ['OVERVIEW', 'INVENTORY_OPERATIONS', 'SALES'].includes(item.code))" :key="domain.code">
            <span>{{ domainLabel(domain.code) }}</span>
            <b :class="domain.status.toLowerCase()">{{ readinessLabel(domain.status) }}</b>
            <small>{{ domain.gaps[0] || '当前基础指标可以使用' }}</small>
          </div>
        </div>
        <p class="inventory-note">条码不是库存商品的必填条件；无条码奶粉整箱和手工建立的新品仍会正常计入库存。</p>
      </section>

      <div class="management-grid">
        <section class="management-card sales-trend">
          <div class="card-title"><div><h3>本月销售走势</h3><p>{{ overview.period.month }} 每日净销售概览</p></div><span>退款 {{ money(overview.sales.current.refunds) }}</span></div>
          <div v-if="overview.sales.current.dailySales.length" class="bar-chart">
            <div v-for="day in overview.sales.current.dailySales" :key="day.date" class="bar-column"><b :style="{ height: `${Math.max(5, day.revenue / maxDailyRevenue * 100)}%` }"><i>{{ money(day.revenue) }}</i></b><small>{{ day.date.slice(-2) }}日</small></div>
          </div>
          <p v-else class="management-empty">本月暂无已同步销售记录。</p>
        </section>

        <section class="management-card expiry-panel">
          <div class="card-title"><div><h3>库存临期预警</h3><p>按现有预警规则统计件数</p></div></div>
          <div class="expiry-grid"><div class="expired"><span>已过期</span><strong>{{ overview.inventory.expiry.expired }}</strong></div><div class="urgent"><span>紧急临期</span><strong>{{ overview.inventory.expiry.urgent }}</strong></div><div class="warning"><span>临期预警</span><strong>{{ overview.inventory.expiry.warning }}</strong></div><div class="early"><span>提前关注</span><strong>{{ overview.inventory.expiry.early }}</strong></div></div>
        </section>

        <section class="management-card ranking">
          <div class="card-title"><div><h3>热销商品</h3><p>按销售额排序</p></div></div>
          <ol v-if="overview.sales.current.topProducts.length"><li v-for="(item, index) in overview.sales.current.topProducts" :key="item.productName"><b>{{ index + 1 }}</b><span><strong>{{ item.productName }}</strong><small>{{ item.brandName }} · {{ number(item.quantity) }} 件</small></span><em>{{ money(item.revenue) }}</em></li></ol>
          <p v-else class="management-empty">POS 同步后将在这里显示商品排行。</p>
        </section>

        <section class="management-card ranking">
          <div class="card-title"><div><h3>品牌表现</h3><p>按销售额排序</p></div></div>
          <ol v-if="overview.sales.current.topBrands.length"><li v-for="(item, index) in overview.sales.current.topBrands" :key="item.brandName"><b>{{ index + 1 }}</b><span><strong>{{ item.brandName }}</strong><small>{{ number(item.quantity) }} 件</small></span><em>{{ money(item.revenue) }}</em></li></ol>
          <p v-else class="management-empty">POS 同步后将在这里显示品牌分析。</p>
        </section>
      </div>
      <p class="sync-note">最近 POS 同步：{{ overview.lastPosSyncAt ? new Date(overview.lastPosSyncAt).toLocaleString() : '尚无成功同步记录' }}</p>
    </template>
    </template>

    <section v-else-if="activeSection === 'sales'" class="sales-analysis-page">
      <form class="sales-filter-panel" @submit.prevent="loadSalesAnalysis">
        <label>开始日期<input v-model="salesFrom" type="date" /></label>
        <label>结束日期<input v-model="salesTo" type="date" /></label>
        <label>统计维度<select v-model="salesDimension"><option value="DAY">按日</option><option value="WEEK">按周</option><option value="MONTH">按月</option></select></label>
        <label>品牌<input v-model="salesBrand" placeholder="全部品牌" /></label>
        <label>品类<input v-model="salesCategory" placeholder="全部品类" /></label>
        <button type="submit" :disabled="salesLoading">{{ salesLoading ? '查询中…' : '查询销售' }}</button>
      </form>
      <p v-if="salesAnalysis?.channelNotice" class="management-alert pending"><strong>渠道说明</strong><span>{{ salesAnalysis.channelNotice }}</span></p>
      <p v-if="salesAnalysis?.refundNotice" class="management-alert pending"><strong>退款口径</strong><span>{{ salesAnalysis.refundNotice }}</span></p>

      <template v-if="salesAnalysis">
        <div class="sales-kpis">
          <article><span>净销售额</span><strong>{{ money(salesAnalysis.metrics.netRevenue) }}</strong><small :class="comparisonClass(salesAnalysis.comparison.netRevenuePercent)">较上期 {{ percent(salesAnalysis.comparison.netRevenuePercent) }}</small></article>
          <article><span>订单数</span><strong>{{ salesAnalysis.metrics.orderCount }}</strong><small :class="comparisonClass(salesAnalysis.comparison.orderCountPercent)">较上期 {{ percent(salesAnalysis.comparison.orderCountPercent) }}</small></article>
          <article><span>销售件数</span><strong>{{ number(salesAnalysis.metrics.unitsSold) }}</strong><small :class="comparisonClass(salesAnalysis.comparison.unitsSoldPercent)">较上期 {{ percent(salesAnalysis.comparison.unitsSoldPercent) }}</small></article>
          <article><span>平均客单价</span><strong>{{ money(salesAnalysis.metrics.averageOrderValue) }}</strong><small :class="comparisonClass(salesAnalysis.comparison.averageOrderValuePercent)">较上期 {{ percent(salesAnalysis.comparison.averageOrderValuePercent) }}</small></article>
          <article><span>退款金额</span><strong>{{ money(salesAnalysis.metrics.refunds) }}</strong><small>销售总额 {{ money(salesAnalysis.metrics.grossRevenue) }}</small></article>
        </div>

        <div class="sales-dashboard-grid">
          <section class="system-card sales-trend-card"><div class="card-title"><div><h3>销售趋势</h3><p>{{ salesAnalysis.period.from }} 至 {{ salesAnalysis.period.to }}</p></div></div><div v-if="salesAnalysis.trend.length" class="sales-line-bars"><div v-for="item in salesAnalysis.trend" :key="item.period"><b :style="{ height: `${Math.max(4, item.revenue / maxSalesTrend * 100)}%` }"><i>{{ money(item.revenue) }}</i></b><small>{{ item.period.slice(5) }}</small></div></div><p v-else class="system-empty">所选日期暂无POS销售数据。</p></section>
          <section class="system-card source-quality"><div class="card-title"><div><h3>数据质量</h3><p>当前查询范围内的POS明细</p></div></div><dl><div><dt>订单</dt><dd>{{ salesAnalysis.sourceQuality.orders }}</dd></div><div><dt>销售明细</dt><dd>{{ salesAnalysis.sourceQuality.activeItems }}</dd></div><div><dt>已映射明细</dt><dd>{{ salesAnalysis.sourceQuality.mappedItems }}</dd></div><div><dt>待复核明细</dt><dd>{{ salesAnalysis.sourceQuality.reviewRequiredItems }}</dd></div></dl></section>
          <section class="system-card hourly-card"><div class="card-title"><div><h3>销售时段</h3><p>按小时统计净销售额</p></div></div><div class="hour-bars"><div v-for="item in salesAnalysis.hourlySales" :key="item.hour"><b :style="{ height: `${Math.max(2, item.revenue / maxHourlyRevenue * 100)}%` }"></b><small>{{ String(item.hour).padStart(2, '0') }}</small></div></div></section>
          <section class="system-card sales-ranking"><div class="card-title"><div><h3>热销商品</h3><p>按商品销售金额排序</p></div></div><ol v-if="salesAnalysis.topProducts.length"><li v-for="(item,index) in salesAnalysis.topProducts.slice(0,10)" :key="item.productName"><b>{{ index + 1 }}</b><span><strong>{{ item.productName }}</strong><small>{{ item.brandName }} · {{ number(item.quantity) }} 件</small></span><em>{{ money(item.revenue) }}</em></li></ol><p v-else class="system-empty">暂无商品排行。</p></section>
          <section class="system-card sales-ranking"><div class="card-title"><div><h3>品牌与品类</h3><p>POS商品映射后的销售结构</p></div></div><ol v-if="salesAnalysis.topBrands.length"><li v-for="(item,index) in salesAnalysis.topBrands.slice(0,6)" :key="item.brandName"><b>{{ index + 1 }}</b><span><strong>{{ item.brandName }}</strong><small>{{ number(item.quantity) }} 件</small></span><em>{{ money(item.revenue) }}</em></li></ol><p v-else class="system-empty">商品映射后显示品牌排行。</p></section>
        </div>
      </template>
    </section>

    <section v-else-if="activeSection === 'products'" class="products-page">
      <form class="product-filter-panel" @submit.prevent="loadProductsBrands">
        <label>开始日期<input v-model="productFrom" type="date" /></label>
        <label>结束日期<input v-model="productTo" type="date" /></label>
        <label>商品搜索<input v-model="productQuery" placeholder="名称、SKU或条码" /></label>
        <label>品牌<input v-model="productBrand" placeholder="全部品牌" /></label>
        <label>品类<input v-model="productCategory" placeholder="全部品类" /></label>
        <button type="submit" :disabled="productsLoading">{{ productsLoading ? '查询中…' : '查询商品' }}</button>
      </form>
      <p v-if="productsBrands && !productsBrands.marginAvailable" class="management-alert pending"><strong>毛利暂不展示</strong><span>{{ productsBrands.marginNotice }}</span></p>
      <template v-if="productsBrands">
        <div class="product-kpis">
          <article><span>启用商品</span><strong>{{ productsBrands.summary.productCount }}</strong><small>所选条件下的正式商品</small></article>
          <article><span>有销售商品</span><strong>{{ productsBrands.summary.soldProductCount }}</strong><small>销售 {{ number(productsBrands.summary.unitsSold) }} 件</small></article>
          <article><span>商品销售额</span><strong>{{ money(productsBrands.summary.salesRevenue) }}</strong><small>{{ productFrom }} 至 {{ productTo }}</small></article>
          <article><span>当前库存</span><strong>{{ number(productsBrands.summary.currentInventory) }} 件</strong><small>来自正式库存表</small></article>
          <article><span>缺货/低库存</span><strong>{{ productsBrands.summary.lowStockProducts }}</strong><small>按现有最低库存配置判断</small></article>
        </div>
        <div class="product-analysis-grid">
          <section class="system-card product-ranking"><div class="card-title"><div><h3>品牌表现</h3><p>销售与当前库存关联</p></div></div><ol v-if="productsBrands.brands.length"><li v-for="(item,index) in productsBrands.brands.slice(0,10)" :key="item.name"><b>{{ index + 1 }}</b><span><strong>{{ item.name }}</strong><small>{{ item.productCount }} 种 · 销售 {{ number(item.unitsSold) }} 件 · 库存 {{ number(item.currentInventory) }} 件</small></span><em>{{ money(item.salesRevenue) }}</em></li></ol><p v-else class="system-empty">暂无品牌数据。</p></section>
          <section class="system-card product-ranking"><div class="card-title"><div><h3>品类结构</h3><p>按商品销售额排序</p></div></div><ol v-if="productsBrands.categories.length"><li v-for="(item,index) in productsBrands.categories.slice(0,10)" :key="item.name"><b>{{ index + 1 }}</b><span><strong>{{ item.name }}</strong><small>{{ item.productCount }} 种 · 销售 {{ number(item.unitsSold) }} 件</small></span><em>{{ money(item.salesRevenue) }}</em></li></ol><p v-else class="system-empty">暂无品类数据。</p></section>
          <section class="system-card source-quality"><div class="card-title"><div><h3>商品资料质量</h3><p>条码为可选项，不阻止无条码商品入库</p></div></div><dl><div><dt>品牌覆盖</dt><dd>{{ productsBrands.catalogQuality.brandCoveragePercent }}%</dd></div><div><dt>品类覆盖</dt><dd>{{ productsBrands.catalogQuality.categoryCoveragePercent }}%</dd></div><div><dt>条码覆盖</dt><dd>{{ productsBrands.catalogQuality.barcodeCoveragePercent }}%</dd></div><div><dt>POS映射覆盖</dt><dd>{{ productsBrands.mappingQuality.coveragePercent }}%</dd></div></dl></section>
        </div>
        <section class="system-card product-table-card">
          <div class="card-title"><div><h3>商品销售与库存明细</h3><p>销售来自POS，库存来自正式库存系统；比例不等同于标准库存周转率</p></div><span>{{ productsBrands.products.length }} 种</span></div>
          <div class="product-table-wrap"><table><thead><tr><th>商品</th><th>品牌 / 品类</th><th>销售件数</th><th>销售额</th><th>当前库存</th><th>销售/库存</th><th>库存状态</th></tr></thead><tbody><tr v-for="item in productsBrands.products" :key="item.productId"><td><strong>{{ item.productName }}</strong><small>{{ item.sku }}{{ item.barcode ? ` · ${item.barcode}` : ' · 无条码' }}</small></td><td><strong>{{ item.brandName }}</strong><small>{{ item.categoryName }}</small></td><td>{{ number(item.unitsSold) }}</td><td>{{ money(item.salesRevenue) }}</td><td>{{ number(item.currentInventory) }}</td><td>{{ item.salesToStockRatio === null ? '—' : number(item.salesToStockRatio) }}</td><td><b :class="['stock-badge', item.stockStatus.toLowerCase()]">{{ item.stockStatus === 'IN_STOCK' ? '正常' : item.stockStatus === 'LOW' ? '低库存' : '缺货' }}</b></td></tr></tbody></table><p v-if="!productsBrands.products.length" class="system-empty">当前筛选条件没有商品。</p></div>
        </section>
      </template>
    </section>

    <section v-else-if="activeSection === 'inventory'" class="inventory-operations-page">
      <form class="inventory-operation-filters" @submit.prevent="loadInventoryOperations">
        <label>销量观察期<select v-model.number="inventoryLookbackDays"><option :value="30">最近30天</option><option :value="60">最近60天</option><option :value="90">最近90天</option><option :value="180">最近180天</option><option :value="365">最近365天</option></select></label>
        <label>商品搜索<input v-model="inventoryQuery" placeholder="名称、品牌、SKU或条码" /></label>
        <button type="submit" :disabled="inventoryLoading">{{ inventoryLoading ? '分析中…' : '查询库存' }}</button>
      </form>
      <p v-if="inventoryOperations" class="management-alert pending"><strong>周转率口径</strong><span>{{ inventoryOperations.turnoverNotice }}</span></p>
      <template v-if="inventoryOperations">
        <div class="inventory-operation-kpis">
          <article><span>当前库存</span><strong>{{ number(inventoryOperations.summary.totalInventory) }} 件</strong><small>{{ inventoryOperations.summary.stockedProducts }} 种有库存商品</small></article>
          <article><span>缺货商品</span><strong>{{ inventoryOperations.summary.outOfStockProducts }}</strong><small>启用但当前库存为0</small></article>
          <article><span>低库存商品</span><strong>{{ inventoryOperations.summary.lowStockProducts }}</strong><small>达到已配置最低库存</small></article>
          <article><span>滞销关注</span><strong>{{ inventoryOperations.summary.slowMovingProducts }}</strong><small>有库存且销量不足</small></article>
          <article><span>观察商品</span><strong>{{ inventoryOperations.summary.productCount }}</strong><small>最近 {{ inventoryOperations.period.lookbackDays }} 天POS销量</small></article>
        </div>
        <div class="inventory-operation-grid">
          <section class="system-card coverage-card"><div class="card-title"><div><h3>库存覆盖结构</h3><p>{{ inventoryOperations.coverageNotice }}</p></div></div><div class="coverage-buckets"><article><span>无销售</span><strong>{{ inventoryOperations.coverageBuckets.noSales }}</strong></article><article><span>不足30天</span><strong>{{ inventoryOperations.coverageBuckets.under30 }}</strong></article><article><span>30–90天</span><strong>{{ inventoryOperations.coverageBuckets.days30To90 }}</strong></article><article><span>超过90天</span><strong>{{ inventoryOperations.coverageBuckets.over90 }}</strong></article></div></section>
          <section class="system-card inventory-alert-list"><div class="card-title"><div><h3>缺货与低库存</h3><p>优先处理需要补货的商品</p></div><span>{{ inventoryOperations.alerts.length }} 种</span></div><ol v-if="inventoryOperations.alerts.length"><li v-for="item in inventoryOperations.alerts.slice(0,10)" :key="item.productId"><span><strong>{{ item.productName }}</strong><small>{{ item.brandName }} · 最低库存 {{ item.minimumStock ?? '未配置' }}</small></span><em>{{ item.currentInventory }} 件</em></li></ol><p v-else class="system-empty">当前没有缺货或低库存提醒。</p></section>
          <section class="system-card inventory-alert-list"><div class="card-title"><div><h3>滞销库存</h3><p>有库存但观察期内销量不足</p></div><span>{{ inventoryOperations.slowMoving.length }} 种</span></div><ol v-if="inventoryOperations.slowMoving.length"><li v-for="item in inventoryOperations.slowMoving.slice(0,10)" :key="item.productId"><span><strong>{{ item.productName }}</strong><small>销售 {{ number(item.soldUnits) }} 件 · {{ item.coverageDays === null ? '观察期无销售' : `覆盖 ${number(item.coverageDays)} 天` }}</small></span><em>库存 {{ item.currentInventory }}</em></li></ol><p v-else class="system-empty">当前没有符合规则的滞销商品。</p></section>
        </div>
        <section class="system-card product-table-card"><div class="card-title"><div><h3>销售与库存关联明细</h3><p>当前库存、观察期销量和估算覆盖天数</p></div><span>{{ inventoryOperations.products.length }} 种</span></div><div class="product-table-wrap"><table><thead><tr><th>商品</th><th>库存</th><th>最低库存</th><th>观察期销量</th><th>日均销量</th><th>覆盖天数</th><th>最后销售</th><th>状态</th></tr></thead><tbody><tr v-for="item in inventoryOperations.products" :key="item.productId"><td><strong>{{ item.productName }}</strong><small>{{ item.brandName }} · {{ item.categoryName }}</small></td><td>{{ number(item.currentInventory) }}</td><td>{{ item.minimumStock ?? '未配置' }}</td><td>{{ number(item.soldUnits) }}</td><td>{{ number(item.dailyVelocity) }}</td><td>{{ item.coverageDays === null ? '无销量' : `${number(item.coverageDays)} 天` }}</td><td>{{ item.daysSinceLastSale === null ? '无记录' : `${item.daysSinceLastSale} 天前` }}</td><td><b :class="['stock-badge', item.stockStatus.toLowerCase()]">{{ item.stockStatus === 'IN_STOCK' ? (item.slowMoving ? '滞销关注' : '正常') : item.stockStatus === 'LOW' ? '低库存' : '缺货' }}</b></td></tr></tbody></table></div></section>
      </template>
    </section>

    <section v-else-if="activeSection === 'customers'" class="product-insight-page">
      <p v-if="productInsights" class="management-alert pending"><strong>分析口径</strong><span>{{ productInsights.disclaimer }}</span></p>
      <form class="insight-search" @submit.prevent="loadProductInsights"><label>商品搜索<input v-model="insightQuery" placeholder="商品名称、品牌或SKU" /></label><button type="submit" :disabled="insightLoading">{{ insightLoading ? '查询中…' : '查询商品' }}</button></form>
      <template v-if="productInsights">
        <div class="insight-kpis"><article><span>商品总数</span><strong>{{ productInsights.coverage.productCount }}</strong><small>当前筛选范围</small></article><article><span>已审核标记</span><strong>{{ productInsights.coverage.approvedProducts }}</strong><small>覆盖率 {{ productInsights.coverage.approvedCoveragePercent }}%</small></article><article><span>待复核</span><strong>{{ productInsights.coverage.pendingProducts }}</strong><small>不得直接用于正式分析</small></article><article><span>尚未标记</span><strong>{{ productInsights.coverage.untaggedProducts }}</strong><small>后续逐步人工补充</small></article></div>
        <section class="system-card taxonomy-card"><div class="card-title"><div><h3>小程序分类与经营标签</h3><p>小程序分类作为正式标签来源；点击标签可编辑、排序或停用</p></div><span>{{ productInsights.tags.length }} 个</span></div><div class="taxonomy-columns"><article v-for="dimension in productInsights.dimensions" :key="dimension.code"><h4>{{ dimension.name }}</h4><div class="taxonomy-list"><div v-for="root in productInsights.tagTree.filter(item => item.dimension === dimension.code)" :key="root.id" :class="{ inactive: root.status === 'INACTIVE' }"><button type="button" :disabled="!managementAccess?.capabilities.permissionsManage" @click="editInsightTag(root)"><strong>{{ root.name }}</strong><small>{{ root.source === 'MINIPROGRAM' ? `小程序分类 #${root.externalId}` : '人工标签' }} · {{ root.status === 'ACTIVE' ? '启用' : '已停用' }}</small></button><ul v-if="root.children.length"><li v-for="child in root.children" :key="child.id" :class="{ inactive: child.status === 'INACTIVE' }"><button type="button" :disabled="!managementAccess?.capabilities.permissionsManage" @click="editInsightTag(child)">{{ child.name }}</button></li></ul></div><p v-if="!productInsights.tagTree.some(item => item.dimension === dimension.code)">暂无标签</p></div></article></div></section>
        <section v-if="managementAccess?.capabilities.permissionsManage" class="system-card tag-definition-editor"><div class="card-title"><div><h3>{{ editingTagId ? '编辑标签' : '新增标签' }}</h3><p>由你定义名称、类型、上级、排序和启停状态，不需要填写技术代码</p></div><button v-if="editingTagId" type="button" class="editor-reset" @click="resetInsightTagEditor">取消编辑</button></div><div class="tag-definition-form"><label>标签名称<input v-model="newTagName" maxlength="120" placeholder="例如：中老年营养" /></label><label>标签类型<select v-model="newTagDimension"><option v-for="dimension in productInsights.dimensions" :key="dimension.code" :value="dimension.code">{{ dimension.name }}</option></select></label><label>上级分类<select v-model="newTagParentId"><option value="">无上级（一级标签）</option><option v-for="tag in productInsights.tags.filter(item => !item.parentId && item.id !== editingTagId)" :key="tag.id" :value="tag.id">{{ tag.name }}</option></select></label><label>说明<input v-model="newTagDescription" maxlength="255" placeholder="选填：这个标签的使用口径" /></label><label>排序<input v-model.number="newTagSortOrder" type="number" /></label><label>状态<select v-model="newTagStatus"><option value="ACTIVE">启用</option><option value="INACTIVE">停用</option></select></label><button type="button" :disabled="insightLoading || !newTagName.trim()" @click="saveInsightTag">{{ editingTagId ? '保存修改' : '新增标签' }}</button></div></section>
        <section v-if="managementAccess?.capabilities.permissionsManage" class="system-card insight-editor"><div class="card-title"><div><h3>人工标记商品倾向</h3><p>选择正式商品与启用标签，并填写判断依据</p></div></div><div class="insight-editor-form"><label>商品<select v-model="insightProductId"><option value="">请选择商品</option><option v-for="item in productInsights.products" :key="item.productId" :value="item.productId">{{ item.productName }}</option></select></label><label>标签<select v-model="insightTagCode"><option value="">请选择标签</option><optgroup v-for="dimension in productInsights.dimensions" :key="dimension.code" :label="dimension.name"><option v-for="tag in productInsights.tags.filter(item => item.dimension === dimension.code && item.status === 'ACTIVE')" :key="tag.code" :value="tag.code">{{ tag.parentId ? `${productInsights.tags.find(parent => parent.id === tag.parentId)?.name} / ` : '' }}{{ tag.name }}</option></optgroup></select></label><label>置信度<select v-model="insightConfidence"><option value="LOW">低</option><option value="MEDIUM">中</option><option value="HIGH">高</option></select></label><label class="evidence-field">判断依据<input v-model="insightEvidence" maxlength="255" placeholder="例如：商品明确标注儿童配方；鱼油主要对应心血管需求" /></label><button type="button" :disabled="insightLoading || !insightProductId || !insightTagCode" @click="assignInsightTag">保存标签</button></div><p v-if="insightMessage" class="insight-success">{{ insightMessage }}</p></section>
        <section class="system-card insight-product-list"><div class="card-title"><div><h3>商品标签覆盖</h3><p>仅已审核标签进入后续消费需求分析</p></div><span>{{ productInsights.products.length }} 种</span></div><div class="insight-products"><article v-for="item in productInsights.products" :key="item.productId"><div><strong>{{ item.productName }}</strong><small>{{ item.brandName }} · {{ item.categoryName }} · {{ item.sku }}</small></div><div class="insight-tags"><span v-for="assignment in item.assignments" :key="assignment.id" :class="assignment.reviewStatus.toLowerCase()"><b>{{ assignment.tag.name }}</b><small>{{ assignment.confidence === 'HIGH' ? '高' : assignment.confidence === 'MEDIUM' ? '中' : '低' }}置信度 · {{ assignment.reviewStatus === 'APPROVED' ? '已审核' : '待复核' }}</small></span><em v-if="!item.assignments.length">尚未标记</em></div></article></div></section>
      </template>
    </section>

    <section v-else-if="activeSection === 'stores'" class="store-comparison-page">
      <form class="store-comparison-filters" @submit.prevent="loadStoreComparison"><label>开始日期<input v-model="storeFrom" type="date" /></label><label>结束日期<input v-model="storeTo" type="date" /></label><button type="submit" :disabled="storeLoading">{{ storeLoading ? '查询中…' : '查询门店' }}</button></form>
      <p v-if="storeComparison?.comparisonNotice" class="management-alert pending"><strong>单店模式</strong><span>{{ storeComparison.comparisonNotice }}</span></p>
      <template v-if="storeComparison">
        <div class="store-kpis"><article><span>启用门店</span><strong>{{ storeComparison.storeCount }}</strong><small>{{ storeComparison.comparisonAvailable ? '已启用多店比较' : '当前为单店经营基线' }}</small></article><article><span>销售额</span><strong>{{ money(storeComparison.stores.reduce((sum,item) => sum + item.sales.netRevenue, 0)) }}</strong><small>{{ storeFrom }} 至 {{ storeTo }}</small></article><article><span>订单</span><strong>{{ storeComparison.stores.reduce((sum,item) => sum + item.sales.orderCount, 0) }}</strong><small>全部正式门店</small></article><article><span>库存</span><strong>{{ number(storeComparison.stores.reduce((sum,item) => sum + item.inventory.totalQuantity, 0)) }} 件</strong><small>正式库存余额</small></article></div>
        <div class="store-card-grid"><article v-for="item in storeComparison.stores" :key="item.store.id" class="system-card store-result-card" :class="{ selected: item.selected }"><div class="card-title"><div><h3>{{ item.store.name }}</h3><p>{{ item.store.code }}</p></div><span v-if="item.selected">当前门店</span></div><dl><div><dt>净销售额</dt><dd>{{ money(item.sales.netRevenue) }}</dd></div><div><dt>订单数</dt><dd>{{ item.sales.orderCount }}</dd></div><div><dt>平均客单价</dt><dd>{{ money(item.sales.averageOrderValue) }}</dd></div><div><dt>销售件数</dt><dd>{{ number(item.sales.unitsSold) }}</dd></div><div><dt>库存</dt><dd>{{ number(item.inventory.totalQuantity) }}</dd></div><div><dt>缺货 / 低库存</dt><dd>{{ item.inventory.outOfStockProducts }} / {{ item.inventory.lowStockProducts }}</dd></div></dl></article></div>
        <section class="system-card store-ranking-card"><div class="card-title"><div><h3>门店经营排行</h3><p>多门店时自动形成正式排行；单店时作为后续比较基线</p></div></div><div class="store-rankings"><div><h4>按净销售额</h4><ol><li v-for="(item,index) in storeComparison.ranking.byRevenue" :key="item.storeId"><b>{{ index + 1 }}</b><span>{{ item.storeName }}</span><em>{{ money(item.value) }}</em></li></ol></div><div><h4>按订单数</h4><ol><li v-for="(item,index) in storeComparison.ranking.byOrders" :key="item.storeId"><b>{{ index + 1 }}</b><span>{{ item.storeName }}</span><em>{{ number(item.value) }}</em></li></ol></div><div><h4>按库存量</h4><ol><li v-for="(item,index) in storeComparison.ranking.byInventory" :key="item.storeId"><b>{{ index + 1 }}</b><span>{{ item.storeName }}</span><em>{{ number(item.value) }} 件</em></li></ol></div></div></section>
      </template>
    </section>

    <section v-else-if="activeSection === 'system'" class="pos-management">
      <p v-if="posMessage" class="management-alert inventory-source"><strong>同步完成</strong><span>{{ posMessage }}</span></p>
      <p class="management-alert pending"><strong>观察模式</strong><span>手动同步只读取POS订单并写入观察区，不会直接扣减正式库存，也不需要操作POS收银机。</span></p>

      <section v-if="managementAccess" class="system-card access-summary-card"><div class="card-title"><div><h3>当前账号经营权限</h3><p>{{ managementAccess.administrator ? '管理员自动拥有全部经营权限' : `角色：${managementAccess.roleCodes.join('、')}` }}</p></div><span>{{ managementAccess.grantedPermissionCodes.length }} 项</span></div><div class="access-capabilities"><b :class="{ granted: managementAccess.capabilities.overviewView }">经营总览</b><b :class="{ granted: managementAccess.capabilities.salesView }">销售与商品</b><b :class="{ granted: managementAccess.capabilities.inventoryView }">库存经营</b><b :class="{ granted: managementAccess.capabilities.posSync }">POS同步</b><b :class="{ granted: managementAccess.capabilities.posIssues }">异常记录</b><b :class="{ granted: managementAccess.capabilities.permissionsManage }">权限管理</b></div></section>

      <div class="pos-status-grid">
        <article><span>同步状态</span><strong :class="posStatus?.running ? 'status-running' : 'status-ok'">{{ posStatus?.running ? '正在同步' : '空闲' }}</strong><small>最近成功或失败结果见下方记录</small></article>
        <article><span>POS订单</span><strong>{{ posCheck?.orders.total ?? 0 }}</strong><small>最近订单：{{ dateTime(posCheck?.orders.lastOrderedAt ?? null) }}</small></article>
        <article><span>商品映射率</span><strong>{{ posCheck?.items.mappingCoveragePercent ?? 0 }}%</strong><small>{{ posCheck?.items.mapped ?? 0 }} / {{ posCheck?.items.total ?? 0 }} 条销售明细已关联</small></article>
        <article><span>待处理异常</span><strong class="status-warning">{{ posCheck?.issues.total ?? 0 }}</strong><small>商品、退款和人工复核事项</small></article>
      </div>

      <div class="pos-system-grid">
        <section v-if="managementAccess?.capabilities.posSync" class="system-card manual-sync-card">
          <div class="card-title"><div><h3>手动同步POS订单</h3><p>选择营业日期，由当前服务器主动读取POS接口</p></div></div>
          <label>营业日期<input v-model="syncDate" type="date" :disabled="posRunning || posStatus?.running" /></label>
          <label class="reconcile-option"><input v-model="reconcile" type="checkbox" :disabled="posRunning || posStatus?.running" /><span><strong>重新核对当天订单</strong><small>退款、取消或订单状态发生变化时使用；日常同步无需勾选。</small></span></label>
          <button type="button" :disabled="posRunning || posStatus?.running || !syncDate" @click="runManualSync">{{ posRunning ? '正在同步…' : '开始同步' }}</button>
          <p>同步不会直接调整库存。同步完成后先处理未映射商品和退款异常，再进入后续库存扣减流程。</p>
        </section>

        <section v-if="managementAccess?.capabilities.posIssues" class="system-card health-check-card">
          <div class="card-title"><div><h3>数据检查</h3><p>检查时间：{{ dateTime(posCheck?.checkedAt ?? null) }}</p></div><span>{{ posCheck?.readiness === 'READY' ? '可用于分析' : posCheck?.readiness === 'NEEDS_REVIEW' ? '需要处理' : '等待数据' }}</span></div>
          <ul><li v-for="check in posCheck?.checks ?? []" :key="check.code"><b :class="check.passed ? 'pass' : 'fail'">{{ check.passed ? '✓' : '!' }}</b><span>{{ check.message }}</span></li></ul>
        </section>
      </div>

      <section v-if="managementAccess?.capabilities.posIssues" class="system-card issue-card">
        <div class="card-title"><div><h3>异常记录</h3><p>未映射商品、需复核商品与待处理退款</p></div><span>{{ posIssues?.summary.itemIssues ?? 0 }} 项商品 · {{ posIssues?.summary.pendingRefunds ?? 0 }} 笔退款</span></div>
        <div class="issue-table-wrap">
          <table v-if="posIssues?.itemIssues.items.length"><thead><tr><th>订单</th><th>时间</th><th>POS商品</th><th>数量</th><th>类型</th><th>原因</th></tr></thead><tbody><tr v-for="item in posIssues.itemIssues.items" :key="item.id"><td>{{ item.orderNo }}</td><td>{{ dateTime(item.orderedAt) }}</td><td><strong>{{ item.productName || '未命名商品' }}</strong><small>{{ item.externalProductId }}{{ item.barcode ? ` · ${item.barcode}` : '' }}</small></td><td>{{ item.quantity }}</td><td>{{ item.disposition === 'UNMAPPED' ? '未映射' : '需复核' }}</td><td>{{ item.reason || '—' }}</td></tr></tbody></table>
          <p v-else class="system-empty">当前没有未映射或需复核的销售商品。</p>
        </div>
        <div v-if="posIssues?.pendingRefunds.items.length" class="refund-list"><article v-for="refund in posIssues.pendingRefunds.items" :key="refund.id"><strong>订单 {{ refund.orderNo }}</strong><span>退款 {{ money(Number(refund.amount)) }}</span><small>{{ refund.reason }}</small></article></div>
      </section>

      <section v-if="managementAccess?.capabilities.posSync" class="system-card history-card">
        <div class="card-title"><div><h3>最近同步历史</h3><p>保留最近20次运行结果</p></div><span>游标：{{ dateTime(posStatus?.cursor?.lastSourceTimestamp ?? null) }}</span></div>
        <div class="sync-history" v-if="posStatus?.history.length"><article v-for="run in posStatus.history" :key="run.id"><b :class="run.status.toLowerCase()">{{ run.status === 'SUCCEEDED' ? '成功' : run.status === 'FAILED' ? '失败' : '运行中' }}</b><span><strong>{{ run.requestedFrom || '未指定日期' }}</strong><small>{{ dateTime(run.startedAt) }} · 订单 {{ run.ordersObserved }} · 明细 {{ run.itemsObserved }} · 异常 {{ run.exceptionsCount }}</small></span><em>{{ run.errorMessage || `新增 ${run.ordersInserted}，更新 ${run.ordersUpdated}，跳过 ${run.ordersSkipped}` }}</em></article></div>
        <p v-else class="system-empty">尚无POS同步运行记录。</p>
      </section>
    </section>

    <section v-else class="planned-section">
      <div class="planned-icon">◫</div>
      <p>MODULE STRUCTURE READY</p>
      <h3>{{ currentSection.label }}</h3>
      <span>{{ currentSection.description }}已经作为独立功能区预留。接入对应数据接口后，这里会展示专属图表、筛选条件和明细表，不会继续堆放到经营总览。</span>
    </section>
    </main>
  </section>
</template>

<style scoped>
.management-workspace{display:grid;grid-template-columns:230px minmax(0,1fr);gap:18px;color:#17243a}.management-sidebar{display:flex;flex-direction:column;min-height:720px;padding:18px 12px;border:1px solid #dce8f7;border-radius:22px;background:linear-gradient(180deg,#13243f,#0d1a30);box-shadow:0 18px 45px rgb(28 52 89 / 15%)}.sidebar-heading{display:grid;gap:5px;padding:8px 10px 18px;color:#fff}.sidebar-heading strong{font-size:20px}.sidebar-heading small{overflow:hidden;color:#9eb2d0;text-overflow:ellipsis;white-space:nowrap}.management-sidebar nav{display:grid;gap:5px}.management-sidebar button{position:relative;display:grid;gap:3px;width:100%;padding:12px;border:0;border-radius:13px;color:#dbe8fa;background:transparent;text-align:left}.management-sidebar button span{font-weight:850}.management-sidebar button small{color:#8fa4c2;font-size:11px}.management-sidebar button em{position:absolute;top:10px;right:9px;padding:2px 5px;border-radius:7px;color:#93a7c5;background:rgb(255 255 255 / 8%);font-size:9px;font-style:normal}.management-sidebar button.locked{opacity:.48;cursor:not-allowed}.management-sidebar button.locked em{color:#ffd8a8;background:rgb(255 174 66 / 12%)}.management-sidebar button.active{color:#fff;background:linear-gradient(135deg,#1eb6ed,#3868f4);box-shadow:0 10px 22px rgb(26 103 226 / 28%)}.management-sidebar button.active small,.management-sidebar button.active em{color:#eaf6ff}.management-sidebar>p{margin:auto 8px 4px;color:#7187a8;font-size:10px;line-height:1.7}.management-content{display:grid;align-content:start;gap:18px;min-width:0}.management-heading{display:flex;align-items:end;justify-content:space-between;gap:24px;padding:24px 26px;border:1px solid #dce8f7;border-radius:24px;background:linear-gradient(135deg,#f8fcff,#eef5ff 55%,#eefbf8);box-shadow:0 18px 45px rgb(46 88 145 / 10%)}.management-heading p{margin:0 0 5px;color:#2188f3;font-size:12px;font-weight:900;letter-spacing:.15em}.management-heading h2{margin:0;font-size:30px}.management-heading span{display:block;margin-top:6px;color:#6d7b91}.management-filters{display:flex;align-items:end;gap:10px}.management-filters label{display:grid;gap:6px;color:#69778d;font-size:12px;font-weight:800}.management-filters input,.management-filters button{min-height:42px;border:1px solid #cfddf0;border-radius:12px;background:#fff;padding:0 14px;font:inherit}.management-filters button{color:#fff;border:0;background:linear-gradient(135deg,#17b8f4,#3567f4);font-weight:850}.management-alert{display:flex;gap:8px;padding:15px 18px;border-radius:16px}.management-alert span{color:#59677b}.management-alert.pending{background:#fff8df;border:1px solid #f4d982}.management-alert.error{color:#9c2f38;background:#fff0f1;border:1px solid #f2bcc1}.management-kpis{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:12px}.management-kpis article{display:grid;gap:8px;min-height:120px;padding:18px;border:1px solid #dfebf8;border-radius:19px;background:linear-gradient(145deg,#fff,#f4f8ff);box-shadow:0 12px 28px rgb(43 75 120 / 8%)}.management-kpis span{color:#68778d;font-size:13px;font-weight:800}.management-kpis strong{font-size:25px}.management-kpis small{color:#728097}.management-kpis .up{color:#159766}.management-kpis .down{color:#d3535a}.management-kpis .inventory-kpi{background:linear-gradient(145deg,#ecf6ff,#eaf2ff)}.management-kpis .expiry-kpi{background:linear-gradient(145deg,#fff7ec,#fff0f1)}.management-grid{display:grid;grid-template-columns:1.35fr .65fr;gap:16px}.management-card{min-height:280px;padding:22px;border:1px solid #dfe9f6;border-radius:22px;background:rgb(255 255 255 / 92%);box-shadow:0 14px 35px rgb(39 73 116 / 9%)}.card-title{display:flex;justify-content:space-between;gap:12px}.card-title h3{margin:0;font-size:19px}.card-title p{margin:5px 0 0;color:#8290a3;font-size:13px}.card-title>span{color:#d05b68;font-weight:750}.bar-chart{display:flex;align-items:end;gap:8px;height:210px;margin-top:20px;padding:20px 8px 0;border-bottom:1px solid #dce5f1;overflow-x:auto}.bar-column{display:grid;align-items:end;gap:7px;min-width:28px;height:100%;text-align:center}.bar-column b{position:relative;display:block;min-height:5px;border-radius:7px 7px 2px 2px;background:linear-gradient(180deg,#24b9ef,#4264f0)}.bar-column i{display:none;position:absolute;bottom:calc(100% + 5px);left:50%;transform:translateX(-50%);padding:4px 6px;border-radius:6px;color:#fff;background:#17243a;font-size:10px;font-style:normal;white-space:nowrap}.bar-column:hover i{display:block}.bar-column small{font-size:10px;color:#8390a2}.expiry-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:24px}.expiry-grid div{display:grid;gap:8px;padding:18px;border-radius:16px}.expiry-grid strong{font-size:27px}.expired{color:#a8444e;background:#fff0f1}.urgent{color:#b46623;background:#fff3e5}.warning{color:#947112;background:#fff9dc}.early{color:#277493;background:#eaf8ff}.ranking ol{display:grid;gap:5px;margin:16px 0 0;padding:0;list-style:none}.ranking li{display:grid;grid-template-columns:30px 1fr auto;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid #edf1f6}.ranking li>b{display:grid;place-items:center;width:26px;height:26px;border-radius:8px;color:#2878ec;background:#e8f2ff}.ranking li span{display:grid;gap:3px;min-width:0}.ranking li span strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.ranking li small{color:#8490a0}.ranking li em{color:#25334a;font-style:normal;font-weight:850}.management-empty{display:grid;place-items:center;min-height:190px;color:#8995a6}.sync-note{margin:0;color:#8490a0;font-size:12px;text-align:right}.planned-section{display:grid;place-items:center;min-height:520px;padding:50px;border:1px dashed #bfd0e8;border-radius:24px;background:linear-gradient(145deg,#fbfdff,#f2f7ff);text-align:center}.planned-icon{display:grid;width:62px;height:62px;place-items:center;border-radius:18px;color:#fff;background:linear-gradient(135deg,#17b8f4,#3567f4);font-size:28px}.planned-section>p{margin:18px 0 5px;color:#3381e5;font-size:11px;font-weight:900;letter-spacing:.14em}.planned-section h3{margin:0;font-size:28px}.planned-section>span{max-width:650px;margin:12px 0 25px;color:#6b7b91;line-height:1.7}.planned-modules{display:flex;justify-content:center;flex-wrap:wrap;gap:9px}.planned-modules b{padding:9px 13px;border:1px solid #d6e3f4;border-radius:999px;color:#53667f;background:#fff;font-size:12px}
.management-workspace{align-items:stretch;min-height:calc(100dvh - 112px)}
.management-sidebar{min-height:0}
.sidebar-heading{gap:4px;margin:0 8px 12px;padding:8px 2px 18px;border-bottom:1px solid rgb(255 255 255 / 12%)}
.sidebar-heading p{margin:0;color:#58a8ff;font-size:10px;font-weight:900;letter-spacing:.14em}
.sidebar-heading strong{font-size:18px}
.sidebar-heading small{color:#8298b9;white-space:nowrap}
.management-content{grid-template-rows:auto minmax(0,1fr);min-height:100%}
.planned-section{height:100%}
.management-alert.inventory-source{border:1px solid #a7dfd0;color:#176d5d;background:#effbf7}.inventory-truth-panel{display:grid;gap:18px;padding:22px;border:1px solid #d7e7f5;border-radius:22px;background:linear-gradient(145deg,#fff,#f2f9ff 62%,#effbf7);box-shadow:0 14px 35px rgb(39 73 116 / 8%)}.inventory-truth-panel>.card-title>span{color:#21876f}.inventory-truth-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.inventory-truth-grid article{display:grid;align-content:start;gap:9px;min-height:128px;padding:17px;border:1px solid #dce8f4;border-radius:17px;background:rgb(255 255 255 / 88%)}.inventory-truth-grid article>span{color:#63748b;font-size:13px;font-weight:850}.inventory-truth-grid article>strong{font-size:23px}.inventory-truth-grid article>small{color:#7b899c;line-height:1.5}.coverage-row{display:grid;grid-template-columns:32px minmax(40px,1fr) 42px;align-items:center;gap:7px}.coverage-row small{color:#728198}.coverage-row b{display:block;height:7px;overflow:hidden;border-radius:999px;background:#e6edf6}.coverage-row i{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,#21b9e9,#3d6cf1)}.coverage-row em{color:#506078;font-size:11px;font-style:normal;text-align:right}.readiness-list{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.readiness-list>div{display:grid;grid-template-columns:1fr auto;gap:5px 10px;padding:13px 15px;border-radius:14px;background:#f7faff}.readiness-list span{font-weight:850}.readiness-list b{padding:3px 7px;border-radius:999px;font-size:10px}.readiness-list b.ready{color:#167a5e;background:#dcf6ec}.readiness-list b.partial{color:#2871c8;background:#e6f1ff}.readiness-list b.waiting_for_data{color:#9a6b16;background:#fff2cc}.readiness-list b.blocked{color:#a3444d;background:#ffe6e8}.readiness-list small{grid-column:1/-1;color:#7a889b;line-height:1.45}.inventory-note{margin:0;padding-top:2px;color:#67788e;font-size:12px}
.pos-management{display:grid;align-content:start;gap:16px}.pos-status-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.pos-status-grid article,.system-card{border:1px solid #dce8f5;border-radius:20px;background:rgb(255 255 255 / 94%);box-shadow:0 12px 30px rgb(39 73 116 / 8%)}.pos-status-grid article{display:grid;gap:8px;min-height:116px;padding:18px}.pos-status-grid span{color:#69788d;font-size:13px;font-weight:800}.pos-status-grid strong{font-size:25px}.pos-status-grid small{color:#7e8b9d}.status-ok{color:#168264}.status-running{color:#2875d7}.status-warning{color:#bd6a22}.pos-system-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:16px}.system-card{padding:21px}.manual-sync-card{display:grid;align-content:start;gap:14px}.manual-sync-card>label:not(.reconcile-option){display:grid;gap:7px;color:#617187;font-size:12px;font-weight:850}.manual-sync-card input[type=date]{min-height:44px;padding:0 12px;border:1px solid #d4e0ef;border-radius:12px;background:#f9fbfe;font:inherit}.manual-sync-card>button{min-height:46px;border:0;border-radius:13px;color:#fff;background:linear-gradient(135deg,#18b6ef,#3769f3);font-weight:850}.manual-sync-card>button:disabled{opacity:.55}.manual-sync-card>p{margin:0;color:#78879a;font-size:12px;line-height:1.55}.reconcile-option{display:flex;align-items:flex-start;gap:10px;padding:12px;border-radius:13px;background:#f4f8fd}.reconcile-option input{margin-top:3px}.reconcile-option span{display:grid;gap:3px}.reconcile-option small{color:#7b899d;line-height:1.45}.health-check-card ul{display:grid;gap:9px;margin:18px 0 0;padding:0;list-style:none}.health-check-card li{display:flex;align-items:center;gap:10px;padding:10px;border-radius:12px;background:#f7faff}.health-check-card li b{display:grid;flex:0 0 auto;width:25px;height:25px;place-items:center;border-radius:8px}.health-check-card li b.pass{color:#197a61;background:#dcf6ec}.health-check-card li b.fail{color:#a6641e;background:#fff0d6}.issue-card,.history-card{display:grid;gap:15px}.issue-table-wrap{max-width:100%;overflow-x:auto}.issue-table-wrap table{width:100%;min-width:820px;border-collapse:collapse}.issue-table-wrap th,.issue-table-wrap td{padding:11px 10px;border-bottom:1px solid #e9eff6;text-align:left}.issue-table-wrap td>strong,.issue-table-wrap td>small{display:block}.issue-table-wrap td>small{margin-top:3px;color:#8290a2}.system-empty{display:grid;min-height:100px;place-items:center;margin:0;color:#8491a3}.refund-list{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px}.refund-list article{display:grid;gap:5px;padding:12px;border-radius:13px;background:#fff2f3}.refund-list span{color:#bd4b55;font-weight:850}.refund-list small{color:#7d899a}.sync-history{display:grid;gap:8px}.sync-history article{display:grid;grid-template-columns:68px minmax(200px,1fr) minmax(180px,.8fr);align-items:center;gap:12px;padding:12px;border-radius:13px;background:#f7faff}.sync-history article>b{padding:6px 8px;border-radius:9px;font-size:11px;text-align:center}.sync-history b.succeeded{color:#14795c;background:#dcf6ec}.sync-history b.failed{color:#a44049;background:#ffe7e9}.sync-history b.running{color:#276fc5;background:#e6f1ff}.sync-history article>span{display:grid;gap:3px}.sync-history small,.sync-history em{color:#7d899b;font-size:11px;font-style:normal}.sync-history em{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.access-summary-card{display:grid;gap:14px}.access-capabilities{display:flex;flex-wrap:wrap;gap:8px}.access-capabilities b{padding:8px 11px;border-radius:999px;color:#8a96a7;background:#eef2f6;font-size:12px}.access-capabilities b.granted{color:#146f5a;background:#dcf6ec}
.sales-analysis-page{display:grid;align-content:start;gap:16px}.sales-filter-panel{display:grid;grid-template-columns:repeat(5,minmax(120px,1fr)) auto;align-items:end;gap:10px;padding:17px;border:1px solid #dce8f5;border-radius:19px;background:rgb(255 255 255 / 94%)}.sales-filter-panel label{display:grid;gap:6px;color:#68788e;font-size:12px;font-weight:850}.sales-filter-panel input,.sales-filter-panel select{width:100%;min-width:0;min-height:42px;padding:0 11px;border:1px solid #d4e0ef;border-radius:11px;background:#f9fbfe;font:inherit}.sales-filter-panel button{min-height:42px;padding:0 17px;border:0;border-radius:11px;color:#fff;background:linear-gradient(135deg,#18b6ef,#3769f3);font-weight:850;white-space:nowrap}.sales-kpis{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:11px}.sales-kpis article{display:grid;gap:8px;min-height:114px;padding:17px;border:1px solid #dce8f5;border-radius:18px;background:linear-gradient(145deg,#fff,#f4f8ff)}.sales-kpis span{color:#68778c;font-size:13px;font-weight:850}.sales-kpis strong{font-size:23px}.sales-kpis small{color:#7d899b}.sales-kpis small.up{color:#16815f}.sales-kpis small.down{color:#bf4f58}.sales-dashboard-grid{display:grid;grid-template-columns:1.35fr .65fr;gap:15px}.sales-trend-card{min-height:320px}.sales-line-bars{display:flex;align-items:end;gap:8px;height:235px;margin-top:17px;padding-top:18px;border-bottom:1px solid #dce5f1;overflow-x:auto}.sales-line-bars>div{display:grid;align-items:end;gap:6px;min-width:34px;height:100%;text-align:center}.sales-line-bars b{position:relative;display:block;min-height:4px;border-radius:7px 7px 2px 2px;background:linear-gradient(180deg,#20b6ed,#3c68f0)}.sales-line-bars i{display:none;position:absolute;bottom:calc(100% + 4px);left:50%;z-index:2;transform:translateX(-50%);padding:4px 6px;border-radius:6px;color:#fff;background:#17243a;font-size:10px;font-style:normal;white-space:nowrap}.sales-line-bars b:hover i{display:block}.sales-line-bars small{color:#7f8ca0;font-size:10px}.source-quality dl{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:18px 0 0}.source-quality dl>div{display:grid;gap:6px;padding:15px;border-radius:14px;background:#f3f7fc}.source-quality dt{color:#748398;font-size:12px}.source-quality dd{margin:0;font-size:24px;font-weight:850}.hourly-card{grid-column:1/-1}.hour-bars{display:flex;align-items:end;gap:5px;height:150px;margin-top:15px;border-bottom:1px solid #dce5f1}.hour-bars>div{display:grid;align-items:end;gap:5px;min-width:20px;width:100%;height:100%;text-align:center}.hour-bars b{display:block;min-height:2px;border-radius:4px 4px 1px 1px;background:linear-gradient(180deg,#5ad4b2,#2688e9)}.hour-bars small{color:#8491a2;font-size:9px}.sales-ranking ol{display:grid;gap:5px;margin:14px 0 0;padding:0;list-style:none}.sales-ranking li{display:grid;grid-template-columns:27px minmax(0,1fr) auto;align-items:center;gap:9px;padding:9px 0;border-bottom:1px solid #edf1f6}.sales-ranking li>b{display:grid;width:25px;height:25px;place-items:center;border-radius:8px;color:#2878ec;background:#e8f2ff}.sales-ranking li span{display:grid;gap:3px;min-width:0}.sales-ranking li span strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.sales-ranking li small{color:#8290a2}.sales-ranking li em{font-style:normal;font-weight:850}
.products-page{display:grid;align-content:start;gap:16px}.product-filter-panel{display:grid;grid-template-columns:repeat(5,minmax(120px,1fr)) auto;align-items:end;gap:10px;padding:17px;border:1px solid #dce8f5;border-radius:19px;background:rgb(255 255 255 / 94%)}.product-filter-panel label{display:grid;gap:6px;color:#68788e;font-size:12px;font-weight:850}.product-filter-panel input{width:100%;min-width:0;min-height:42px;padding:0 11px;border:1px solid #d4e0ef;border-radius:11px;background:#f9fbfe;font:inherit}.product-filter-panel button{min-height:42px;padding:0 17px;border:0;border-radius:11px;color:#fff;background:linear-gradient(135deg,#18b6ef,#3769f3);font-weight:850}.product-kpis{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:11px}.product-kpis article{display:grid;gap:8px;min-height:112px;padding:17px;border:1px solid #dce8f5;border-radius:18px;background:linear-gradient(145deg,#fff,#f4f8ff)}.product-kpis span{color:#68778c;font-size:13px;font-weight:850}.product-kpis strong{font-size:23px}.product-kpis small{color:#7d899b}.product-analysis-grid{display:grid;grid-template-columns:1fr 1fr .8fr;gap:15px}.product-ranking ol{display:grid;gap:5px;margin:14px 0 0;padding:0;list-style:none}.product-ranking li{display:grid;grid-template-columns:27px minmax(0,1fr) auto;align-items:center;gap:9px;padding:9px 0;border-bottom:1px solid #edf1f6}.product-ranking li>b{display:grid;width:25px;height:25px;place-items:center;border-radius:8px;color:#2878ec;background:#e8f2ff}.product-ranking li span{display:grid;gap:3px;min-width:0}.product-ranking li span strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.product-ranking li small{color:#8290a2}.product-ranking li em{font-style:normal;font-weight:850}.product-table-card{display:grid;gap:15px}.product-table-wrap{max-width:100%;overflow-x:auto}.product-table-wrap table{width:100%;min-width:920px;border-collapse:collapse}.product-table-wrap th,.product-table-wrap td{padding:11px 10px;border-bottom:1px solid #e9eff6;text-align:left}.product-table-wrap td>strong,.product-table-wrap td>small{display:block}.product-table-wrap td>small{margin-top:3px;color:#8290a2}.stock-badge{display:inline-block;padding:5px 8px;border-radius:999px;font-size:11px}.stock-badge.in_stock{color:#14795c;background:#dcf6ec}.stock-badge.low{color:#a6641e;background:#fff0d6}.stock-badge.out_of_stock{color:#a44049;background:#ffe7e9}
.inventory-operations-page{display:grid;align-content:start;gap:16px}.inventory-operation-filters{display:grid;grid-template-columns:minmax(160px,.5fr) minmax(240px,1.5fr) auto;align-items:end;gap:10px;padding:17px;border:1px solid #dce8f5;border-radius:19px;background:rgb(255 255 255 / 94%)}.inventory-operation-filters label{display:grid;gap:6px;color:#68788e;font-size:12px;font-weight:850}.inventory-operation-filters input,.inventory-operation-filters select{width:100%;min-width:0;min-height:42px;padding:0 11px;border:1px solid #d4e0ef;border-radius:11px;background:#f9fbfe;font:inherit}.inventory-operation-filters button{min-height:42px;padding:0 18px;border:0;border-radius:11px;color:#fff;background:linear-gradient(135deg,#18b6ef,#3769f3);font-weight:850}.inventory-operation-kpis{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:11px}.inventory-operation-kpis article{display:grid;gap:8px;min-height:112px;padding:17px;border:1px solid #dce8f5;border-radius:18px;background:linear-gradient(145deg,#fff,#f4f8ff)}.inventory-operation-kpis span{color:#68778c;font-size:13px;font-weight:850}.inventory-operation-kpis strong{font-size:23px}.inventory-operation-kpis small{color:#7d899b}.inventory-operation-grid{display:grid;grid-template-columns:.8fr 1fr 1fr;gap:15px}.coverage-buckets{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:16px}.coverage-buckets article{display:grid;gap:6px;padding:14px;border-radius:14px;background:#f3f7fc}.coverage-buckets span{color:#718097;font-size:12px}.coverage-buckets strong{font-size:24px}.inventory-alert-list ol{display:grid;gap:4px;margin:14px 0 0;padding:0;list-style:none}.inventory-alert-list li{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:center;padding:10px 0;border-bottom:1px solid #edf1f6}.inventory-alert-list li span{display:grid;gap:3px;min-width:0}.inventory-alert-list li strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.inventory-alert-list li small{color:#8290a2}.inventory-alert-list li em{color:#2b4261;font-style:normal;font-weight:850;white-space:nowrap}
.store-comparison-page{display:grid;align-content:start;gap:16px}.store-comparison-filters{display:grid;grid-template-columns:minmax(160px,1fr) minmax(160px,1fr) auto;align-items:end;gap:10px;padding:17px;border:1px solid #dce8f5;border-radius:19px;background:rgb(255 255 255 / 94%)}.store-comparison-filters label{display:grid;gap:6px;color:#68788e;font-size:12px;font-weight:850}.store-comparison-filters input{min-height:42px;padding:0 11px;border:1px solid #d4e0ef;border-radius:11px;background:#f9fbfe;font:inherit}.store-comparison-filters button{min-height:42px;padding:0 18px;border:0;border-radius:11px;color:#fff;background:linear-gradient(135deg,#18b6ef,#3769f3);font-weight:850}.store-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:11px}.store-kpis article{display:grid;gap:8px;min-height:112px;padding:17px;border:1px solid #dce8f5;border-radius:18px;background:linear-gradient(145deg,#fff,#f4f8ff)}.store-kpis span{color:#68778c;font-size:13px;font-weight:850}.store-kpis strong{font-size:23px}.store-kpis small{color:#7d899b}.store-card-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:15px}.store-result-card.selected{border-color:#76baff;background:linear-gradient(145deg,#fff,#edf6ff)}.store-result-card dl{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin:18px 0 0}.store-result-card dl>div{display:grid;gap:5px;padding:13px;border-radius:13px;background:#f4f8fd}.store-result-card dt{color:#738198;font-size:11px}.store-result-card dd{margin:0;font-size:18px;font-weight:850}.store-ranking-card{display:grid;gap:14px}.store-rankings{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}.store-rankings>div{padding:14px;border-radius:14px;background:#f5f8fc}.store-rankings h4{margin:0 0 10px}.store-rankings ol{display:grid;gap:8px;margin:0;padding:0;list-style:none}.store-rankings li{display:grid;grid-template-columns:25px minmax(0,1fr) auto;align-items:center;gap:8px}.store-rankings li>b{display:grid;width:24px;height:24px;place-items:center;border-radius:7px;color:#2878ec;background:#e8f2ff}.store-rankings li span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.store-rankings li em{font-style:normal;font-weight:850}
.product-insight-page{display:grid;align-content:start;gap:16px}.insight-search{display:grid;grid-template-columns:minmax(240px,1fr) auto;align-items:end;gap:10px;padding:17px;border:1px solid #dce8f5;border-radius:19px;background:#fff}.insight-search label,.insight-editor-form label{display:grid;gap:6px;color:#68788e;font-size:12px;font-weight:850}.insight-search input,.insight-editor-form input,.insight-editor-form select{width:100%;min-width:0;min-height:42px;padding:0 11px;border:1px solid #d4e0ef;border-radius:11px;background:#f9fbfe;font:inherit}.insight-search button,.insight-editor-form button{min-height:42px;padding:0 18px;border:0;border-radius:11px;color:#fff;background:linear-gradient(135deg,#18b6ef,#3769f3);font-weight:850}.insight-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:11px}.insight-kpis article{display:grid;gap:8px;min-height:110px;padding:17px;border:1px solid #dce8f5;border-radius:18px;background:linear-gradient(145deg,#fff,#f4f8ff)}.insight-kpis span{color:#68778c;font-size:13px;font-weight:850}.insight-kpis strong{font-size:23px}.insight-kpis small{color:#7d899b}.insight-editor{display:grid;gap:15px}.insight-editor-form{display:grid;grid-template-columns:1.3fr 1fr .55fr 1.6fr auto;align-items:end;gap:10px}.insight-success{margin:0;color:#15755d}.insight-product-list{display:grid;gap:15px}.insight-products{display:grid;gap:8px}.insight-products>article{display:grid;grid-template-columns:minmax(220px,.8fr) minmax(300px,1.5fr);gap:14px;padding:14px;border-radius:14px;background:#f6f9fd}.insight-products>article>div:first-child{display:grid;gap:4px}.insight-products small{color:#7d899b}.insight-tags{display:flex;flex-wrap:wrap;align-items:center;gap:7px}.insight-tags span{display:grid;gap:2px;padding:7px 10px;border-radius:11px;background:#eef3f8}.insight-tags span.approved{color:#166e59;background:#dcf6ec}.insight-tags span.pending{color:#96671b;background:#fff1ce}.insight-tags em{color:#8a96a6;font-style:normal}
.taxonomy-card,.tag-definition-editor{display:grid;gap:15px}.taxonomy-columns{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:11px}.taxonomy-columns>article{padding:14px;border-radius:15px;background:#f6f9fd}.taxonomy-columns h4{margin:0 0 10px}.taxonomy-list{display:grid;gap:7px}.taxonomy-list>div{display:grid;gap:3px;padding:9px;border-radius:11px;background:#fff}.taxonomy-list button{display:grid;width:100%;gap:3px;padding:0;border:0;color:inherit;background:transparent;text-align:left;cursor:pointer}.taxonomy-list button:disabled{cursor:default}.taxonomy-list small,.taxonomy-list p{margin:0;color:#7d899b}.taxonomy-list ul{display:flex;flex-wrap:wrap;gap:5px;margin:5px 0 0;padding:0;list-style:none}.taxonomy-list li{padding:4px 7px;border-radius:8px;color:#356078;background:#e8f7fb;font-size:11px}.taxonomy-list .inactive{opacity:.48}.tag-definition-form{display:grid;grid-template-columns:1fr .7fr 1fr 1.3fr .45fr .55fr auto;align-items:end;gap:10px}.tag-definition-form label{display:grid;gap:6px;color:#68788e;font-size:12px;font-weight:850}.tag-definition-form input,.tag-definition-form select{width:100%;min-width:0;min-height:42px;padding:0 11px;border:1px solid #d4e0ef;border-radius:11px;background:#f9fbfe;font:inherit}.tag-definition-form button,.editor-reset{min-height:42px;padding:0 18px;border:0;border-radius:11px;color:#fff;background:linear-gradient(135deg,#18b6ef,#3769f3);font-weight:850}.editor-reset{min-height:34px;color:#2571cc;background:#e8f3ff}
@media(max-width:1200px){.management-workspace{grid-template-columns:200px minmax(0,1fr)}.management-kpis{grid-template-columns:repeat(3,minmax(0,1fr))}}
@media(max-width:1200px){.sales-filter-panel{grid-template-columns:repeat(3,minmax(120px,1fr))}.sales-kpis{grid-template-columns:repeat(3,minmax(0,1fr))}}
@media(max-width:1200px){.product-filter-panel{grid-template-columns:repeat(3,minmax(120px,1fr))}.product-kpis{grid-template-columns:repeat(3,minmax(0,1fr))}.product-analysis-grid{grid-template-columns:1fr 1fr}.product-analysis-grid .source-quality{grid-column:1/-1}}
@media(max-width:1200px){.inventory-operation-kpis{grid-template-columns:repeat(3,minmax(0,1fr))}.inventory-operation-grid{grid-template-columns:1fr 1fr}.coverage-card{grid-column:1/-1}}
@media(max-width:1200px){.store-result-card dl{grid-template-columns:1fr 1fr}}
@media(max-width:1200px){.taxonomy-columns{grid-template-columns:repeat(2,minmax(0,1fr))}.tag-definition-form,.insight-editor-form{grid-template-columns:1fr 1fr 1fr}.insight-editor-form .evidence-field{grid-column:1/3}}
@media(max-width:960px){.management-workspace{grid-template-columns:1fr;gap:12px}.management-sidebar{display:block;min-height:0;padding:10px}.sidebar-heading{padding:5px 7px 10px}.management-sidebar nav{display:flex;gap:6px;overflow-x:auto;scrollbar-width:none}.management-sidebar nav::-webkit-scrollbar{display:none}.management-sidebar button{flex:0 0 auto;width:auto;min-width:118px;padding:10px}.management-sidebar button small,.management-sidebar button em,.management-sidebar>p{display:none}.management-content{gap:12px}.management-grid{grid-template-columns:1fr}.management-heading{flex-wrap:wrap}.inventory-truth-grid,.pos-status-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.readiness-list{grid-template-columns:1fr}.pos-system-grid,.sales-dashboard-grid{grid-template-columns:1fr}.refund-list{grid-template-columns:1fr 1fr}.hourly-card{grid-column:auto}}
@media(max-width:720px){.management-heading{display:grid;align-items:start;padding:16px}.management-heading h2{font-size:24px}.management-filters{display:grid;grid-template-columns:minmax(0,1fr) auto;width:100%}.management-filters label{min-width:0}.management-filters input{width:100%;min-width:0}.management-kpis{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.management-kpis article{min-width:0;min-height:104px;padding:13px}.management-kpis strong{overflow-wrap:anywhere;font-size:20px}.management-card{min-width:0;min-height:240px;padding:15px}.sales-trend{overflow:hidden}.expiry-grid{margin-top:18px}.ranking li{grid-template-columns:28px minmax(0,1fr) auto}.ranking li em{font-size:11px}.planned-section{height:auto;min-height:380px;padding:28px 16px}}
@media(max-width:720px){.sync-history article{grid-template-columns:58px minmax(0,1fr)}.sync-history em{grid-column:1/-1;white-space:normal}.refund-list{grid-template-columns:1fr}.system-card{padding:15px}.sales-filter-panel{grid-template-columns:1fr 1fr}.sales-kpis{grid-template-columns:1fr 1fr}.hour-bars{min-width:600px}.hourly-card{overflow-x:auto}}
@media(max-width:720px){.product-filter-panel{grid-template-columns:1fr 1fr}.product-kpis{grid-template-columns:1fr 1fr}.product-analysis-grid{grid-template-columns:1fr}.product-analysis-grid .source-quality{grid-column:auto}}
@media(max-width:720px){.inventory-operation-filters{grid-template-columns:1fr 1fr}.inventory-operation-filters button{grid-column:1/-1}.inventory-operation-kpis{grid-template-columns:1fr 1fr}.inventory-operation-grid{grid-template-columns:1fr}.coverage-card{grid-column:auto}}
@media(max-width:720px){.store-comparison-filters{grid-template-columns:1fr 1fr}.store-comparison-filters button{grid-column:1/-1}.store-kpis,.store-card-grid,.store-rankings{grid-template-columns:1fr 1fr}.store-rankings>div:last-child{grid-column:1/-1}}
@media(max-width:720px){.taxonomy-columns{grid-template-columns:1fr}.insight-kpis{grid-template-columns:1fr 1fr}.tag-definition-form,.insight-editor-form{grid-template-columns:1fr 1fr}.insight-editor-form .evidence-field{grid-column:1/-1}.insight-products>article{grid-template-columns:1fr}}
@media(max-width:390px){.management-sidebar button{min-width:102px}.management-heading{padding:14px}.management-heading h2{font-size:22px}.management-filters{grid-template-columns:1fr}.management-kpis{grid-template-columns:1fr 1fr}.management-kpis article{padding:11px}.management-kpis strong{font-size:18px}.expiry-grid{grid-template-columns:1fr 1fr;gap:7px}.expiry-grid div{padding:13px}.inventory-truth-panel{padding:14px}.inventory-truth-grid,.pos-status-grid{grid-template-columns:1fr}.inventory-truth-grid article{min-height:auto}.pos-status-grid article{min-height:auto}.sales-filter-panel,.sales-kpis{grid-template-columns:1fr}}
@media(max-width:390px){.product-filter-panel,.product-kpis{grid-template-columns:1fr}}
@media(max-width:390px){.inventory-operation-filters,.inventory-operation-kpis{grid-template-columns:1fr}.inventory-operation-filters button{grid-column:auto}}
@media(max-width:390px){.store-comparison-filters,.store-kpis,.store-card-grid,.store-rankings,.store-result-card dl{grid-template-columns:1fr}.store-comparison-filters button,.store-rankings>div:last-child{grid-column:auto}}
@media(max-width:390px){.insight-search,.insight-kpis,.tag-definition-form,.insight-editor-form{grid-template-columns:1fr}.insight-editor-form .evidence-field{grid-column:auto}}
</style>
