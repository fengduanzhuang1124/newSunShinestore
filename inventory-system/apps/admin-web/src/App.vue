<script setup lang="ts">
import type { IScannerControls } from '@zxing/browser';
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';

type Mode = 'home' | 'receive' | 'issue' | 'query' | 'productReview' | 'milkReview' | 'reports';
type Theme = 'light' | 'dark';
type Batch = { batchId: string; expiryDate: string; expiryPrecision: 'MONTH' | 'DATE'; quantity: number };
type ProductResult = {
  productId: string;
  productName: string;
  sku: string | null;
  englishName: string | null;
  chineseName: string | null;
  barcodes: string[];
  batches: Batch[];
  totalQuantity: number;
};
type ReceiptItem = { itemId: string; barcode: string; productName: string; expiryDate: string; quantity: number; reversed: boolean; createdAt: string; entryCount?: number };
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
  reason: string | null; performedBy: string; reversalOfMovementNo: string | null;
  reversedByMovementNo: string | null; reversed: boolean; canReverse: boolean; createdAt: string;
};
type ReceiveDraftItem = {
  draftId: string; barcode: string; productName: string; productId?: string;
  expiryMonth: string; expiryDay?: number; expiryDisplay: string; quantity: number;
};
type MilkCandidate = {
  id: string; sourceSku: string | null; barcode: string | null; sourceName: string;
  suggestedEnglishName: string; suggestedChineseName: string | null; suggestedBrand: string;
  suggestedPackQuantity: number | null;
  suggestedInventoryPolicy: 'LOCAL_STOCK' | 'EXTERNAL_WAREHOUSE' | 'REVIEW_REQUIRED';
  cartonPriceMatched: boolean; salePrice: string | null; recognitionReason: string;
  reviewStatus: 'PENDING' | 'APPROVED' | 'IGNORED';
};
type PosProductCandidate = {
  id: string; externalProductId: string; sourceSku: string | null; barcode: string;
  sourceName: string; englishName: string; chineseName: string | null;
  brandName: string | null; categoryName: string | null; itemType: string | null;
  salePrice: string | null; sourceStock: string | null;
  reviewStatus: 'PENDING' | 'APPROVED' | 'IGNORED';
  translationStatus: 'UNTRANSLATED' | 'DRAFT' | 'APPROVED';
};

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? '/api/v1';
const tokenKey = 'sunshine_inventory_access_token';
const profileKey = 'sunshine_inventory_profile';
const themeKey = 'sunshine_inventory_theme';
const modeKey = 'sunshine_inventory_mode';
const savedTheme = localStorage.getItem(themeKey);
const theme = ref<Theme>(savedTheme === 'dark' || savedTheme === 'light'
  ? savedTheme
  : (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
const storedProfile = JSON.parse(localStorage.getItem(profileKey) ?? '{}');
const token = ref(localStorage.getItem(tokenKey) ?? '');
const userId = ref(storedProfile.id ?? '');
const username = ref('');
const password = ref('');
const displayName = ref(storedProfile.displayName ?? '');
const storeName = ref(storedProfile.roles?.[0]?.storeName ?? '');
const storeId = ref(storedProfile.roles?.[0]?.storeId ?? '');
const warehouseId = ref(storedProfile.warehouses?.find((item: { canReceive?: boolean }) => item.canReceive)?.warehouseId
  ?? storedProfile.warehouses?.[0]?.warehouseId
  ?? '');
const mustChangePassword = ref(storedProfile.mustChangePassword ?? false);
const savedMode = localStorage.getItem(modeKey);
const activeMode = ref<Mode>(savedMode === 'receive' || savedMode === 'issue' || savedMode === 'query' || savedMode === 'reports'
  ? savedMode
  : 'home');
const query = ref('');
const results = ref<ProductResult[]>([]);
const showSearchDropdown = ref(false);
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
const expiryMonthInput = ref<HTMLInputElement>();
const cameraVideo = ref<HTMLVideoElement>();
const cameraOpen = ref(false);
const cameraStatus = ref('正在准备后置摄像头…');
const cameraError = ref('');
const cameraTarget = ref<'receive' | 'issue'>('receive');
let cameraControls: IScannerControls | null = null;
let lastCameraCode = '';
let lastCameraCodeAt = 0;
const reportView = ref<'receipts' | 'inventory' | 'expiry' | 'movements'>('receipts');
const inventoryView = ref<'ledger' | 'stocktake'>('ledger');
const showAccountPanel = ref(false);
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
const stocktakeQuery = ref('');
const increaseProduct = ref<ProductResult | null>(null);
const increaseBatchChoice = ref('new');
const increaseExpiryMonth = ref('');
const increaseExpiryDay = ref<number | null>(null);
const increaseQuantity = ref(1);
const increaseReason = ref('后续发现库存');
const reversalReasons = ref<Record<string, string>>({});
const receiveDraft = ref<ReceiveDraftItem[]>([]);
const filteredStocktakeProducts = computed(() => {
  const keyword = stocktakeQuery.value.trim().toLocaleLowerCase();
  if (!keyword) return inventorySummary.value.products;
  return inventorySummary.value.products.filter((product) => [
    product.productName,
    product.chineseName,
    product.englishName,
    product.sku,
    ...product.barcodes,
  ].some((value) => value?.toLocaleLowerCase().includes(keyword)));
});
const selectedIncreaseBatch = computed(() => increaseProduct.value?.batches.find(
  (batch) => batch.batchId === increaseBatchChoice.value,
) ?? null);
const increaseCurrentQuantity = computed(() => selectedIncreaseBatch.value?.quantity ?? 0);
const increaseResultQuantity = computed(() => increaseCurrentQuantity.value + (Number.isInteger(increaseQuantity.value) ? increaseQuantity.value : 0));
const milkCandidates = ref<MilkCandidate[]>([]);
const milkReviewFilter = ref<'PENDING' | 'APPROVED' | 'IGNORED'>('PENDING');
const milkReviewReasons = ref<Record<string, string>>({});
const productCandidates = ref<PosProductCandidate[]>([]);
const productReviewFilter = ref<'PENDING' | 'APPROVED' | 'IGNORED'>('PENDING');
const productReviewQuery = ref('');
const productReviewPage = ref(1);
const productReviewPageTotal = ref(0);
const productReviewTotal = ref(0);
const productReviewReasons = ref<Record<string, string>>({});

function createClientUuid(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }

  const bytes = new Uint8Array(16);
  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

type ReceiveDraftSnapshot = {
  version: 1;
  receiveSearch: string;
  barcode: string;
  productName: string;
  expiryMonth: string;
  expiryDay: number | null;
  receiveQuantity: number;
  selectedProduct: ProductResult | null;
  receiveDraft: ReceiveDraftItem[];
};

function receiveDraftStorageKey(): string | null {
  if (!userId.value || !storeId.value) return null;
  return `sunshine_inventory_receive_draft:${userId.value}:${storeId.value}`;
}

function persistReceiveDraft(): void {
  const key = receiveDraftStorageKey();
  if (!key) return;
  const hasWork = receiveDraft.value.length > 0
    || Boolean(receiveSearch.value.trim() || barcode.value.trim() || productName.value.trim()
      || expiryMonth.value || selectedProduct.value);
  if (!hasWork) {
    localStorage.removeItem(key);
    return;
  }
  const snapshot: ReceiveDraftSnapshot = {
    version: 1,
    receiveSearch: receiveSearch.value,
    barcode: barcode.value,
    productName: productName.value,
    expiryMonth: expiryMonth.value,
    expiryDay: expiryDay.value,
    receiveQuantity: receiveQuantity.value,
    selectedProduct: selectedProduct.value,
    receiveDraft: receiveDraft.value,
  };
  localStorage.setItem(key, JSON.stringify(snapshot));
}

function restoreReceiveDraft(): void {
  const key = receiveDraftStorageKey();
  if (!key) return;
  const saved = localStorage.getItem(key);
  if (!saved) return;
  try {
    const snapshot = JSON.parse(saved) as Partial<ReceiveDraftSnapshot>;
    if (snapshot.version !== 1 || !Array.isArray(snapshot.receiveDraft)) return;
    receiveSearch.value = typeof snapshot.receiveSearch === 'string' ? snapshot.receiveSearch : '';
    barcode.value = typeof snapshot.barcode === 'string' ? snapshot.barcode : '';
    productName.value = typeof snapshot.productName === 'string' ? snapshot.productName : '';
    expiryMonth.value = typeof snapshot.expiryMonth === 'string' ? snapshot.expiryMonth : '';
    expiryDay.value = Number.isInteger(snapshot.expiryDay) ? snapshot.expiryDay ?? null : null;
    receiveQuantity.value = Number.isInteger(snapshot.receiveQuantity) && Number(snapshot.receiveQuantity) > 0
      ? Number(snapshot.receiveQuantity)
      : 1;
    selectedProduct.value = snapshot.selectedProduct?.productId ? snapshot.selectedProduct : null;
    receiveDraft.value = snapshot.receiveDraft.filter((item) =>
      typeof item?.draftId === 'string'
      && typeof item?.barcode === 'string'
      && typeof item?.productName === 'string'
      && typeof item?.expiryMonth === 'string'
      && Number.isInteger(item?.quantity)
      && item.quantity > 0);
    if (receiveDraft.value.length || selectedProduct.value) {
      message.value = '已恢复上次未提交的入库草稿。';
    }
  } catch {
    localStorage.removeItem(key);
  }
}

restoreReceiveDraft();
watch(
  [receiveSearch, barcode, productName, expiryMonth, expiryDay, receiveQuantity, selectedProduct, receiveDraft],
  persistReceiveDraft,
  { deep: true, flush: 'sync' },
);

watch([query, receiveSearch], () => {
  showSearchDropdown.value = false;
});

function closeSearchDropdownOutside(event: PointerEvent) {
  const target = event.target;
  if (target instanceof Element && !target.closest('.product-search-shell')) {
    showSearchDropdown.value = false;
  }
}

onMounted(async () => {
  document.documentElement.dataset.theme = theme.value;
  document.addEventListener('pointerdown', closeSearchDropdownOutside);
  if (!token.value) return;
  if (!storeId.value) {
    logout();
    error.value = '旧登录信息缺少门店，请重新登录库存系统';
    return;
  }
  if (!warehouseId.value) {
    logout();
    error.value = '旧登录信息缺少仓库，请重新登录库存系统';
    return;
  }
  if (activeMode.value === 'home') {
    await loadWorkbench();
    return;
  }
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

async function reverseMovement(movement: Movement) {
  const reason = reversalReasons.value[movement.movementId]?.trim() ?? '';
  if (reason.length < 2) {
    error.value = '请填写至少2个字的撤销原因';
    return;
  }
  loading.value = true;
  clearStatus();
  try {
    const data = await apiRequest(`/inventory/movements/${movement.movementId}/reverse`, {
      method: 'POST',
      body: JSON.stringify({ reason, idempotencyKey: createClientUuid() }),
    });
    message.value = `已撤销 ${data.reversedMovementNo}，库存变化 ${data.quantityDelta > 0 ? '+' : ''}${data.quantityDelta} 件。`;
    delete reversalReasons.value[movement.movementId];
    await loadMovements();
  } catch (reasonValue) {
    error.value = reasonValue instanceof Error ? reasonValue.message : '撤销失败';
  } finally {
    loading.value = false;
  }
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
    userId.value = data.user.id;
    displayName.value = data.user.displayName;
    storeName.value = data.user.roles?.[0]?.storeName ?? '';
    storeId.value = data.user.roles?.[0]?.storeId ?? '';
    warehouseId.value = data.user.warehouses?.find((item: { canReceive?: boolean }) => item.canReceive)?.warehouseId
      ?? data.user.warehouses?.[0]?.warehouseId
      ?? '';
    mustChangePassword.value = data.user.mustChangePassword;
    localStorage.setItem(tokenKey, token.value);
    localStorage.setItem(profileKey, JSON.stringify(data.user));
    restoreReceiveDraft();
    password.value = '';
    activeMode.value = 'home';
    await loadWorkbench();
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : '登录失败';
  } finally {
    loading.value = false;
  }
}

function logout() {
  stopCameraScanner();
  token.value = '';
  userId.value = '';
  displayName.value = '';
  storeName.value = '';
  storeId.value = '';
  warehouseId.value = '';
  receiveSearch.value = '';
  barcode.value = '';
  productName.value = '';
  expiryMonth.value = '';
  expiryDay.value = null;
  receiveQuantity.value = 1;
  selectedProduct.value = null;
  showSearchDropdown.value = false;
  receiveDraft.value = [];
  localStorage.removeItem(tokenKey);
  localStorage.removeItem(profileKey);
}

async function switchMode(mode: Mode) {
  stopCameraScanner();
  activeMode.value = mode;
  if (mode === 'home' || mode === 'receive' || mode === 'issue' || mode === 'query' || mode === 'reports') {
    localStorage.setItem(modeKey, mode);
  }
  query.value = '';
  results.value = [];
  showSearchDropdown.value = false;
  selectedProduct.value = null;
  receiveSearch.value = '';
  barcode.value = '';
  productName.value = '';
  expiryMonth.value = '';
  expiryDay.value = null;
  clearStatus();
  if (mode === 'home') await loadWorkbench();
  if (mode === 'query') {
    if (lastReceivedBarcode.value) {
      query.value = lastReceivedBarcode.value;
      await searchProducts(lastReceivedBarcode.value);
      if (results.value.length) message.value = '已自动显示刚刚入库商品的最新库存。';
    }
    try {
      await loadInventoryReport();
    } catch (reason) {
      error.value = reason instanceof Error ? reason.message : '库存加载失败';
    }
  }
  if (mode === 'reports') await loadReport();
  if (mode === 'milkReview') await loadMilkCandidates();
  if (mode === 'productReview') await loadProductCandidates();
  nextTick(() => scanInput.value?.focus());
}

function stopCameraScanner() {
  cameraControls?.stop();
  cameraControls = null;
  const stream = cameraVideo.value?.srcObject;
  if (typeof MediaStream !== 'undefined' && stream instanceof MediaStream) stream.getTracks().forEach((track) => track.stop());
  if (cameraVideo.value) cameraVideo.value.srcObject = null;
  cameraOpen.value = false;
  cameraStatus.value = '';
}

async function acceptCameraBarcode(rawValue: string) {
  const value = rawValue.trim();
  const now = Date.now();
  if (!value || (value === lastCameraCode && now - lastCameraCodeAt < 1800)) return;
  lastCameraCode = value;
  lastCameraCodeAt = now;
  const target = cameraTarget.value;
  stopCameraScanner();
  if (target === 'receive') {
    receiveSearch.value = value;
    await lookupForReceive();
  } else {
    query.value = value;
    await searchProducts(value);
  }
}

async function startCameraScanner(target: 'receive' | 'issue') {
  cameraTarget.value = target;
  cameraOpen.value = true;
  cameraError.value = '';
  cameraStatus.value = '正在准备后置摄像头…';
  await nextTick();

  const localHost = ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);
  if (!window.isSecureContext && !localHost) {
    cameraError.value = '当前地址不是 HTTPS，手机浏览器禁止调用摄像头。配置 HTTPS 后即可使用；蓝牙扫码枪和手动输入仍可正常使用。';
    cameraStatus.value = '';
    return;
  }
  if (!navigator.mediaDevices?.getUserMedia || !cameraVideo.value) {
    cameraError.value = '当前浏览器无法调用摄像头，请使用最新版 Safari 或 Chrome。';
    cameraStatus.value = '';
    return;
  }

  try {
    const { BrowserMultiFormatOneDReader } = await import('@zxing/browser');
    const reader = new BrowserMultiFormatOneDReader();
    cameraControls = await reader.decodeFromConstraints({
      audio: false,
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1920 },
        height: { ideal: 1080 },
      },
    }, cameraVideo.value, (result) => {
      if (result) void acceptCameraBarcode(result.getText());
    });
    const stream = cameraVideo.value.srcObject;
    if (typeof MediaStream !== 'undefined' && stream instanceof MediaStream) {
      const track = stream.getVideoTracks()[0];
      const capabilities = track?.getCapabilities?.() as MediaTrackCapabilities & {
        focusMode?: string[];
      };
      if (track && capabilities?.focusMode?.includes('continuous')) {
        await track.applyConstraints({ advanced: [{ focusMode: 'continuous' } as MediaTrackConstraintSet] });
      }
    }
    cameraStatus.value = '距离条码约 10–20 厘米，保持条码清晰并完整放入扫描框';
  } catch (reason) {
    stopCameraScanner();
    cameraOpen.value = true;
    const name = reason instanceof DOMException ? reason.name : '';
    cameraError.value = name === 'NotAllowedError'
      ? '摄像头权限被拒绝，请在浏览器网站设置中允许摄像头后重试。'
      : '无法打开后置摄像头，请确认摄像头没有被其他应用占用。';
  }
}

