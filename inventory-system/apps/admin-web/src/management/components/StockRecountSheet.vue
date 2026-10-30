<script setup lang="ts">
// Purchase-page recount (CR-006 D1): set one product's batches to what is on the shelf, without leaving the
// management centre. Same rules as confirming a stock count; nothing changes until "确认库存" is tapped.
import { computed, onMounted, ref } from 'vue';

type Batch = { batchId: string; expiry: string; quantity: number };
type ProductStock = { productId: string; productName: string; barcode: string | null; systemQuantity: number; batches: Batch[] };
type Row = { key: number; month: string; day: string; quantity: number | null };

const props = defineProps<{ productId: string; request: <T>(path: string, init?: RequestInit) => Promise<T> }>();
const emit = defineEmits<{ close: []; saved: [stock: ProductStock] }>();

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
const DAYS = Array.from({ length: 31 }, (_, index) => String(index + 1).padStart(2, '0'));
const stock = ref<ProductStock | null>(null);
const rows = ref<Row[]>([]);
const loading = ref(true);
const saving = ref(false);
const error = ref('');
let rowKey = 0;
let requestId = crypto.randomUUID();
const rowFrom = (expiry: string, quantity: number): Row => ({ key: ++rowKey, month: expiry.slice(0, 7), day: expiry.slice(8, 10), quantity });
const expiryOf = (row: Row) => (row.day ? `${row.month}-${row.day}` : row.month);

async function load() {
  loading.value = true;
  error.value = '';
  try {
    stock.value = await props.request<ProductStock>(`/inventory/products/${props.productId}/stock`);
    rows.value = stock.value.batches.length ? stock.value.batches.map((batch) => rowFrom(batch.expiry, Math.max(0, batch.quantity))) : [rowFrom('', 0)];
    requestId = crypto.randomUUID();
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : '库存读取失败';
  } finally {
    loading.value = false;
  }
}
onMounted(load);

// A row left at 0 is dropped on save, so it needs no expiry date.
const rowErrors = computed(() => rows.value.map((row) => {
  if (row.quantity === 0) return '';
  if (!MONTH_PATTERN.test(row.month)) return '请选择到期年月';
  if (row.day && Number(row.day) > new Date(Date.UTC(Number(row.month.slice(0, 4)), Number(row.month.slice(5, 7)), 0)).getUTCDate()) return '所选日期超出该月天数';
  if (row.quantity === null || !Number.isInteger(row.quantity) || row.quantity < 0) return '数量需为 0 或正整数';
  if (row.quantity > 9999) return '单个批次最多 9999 件，请核对';
  return '';
}));
const total = computed(() => rows.value.reduce((sum, row) => sum + (row.quantity ?? 0), 0));
const difference = computed(() => total.value - (stock.value?.systemQuantity ?? 0));

