<script setup lang="ts">
// Stock count task (REQ-012): work through the recount list product by product. Each product opens with its
// system batches; the admin corrects quantities and expiry dates (or adds/removes batches) and confirms, which
// writes the stocktake movements immediately and takes the product off the list.
import { computed, onMounted, ref, watch } from 'vue';

type Batch = { batchId: string; expiry: string; quantity: number };
type CountItem = {
  id: string; productId: string; productName: string; brandName: string | null; barcode: string | null;
  priority: number; reasons: string; source: 'PLANNED' | 'ADDED'; status: 'PENDING' | 'CONFIRMED';
  systemQuantity: number; batches: Batch[]; countedQuantity: number | null; confirmCount: number; confirmedAt: string | null;
};
type CountTask = { id: string; code: string; title: string; total: number; confirmed: number; pending: number };
// Expiry is picked as a month (native picker) plus an optional day, like the receiving form.
type Row = { key: number; month: string; day: string; quantity: number | null };
type View = 1 | 2 | 3 | 'done';

const props = defineProps<{ apiBaseUrl: string; token: string; scanned: { code: string; at: number } | null }>();
const emit = defineEmits<{ scan: [] }>();

const PAGE = 50;
const PRIORITIES = [1, 2, 3] as const;
const PRIORITY_LABEL: Record<number, string> = { 1: '高', 2: '中', 3: '低' };
const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
const DAYS = Array.from({ length: 31 }, (_, index) => String(index + 1).padStart(2, '0'));
const expiryOf = (row: Row) => (row.day ? `${row.month}-${row.day}` : row.month);

const task = ref<CountTask | null>(null);
const items = ref<CountItem[]>([]);
const loading = ref(true);
const loadError = ref('');
const view = ref<View>(1);
const search = ref('');
const shown = ref(PAGE);
const toast = ref('');
const notListed = ref<{ productId: string; productName: string } | null>(null);
let toastTimer: ReturnType<typeof setTimeout> | undefined;

const open = ref<CountItem | null>(null);
const rows = ref<Row[]>([]);
const saving = ref(false);
const sheetError = ref('');
let requestId = '';
let rowKey = 0;
const rowFrom = (expiry: string, quantity: number): Row => ({ key: ++rowKey, month: expiry.slice(0, 7), day: expiry.slice(8, 10), quantity });

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${props.apiBaseUrl}${path}`, { ...init, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${props.token}`, ...(init?.headers ?? {}) } });
  } catch {
    throw new Error('网络连接失败，请检查网络后重试');
  }
  const body = await response.json().catch(() => ({})) as { message?: string | string[]; data?: T };
  if (!response.ok) throw Object.assign(new Error(Array.isArray(body.message) ? body.message.join('，') : body.message || `请求失败（${response.status}）`), { status: response.status });
  return body.data as T;
}

async function load() {
  loading.value = true;
  loadError.value = '';
  try {
    const data = await request<{ task: CountTask | null; items: CountItem[] }>('/inventory/count-tasks/current');
    task.value = data.task;
    items.value = data.items;
  } catch (reason) {
    loadError.value = reason instanceof Error ? reason.message : '盘点任务加载失败';
  } finally {
    loading.value = false;
  }
}
onMounted(load);

const pendingByPriority = computed(() => [1, 2, 3].map((priority) => items.value.filter((item) => item.status === 'PENDING' && item.priority === priority).length));
const confirmedCount = computed(() => items.value.filter((item) => item.status === 'CONFIRMED').length);
const progress = computed(() => (items.value.length ? Math.round((confirmedCount.value / items.value.length) * 100) : 0));
const visible = computed(() => {
  const text = search.value.trim().toLowerCase();
  return items.value
    .filter((item) => (view.value === 'done' ? item.status === 'CONFIRMED' : item.status === 'PENDING' && item.priority === view.value))
    .filter((item) => !text || item.productName.toLowerCase().includes(text) || (item.barcode ?? '').includes(text) || (item.brandName ?? '').toLowerCase().includes(text))
    .sort((a, b) => (view.value === 'done' ? (b.confirmedAt ?? '').localeCompare(a.confirmedAt ?? '') : (a.source === 'ADDED' ? -1 : 0) - (b.source === 'ADDED' ? -1 : 0)));
});
watch([view, search], () => { shown.value = PAGE; notListed.value = null; });