onBeforeUnmount(() => {
  stopCameraScanner();
  document.removeEventListener('pointerdown', closeSearchDropdownOutside);
});

async function loadProductCandidates(page = productReviewPage.value) {
  if (!storeId.value) {
    error.value = '当前账号没有分配门店，无法审核POS商品';
    return;
  }
  loading.value = true;
  clearStatus();
  try {
    const params = new URLSearchParams({
      storeId: storeId.value,
      reviewStatus: productReviewFilter.value,
      page: String(page),
      pageSize: '50',
    });
    if (productReviewQuery.value.trim()) params.set('q', productReviewQuery.value.trim());
    const data = await apiRequest(`/pos/product-candidates?${params.toString()}`);
    productCandidates.value = data.items;
    productReviewPage.value = data.pagination.page;
    productReviewPageTotal.value = data.pagination.pageTotal;
    productReviewTotal.value = data.pagination.total;
    if (!data.items.length) message.value = '当前筛选条件下没有条码商品。';
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : 'POS商品候选加载失败';
  } finally {
    loading.value = false;
  }
}

async function importProductCandidates() {
  loading.value = true;
  clearStatus();
  try {
    const data = await apiRequest(`/pos/product-candidates/import?storeId=${encodeURIComponent(storeId.value)}`, { method: 'POST' });
    productReviewPage.value = 1;
    await loadProductCandidates(1);
    message.value = `POS共 ${data.sourceProducts} 个商品；有条码 ${data.withBarcode} 个；排除已处理奶粉 ${data.excludedMilkProducts} 个；待核对 ${data.reviewCandidates} 个。`;
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : '拉取POS条码商品失败';
  } finally {
    loading.value = false;
  }
}

