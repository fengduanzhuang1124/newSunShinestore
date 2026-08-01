<script setup lang="ts">
import { nextTick, onMounted, ref } from 'vue';

type Mode = 'receive' | 'issue' | 'query' | 'reports';
type Theme = 'light' | 'dark';
type Batch = { batchId: string; expiryDate: string; expiryPrecision: 'MONTH' | 'DATE'; quantity: number };
type ProductResult = {
  productId: string;
  productName: string;
  barcodes: string[];
  batches: Batch[];
  totalQuantity: number;
};
type ReceiptItem = { itemId: string; barcode: string; productName: string; expiryDate: string; quantity: number; createdAt: string };
type Receipt = {
  receiptId: string;
  receiptNo: string;
  status: 'OPEN' | 'COMPLETED';
  employeeName: string;
  createdAt: string;
  completedAt: string | null;
  productCount: number;
  totalQuantity: number;
  items: ReceiptItem[];
};
type ExpiryLevel = 'EXPIRED' | 'URGENT' | 'WARNING' | 'EARLY';
type ExpiryItem = {
  productId: string; productName: string; barcodes: string[]; batchId: string;
  expiryDate: string; quantity: number; level: ExpiryLevel; levelLabel: string; daysRemaining: number;
};
type Movement = {
  movementId: string; movementNo: string; movementType: string; movementLabel: string;
  productName: string; barcodes: string[]; expiryDate: string; quantityDelta: number;
  reason: string | null; performedBy: string; createdAt: string;
};

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:3100/api/v1';
const tokenKey = 'sunshine_inventory_access_token';
const profileKey = 'sunshine_inventory_profile';
const themeKey = 'sunshine_inventory_theme';
const savedTheme = localStorage.getItem(themeKey);
const theme = ref<Theme>(savedTheme === 'dark' || savedTheme === 'light'
  ? savedTheme
  : (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
const storedProfile = JSON.parse(localStorage.getItem(profileKey) ?? '{}');
const token = ref(localStorage.getItem(tokenKey) ?? '');
const username = ref('');
const password = ref('');
const displayName = ref(storedProfile.displayName ?? '');
const storeName = ref(storedProfile.roles?.[0]?.storeName ?? '');
const mustChangePassword = ref(storedProfile.mustChangePassword ?? false);
const activeMode = ref<Mode>('receive');
const query = ref('');
const results = ref<ProductResult[]>([]);
const selectedProduct = ref<ProductResult | null>(null);
const receiveSearch = ref('');
const barcode = ref('');
const productName = ref('');
const expiryMonth = ref('');
const expiryDay = ref<number | null>(null);
const receiveQuantity = ref(1);
const issueQuantities = ref<Record<string, number>>({});
const lastReceivedBarcode = ref('');
const message = ref('');
const error = ref('');
const loading = ref(false);
const scanReady = ref(false);
const scanInput = ref<HTMLInputElement>();
const reportView = ref<'receipts' | 'inventory' | 'expiry' | 'movements'>('receipts');
const reportDate = ref(new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Pacific/Auckland', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date()));
const receipts = ref<Receipt[]>([]);
const reportWarehouseName = ref('');
const receiptSummary = ref({ receiptCount: 0, productCount: 0, totalQuantity: 0 });
const inventorySummary = ref<{ productCount: number; totalQuantity: number; products: ProductResult[] }>({
  productCount: 0,
  totalQuantity: 0,
  products: [],
});
const expiryQuery = ref('');
const expiryLevel = ref<'' | ExpiryLevel>('');
const expiryItems = ref<ExpiryItem[]>([]);
const expirySummary = ref<Record<ExpiryLevel, number>>({ EXPIRED: 0, URGENT: 0, WARNING: 0, EARLY: 0 });
const expiryThresholds = ref({ urgentMonths: 2, warningMonths: 3, earlyWarningMonths: 6 });
const movementQuery = ref('');
const movements = ref<Movement[]>([]);
const stocktakeActual = ref<Record<string, number>>({});
const stocktakeReasons = ref<Record<string, string>>({});

onMounted(async () => {
  document.documentElement.dataset.theme = theme.value;
  if (!token.value) return;
  await nextTick();
  if (scanInput.value) {
    scanInput.value.focus();
    scanReady.value = true;
  }
});

function toggleTheme() {
  theme.value = theme.value === 'light' ? 'dark' : 'light';
  document.documentElement.dataset.theme = theme.value;
  localStorage.setItem(themeKey, theme.value);
}

async function apiRequest(path: string, options: RequestInit = {}) {
  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token.value ? { Authorization: `Bearer ${token.value}` } : {}),
        ...options.headers,
      },
    });
  } catch {
    throw new Error('无法连接库存 API，请先在 Cursor 终端运行 npm run dev');
  }
  const body = await response.json();
  if (response.status === 401 && token.value) logout();
  if (!response.ok) {
    const details = Array.isArray(body.message) ? body.message.join('，') : body.message;
    const text = String(details ?? '操作失败');
    if (text.includes('expiryMonth') || text.includes('expiryDate')) {
      throw new Error('到期日期格式不正确，请重新选择年月和日期');
    }
    throw new Error(text);
  }
  return body.data;
}