function showToast(text: string) {
  toast.value = text;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.value = ''; }, 2600);
}

function openItem(item: CountItem) {
  open.value = item;
  rows.value = item.batches.length ? item.batches.map((batch) => rowFrom(batch.expiry, batch.quantity)) : [rowFrom('', 0)];
  sheetError.value = '';
  requestId = crypto.randomUUID();
}
function closeSheet() { open.value = null; }

const rowErrors = computed(() => rows.value.map((row) => {
  if (!MONTH_PATTERN.test(row.month)) return '请选择到期年月';
  if (row.day && Number(row.day) > new Date(Date.UTC(Number(row.month.slice(0, 4)), Number(row.month.slice(5, 7)), 0)).getUTCDate()) return '所选日期超出该月天数';
  if (row.quantity === null || !Number.isInteger(row.quantity) || row.quantity < 0) return '数量需为 0 或正整数';
  return '';
}));
const countedTotal = computed(() => rows.value.reduce((sum, row) => sum + (row.quantity ?? 0), 0));
const difference = computed(() => countedTotal.value - (open.value?.systemQuantity ?? 0));
const unchanged = computed(() => {
  if (!open.value) return false;
  const normalize = (list: { expiry: string; quantity: number }[]) => list.filter((row) => row.quantity !== 0).map((row) => `${row.expiry}:${row.quantity}`).sort().join('|');
  return normalize(rows.value.map((row) => ({ expiry: expiryOf(row), quantity: row.quantity ?? 0 }))) === normalize(open.value.batches);
});
const canSubmit = computed(() => !saving.value && rowErrors.value.every((message) => !message));

function step(row: Row, delta: number) { row.quantity = Math.max(0, (row.quantity ?? 0) + delta); }
function addRow() { rows.value.push(rowFrom('', 0)); }
function removeRow(row: Row) { rows.value = rows.value.filter((item) => item !== row); }

async function confirm() {
  const item = open.value;
  if (!item || !task.value || !canSubmit.value) return;
  saving.value = true;
  sheetError.value = '';
  try {
    const result = await request<{ item: CountItem; task: CountTask }>(`/inventory/count-tasks/${task.value.id}/items/${item.id}/confirm`, {
      method: 'POST',
      body: JSON.stringify({
        lines: rows.value.filter((row) => (row.quantity ?? 0) > 0).map((row) => ({ expiry: expiryOf(row), quantity: row.quantity })),
        expected: item.batches.map((batch) => ({ batchId: batch.batchId, quantity: batch.quantity })),
        requestId,
      }),
    });
    const summary = unchanged.value ? '无差异' : `${difference.value > 0 ? '+' : ''}${difference.value}`;
    Object.assign(item, result.item);
    task.value = { ...task.value, ...result.task };
    showToast(`已确认：${item.productName}（${summary}）`);
    const next = visible.value.find((candidate) => candidate.status === 'PENDING' && candidate.id !== item.id);
    if (view.value !== 'done' && next) openItem(next);
    else closeSheet();
  } catch (reason) {
    const status = (reason as { status?: number }).status;
    sheetError.value = reason instanceof Error ? reason.message : '确认失败，请重试';
    if (status === 409) await refreshOpenItem();
  } finally {
    saving.value = false;
  }
}

// Stock moved (e.g. a POS sale) after the product was opened: reload it so the admin confirms against current numbers.
async function refreshOpenItem() {
  const id = open.value?.id;
  await load();
  const fresh = items.value.find((item) => item.id === id);
  if (fresh) {
    const message = sheetError.value;
    openItem(fresh);
    sheetError.value = `${message}。已刷新为最新库存，请核对后再确认。`;
  }
}