async function save() {
  if (!stock.value || saving.value || rowErrors.value.some(Boolean)) return;
  saving.value = true;
  error.value = '';
  try {
    const saved = await props.request<ProductStock>(`/inventory/products/${props.productId}/recount`, {
      method: 'POST',
      body: JSON.stringify({
        lines: rows.value.filter((row) => (row.quantity ?? 0) > 0).map((row) => ({ expiry: expiryOf(row), quantity: row.quantity })),
        expected: stock.value.batches.map((batch) => ({ batchId: batch.batchId, quantity: batch.quantity })),
        requestId,
      }),
    });
    emit('saved', saved);
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : '保存失败，请重试';
    if ((reason as { status?: number }).status === 409) await load();
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <Teleport to="body">
    <div class="mgmt-sheet-overlay" role="presentation" @click.self="emit('close')">
      <section class="mgmt-sheet" role="dialog" aria-modal="true" aria-label="调库存">
        <header>
          <div><h3>调库存</h3><p v-if="stock">{{ stock.productName }}<template v-if="stock.barcode"> · {{ stock.barcode }}</template></p></div>
          <button class="mgmt-sheet-close" type="button" aria-label="关闭" @click="emit('close')">×</button>
        </header>
        <p v-if="loading" class="mgmt-sheet-muted">正在读取库存…</p>
        <template v-else-if="stock">
          <div class="recount-rows">
            <div v-for="(row, index) in rows" :key="row.key" class="recount-row" :class="{ invalid: rowErrors[index] }">
              <input v-model="row.month" type="month" :aria-label="`第 ${index + 1} 个批次到期年月`" />
              <select v-model="row.day" :aria-label="`第 ${index + 1} 个批次到期日`"><option value="">整月</option><option v-for="day in DAYS" :key="day" :value="day">{{ Number(day) }} 日</option></select>
              <input v-model.number="row.quantity" class="recount-qty" type="number" inputmode="numeric" min="0" :aria-label="`第 ${index + 1} 个批次数量`" />
              <button class="mgmt-sheet-link" type="button" aria-label="删除这个批次" @click="rows = rows.filter((item) => item !== row)">删除</button>
              <small v-if="rowErrors[index]">{{ rowErrors[index] }}</small>
            </div>
            <button class="mgmt-sheet-link" type="button" @click="rows.push(rowFrom('', 0))">＋ 新增批次</button>
          </div>
          <p class="recount-total">系统 {{ stock.systemQuantity }} 件 → 实有 <strong>{{ total }}</strong> 件<b v-if="difference" :class="difference > 0 ? 'up' : 'down'">（{{ difference > 0 ? '+' : '' }}{{ difference }}）</b></p>
        </template>
        <p v-if="error" class="mgmt-sheet-error" role="alert">{{ error }}</p>
        <footer>
          <button class="mgmt-sheet-secondary" type="button" @click="emit('close')">取消</button>
          <button class="mgmt-sheet-primary" type="button" :disabled="loading || saving || !stock || rowErrors.some(Boolean)" @click="save">{{ saving ? '正在保存…' : '确认库存' }}</button>
        </footer>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.mgmt-sheet-overlay { --s-bg: #fff; --s-ink: #24314d; --s-muted: #718096; --s-line: #e2e8f0; --s-field: #f7f9fc; --s-accent: #167f8e; --s-red: #d64545; --s-green: #1f9d6b;
  position: fixed; inset: 0; z-index: 1000; display: flex; align-items: center; justify-content: center; padding: 16px; background: rgb(15 23 42 / 45%); }
:root[data-theme="dark"] .mgmt-sheet-overlay { --s-bg: #111b2a; --s-ink: #e8eef8; --s-muted: #93a1b5; --s-line: #26364d; --s-field: #0c1624; --s-accent: #3cc4cc; --s-red: #ff8a8a; --s-green: #5fd3a0; }
.mgmt-sheet { display: grid; gap: 14px; width: min(560px, 100%); max-height: calc(100dvh - 32px); overflow: auto; padding: 18px; color: var(--s-ink); border: 1px solid var(--s-line); border-radius: 14px; background: var(--s-bg); box-shadow: 0 20px 50px rgb(0 0 0 / 25%); }
.mgmt-sheet header { display: flex; flex-direction: row; align-items: flex-start; justify-content: space-between; gap: 12px; margin: 0; padding: 0; border: 0; background: none; position: static; }
.mgmt-sheet header > div { min-width: 0; }
.mgmt-sheet h3 { margin: 0; color: var(--s-ink); font-size: 17px; }
.mgmt-sheet header p, .mgmt-sheet-muted { margin: 4px 0 0; color: var(--s-muted); font-size: 13px; }
.mgmt-sheet-close { flex: none; width: 32px; min-width: 32px; height: 32px; min-height: 32px; padding: 0; color: var(--s-muted); border: 0; background: none; box-shadow: none; font-size: 22px; line-height: 1; cursor: pointer; }
.recount-rows { display: grid; gap: 8px; }
.recount-row { display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(0, 0.9fr) minmax(0, 0.8fr) auto; gap: 8px; align-items: center; }
.recount-row :is(input, select) { min-width: 0; min-height: 40px; padding: 0 10px; color: var(--s-ink); border: 1px solid var(--s-line); border-radius: 9px; background: var(--s-field); font-size: 14px; }
.recount-row.invalid :is(input, select) { border-color: var(--s-red); }
.recount-row small { grid-column: 1 / -1; color: var(--s-red); font-size: 12px; }
.recount-qty { text-align: center; font-variant-numeric: tabular-nums; }
.mgmt-sheet-link { min-height: 32px; padding: 0 6px; color: var(--s-accent); border: 0; background: none; box-shadow: none; font-size: 13px; font-weight: 600; cursor: pointer; justify-self: start; }
.recount-total { margin: 0; font-size: 14px; }
.recount-total b.up { color: var(--s-green); } .recount-total b.down { color: var(--s-red); }
.mgmt-sheet-error { margin: 0; padding: 8px 10px; color: var(--s-red); border: 1px solid var(--s-red); border-radius: 9px; font-size: 13px; }
.mgmt-sheet footer { display: flex; justify-content: flex-end; gap: 8px; }
.mgmt-sheet-primary, .mgmt-sheet-secondary { min-height: 40px; padding: 0 18px; border-radius: 9px; font-size: 14px; font-weight: 600; box-shadow: none; cursor: pointer; }
.mgmt-sheet-primary { color: #fff; border: 0; background: var(--s-accent); }
.mgmt-sheet-primary:disabled { opacity: 0.5; cursor: default; }
.mgmt-sheet-secondary { color: var(--s-ink); border: 1px solid var(--s-line); background: transparent; }
@media (max-width: 720px) {
  .mgmt-sheet-overlay { align-items: flex-end; padding: 0; }
  .mgmt-sheet { width: 100%; max-height: 90dvh; border-radius: 16px 16px 0 0; padding-bottom: calc(18px + env(safe-area-inset-bottom)); }
  .recount-row { grid-template-columns: minmax(0, 1fr) minmax(0, 0.8fr); }
  .recount-qty { grid-column: 1; } .recount-row .mgmt-sheet-link { grid-column: 2; justify-self: end; }
  .mgmt-sheet footer button { flex: 1; min-height: 44px; }
}
</style>