function clearStatus() {
  message.value = '';
  error.value = '';
}

async function login() {
  loading.value = true;
  clearStatus();
  try {
    const data = await apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: username.value, password: password.value }),
    });
    token.value = data.accessToken;
    displayName.value = data.user.displayName;
    storeName.value = data.user.roles?.[0]?.storeName ?? '';
    mustChangePassword.value = data.user.mustChangePassword;
    localStorage.setItem(tokenKey, token.value);
    localStorage.setItem(profileKey, JSON.stringify(data.user));
    password.value = '';
    await nextTick();
    scanInput.value?.focus();
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : '登录失败';
  } finally {
    loading.value = false;
  }
}

function logout() {
  token.value = '';
  displayName.value = '';
  storeName.value = '';
  localStorage.removeItem(tokenKey);
  localStorage.removeItem(profileKey);
}

async function switchMode(mode: Mode) {
  activeMode.value = mode;
  query.value = '';
  results.value = [];
  selectedProduct.value = null;
  receiveSearch.value = '';
  barcode.value = '';
  productName.value = '';
  expiryMonth.value = '';
  expiryDay.value = null;
  clearStatus();
  if (mode === 'query' && lastReceivedBarcode.value) {
    query.value = lastReceivedBarcode.value;
    await searchProducts(lastReceivedBarcode.value);
    if (results.value.length) message.value = '已自动显示刚刚入库商品的最新库存。';
  }
  if (mode === 'reports') await loadReport();
  nextTick(() => scanInput.value?.focus());
}

async function searchProducts(searchText = query.value) {
  const value = searchText.trim();
  if (!value) return;
  loading.value = true;
  clearStatus();
  try {
    const data = await apiRequest(`/inventory/search?q=${encodeURIComponent(value)}`);
    results.value = data.products;
    if (!results.value.length) message.value = '没有找到商品。';
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : '查询失败';
  } finally {
    loading.value = false;
  }
}

async function lookupForReceive() {
  const value = receiveSearch.value.trim();
  if (!value) return;
  selectedProduct.value = null;
  await searchProducts(value);
  const exactBarcodeProduct = results.value.find((product) => product.barcodes.includes(value));
  if (exactBarcodeProduct) {
    chooseProduct(exactBarcodeProduct);
    message.value = `已按条码找到 ${exactBarcodeProduct.productName}，可以登记本次入库。`;
  } else if (results.value.length) {
    message.value = `找到 ${results.value.length} 个商品，请选择正确商品入库。`;
  } else if (/^\d{6,}$/.test(value)) {
    barcode.value = value;
    productName.value = '';
    message.value = '没有找到这个条码，可在下方填写商品名称后创建新品。';
  } else {
    productName.value = value;
    barcode.value = '';
    message.value = '没有找到同名商品。如需创建新品，请继续输入或扫描商品条码。';
  }
}