async function reviewProductCandidate(candidate: PosProductCandidate, reviewStatus: 'APPROVED' | 'IGNORED') {
  const reason = productReviewReasons.value[candidate.id]?.trim() ?? '';
  if (reason.length < 2) {
    error.value = '请填写至少2个字的审核原因';
    return;
  }
  if (reviewStatus === 'APPROVED' && !candidate.chineseName?.trim()) {
    error.value = '批准前必须填写中文名称';
    return;
  }
  loading.value = true;
  clearStatus();
  try {
    await apiRequest(`/pos/product-candidates/${candidate.id}/review?storeId=${encodeURIComponent(storeId.value)}`, {
      method: 'PATCH',
      body: JSON.stringify({
        reviewStatus,
        englishName: candidate.englishName.trim(),
        ...(candidate.chineseName?.trim() ? { chineseName: candidate.chineseName.trim() } : {}),
        ...(candidate.brandName?.trim() ? { brandName: candidate.brandName.trim() } : {}),
        ...(candidate.categoryName?.trim() ? { categoryName: candidate.categoryName.trim() } : {}),
        reason,
        idempotencyKey: createClientUuid(),
      }),
    });
    delete productReviewReasons.value[candidate.id];
    await loadProductCandidates();
    message.value = reviewStatus === 'APPROVED' ? `已批准：${candidate.sourceName}` : `已忽略：${candidate.sourceName}`;
  } catch (reasonValue) {
    error.value = reasonValue instanceof Error ? reasonValue.message : '商品审核失败';
  } finally {
    loading.value = false;
  }
}

async function loadMilkCandidates() {
  if (!storeId.value) {
    error.value = '当前账号没有分配门店，无法审核奶粉商品';
    return;
  }
  loading.value = true;
  clearStatus();
  try {
    const data = await apiRequest(`/pos/milk-products?storeId=${encodeURIComponent(storeId.value)}&reviewStatus=${milkReviewFilter.value}&pageSize=100`);
    milkCandidates.value = data.items;
    if (!data.items.length) message.value = '当前筛选条件下没有奶粉候选商品。';
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : '奶粉候选商品加载失败';
  } finally {
    loading.value = false;
  }
}

async function importMilkCandidates() {
  loading.value = true;
  clearStatus();
  try {
    const data = await apiRequest(`/pos/milk-products/import?storeId=${encodeURIComponent(storeId.value)}`, { method: 'POST' });
    await loadMilkCandidates();
    message.value = `已从POS只读获取 ${data.sourceProducts} 个商品，识别出 ${data.milkCandidates} 个奶粉候选。`;
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : '拉取奶粉候选失败';
  } finally {
    loading.value = false;
  }
}

async function reviewMilkCandidate(candidate: MilkCandidate, reviewStatus: 'APPROVED' | 'IGNORED') {
  const reason = milkReviewReasons.value[candidate.id]?.trim() ?? '';
  if (reason.length < 2) {
    error.value = '请填写至少2个字的审核原因';
    return;
  }
  if (reviewStatus === 'APPROVED' && candidate.suggestedInventoryPolicy === 'REVIEW_REQUIRED') {
    error.value = '请先确认该商品是本地单罐还是外仓成箱';
    return;
  }
  loading.value = true;
  clearStatus();
  try {
    await apiRequest(`/pos/milk-products/${candidate.id}/review?storeId=${encodeURIComponent(storeId.value)}`, {
      method: 'PATCH',
      body: JSON.stringify({
        reviewStatus,
        brand: candidate.suggestedBrand,
        englishName: candidate.suggestedEnglishName,
        ...(candidate.suggestedChineseName?.trim() ? { chineseName: candidate.suggestedChineseName.trim() } : {}),
        ...(candidate.suggestedPackQuantity ? { packQuantity: candidate.suggestedPackQuantity } : {}),
        inventoryPolicy: candidate.suggestedInventoryPolicy,
        reason,
        idempotencyKey: createClientUuid(),
      }),
    });
    delete milkReviewReasons.value[candidate.id];
    await loadMilkCandidates();
    message.value = reviewStatus === 'APPROVED' ? `已批准：${candidate.sourceName}` : `已忽略：${candidate.sourceName}`;
  } catch (reasonValue) {
    error.value = reasonValue instanceof Error ? reasonValue.message : '审核失败';
  } finally {
    loading.value = false;
  }
}

async function searchProducts(searchText = query.value) {
  const value = searchText.trim();
  if (!value) return;
  loading.value = true;
  clearStatus();
  try {
    const data = await apiRequest(`/inventory/search?q=${encodeURIComponent(value)}`);
    results.value = data.products;
    const exactBarcodeProduct = results.value.find((product) => product.barcodes.includes(value));
    showSearchDropdown.value = results.value.length > 0 && !exactBarcodeProduct;
    if (exactBarcodeProduct && activeMode.value !== 'receive') results.value = [exactBarcodeProduct];
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
    barcode.value = value;
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
    message.value = '没有找到同名商品。可直接填写名称和日期；无条码商品会在提交时生成内部编号。';
  }
}

function chooseProduct(product: ProductResult) {
  selectedProduct.value = product;
  productName.value = product.productName;
  if (!barcode.value) barcode.value = product.barcodes[0] ?? '';
  results.value = [];
  showSearchDropdown.value = false;
  message.value = `已选择 ${product.productName}，全部条码库存会合并统计。`;
  nextTick(() => expiryMonthInput.value?.focus());
}

function selectSearchSuggestion(product: ProductResult) {
  if (activeMode.value === 'receive') {
    chooseProduct(product);
    return;
  }
  results.value = [product];
  showSearchDropdown.value = false;
  query.value = product.chineseName || product.productName;
  message.value = `已选择 ${product.productName}，显示全部到期批次。`;
}