async function lookup(code: string) {
  const value = code.trim();
  if (!value) return;
  notListed.value = null;
  const listed = items.value.find((item) => item.barcode === value);
  if (listed) { openItem(listed); return; }
  try {
    const product = await request<{ productId: string; productName: string }>(`/inventory/barcode/${encodeURIComponent(value)}`);
    const match = items.value.find((item) => item.productId === product.productId);
    if (match) openItem(match);
    else notListed.value = { productId: product.productId, productName: product.productName };
  } catch (reason) {
    showToast(reason instanceof Error ? reason.message : '未找到该条码');
  }
}
watch(() => props.scanned, (value) => { if (value) { search.value = ''; void lookup(value.code); } });
function submitSearch() { if (/^\d{6,}$/.test(search.value.trim())) void lookup(search.value); }

async function addNotListed() {
  if (!notListed.value || !task.value) return;
  try {
    const item = await request<CountItem>(`/inventory/count-tasks/${task.value.id}/items`, { method: 'POST', body: JSON.stringify({ productId: notListed.value.productId }) });
    if (!items.value.some((existing) => existing.id === item.id)) {
      items.value.unshift(item);
      task.value = { ...task.value, total: task.value.total + 1, pending: task.value.pending + 1 };
    }
    notListed.value = null;
    view.value = 1;
    openItem(items.value.find((existing) => existing.id === item.id)!);
  } catch (reason) {
    showToast(reason instanceof Error ? reason.message : '加入失败');
  }
}