function chooseProduct(product: ProductResult) {
  selectedProduct.value = product;
  productName.value = product.productName;
  if (!barcode.value) barcode.value = product.barcodes[0] ?? '';
  results.value = [];
  message.value = `已选择 ${product.productName}，全部条码库存会合并统计。`;
}

async function receiveStock() {
  loading.value = true;
  clearStatus();
  try {
    const receivedBarcode = barcode.value.trim();
    const data = await apiRequest('/inventory/scan-receive', {
      method: 'POST',
      body: JSON.stringify({
        barcode: receivedBarcode,
        productName: productName.value.trim(),
        productId: selectedProduct.value?.productId,
        expiryMonth: expiryMonth.value,
        expiryDay: expiryDay.value || undefined,
        quantity: receiveQuantity.value,
      }),
    });
    lastReceivedBarcode.value = receivedBarcode;
    message.value = `已加入入库单 ${data.receiptNo}：${data.productName}，当前 ${data.currentQuantity} 件。`;
    receiveSearch.value = '';
    barcode.value = '';
    productName.value = '';
    expiryMonth.value = '';
    expiryDay.value = null;
    receiveQuantity.value = 1;
    selectedProduct.value = null;
    results.value = [];
    await nextTick();
    scanInput.value?.focus();
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : '入库失败';
  } finally {
    loading.value = false;
  }
}

async function loadReceipts() {
  const data = await apiRequest(`/inventory/receipts?date=${encodeURIComponent(reportDate.value)}`);
  receipts.value = data.receipts;
  receiptSummary.value = data.summary;
  reportWarehouseName.value = data.warehouseName;
}

async function loadInventoryReport() {
  const data = await apiRequest('/inventory/inventory-report');
  inventorySummary.value = data;
  reportWarehouseName.value = data.warehouseName;
}

async function loadExpiryReport() {
  const params = new URLSearchParams();
  if (expiryQuery.value.trim()) params.set('q', expiryQuery.value.trim());
  if (expiryLevel.value) params.set('level', expiryLevel.value);
  const data = await apiRequest(`/inventory/expiry-alerts?${params.toString()}`);
  expiryItems.value = data.items;
  expirySummary.value = data.summary;
  expiryThresholds.value = data.thresholds;
  reportWarehouseName.value = data.warehouseName;
}

async function loadMovements() {
  const suffix = movementQuery.value.trim() ? `?q=${encodeURIComponent(movementQuery.value.trim())}` : '';
  const [movementData, inventoryData] = await Promise.all([
    apiRequest(`/inventory/movements${suffix}`),
    apiRequest('/inventory/inventory-report'),
  ]);
  movements.value = movementData.movements;
  inventorySummary.value = inventoryData;
  reportWarehouseName.value = movementData.warehouseName;
}

async function loadReport() {
  loading.value = true;
  clearStatus();
  try {
    if (reportView.value === 'receipts') await loadReceipts();
    else if (reportView.value === 'inventory') await loadInventoryReport();
    else if (reportView.value === 'expiry') await loadExpiryReport();
    else await loadMovements();
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : '报表加载失败';
  } finally {
    loading.value = false;
  }
}