function addReceiveDraft() {
  clearStatus();
  const itemBarcode = barcode.value.trim();
  const itemName = productName.value.trim();
  const itemQuantity = receiveQuantity.value;
  if (!itemName || !expiryMonth.value || !Number.isInteger(itemQuantity) || itemQuantity < 1) {
    error.value = '请填写商品名、到期年月和正确数量。条码可以不填。';
    return;
  }
  const itemDay = expiryDay.value || undefined;
  const duplicate = receiveDraft.value.find((item) =>
    item.barcode === itemBarcode && item.productName === itemName
    && item.expiryMonth === expiryMonth.value && item.expiryDay === itemDay);
  if (duplicate) duplicate.quantity += itemQuantity;
  else receiveDraft.value.push({
    draftId: createClientUuid(), barcode: itemBarcode, productName: itemName,
    productId: selectedProduct.value?.productId, expiryMonth: expiryMonth.value,
    expiryDay: itemDay, expiryDisplay: `${expiryMonth.value}${itemDay ? `-${String(itemDay).padStart(2, '0')}` : ''}`,
    quantity: itemQuantity,
  });
  message.value = duplicate ? `已累计 ${itemName}，清单数量 ${duplicate.quantity} 件。` : `已加入本次点货清单：${itemName}。`;
  receiveSearch.value = '';
  barcode.value = '';
  productName.value = '';
  expiryMonth.value = '';
  expiryDay.value = null;
  receiveQuantity.value = 1;
  selectedProduct.value = null;
  results.value = [];
  nextTick(() => scanInput.value?.focus());
}

function removeReceiveDraft(draftId: string) {
  receiveDraft.value = receiveDraft.value.filter((item) => item.draftId !== draftId);
}