function timeText(value: string | null) {
  return value ? new Intl.DateTimeFormat('zh-CN', { timeZone: 'Pacific/Auckland', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(value)) : '';
}
</script>

<template>
  <section class="stock-count">
    <p v-if="loading" class="count-state" role="status">正在加载盘点任务…</p>
    <div v-else-if="loadError" class="count-state error" role="alert"><span>{{ loadError }}</span><button type="button" @click="load">重新加载</button></div>
    <div v-else-if="!task" class="count-state">当前没有进行中的盘点任务。</div>
    <template v-else>
      <header class="count-header">
        <div><h2>盘点任务</h2><small>{{ task.title }}</small></div>
        <strong>剩余 {{ task.pending }}</strong>
      </header>
      <div class="count-progress" role="progressbar" :aria-valuenow="progress" aria-valuemin="0" aria-valuemax="100"><i :style="{ width: `${progress}%` }"></i></div>
      <p class="count-progress-text">已完成 {{ confirmedCount }} / {{ items.length }}</p>

      <nav class="count-tabs" aria-label="盘点清单分组">
        <button v-for="priority in PRIORITIES" :key="priority" type="button" :class="{ active: view === priority }" @click="view = priority">{{ PRIORITY_LABEL[priority] }}<b>{{ pendingByPriority[priority - 1] }}</b></button>
        <button type="button" :class="{ active: view === 'done' }" @click="view = 'done'">已完成<b>{{ confirmedCount }}</b></button>
      </nav>

      <form class="count-search" @submit.prevent="submitSearch">
        <input v-model="search" type="search" inputmode="search" placeholder="搜索名称、品牌或条码" aria-label="搜索盘点商品" />
        <button type="button" aria-label="扫码查找商品" @click="emit('scan')"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7V5a1 1 0 0 1 1-1h2M17 4h2a1 1 0 0 1 1 1v2M20 17v2a1 1 0 0 1-1 1h-2M7 20H5a1 1 0 0 1-1-1v-2M7 9v6M10 9v6M13 9v6M16 9v6" /></svg>扫码</button>
      </form>

      <div v-if="notListed" class="count-not-listed">
        <span><strong>{{ notListed.productName }}</strong>不在本次清单中</span>
        <button type="button" @click="addNotListed">加入盘点</button>
      </div>

      <p v-if="!visible.length" class="count-state">{{ view === 'done' ? '还没有已完成的商品' : search ? '没有匹配的商品' : '这一组已全部完成' }}</p>
      <ul v-else class="count-list">
        <li v-for="item in visible.slice(0, shown)" :key="item.id">
          <button type="button" @click="openItem(item)">
            <span class="count-name">{{ item.productName }}</span>
            <span class="count-meta">{{ item.barcode || '无条码' }}<template v-if="item.brandName"> · {{ item.brandName }}</template></span>
            <span v-if="item.status === 'CONFIRMED'" class="count-result">实点 {{ item.countedQuantity }} 件 · {{ timeText(item.confirmedAt) }}</span>
            <span v-else class="count-result">系统 {{ item.systemQuantity }} 件 · {{ item.batches.length }} 个批次</span>
            <span class="count-reason">{{ item.source === 'ADDED' ? '临时加入' : item.reasons.split('；')[0] }}</span>
          </button>
        </li>
      </ul>
      <button v-if="visible.length > shown" class="count-more" type="button" @click="shown += PAGE">加载更多（{{ shown }} / {{ visible.length }}）</button>
    </template>

    <Teleport to="body">
    <Transition name="count-sheet">
      <div v-if="open" class="count-overlay" role="presentation" @click.self="closeSheet">
        <section class="count-sheet" role="dialog" aria-modal="true" :aria-label="`盘点 ${open.productName}`">
          <i class="count-handle" aria-hidden="true"></i>
          <header>
            <div><h3>{{ open.productName }}</h3><small>{{ open.barcode || '无条码' }}<template v-if="open.brandName"> · {{ open.brandName }}</template></small></div>
            <button type="button" aria-label="关闭" @click="closeSheet"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg></button>
          </header>
          <p class="count-why">{{ open.source === 'ADDED' ? '盘点时临时加入' : open.reasons }}</p>

          <div class="count-rows">
            <div v-for="(row, index) in rows" :key="row.key" class="count-row" :class="{ invalid: rowErrors[index] }">
              <input v-model="row.month" class="count-month" type="month" :aria-label="`第 ${index + 1} 个批次到期年月`" />
              <select v-model="row.day" class="count-day" :aria-label="`第 ${index + 1} 个批次到期日（可不选）`"><option value="">整月</option><option v-for="day in DAYS" :key="day" :value="day">{{ Number(day) }} 日</option></select>
              <div class="count-stepper">
                <button type="button" aria-label="减一" @click="step(row, -1)">−</button>
                <input v-model.number="row.quantity" type="number" inputmode="numeric" min="0" :aria-label="`第 ${index + 1} 个批次数量`" />
                <button type="button" aria-label="加一" @click="step(row, 1)">＋</button>
              </div>
              <button class="count-remove" type="button" aria-label="删除这个批次" @click="removeRow(row)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M10 11v6M14 11v6M6 7l1 12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-12M9 7V4h6v3" /></svg></button>
              <small v-if="rowErrors[index]">{{ rowErrors[index] }}</small>
            </div>
            <button class="count-add" type="button" @click="addRow">＋ 新增批次</button>
          </div>

          <p class="count-total">系统 {{ open.systemQuantity }} 件 → 实点 <strong>{{ countedTotal }}</strong> 件<b v-if="!unchanged" :class="difference > 0 ? 'up' : difference < 0 ? 'down' : ''">（{{ difference > 0 ? '+' : '' }}{{ difference }}）</b></p>
          <p v-if="sheetError" class="count-error" role="alert">{{ sheetError }}</p>
          <button class="count-confirm" :class="{ same: unchanged }" type="button" :disabled="!canSubmit" @click="confirm">{{ saving ? '正在保存…' : unchanged ? '与系统一致，确认' : '确认修改' }}</button>
        </section>
      </div>
    </Transition>
    <Transition name="count-toast"><p v-if="toast" class="count-toast" role="status">{{ toast }}</p></Transition>
    </Teleport>
  </section>
</template>

<style scoped>
/* The sheet and toast are teleported to <body>, so shared tokens are declared on them too. */
.stock-count, .count-overlay, .count-toast { --count-red: #e5484d; }
.stock-count { display: grid; gap: 12px; padding-bottom: 8px; color: var(--ink); }
.count-state { margin: 0; padding: 28px 16px; color: var(--muted); border: 1px dashed var(--ops-border); border-radius: 14px; font-size: 14px; text-align: center; }
.count-state.error { display: grid; gap: 12px; color: var(--count-red); }
.count-state button, .count-more { min-height: 44px; color: var(--ops-blue); border: 1px solid var(--ops-border); border-radius: 12px; background: var(--ops-card); font-size: 14px; font-weight: 600; }

/* Global phone styles stack every <header>; this one stays a row. */
.count-header { display: flex; flex-direction: row; align-items: flex-end; justify-content: space-between; gap: 12px; }
.count-header h2 { margin: 0; font-size: 20px; line-height: 28px; font-weight: 600; }
.count-header small { color: var(--muted); font-size: 12px; }
.count-header strong { color: var(--ops-blue); font-size: 20px; font-variant-numeric: tabular-nums; white-space: nowrap; }
.count-progress { height: 8px; overflow: hidden; border-radius: 4px; background: var(--ops-border); }
.count-progress i { display: block; height: 100%; border-radius: 4px; background: var(--ops-green); transition: width .3s ease; }
.count-progress-text { margin: -6px 0 0; color: var(--muted); font-size: 12px; }

.count-tabs { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 4px; padding: 4px; border-radius: 12px; background: var(--ops-border); }
.count-tabs button { display: flex; align-items: center; justify-content: center; gap: 4px; min-height: 40px; padding: 0 4px; color: var(--muted); border: 0; border-radius: 9px; background: transparent; box-shadow: none; font-size: 14px; font-weight: 600; }
.count-tabs button b { font-size: 12px; font-variant-numeric: tabular-nums; }
.count-tabs button.active { color: var(--ink); background: var(--ops-card); }

.count-search { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 8px; }
.count-search input { min-width: 0; min-height: 44px; font-size: 16px; }
.count-search button { display: inline-flex; align-items: center; gap: 4px; min-height: 44px; padding: 0 14px; color: var(--ops-blue); border: 1px solid var(--ops-border); border-radius: 12px; background: var(--ops-card); box-shadow: none; font-size: 14px; font-weight: 600; }
.stock-count svg, .count-sheet svg { width: 20px; height: 20px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }

.count-not-listed { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px; border: 1px solid var(--ops-blue); border-radius: 14px; font-size: 13px; }
.count-not-listed strong { display: block; font-size: 14px; }
.count-not-listed button { flex: none; min-height: 40px; padding: 0 14px; border-radius: 10px; font-size: 14px; }

.count-list { display: grid; gap: 8px; margin: 0; padding: 0; list-style: none; }
.count-list button { display: grid; gap: 4px; width: 100%; padding: 12px; color: var(--ink); border: 1px solid var(--ops-border); border-radius: 14px; background: var(--ops-card); box-shadow: none; text-align: left; }
.count-name { display: -webkit-box; overflow: hidden; font-size: 15px; font-weight: 600; line-height: 22px; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
.count-meta, .count-reason { overflow: hidden; color: var(--muted); font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
.count-result { font-size: 14px; font-variant-numeric: tabular-nums; }

.count-overlay { position: fixed; z-index: 70; inset: 0; display: flex; align-items: flex-end; background: rgb(10 18 32 / 48%); }
.count-sheet { display: grid; gap: 12px; width: 100%; max-height: calc(100dvh - 24px - env(safe-area-inset-top)); padding: 8px max(16px, env(safe-area-inset-right)) calc(16px + env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left)); overflow-y: auto; color: var(--ink); border-radius: 20px 20px 0 0; background: var(--ops-card); box-shadow: 0 -16px 40px rgb(0 0 0 / 24%); }
.count-handle { justify-self: center; width: 36px; height: 4px; border-radius: 2px; background: var(--ops-border); }
.count-sheet header { display: grid; grid-template-columns: minmax(0, 1fr) 44px; align-items: start; gap: 8px; }
.count-sheet h3 { margin: 0; font-size: 18px; line-height: 26px; font-weight: 600; }
.count-sheet header small { color: var(--muted); font-size: 12px; }
.count-sheet header button { display: grid; width: 44px; height: 44px; min-height: 44px; place-items: center; padding: 0; color: var(--muted); border: 0; border-radius: 50%; background: transparent; box-shadow: none; }
.count-why { margin: 0; padding: 8px 10px; color: var(--muted); border-radius: 10px; background: var(--ops-bg); font-size: 12px; line-height: 18px; }

.count-rows { display: grid; gap: 8px; }
/* Each batch: expiry month + day on the first line, quantity and delete on the second. */
.count-row { display: grid; grid-template-columns: minmax(0, 1fr) 104px; align-items: center; gap: 8px; padding: 10px; border: 1px solid var(--ops-border); border-radius: 14px; }
.count-row .count-stepper { grid-column: 1; }
.count-row .count-remove { justify-self: end; }
/* The sheet lives under <body>, outside the app's themed input styles. */
.count-sheet input { color: var(--ink); border: 1px solid var(--ops-border); border-radius: 12px; background: var(--ops-bg); }
.count-row > :is(input, select) { width: 100%; min-width: 0; min-height: 44px; padding: 0 12px; font-size: 16px; font-variant-numeric: tabular-nums; }
.count-sheet select { color: var(--ink); border: 1px solid var(--ops-border); border-radius: 12px; background: var(--ops-bg); }
.count-row.invalid > :is(input, select) { border-color: var(--count-red); }
.count-row small { grid-column: 1 / -1; color: var(--count-red); font-size: 12px; }
.count-stepper { display: grid; grid-template-columns: 44px minmax(0, 1fr) 44px; overflow: hidden; border: 1px solid var(--ops-border); border-radius: 12px; }
.count-stepper button { min-height: 44px; padding: 0; color: var(--ink); border: 0; border-radius: 0; background: var(--ops-bg); box-shadow: none; font-size: 20px; }
.count-sheet .count-stepper input { min-width: 0; min-height: 44px; padding: 0; border: 0; border-radius: 0; background: var(--ops-card); font-size: 18px; font-weight: 600; font-variant-numeric: tabular-nums; text-align: center; }
.count-remove { display: grid; width: 44px; min-height: 44px; place-items: center; padding: 0; color: var(--muted); border: 0; background: transparent; box-shadow: none; }
.count-add { min-height: 44px; color: var(--ops-blue); border: 1px dashed var(--ops-border); border-radius: 12px; background: transparent; box-shadow: none; font-size: 14px; font-weight: 600; }

.count-total { margin: 0; font-size: 15px; font-variant-numeric: tabular-nums; }
.count-total strong { font-size: 18px; }
.count-total b.up { color: var(--ops-green); }
.count-total b.down { color: var(--count-red); }
.count-error { margin: 0; padding: 10px 12px; color: var(--count-red); border: 1px solid var(--count-red); border-radius: 12px; font-size: 14px; }
.count-confirm { min-height: 48px; border-radius: 12px; font-size: 16px; font-weight: 600; }
.count-confirm.same { background: var(--ops-green); }
.count-confirm:disabled { opacity: .5; }

.count-toast { position: fixed; z-index: 80; right: 16px; bottom: calc(76px + env(safe-area-inset-bottom)); left: 16px; margin: 0; padding: 12px 14px; color: #fff; border-radius: 12px; background: rgb(23 32 51 / 92%); font-size: 14px; text-align: center; }
.count-sheet-enter-active, .count-sheet-leave-active { transition: background-color .2s ease; }
.count-sheet-enter-active .count-sheet, .count-sheet-leave-active .count-sheet { transition: transform .24s cubic-bezier(.22, 1, .36, 1); }
.count-sheet-enter-from, .count-sheet-leave-to { background-color: transparent; }
.count-sheet-enter-from .count-sheet, .count-sheet-leave-to .count-sheet { transform: translateY(100%); }
.count-toast-enter-active, .count-toast-leave-active { transition: opacity .2s ease; }
.count-toast-enter-from, .count-toast-leave-to { opacity: 0; }
@media (prefers-reduced-motion: reduce) { .count-sheet-enter-active .count-sheet, .count-sheet-leave-active .count-sheet, .count-progress i { transition: none; } }
</style>