async function adjustStocktake(product: ProductResult, batch: Batch) {
  const actualQuantity = stocktakeActual.value[batch.batchId];
  const reason = stocktakeReasons.value[batch.batchId]?.trim();
  if (!Number.isInteger(actualQuantity) || actualQuantity < 0 || !reason) {
    error.value = '请填写实际数量和盘点原因。';
    return;
  }
  loading.value = true;
  clearStatus();
  try {
    const data = await apiRequest('/inventory/stocktake-adjustment', {
      method: 'POST', body: JSON.stringify({ batchId: batch.batchId, actualQuantity, reason }),
    });
    message.value = `盘点完成：${data.productName} ${data.expiryDate}，${data.difference > 0 ? '盘盈' : '盘亏'} ${Math.abs(data.difference)} 件。`;
    delete stocktakeActual.value[batch.batchId];
    delete stocktakeReasons.value[batch.batchId];
    await loadMovements();
  } catch (reasonValue) {
    error.value = reasonValue instanceof Error ? reasonValue.message : '盘点调整失败';
  } finally {
    loading.value = false;
  }
}

async function completeCurrentReceipt() {
  loading.value = true;
  clearStatus();
  try {
    const data = await apiRequest('/inventory/receipts/current/complete', { method: 'POST' });
    message.value = `入库单 ${data.receiptNo} 已完成，共 ${data.totalQuantity} 件。`;
    await loadReceipts();
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : '完成入库单失败';
  } finally {
    loading.value = false;
  }
}

function csvCell(value: string | number) {
  const text = String(value);
  const safeText = typeof value === 'string' && /^[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safeText.replaceAll('"', '""')}"`;
}