async function confirmReceiveDraft() {
  if (!receiveDraft.value.length || loading.value) return;
  loading.value = true;
  clearStatus();
  let completed = 0;
  let receiptNo = '';
  try {
    for (const item of [...receiveDraft.value]) {
      const data = await apiRequest('/inventory/scan-receive', {
        method: 'POST', body: JSON.stringify({
          barcode: item.barcode || undefined, productName: item.productName, productId: item.productId,
          expiryMonth: item.expiryMonth, expiryDay: item.expiryDay, quantity: item.quantity,
          warehouseId: warehouseId.value, idempotencyKey: item.draftId,
        }),
      });
      completed += 1;
      receiptNo = data.receiptNo;
      lastReceivedBarcode.value = data.barcode || item.barcode;
      removeReceiveDraft(item.draftId);
    }
    message.value = `入库单 ${receiptNo} 已写入：${completed} 项。`;
  } catch (reason) {
    const detail = reason instanceof Error ? reason.message : '入库失败';
    error.value = `已成功 ${completed} 项，剩余 ${receiveDraft.value.length} 项未写入：${detail}`;
  } finally {
    loading.value = false;
    nextTick(() => scanInput.value?.focus());
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

async function loadWorkbench() {
  loading.value = true;
  clearStatus();
  try {
    await Promise.all([loadReceipts(), loadInventoryReport(), loadExpiryReport()]);
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : '工作台数据加载失败';
  } finally {
    loading.value = false;
  }
}

async function openReport(view: 'receipts' | 'inventory' | 'expiry' | 'movements') {
  reportView.value = view;
  await switchMode('reports');
}

async function openInventory(view: 'ledger' | 'stocktake' = 'ledger') {
  inventoryView.value = view;
  await switchMode('query');
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

function openStockIncrease(product: ProductResult) {
  increaseProduct.value = product;
  increaseBatchChoice.value = product.batches[0]?.batchId ?? 'new';
  increaseExpiryMonth.value = '';
  increaseExpiryDay.value = null;
  increaseQuantity.value = 1;
  increaseReason.value = '后续发现库存';
  clearStatus();
}

function closeStockIncrease() {
  if (!loading.value) increaseProduct.value = null;
}

async function submitStockIncrease() {
  const product = increaseProduct.value;
  const quantity = increaseQuantity.value;
  const reason = increaseReason.value.trim();
  const usesNewBatch = increaseBatchChoice.value === 'new';
  if (!product || !Number.isInteger(quantity) || quantity < 1 || reason.length < 2
    || (usesNewBatch && !increaseExpiryMonth.value)) {
    error.value = '请选择到期批次或填写新到期日期，并输入增加数量和至少2个字的原因。';
    return;
  }
  loading.value = true;
  clearStatus();
  try {
    const data = await apiRequest('/inventory/stock-increase', {
      method: 'POST',
      body: JSON.stringify({
        productId: product.productId,
        ...(usesNewBatch
          ? { expiryMonth: increaseExpiryMonth.value, expiryDay: increaseExpiryDay.value || undefined }
          : { batchId: increaseBatchChoice.value }),
        quantity,
        reason,
        warehouseId: warehouseId.value,
        idempotencyKey: createClientUuid(),
      }),
    });
    increaseProduct.value = null;
    message.value = `库存增加成功：${data.productName} ${data.expiryDate}，增加 ${data.quantityAdded} 件，现有 ${data.currentQuantity} 件。`;
    await loadInventoryReport();
    if (query.value.trim()) {
      await searchProducts(query.value);
      const refreshed = results.value.find((item) => item.productId === product.productId);
      if (refreshed) results.value = [refreshed];
      showSearchDropdown.value = false;
    }
  } catch (reasonValue) {
    error.value = reasonValue instanceof Error ? reasonValue.message : '库存增加失败';
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
    const refreshedProduct = results.value.find((item) => item.productId === product.productId);
    if (refreshedProduct) results.value = [refreshedProduct];
    showSearchDropdown.value = false;
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
    <section v-if="!token" class="login-card login-ip-card">
      <button class="theme-toggle login-theme-toggle" type="button" :aria-label="theme === 'light' ? '切换到深色模式' : '切换到浅色模式'" @click="toggleTheme">
        <span aria-hidden="true">{{ theme === 'light' ? '☾' : '☀' }}</span>{{ theme === 'light' ? 'Dark' : 'Light' }}
      </button>
      <div class="login-layout">
        <div class="login-form-panel">
          <div class="login-brand-row">
            <span class="login-logo-stage"><img class="login-logo" src="/sunshine-health-logo.png" alt="阳光特产 Sunshine Health" /></span>
            <p class="eyebrow">SUNSHINE HEALTH</p>
          </div>
          <p class="login-kicker">员工库存工作台</p>
          <h1>阳光特产库存管理</h1>
          <p class="summary">扫码点货、上架出库、日期查询，一站完成。</p>
          <form @submit.prevent="login">
            <label>员工账号<input v-model="username" autocomplete="username" autofocus placeholder="请输入员工账号" /></label>
            <label>密码<input v-model="password" type="password" autocomplete="current-password" placeholder="请输入密码" /></label>
            <p v-if="error" class="alert error">{{ error }}</p>
            <button class="login-submit" :disabled="loading" type="submit">{{ loading ? '登录中…' : '进入库存系统' }}</button>
          </form>
        </div>
        <div class="login-hero" aria-hidden="true">
          <img src="/inventory-open-capsule-hero.png" alt="" />
          <span class="animated-capsule"><i class="capsule-half capsule-blue"></i><i class="capsule-half capsule-pink"></i></span>
          <span class="powder-stream"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></span>
        </div>
      </div>
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

      <nav class="mode-tabs primary-navigation" aria-label="库存操作分类">
        <button :class="{ active: activeMode === 'home' }" @click="switchMode('home')">工作台</button>
        <button :class="{ active: activeMode === 'query' }" @click="switchMode('query')">库存</button>
        <button :class="{ active: activeMode === 'reports' }" @click="switchMode('reports')">记录与报表</button>
      </nav>

      <p v-if="message" class="alert success">{{ message }}</p>
      <p v-if="error" class="alert error">{{ error }}</p>

      <Transition name="panel" mode="out-in">
        <div :key="activeMode" class="mode-panel" :class="{ 'home-panel': activeMode === 'home' }">
      <nav v-if="activeMode === 'receive' || activeMode === 'issue'" class="operation-tabs" aria-label="入库与出库">
        <button :class="{ active: activeMode === 'receive' }" @click="switchMode('receive')">扫码入库</button>
        <button :class="{ active: activeMode === 'issue' }" @click="switchMode('issue')">扫码出库</button>
      </nav>
      <template v-if="activeMode === 'home'">
        <section class="workbench-page-header report-header">
          <h2>仓管通</h2>
        </section>
        <section class="workbench-hero">
          <div class="workbench-brand">
            <img src="/sunshine-health-wordmark.png" alt="阳光特产 Sunshine Health" />
            <small>当前仓库：{{ reportWarehouseName || storeName }}</small>
          </div>
          <div class="workbench-tools">
            <button class="workbench-eye" type="button" :aria-label="theme === 'light' ? '开启护眼模式' : '关闭护眼模式'" @click="toggleTheme"><span aria-hidden="true">{{ theme === 'light' ? '☾' : '☀' }}</span></button>
            <button class="workbench-profile" type="button" aria-label="打开个人设置" @click="showAccountPanel = true">{{ (displayName || '员工').slice(0, 1) }}</button>
          </div>
        </section>

        <section class="workbench-metrics" aria-label="今日库存概览">
          <button type="button" @click="openReport('inventory')"><span class="metric-icon inventory-icon">▣</span><small>当前库存</small><strong>{{ inventorySummary.totalQuantity }}</strong><em>{{ inventorySummary.productCount }} 种商品</em></button>
          <button type="button" @click="openReport('receipts')"><span class="metric-icon receive-icon">↓</span><small>今日入库</small><strong>{{ receiptSummary.totalQuantity }}</strong><em>{{ receiptSummary.receiptCount }} 张入库单</em></button>
          <button type="button" @click="switchMode('receive')"><span class="metric-icon draft-icon">▤</span><small>待提交点货</small><strong>{{ receiveDraft.reduce((sum, item) => sum + item.quantity, 0) }}</strong><em>{{ receiveDraft.length }} 种商品</em></button>
          <button type="button" @click="openReport('expiry')"><span class="metric-icon warning-icon">!</span><small>到期关注</small><strong>{{ Object.values(expirySummary).reduce((sum, count) => sum + count, 0) }}</strong><em>6个月内批次</em></button>
        </section>

        <section class="quick-actions" aria-labelledby="quick-action-title">
          <div class="section-heading"><h2 id="quick-action-title">快捷操作</h2></div>
          <div class="quick-action-grid">
            <button type="button" @click="switchMode('receive')"><span>⌗</span><strong>扫码入库</strong><small>蓝牙扫码枪或手动条码</small></button>
            <button type="button" @click="switchMode('issue')"><span>↗</span><strong>扫码出库</strong><small>按日期批次扣减库存</small></button>
            <button type="button" @click="switchMode('query')"><span>⌕</span><strong>库存查询</strong><small>查看商品与到期批次</small></button>
            <button type="button" @click="openInventory('stocktake')"><span>✓</span><strong>库存盘点</strong><small>记录盘盈、盘亏及原因</small></button>
            <button type="button" @click="openReport('expiry')"><span>!</span><strong>临期预警</strong><small>查看2、3、6个月预警</small></button>
            <button type="button" @click="openReport('receipts')"><span>≡</span><strong>入库记录</strong><small>查看和完成当天入库单</small></button>
          </div>
        </section>

        <aside v-if="receiveDraft.length" class="draft-reminder">
          <div><strong>当天未提交</strong><p>{{ receiveDraft.length }} 种商品，共 {{ receiveDraft.reduce((sum, item) => sum + item.quantity, 0) }} 件；点击后可继续扫码或提交。</p></div>
          <button class="action-primary" type="button" @click="switchMode('receive')">继续点货</button>
        </aside>
      </template>

      <template v-else-if="activeMode === 'receive'">
        <section class="section-heading scanner-heading"><h2>条码 / 商品名称</h2><span class="scanner-status" :class="{ ready: scanReady }"><i></i>{{ scanReady ? '扫码输入就绪' : '点击输入框后扫码' }}</span></section>
        <div class="product-search-shell">
          <div class="search-row scan-search-row">
            <input ref="scanInput" v-model="receiveSearch" aria-label="查询条码或商品名称" placeholder="扫描条码或输入商品名称关键词" autocomplete="off" @focus="scanReady = true" @blur="scanReady = false" @keydown.esc="showSearchDropdown = false" @keydown.enter.prevent="lookupForReceive" />
            <button class="action-secondary" :disabled="loading || !receiveSearch.trim()" @click="lookupForReceive">查询</button>
            <button class="camera-scan-button" type="button" aria-label="打开手机相机扫码入库" @click="startCameraScanner('receive')"><span aria-hidden="true">▣</span> 相机扫码</button>
          </div>
          <div v-if="showSearchDropdown && results.length" class="product-search-dropdown" role="listbox" aria-label="商品搜索结果">
            <button v-for="product in results" :key="product.productId" type="button" role="option" @pointerdown.prevent="selectSearchSuggestion(product)">
              <span><strong>{{ product.chineseName || product.productName }}</strong><small v-if="product.englishName && product.englishName !== product.chineseName">{{ product.englishName }}</small><small>{{ product.barcodes.join('、') || product.sku || '无条码' }}</small></span>
              <span class="search-option-stock"><b>{{ product.totalQuantity }}</b> 件<small>{{ product.batches[0]?.expiryDate ? `最近 ${product.batches[0].expiryDate}` : '暂无批次' }}</small></span>
            </button>
          </div>
        </div>

        <article v-if="selectedProduct" class="receive-product-card" aria-live="polite">
          <div>
            <span class="product-confirmed">已识别商品</span>
            <h3>{{ selectedProduct.chineseName || selectedProduct.productName }}</h3>
            <p v-if="selectedProduct.englishName && selectedProduct.englishName !== selectedProduct.chineseName">{{ selectedProduct.englishName }}</p>
          </div>
          <dl>
            <div><dt>SKU</dt><dd>{{ selectedProduct.sku || '—' }}</dd></div>
            <div><dt>条码</dt><dd>{{ barcode }}</dd></div>
          </dl>
        </article>

        <form class="receive-form" @submit.prevent="addReceiveDraft">
          <label v-if="!selectedProduct">条码（可不填）<input v-model="barcode" maxlength="128" placeholder="扫描条码" /></label>
          <label v-if="!selectedProduct">商品名<input v-model="productName" required maxlength="255" /></label>
          <label class="expiry-label">到期日期
            <span class="expiry-fields">
              <input ref="expiryMonthInput" v-model="expiryMonth" required type="month" aria-label="到期年月" />
              <input v-model.number="expiryDay" type="number" min="1" max="31" aria-label="到期日（可不选）" placeholder="日（可不选）" />
            </span>
          </label>
          <label>数量<input v-model.number="receiveQuantity" required type="number" min="1" step="1" /></label>
          <button class="receive-submit action-secondary" :disabled="loading || !productName.trim() || !expiryMonth">加入本次清单</button>
        </form>
        <section class="receive-draft" aria-label="本次点货清单">
          <div class="draft-heading"><div><h3>本次点货清单</h3><p>先核对清单，确认后才写入库存；未提交内容会自动保存在本机。</p></div><strong>{{ receiveDraft.length }} 项 · {{ receiveDraft.reduce((sum, item) => sum + item.quantity, 0) }} 件</strong></div>
          <div v-if="receiveDraft.length" class="table-wrap receive-draft-table-wrap">
            <table class="receive-draft-table">
              <thead><tr><th>条码</th><th>商品名</th><th>到期日期</th><th>数量</th><th>操作</th></tr></thead>
              <tbody><tr v-for="item in receiveDraft" :key="item.draftId"><td data-label="条码">{{ item.barcode || '无条码（自动编号）' }}</td><td data-label="商品名">{{ item.productName }}</td><td data-label="到期日期">{{ item.expiryDisplay }}</td><td data-label="数量"><input v-model.number="item.quantity" class="table-input quantity-input" type="number" min="1" step="1" :aria-label="`${item.productName} 清单数量`" /></td><td data-label="操作"><button class="secondary danger-action" type="button" @click="removeReceiveDraft(item.draftId)">删除</button></td></tr></tbody>
            </table>
            <button class="confirm-draft action-primary" type="button" :disabled="loading || receiveDraft.some((item) => !Number.isInteger(item.quantity) || item.quantity < 1)" @click="confirmReceiveDraft">{{ loading ? '正在写入…' : '确认整单入库' }}</button>
          </div>
          <p v-else class="empty-state compact">扫描并填写日期后，商品会先出现在这里。</p>
        </section>
      </template>

      <template v-else-if="activeMode === 'productReview'">
        <section class="milk-review-heading">
          <div><h2>POS条码商品中英文核对</h2><p>这里只保存本地候选；填写中文名称并批准后，才更新本地商品主档和映射。</p></div>
          <button class="action-secondary" :disabled="loading || !storeId" @click="importProductCandidates">{{ loading ? '正在分页读取POS商品…' : '从POS只读拉取有条码商品' }}</button>
        </section>
        <div class="report-actions milk-review-actions">
          <label>审核状态
            <select v-model="productReviewFilter" @change="productReviewPage = 1; loadProductCandidates(1)">
              <option value="PENDING">待审核</option><option value="APPROVED">已批准</option><option value="IGNORED">已忽略</option>
            </select>
          </label>
          <label>搜索<input v-model="productReviewQuery" placeholder="英文名、中文名、SKU或条码" @keydown.enter.prevent="productReviewPage = 1; loadProductCandidates(1)" /></label>
          <button class="secondary" :disabled="loading" @click="productReviewPage = 1; loadProductCandidates(1)">查询</button>
          <span>共 {{ productReviewTotal }} 个</span>
        </div>
        <div v-if="productCandidates.length" class="milk-review-list">
          <article v-for="candidate in productCandidates" :key="candidate.id" class="milk-review-card">
            <header>
              <div><strong>{{ candidate.sourceName }}</strong><small>SKU {{ candidate.sourceSku || '无' }} · Barcode {{ candidate.barcode }} · ${{ candidate.salePrice || '0.00' }} · POS库存 {{ candidate.sourceStock || '—' }}</small></div>
              <span class="level-badge">{{ candidate.reviewStatus === 'PENDING' ? '待审核' : candidate.reviewStatus === 'APPROVED' ? '已批准' : '已忽略' }}</span>
            </header>
            <div class="milk-review-fields product-review-fields">
              <label>英文名称<input v-model="candidate.englishName" maxlength="255" /></label>
              <label>中文名称<input v-model="candidate.chineseName" maxlength="255" placeholder="批准前必须填写" /></label>
              <label>品牌<input v-model="candidate.brandName" maxlength="80" placeholder="可选" /></label>
              <label>本地类目<input v-model="candidate.categoryName" maxlength="120" placeholder="如：保健品 / 蜂蜜" /></label>
              <label>审核备注<input v-model="productReviewReasons[candidate.id]" maxlength="255" placeholder="如：已核对中英文名称" /></label>
            </div>
            <div v-if="candidate.reviewStatus === 'PENDING'" class="milk-review-buttons">
              <button class="action-primary" :disabled="loading" @click="reviewProductCandidate(candidate, 'APPROVED')">确认并批准</button>
              <button class="secondary danger-action" :disabled="loading" @click="reviewProductCandidate(candidate, 'IGNORED')">忽略该商品</button>
            </div>
          </article>
          <div class="pagination-actions">
            <button class="secondary" :disabled="loading || productReviewPage <= 1" @click="loadProductCandidates(productReviewPage - 1)">上一页</button>
            <span>第 {{ productReviewPage }} / {{ productReviewPageTotal || 1 }} 页</span>
            <button class="secondary" :disabled="loading || productReviewPage >= productReviewPageTotal" @click="loadProductCandidates(productReviewPage + 1)">下一页</button>
          </div>
        </div>
        <p v-else class="empty-state">{{ loading ? '正在读取POS商品，请稍候…' : '还没有条码商品候选。点击“从POS只读拉取有条码商品”。' }}</p>
      </template>

      <template v-else-if="activeMode === 'milkReview'">
        <section class="milk-review-heading">
          <div><h2>奶粉商品人工核对</h2><p>你确认前只保存候选数据，不扣库存、不修改收银机。</p></div>
          <button class="action-secondary" :disabled="loading || !storeId" @click="importMilkCandidates">{{ loading ? '正在读取POS商品，请稍候…' : '从POS只读拉取' }}</button>
        </section>
        <div class="report-actions milk-review-actions">
          <label>审核状态
            <select v-model="milkReviewFilter" @change="loadMilkCandidates">
              <option value="PENDING">待审核</option><option value="APPROVED">已批准</option><option value="IGNORED">已忽略</option>
            </select>
          </label>
          <button class="secondary" :disabled="loading" @click="loadMilkCandidates">刷新列表</button>
        </div>
        <div v-if="milkCandidates.length" class="milk-review-list">
          <article v-for="candidate in milkCandidates" :key="candidate.id" class="milk-review-card">
            <header><div><strong>{{ candidate.sourceName }}</strong><small>SKU {{ candidate.sourceSku || '无' }} · Barcode {{ candidate.barcode || '无' }} · ${{ candidate.salePrice || '0.00' }}</small></div><span class="level-badge">{{ candidate.reviewStatus === 'PENDING' ? '待审核' : candidate.reviewStatus === 'APPROVED' ? '已批准' : '已忽略' }}</span></header>
            <p class="recognition-note">{{ candidate.recognitionReason }}</p>
            <div class="milk-review-fields">
              <label>品牌<input v-model="candidate.suggestedBrand" maxlength="80" /></label>
              <label>英文名称<input v-model="candidate.suggestedEnglishName" maxlength="255" /></label>
              <label>中文名称<input v-model="candidate.suggestedChineseName" maxlength="255" placeholder="可稍后补充" /></label>
              <label>库存处理<select v-model="candidate.suggestedInventoryPolicy"><option value="REVIEW_REQUIRED">待确认</option><option value="LOCAL_STOCK">本地单罐（可扣库存）</option><option value="EXTERNAL_WAREHOUSE">外仓邮寄（只统计）</option></select></label>
              <label>每箱罐数<input v-model.number="candidate.suggestedPackQuantity" type="number" min="2" max="100" :disabled="candidate.suggestedInventoryPolicy !== 'EXTERNAL_WAREHOUSE'" placeholder="如 6" /></label>
              <label>审核原因<input v-model="milkReviewReasons[candidate.id]" maxlength="255" placeholder="如：确认6罐整箱外仓发货" /></label>
            </div>
            <div v-if="candidate.reviewStatus === 'PENDING'" class="milk-review-buttons">
              <button class="action-primary" :disabled="loading" @click="reviewMilkCandidate(candidate, 'APPROVED')">确认并批准</button>
              <button class="secondary danger-action" :disabled="loading" @click="reviewMilkCandidate(candidate, 'IGNORED')">忽略该商品</button>
            </div>
          </article>
        </div>
        <p v-else class="empty-state">{{ loading ? '正在分页读取3658个POS商品，通常需要约1分钟…' : '还没有可显示的奶粉候选。点击“从POS只读拉取”后再逐条核对。' }}</p>
      </template>

      <template v-else-if="activeMode === 'reports'">
        <section class="report-header">
          <h2>记录与报表</h2>
          <div class="report-switch secondary-navigation" aria-label="报表分类">
            <button :class="{ active: reportView === 'receipts' }" @click="reportView = 'receipts'; loadReport()">当天入库表</button>
            <button :class="{ active: reportView === 'inventory' }" @click="reportView = 'inventory'; loadReport()">总库存表</button>
            <button :class="{ active: reportView === 'expiry' }" @click="reportView = 'expiry'; loadReport()">临期预警</button>
            <button :class="{ active: reportView === 'movements' }" @click="reportView = 'movements'; loadReport()">库存流水</button>
          </div>
        </section>

        <template v-if="reportView === 'receipts'">
          <div class="report-actions">
            <label class="report-date-field">入库日期
              <span class="report-date-control">
                <strong>{{ reportDate.replace(/^(\d{4})-(\d{2})-(\d{2})$/, '$1年$2月$3日') }}</strong>
                <input v-model="reportDate" aria-label="选择入库日期" type="date" @change="loadReport" />
              </span>
            </label>
            <button class="secondary" :disabled="loading" @click="loadReport">刷新</button>
            <button class="secondary" :disabled="!receipts.length" @click="exportReceipts">导出 CSV</button>
            <button class="action-primary" :disabled="loading || !receipts.some((receipt) => receipt.status === 'OPEN')" @click="completeCurrentReceipt">完成我的入库单</button>
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
                  <tbody><tr v-for="item in receipt.items" :key="item.itemId" :class="{ 'reversed-row': item.reversed }"><td>{{ item.barcode }}</td><td>{{ item.productName }} <small v-if="!item.reversed && item.entryCount && item.entryCount > 1">（合并 {{ item.entryCount }} 次录入）</small></td><td>{{ item.expiryDate }}</td><td>{{ item.quantity }} 件 <span v-if="item.reversed" class="reversed-label">已撤销</span></td><td>{{ new Date(item.createdAt).toLocaleTimeString() }}</td></tr></tbody>
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
          <div class="report-actions movement-actions">
            <label>商品、条码或流水号<input v-model="movementQuery" placeholder="输入关键词查询最近100条" @keydown.enter.prevent="loadReport" /></label>
            <button class="secondary" :disabled="loading" @click="loadReport">查询流水</button>
          </div>
          <div v-if="movements.length" class="movement-history">
          <div class="table-wrap inventory-table report-detail-panel movement-desktop-table">
            <table>
              <thead><tr><th>时间</th><th>类型</th><th>商品</th><th>条码</th><th>到期日期</th><th>数量变化</th><th>原因/关联</th><th>管理员操作</th></tr></thead>
              <tbody><tr v-for="movement in movements" :key="movement.movementId" :class="{ 'reversed-row': movement.reversed }"><td>{{ new Date(movement.createdAt).toLocaleString() }}</td><td><span class="movement-badge" :class="movement.quantityDelta > 0 ? 'gain' : 'loss'">{{ movement.movementLabel }}</span><span v-if="movement.reversed" class="reversed-label">已撤销</span></td><td>{{ movement.productName }}</td><td>{{ movement.barcodes.join('、') }}</td><td>{{ movement.expiryDate }}</td><td :class="movement.quantityDelta > 0 ? 'delta-gain' : 'delta-loss'">{{ movement.quantityDelta > 0 ? '+' : '' }}{{ movement.quantityDelta }}</td><td><span>{{ movement.reason || '—' }}</span><small v-if="movement.reversalOfMovementNo" class="movement-link">撤销：{{ movement.reversalOfMovementNo }}</small><small v-if="movement.reversedByMovementNo" class="movement-link">冲销：{{ movement.reversedByMovementNo }}</small></td><td><div v-if="movement.canReverse" class="reversal-action"><input v-model="reversalReasons[movement.movementId]" :aria-label="`${movement.movementNo} 撤销原因`" maxlength="255" placeholder="撤销原因" /><button class="secondary danger-action" :disabled="loading || (reversalReasons[movement.movementId]?.trim().length ?? 0) < 2" @click="reverseMovement(movement)">撤销</button></div><span v-else>—</span></td></tr></tbody>
            </table>
          </div>
          <div class="movement-mobile-list">
            <article v-for="movement in movements" :key="movement.movementId" class="movement-mobile-card">
              <div class="movement-mobile-heading"><span class="movement-badge" :class="movement.quantityDelta > 0 ? 'gain' : 'loss'">{{ movement.movementLabel }}</span><strong :class="movement.quantityDelta > 0 ? 'delta-gain' : 'delta-loss'">{{ movement.quantityDelta > 0 ? '+' : '' }}{{ movement.quantityDelta }} 件</strong></div>
              <h3>{{ movement.productName }}</h3><p>{{ movement.barcodes.join('、') || '无条码' }} · 到期 {{ movement.expiryDate }}</p>
              <dl><div><dt>时间</dt><dd>{{ new Date(movement.createdAt).toLocaleString() }}</dd></div><div><dt>操作人</dt><dd>{{ movement.performedBy }}</dd></div><div><dt>原因</dt><dd>{{ movement.reason || '—' }}</dd></div></dl>
              <div v-if="movement.canReverse" class="reversal-action"><input v-model="reversalReasons[movement.movementId]" :aria-label="`${movement.movementNo} 撤销原因`" maxlength="255" placeholder="填写撤销原因" /><button class="secondary danger-action" :disabled="loading || (reversalReasons[movement.movementId]?.trim().length ?? 0) < 2" @click="reverseMovement(movement)">撤销</button></div>
            </article>
          </div>
          </div>
          <p v-else class="empty-state">没有找到库存流水。</p>
        </template>
      </template>

      <template v-else>
        <section v-if="activeMode === 'query'" class="inventory-page-header report-header">
          <h2>库存管理</h2>
          <nav class="inventory-section-tabs secondary-navigation" aria-label="库存分类">
            <button :class="{ active: inventoryView === 'ledger' }" @click="inventoryView = 'ledger'; results = []; clearStatus()">库存台账</button>
            <button :class="{ active: inventoryView === 'stocktake' }" @click="inventoryView = 'stocktake'; results = []; clearStatus()">库存盘点</button>
          </nav>
        </section>
        <section v-if="activeMode === 'issue' || inventoryView === 'ledger'" class="section-heading inventory-page-heading" :class="{ 'inventory-summary-heading': activeMode === 'query' }">
          <div><h2 v-if="activeMode === 'issue'">查找要出库的商品</h2><p v-if="activeMode === 'query'">共 {{ inventorySummary.productCount }} 种商品 · {{ inventorySummary.totalQuantity }} 件库存</p></div>
          <button v-if="activeMode === 'query'" class="inventory-refresh secondary" :disabled="loading" @click="loadInventoryReport">刷新</button>
        </section>
        <div v-if="activeMode === 'issue' || inventoryView === 'ledger'" class="product-search-shell">
          <div class="search-row inventory-search-row" :class="{ 'has-camera-button': activeMode === 'issue' }">
            <input ref="scanInput" v-model="query" aria-label="商品关键词或条码" placeholder="输入商品名称、相近词或扫描条码" autocomplete="off" @focus="scanReady = true" @blur="scanReady = false" @keydown.esc="showSearchDropdown = false" @keydown.enter.prevent="searchProducts()" />
            <button class="action-secondary" :disabled="loading || !query.trim()" @click="searchProducts()">查询</button>
            <button v-if="activeMode === 'issue'" class="camera-scan-button" type="button" aria-label="打开手机相机扫码出库" @click="startCameraScanner('issue')"><span aria-hidden="true">▣</span> 相机扫码</button>
          </div>
          <div v-if="showSearchDropdown && results.length" class="product-search-dropdown" role="listbox" aria-label="商品搜索结果">
            <button v-for="product in results" :key="product.productId" type="button" role="option" @pointerdown.prevent="selectSearchSuggestion(product)">
              <span><strong>{{ product.chineseName || product.productName }}</strong><small v-if="product.englishName && product.englishName !== product.chineseName">{{ product.englishName }}</small><small>{{ product.barcodes.join('、') || product.sku || '无条码' }}</small></span>
              <span class="search-option-stock"><b>{{ product.totalQuantity }}</b> 件<small>{{ product.batches[0]?.expiryDate ? `最近 ${product.batches[0].expiryDate}` : '暂无批次' }}</small></span>
            </button>
          </div>
        </div>
        <section v-if="activeMode === 'query' && inventoryView === 'ledger' && !results.length" class="inventory-browser" aria-label="现有库存">
          <div class="inventory-browser-title"><h3>现有库存</h3><span>{{ inventorySummary.productCount }} 种</span></div>
          <div v-if="inventorySummary.products.length" class="inventory-card-list">
            <article v-for="product in inventorySummary.products" :key="product.productId" class="inventory-stock-card">
              <div class="inventory-stock-main"><div><h3>{{ product.chineseName || product.productName }}</h3><p v-if="product.englishName && product.englishName !== product.chineseName">{{ product.englishName }}</p><small>{{ product.barcodes.join('、') || product.sku || '无条码' }}</small></div><strong>{{ product.totalQuantity }}<small>件</small></strong></div>
              <div class="inventory-batches"><span v-for="batch in product.batches" :key="batch.batchId"><em>{{ batch.expiryDate }}</em>{{ batch.quantity }} 件</span></div>
              <div class="inventory-stock-actions"><button class="secondary" type="button" @click="openStockIncrease(product)">库存增加</button></div>
            </article>
          </div>
          <p v-else class="empty-state compact">当前仓库还没有库存。</p>
        </section>
        <section v-if="activeMode === 'query' && inventoryView === 'stocktake'" class="stocktake-workspace">
          <div class="expiry-note stocktake-note">填写现场实际数量和盘点原因，系统只记录盘盈或盘亏，不会修改 POS。</div>
          <div class="search-row inventory-search-row stocktake-search-row">
            <input v-model="stocktakeQuery" aria-label="筛选盘点商品" placeholder="输入商品名称或扫描条码筛选" />
            <button class="action-secondary" type="button" :disabled="!stocktakeQuery" @click="stocktakeQuery = ''">清除</button>
          </div>
          <div v-if="filteredStocktakeProducts.length" class="stocktake-desktop-table table-wrap inventory-table">
            <table><thead><tr><th>商品</th><th>到期日期</th><th>系统数量</th><th>实际数量</th><th>原因</th><th>操作</th></tr></thead>
              <tbody v-for="product in filteredStocktakeProducts" :key="product.productId"><tr v-for="batch in product.batches" :key="batch.batchId"><td>{{ product.productName }}</td><td>{{ batch.expiryDate }}</td><td>{{ batch.quantity }} 件</td><td><input v-model.number="stocktakeActual[batch.batchId]" :aria-label="`${product.productName} ${batch.expiryDate} 实际数量`" class="table-input quantity-input" type="number" min="0" step="1" placeholder="实际数量" /></td><td><input v-model="stocktakeReasons[batch.batchId]" :aria-label="`${product.productName} ${batch.expiryDate} 盘点原因`" class="table-input" maxlength="255" placeholder="如：现场盘点" /></td><td><button class="action-primary compact-action" :disabled="loading" @click="adjustStocktake(product, batch)">确认调整</button></td></tr></tbody>
            </table>
          </div>
          <div v-if="filteredStocktakeProducts.length" class="stocktake-mobile-list">
            <template v-for="product in filteredStocktakeProducts" :key="product.productId"><article v-for="batch in product.batches" :key="batch.batchId" class="stocktake-mobile-card"><div class="stocktake-card-heading"><div><h3>{{ product.chineseName || product.productName }}</h3><p>{{ product.barcodes.join('、') || product.sku || '无条码' }}</p></div><strong>{{ batch.quantity }}<small>系统件数</small></strong></div><div class="stocktake-card-meta"><span>到期日期</span><b>{{ batch.expiryDate }}</b></div><label>现场实际数量<input v-model.number="stocktakeActual[batch.batchId]" :aria-label="`${product.productName} ${batch.expiryDate} 实际数量`" type="number" min="0" step="1" placeholder="请输入实际数量" /></label><label>盘点原因<input v-model="stocktakeReasons[batch.batchId]" :aria-label="`${product.productName} ${batch.expiryDate} 盘点原因`" maxlength="255" placeholder="如：现场盘点、破损、同步差异" /></label><button class="action-primary" :disabled="loading" @click="adjustStocktake(product, batch)">确认盘点</button></article></template>
          </div>
          <p v-if="!filteredStocktakeProducts.length" class="empty-state">{{ stocktakeQuery ? '没有找到匹配的盘点商品。' : '当前仓库没有可盘点库存。' }}</p>
        </section>
      </template>

      <section v-if="results.length && !showSearchDropdown" class="result-list">
        <article v-for="product in results" :key="product.productId" class="product-card">
          <div class="product-summary">
            <div><h3>{{ product.chineseName || product.productName }}</h3><p v-if="product.englishName && product.englishName !== product.chineseName">{{ product.englishName }}</p><p>SKU：{{ product.sku || '—' }} · 条码：{{ product.barcodes.join('、') || '无' }}</p></div>
            <strong>总库存 {{ product.totalQuantity }} 件</strong>
          </div>
          <div v-if="activeMode === 'receive'" class="bind-action">
            <button class="secondary" @click="chooseProduct(product)">选择这个商品入库</button>
          </div>
          <div v-if="activeMode === 'query'" class="bind-action inventory-result-actions">
            <button class="action-primary" type="button" @click="openStockIncrease(product)">库存增加</button>
          </div>
          <div v-for="batch in product.batches" :key="batch.batchId" class="batch-row">
            <div class="batch-value"><small>到期日期</small><strong>{{ batch.expiryDate }}</strong></div>
            <div class="batch-value quantity-value"><small>库存数量</small><strong>{{ batch.quantity }} 件</strong></div>
            <div v-if="activeMode === 'issue'" class="issue-action">
              <input v-model.number="issueQuantities[batch.batchId]" :aria-label="`${batch.expiryDate} 出库数量`" type="number" min="1" :max="batch.quantity" placeholder="数量" />
              <button class="action-primary" :disabled="loading || batch.quantity < 1" @click="issueBatch(product, batch)">确认出库</button>
            </div>
          </div>
          <p v-if="!product.batches.length" class="empty">暂无日期库存</p>
        </article>
      </section>
        </div>
      </Transition>

      <nav class="mobile-bottom-nav" aria-label="手机库存操作">
        <button :class="{ active: activeMode === 'home' }" @click="switchMode('home')"><span>⌂</span>工作台</button>
        <button :class="{ active: activeMode === 'query' }" @click="switchMode('query')"><span>⌕</span>库存</button>
        <button :class="{ active: activeMode === 'reports' }" @click="switchMode('reports')"><span>▤</span>记录</button>
      </nav>

      <div v-if="cameraOpen" class="camera-scanner-overlay" role="dialog" aria-modal="true" aria-label="手机相机扫码">
        <section class="camera-scanner-sheet">
          <header><button type="button" aria-label="关闭相机扫码" @click="stopCameraScanner">×</button><div><strong>{{ cameraTarget === 'receive' ? '扫码入库' : '扫码出库' }}</strong><small>扫描商品条形码</small></div><span></span></header>
          <div v-if="!cameraError" class="camera-viewport">
            <video ref="cameraVideo" autoplay muted playsinline></video>
            <div class="camera-guide"><i></i><i></i><i></i><i></i><span></span></div>
          </div>
          <p v-if="cameraStatus" class="camera-status">{{ cameraStatus }}</p>
          <div v-if="cameraError" class="camera-error"><strong>暂时无法打开相机</strong><p>{{ cameraError }}</p></div>
          <button v-if="cameraError" class="camera-close-action" type="button" @click="stopCameraScanner">返回手动输入</button>
        </section>
      </div>

      <div v-if="showAccountPanel" class="account-overlay" role="presentation" @click.self="showAccountPanel = false">
        <section class="account-sheet" role="dialog" aria-modal="true" aria-label="个人设置">
          <button class="account-close" type="button" aria-label="关闭个人设置" @click="showAccountPanel = false">×</button>
          <p class="account-eyebrow">账户与设置</p>
          <div class="account-avatar">{{ (displayName || '员工').slice(0, 1) }}</div><div class="account-heading"><h2>{{ displayName || '员工' }}</h2><p>库存作业账号</p></div>
          <dl class="account-details"><div><dt>所属门店</dt><dd>{{ storeName || '未分配门店' }}</dd></div><div><dt>作业仓库</dt><dd>{{ reportWarehouseName || '当前授权仓库' }}</dd></div><div><dt>当前日期</dt><dd>{{ reportDate }}</dd></div></dl>
          <div class="account-actions"><button class="secondary" type="button" @click="toggleTheme">{{ theme === 'light' ? '开启护眼模式' : '关闭护眼模式' }}</button><button class="account-logout" type="button" @click="logout">退出当前账号</button></div>
        </section>
      </div>

      <div v-if="increaseProduct" class="account-overlay" role="presentation" @click.self="closeStockIncrease">
        <section class="stock-increase-sheet" role="dialog" aria-modal="true" aria-label="库存增加">
          <button class="account-close" type="button" aria-label="关闭库存增加" @click="closeStockIncrease">×</button>
          <p class="account-eyebrow">库存增加</p>
          <h2>{{ increaseProduct.chineseName || increaseProduct.productName }}</h2>
          <p class="stock-increase-code">{{ increaseProduct.barcodes.join('、') || increaseProduct.sku || '无条码商品' }}</p>
          <label>到期批次
            <select v-model="increaseBatchChoice">
              <option v-for="batch in increaseProduct.batches" :key="batch.batchId" :value="batch.batchId">{{ batch.expiryDate }} · 当前 {{ batch.quantity }} 件</option>
              <option value="new">＋ 新的到期日期</option>
            </select>
          </label>
          <label v-if="increaseBatchChoice === 'new'">新到期日期
            <span class="expiry-fields"><input v-model="increaseExpiryMonth" type="month" aria-label="库存增加到期年月" /><input v-model.number="increaseExpiryDay" type="number" min="1" max="31" aria-label="库存增加到期日（可不选）" placeholder="日（可不选）" /></span>
          </label>
          <label>增加数量<input v-model.number="increaseQuantity" aria-label="库存增加数量" type="number" min="1" step="1" /></label>
          <label>增加原因<input v-model="increaseReason" aria-label="库存增加原因" maxlength="255" placeholder="如：后续发现库存" /></label>
          <div class="stock-change-preview"><span>当前批次数量<strong>{{ increaseCurrentQuantity }}</strong></span><i>→</i><span>调整后数量<strong>{{ increaseResultQuantity }}</strong></span></div>
          <button class="action-primary stock-increase-confirm" type="button" :disabled="loading || increaseQuantity < 1 || increaseReason.trim().length < 2 || (increaseBatchChoice === 'new' && !increaseExpiryMonth)" @click="submitStockIncrease">{{ loading ? '正在增加…' : `确认增加 ${increaseQuantity} 件` }}</button>
        </section>
      </div>
    </section>
  </main>
</template>
