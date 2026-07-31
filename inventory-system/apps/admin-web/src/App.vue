<script setup lang="ts">
import { nextTick, onMounted, ref } from 'vue';

type Mode = 'receive' | 'issue' | 'query';
type Batch = { batchId: string; expiryDate: string; expiryPrecision: 'MONTH' | 'DATE'; quantity: number };
type ProductResult = {
  productId: string;
  productName: string;
  barcodes: string[];
  batches: Batch[];
  totalQuantity: number;
};

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:3100/api/v1';
const tokenKey = 'sunshine_inventory_access_token';
const profileKey = 'sunshine_inventory_profile';
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

onMounted(async () => {
  if (!token.value) return;
  await nextTick();
  if (scanInput.value) {
    scanInput.value.focus();
    scanReady.value = true;
  }
});

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
    message.value = `入库成功：${data.productName}，当前 ${data.currentQuantity} 件。可到“查询”核对。`;
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
        <div class="account"><span class="store-badge">{{ storeName || '未分配门店' }}</span><span>{{ displayName || '员工' }}</span><button class="secondary" @click="logout">退出</button></div>
      </header>

      <p v-if="mustChangePassword" class="alert warning">当前使用临时密码，请勿把密码交给其他人。</p>

      <nav class="mode-tabs" aria-label="库存操作分类">
        <button :class="{ active: activeMode === 'receive' }" @click="switchMode('receive')">点货入库</button>
        <button :class="{ active: activeMode === 'issue' }" @click="switchMode('issue')">出库</button>
        <button :class="{ active: activeMode === 'query' }" @click="switchMode('query')">查询</button>
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