function downloadCsv(fileName: string, rows: Array<Array<string | number>>) {
  const content = `\uFEFF${rows.map((row) => row.map(csvCell).join(',')).join('\n')}`;
  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

function exportReceipts() {
  downloadCsv(`${storeName.value}-入库记录-${reportDate.value}.csv`, [
    ['入库单号', '状态', '员工', '条码', '商品名称', '到期日期', '数量', '录入时间'],
    ...receipts.value.flatMap((receipt) => receipt.items.map((item) => [
      receipt.receiptNo,
      receipt.status === 'OPEN' ? '点货中' : '已完成',
      receipt.employeeName,
      item.barcode,
      item.productName,
      item.expiryDate,
      item.quantity,
      new Date(item.createdAt).toLocaleString(),
    ])),
  ]);
}

function exportInventory() {
  downloadCsv(`${storeName.value}-当前库存-${reportDate.value}.csv`, [
    ['商品名称', '条码', '到期日期', '库存数量', '商品总库存'],
    ...inventorySummary.value.products.flatMap((product) => product.batches.map((batch) => [
      product.productName,
      product.barcodes.join(' / '),
      batch.expiryDate,
      batch.quantity,
      product.totalQuantity,
    ])),
  ]);
}

function exportExpiryAlerts() {
  downloadCsv(`${storeName.value}-临期库存-${reportDate.value}.csv`, [
    ['预警级别', '商品名称', '条码', '到期日期', '剩余天数', '库存数量'],
    ...expiryItems.value.map((item) => [
      item.levelLabel,
      item.productName,
      item.barcodes.join(' / '),
      item.expiryDate,
      item.daysRemaining,
      item.quantity,
    ]),
  ]);
}

async function issueBatch(product: ProductResult, batch: Batch) {
  const quantity = issueQuantities.value[batch.batchId] ?? 1;
  loading.value = true;
  clearStatus();
  try {
    const data = await apiRequest('/inventory/manual-issue', {
      method: 'POST',
      body: JSON.stringify({ batchId: batch.batchId, quantity, reason: '上货架' }),
    });
    await searchProducts(query.value);
    issueQuantities.value[batch.batchId] = 1;
    message.value = `出库成功：${data.productName} ${data.expiryDate}，剩余 ${data.currentQuantity} 件。`;
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : '出库失败';
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <main class="app-shell">
    <section v-if="!token" class="login-card">
      <button class="theme-toggle login-theme-toggle" type="button" :aria-label="theme === 'light' ? '切换到深色模式' : '切换到浅色模式'" @click="toggleTheme">
        <span aria-hidden="true">{{ theme === 'light' ? '☾' : '☀' }}</span>{{ theme === 'light' ? 'Dark' : 'Light' }}
      </button>
      <img class="login-logo" src="/sunshine-health-logo.png" alt="阳光特产 Sunshine Health" />
      <p class="eyebrow">SUNSHINE INVENTORY</p>
      <h1>员工登录</h1>
      <p class="summary">登录后进行点货入库、上货架出库和库存日期查询。</p>
      <form @submit.prevent="login">
        <label>员工账号<input v-model="username" autocomplete="username" autofocus /></label>
        <label>密码<input v-model="password" type="password" autocomplete="current-password" /></label>
        <p v-if="error" class="alert error">{{ error }}</p>
        <button :disabled="loading" type="submit">{{ loading ? '登录中…' : '登录' }}</button>
      </form>
    </section>

    <section v-else class="workspace">
      <header>
        <div class="brand-block">
          <img class="brand-logo" src="/sunshine-health-logo.png" alt="阳光特产 Sunshine Health" />
          <div>
            <p class="eyebrow">SUNSHINE INVENTORY</p>
            <h1>库存管理</h1>
          </div>
        </div>
        <div class="account"><button class="theme-toggle" type="button" :aria-label="theme === 'light' ? '切换到深色模式' : '切换到浅色模式'" @click="toggleTheme"><span aria-hidden="true">{{ theme === 'light' ? '☾' : '☀' }}</span>{{ theme === 'light' ? 'Dark' : 'Light' }}</button><span class="store-badge">{{ storeName || '未分配门店' }}</span><span>{{ displayName || '员工' }}</span><button class="secondary" @click="logout">退出</button></div>
      </header>

      <p v-if="mustChangePassword" class="alert warning">当前使用临时密码，请勿把密码交给其他人。</p>

      <nav class="mode-tabs" aria-label="库存操作分类">
        <button :class="{ active: activeMode === 'receive' }" @click="switchMode('receive')">点货入库</button>
        <button :class="{ active: activeMode === 'issue' }" @click="switchMode('issue')">出库</button>
        <button :class="{ active: activeMode === 'query' }" @click="switchMode('query')">查询</button>
        <button :class="{ active: activeMode === 'reports' }" @click="switchMode('reports')">记录与报表</button>
      </nav>

      <p v-if="message" class="alert success">{{ message }}</p>
      <p v-if="error" class="alert error">{{ error }}</p>

      <Transition name="panel" mode="out-in">
        <div :key="activeMode" class="mode-panel">
      <template v-if="activeMode === 'receive'">
        <section class="section-heading scanner-heading"><h2>条码 / 商品名称</h2><span class="scanner-status" :class="{ ready: scanReady }"><i></i>{{ scanReady ? '扫码输入就绪' : '点击输入框后扫码' }}</span></section>
        <div class="search-row scan-search-row">
          <input ref="scanInput" v-model="receiveSearch" aria-label="查询条码或商品名称" placeholder="扫描条码或输入商品名称关键词" @focus="scanReady = true" @blur="scanReady = false" @keydown.enter.prevent="lookupForReceive" />
          <button :disabled="loading || !receiveSearch.trim()" @click="lookupForReceive">查询</button>
        </div>

        <form class="receive-form" @submit.prevent="receiveStock">
          <label>条码<input v-model="barcode" required maxlength="128" placeholder="扫描条码" /></label>
          <label>商品名<input v-model="productName" required maxlength="255" /></label>
          <label class="expiry-label">到期日期
            <span class="expiry-fields">
              <input v-model="expiryMonth" required type="month" aria-label="到期年月" />
              <input v-model.number="expiryDay" type="number" min="1" max="31" aria-label="到期日（可不选）" placeholder="日（可不选）" />
            </span>
          </label>
          <label>数量<input v-model.number="receiveQuantity" required type="number" min="1" step="1" /></label>
          <button class="receive-submit" :disabled="loading || !barcode.trim() || !expiryMonth">确认入库</button>
        </form>
      </template>

      <template v-else-if="activeMode === 'reports'">
        <section class="report-header">
          <div>
            <p class="eyebrow">RECORDS & REPORTS</p>
            <h2>记录与报表</h2>
            <p>{{ reportWarehouseName || '当前仓库' }} · 入库记录与实时总库存</p>
          </div>
          <div class="report-switch" aria-label="报表分类">
            <button :class="{ active: reportView === 'receipts' }" @click="reportView = 'receipts'; loadReport()">当天入库表</button>
            <button :class="{ active: reportView === 'inventory' }" @click="reportView = 'inventory'; loadReport()">总库存表</button>
            <button :class="{ active: reportView === 'expiry' }" @click="reportView = 'expiry'; loadReport()">临期预警</button>
            <button :class="{ active: reportView === 'movements' }" @click="reportView = 'movements'; loadReport()">盘点与流水</button>
          </div>
        </section>

        <template v-if="reportView === 'receipts'">
          <div class="report-actions">
            <label>入库日期<input v-model="reportDate" type="date" @change="loadReport" /></label>
            <button class="secondary" :disabled="loading" @click="loadReport">刷新</button>
            <button class="secondary" :disabled="!receipts.length" @click="exportReceipts">导出 CSV</button>
            <button :disabled="loading || !receipts.some((receipt) => receipt.status === 'OPEN')" @click="completeCurrentReceipt">完成我的入库单</button>
          </div>
          <div class="metric-grid">
            <div><small>入库单</small><strong>{{ receiptSummary.receiptCount }}</strong></div>
            <div><small>商品种类</small><strong>{{ receiptSummary.productCount }}</strong></div>
            <div><small>入库总件数</small><strong>{{ receiptSummary.totalQuantity }}</strong></div>
          </div>
          <section v-if="receipts.length" class="receipt-list">
            <details v-for="receipt in receipts" :key="receipt.receiptId" class="receipt-card" :open="receipt.status === 'OPEN'">
              <summary>
                <span><strong>{{ receipt.receiptNo }}</strong><small>{{ receipt.employeeName }} · {{ receipt.status === 'OPEN' ? '点货中' : '已完成' }}</small></span>
                <span>{{ receipt.productCount }} 种 · {{ receipt.totalQuantity }} 件</span>
              </summary>
              <div class="table-wrap">
                <table>
                  <thead><tr><th>条码</th><th>商品名称</th><th>到期日期</th><th>数量</th><th>录入时间</th></tr></thead>
                  <tbody><tr v-for="item in receipt.items" :key="item.itemId"><td>{{ item.barcode }}</td><td>{{ item.productName }}</td><td>{{ item.expiryDate }}</td><td>{{ item.quantity }} 件</td><td>{{ new Date(item.createdAt).toLocaleTimeString() }}</td></tr></tbody>
                </table>
              </div>
            </details>
          </section>
          <p v-else class="empty-state">这一天还没有入库记录。</p>
        </template>

        <template v-else-if="reportView === 'inventory'">
          <div class="report-actions inventory-actions">
            <button class="secondary" :disabled="loading" @click="loadReport">刷新库存</button>
            <button class="secondary" :disabled="!inventorySummary.products.length" @click="exportInventory">导出 CSV</button>
          </div>
          <div class="metric-grid two">
            <div><small>有库存商品</small><strong>{{ inventorySummary.productCount }}</strong></div>
            <div><small>当前总件数</small><strong>{{ inventorySummary.totalQuantity }}</strong></div>
          </div>
          <div v-if="inventorySummary.products.length" class="table-wrap inventory-table">
            <table>
              <thead><tr><th>商品名称</th><th>条码</th><th>到期日期</th><th>日期库存</th><th>商品总库存</th></tr></thead>
              <tbody v-for="product in inventorySummary.products" :key="product.productId">
                <tr v-for="(batch, index) in product.batches" :key="batch.batchId">
                  <td>{{ index === 0 ? product.productName : '' }}</td>
                  <td>{{ index === 0 ? product.barcodes.join('、') : '' }}</td>
                  <td>{{ batch.expiryDate }}</td><td>{{ batch.quantity }} 件</td>
                  <td>{{ index === 0 ? `${product.totalQuantity} 件` : '' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p v-else class="empty-state">当前仓库暂无库存。</p>
        </template>

        <template v-else-if="reportView === 'expiry'">
          <div class="expiry-note">系统自动分级：2个月内紧急临期、3个月内临期预警、6个月内提前关注；已过期单独显示。</div>
          <div class="report-actions expiry-actions">
            <label>商品或条码<input v-model="expiryQuery" placeholder="输入关键词或扫描条码" @keydown.enter.prevent="loadReport" /></label>
            <label>预警级别
              <select v-model="expiryLevel" @change="loadReport">
                <option value="">全部级别</option><option value="EXPIRED">已过期</option><option value="URGENT">2个月内</option><option value="WARNING">3个月内</option><option value="EARLY">6个月内</option>
              </select>
            </label>
            <button class="secondary" :disabled="loading" @click="loadReport">查询</button>
            <button class="secondary" :disabled="!expiryItems.length" @click="exportExpiryAlerts">导出 CSV</button>
          </div>
          <div class="metric-grid expiry-metrics">
            <div class="expired"><small>已过期</small><strong>{{ expirySummary.EXPIRED }}</strong></div>
            <div class="urgent"><small>{{ expiryThresholds.urgentMonths }}个月内</small><strong>{{ expirySummary.URGENT }}</strong></div>
            <div class="warning-level"><small>{{ expiryThresholds.warningMonths }}个月内</small><strong>{{ expirySummary.WARNING }}</strong></div>
            <div class="early"><small>{{ expiryThresholds.earlyWarningMonths }}个月内</small><strong>{{ expirySummary.EARLY }}</strong></div>
          </div>
          <div v-if="expiryItems.length" class="table-wrap inventory-table">
            <table>
              <thead><tr><th>级别</th><th>商品名称</th><th>条码</th><th>到期日期</th><th>剩余时间</th><th>库存</th></tr></thead>
              <tbody><tr v-for="item in expiryItems" :key="`${item.productId}-${item.batchId}`"><td><span class="level-badge" :class="item.level.toLowerCase()">{{ item.levelLabel }}</span></td><td>{{ item.productName }}</td><td>{{ item.barcodes.join('、') }}</td><td>{{ item.expiryDate }}</td><td>{{ item.daysRemaining < 0 ? `已过期 ${Math.abs(item.daysRemaining)} 天` : `剩余 ${item.daysRemaining} 天` }}</td><td>{{ item.quantity }} 件</td></tr></tbody>
            </table>
          </div>
          <p v-else class="empty-state">当前筛选条件下没有6个月内到期的库存。</p>
        </template>

        <template v-else>
          <div class="expiry-note stocktake-note">盘点只填写实际看到的数量，系统会自动生成盘盈或盘亏流水；不会修改或删除历史记录。</div>
          <div class="report-actions movement-actions">
            <label>商品、条码或流水号<input v-model="movementQuery" placeholder="输入关键词查询最近100条" @keydown.enter.prevent="loadReport" /></label>
            <button class="secondary" :disabled="loading" @click="loadReport">查询流水</button>
          </div>
          <h3 class="report-subtitle">库存盘点</h3>
          <div v-if="inventorySummary.products.length" class="table-wrap inventory-table">
            <table>
              <thead><tr><th>商品</th><th>到期日期</th><th>系统数量</th><th>实际数量</th><th>原因</th><th>操作</th></tr></thead>
              <tbody v-for="product in inventorySummary.products" :key="product.productId">
                <tr v-for="batch in product.batches" :key="batch.batchId">
                  <td>{{ product.productName }}</td><td>{{ batch.expiryDate }}</td><td>{{ batch.quantity }} 件</td>
                  <td><input v-model.number="stocktakeActual[batch.batchId]" :aria-label="`${product.productName} ${batch.expiryDate} 实际数量`" class="table-input quantity-input" type="number" min="0" step="1" placeholder="实际数量" /></td>
                  <td><input v-model="stocktakeReasons[batch.batchId]" :aria-label="`${product.productName} ${batch.expiryDate} 盘点原因`" class="table-input" maxlength="255" placeholder="如：现场盘点" /></td>
                  <td><button class="secondary" :disabled="loading" @click="adjustStocktake(product, batch)">确认调整</button></td>
                </tr>
              </tbody>
            </table>
          </div>
          <p v-else class="empty-state">当前仓库没有可盘点库存。</p>
          <h3 class="report-subtitle">最近库存流水</h3>
          <div v-if="movements.length" class="table-wrap inventory-table">
            <table>
              <thead><tr><th>时间</th><th>类型</th><th>商品</th><th>条码</th><th>到期日期</th><th>数量变化</th><th>原因</th></tr></thead>
              <tbody><tr v-for="movement in movements" :key="movement.movementId"><td>{{ new Date(movement.createdAt).toLocaleString() }}</td><td><span class="movement-badge" :class="movement.quantityDelta > 0 ? 'gain' : 'loss'">{{ movement.movementLabel }}</span></td><td>{{ movement.productName }}</td><td>{{ movement.barcodes.join('、') }}</td><td>{{ movement.expiryDate }}</td><td :class="movement.quantityDelta > 0 ? 'delta-gain' : 'delta-loss'">{{ movement.quantityDelta > 0 ? '+' : '' }}{{ movement.quantityDelta }}</td><td>{{ movement.reason || '—' }}</td></tr></tbody>
            </table>
          </div>
          <p v-else class="empty-state">没有找到库存流水。</p>
        </template>
      </template>

      <template v-else>
        <section class="section-heading">
          <h2>{{ activeMode === 'issue' ? '查找要出库的商品' : '查询商品库存与日期' }}</h2>
        </section>
        <div class="search-row">
          <input ref="scanInput" v-model="query" aria-label="商品关键词或条码" placeholder="输入商品名称或扫描条码" @focus="scanReady = true" @blur="scanReady = false" @keydown.enter.prevent="searchProducts()" />
          <button :disabled="loading || !query.trim()" @click="searchProducts()">查询</button>
        </div>
      </template>

      <section v-if="results.length" class="result-list">
        <article v-for="product in results" :key="product.productId" class="product-card">
          <div class="product-summary">
            <div><h3>{{ product.productName }}</h3><p>条码：{{ product.barcodes.join('、') || '无' }}</p></div>
            <strong>总库存 {{ product.totalQuantity }} 件</strong>
          </div>
          <div v-if="activeMode === 'receive'" class="bind-action">
            <button class="secondary" @click="chooseProduct(product)">选择这个商品入库</button>
          </div>
          <div v-for="batch in product.batches" :key="batch.batchId" class="batch-row">
            <div class="batch-value"><small>到期日期</small><strong>{{ batch.expiryDate }}</strong></div>
            <div class="batch-value quantity-value"><small>库存数量</small><strong>{{ batch.quantity }} 件</strong></div>
            <div v-if="activeMode === 'issue'" class="issue-action">
              <input v-model.number="issueQuantities[batch.batchId]" :aria-label="`${batch.expiryDate} 出库数量`" type="number" min="1" :max="batch.quantity" placeholder="数量" />
              <button :disabled="loading || batch.quantity < 1" @click="issueBatch(product, batch)">确认出库</button>
            </div>
          </div>
          <p v-if="!product.batches.length" class="empty">暂无日期库存</p>
        </article>
      </section>
        </div>
      </Transition>
    </section>
  </main>
</template>
