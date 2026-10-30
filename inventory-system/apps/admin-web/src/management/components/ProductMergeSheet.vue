<script setup lang="ts">
// Merge same-product records (CR-006 D2): pick the other records of this product, choose how their stock is
// treated, and merge them into the current one. Barcodes, POS mappings and sales move over; the others are retired.
import { ref } from 'vue';

type Candidate = { productId: string; name: string; barcodes: string[]; posName: string | null; stock: number };

const props = defineProps<{ productId: string; productName: string; currentInventory: number; request: <T>(path: string, init?: RequestInit) => Promise<T> }>();
const emit = defineEmits<{ close: []; merged: [] }>();

const query = ref(props.productName.split(/[\s（(]/)[0] ?? '');
const results = ref<Candidate[]>([]);
const selected = ref<string[]>([]);
const stockMode = ref<'KEEP_TARGET' | 'SUM'>('KEEP_TARGET');
const searching = ref(false);
const saving = ref(false);
const confirming = ref(false);
const error = ref('');
const requestId = crypto.randomUUID();

async function search() {
  if (query.value.trim().length < 2) { results.value = []; return; }
  searching.value = true;
  error.value = '';
  try {
    const found = await props.request<Candidate[]>(`/inventory/products/search?q=${encodeURIComponent(query.value.trim())}`);
    results.value = found.filter((candidate) => candidate.productId !== props.productId);
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : '搜索失败';
  } finally {
    searching.value = false;
  }
}
void search();

const chosen = () => results.value.filter((candidate) => selected.value.includes(candidate.productId));
const chosenStock = () => chosen().reduce((sum, candidate) => sum + candidate.stock, 0);

async function merge() {
  if (!selected.value.length || saving.value) return;
  saving.value = true;
  error.value = '';
  try {
    await props.request(`/inventory/products/merge`, {
      method: 'POST',
      body: JSON.stringify({ intoProductId: props.productId, fromProductIds: selected.value, stockMode: stockMode.value, requestId }),
    });
    emit('merged');
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : '合并失败，请重试';
    confirming.value = false;
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <Teleport to="body">
    <div class="mgmt-sheet-overlay" role="presentation" @click.self="emit('close')">
      <section class="mgmt-sheet" role="dialog" aria-modal="true" aria-label="合并同款">
        <header>
          <div><h3>合并同款</h3><p>保留：{{ productName }}（库存 {{ currentInventory }}）</p></div>
          <button class="mgmt-sheet-close" type="button" aria-label="关闭" @click="emit('close')">×</button>
        </header>
        <form class="merge-search" @submit.prevent="search"><input v-model="query" type="search" placeholder="名称或条码" aria-label="搜索同款商品" /><button type="submit" :disabled="searching">搜索</button></form>
        <ul v-if="results.length" class="merge-list">
          <li v-for="candidate in results" :key="candidate.productId">
            <label>
              <input v-model="selected" type="checkbox" :value="candidate.productId" />
              <span><b>{{ candidate.name }}</b><small>{{ candidate.barcodes.join(' / ') || '无条码' }}<template v-if="candidate.posName"> · POS：{{ candidate.posName }}</template> · 库存 {{ candidate.stock }}</small></span>
            </label>
          </li>
        </ul>
        <p v-else-if="!searching" class="mgmt-sheet-muted">没有找到其他档案，可换个关键词。</p>
        <fieldset v-if="selected.length" class="merge-mode">
          <legend>库存怎么算</legend>
          <label><input v-model="stockMode" type="radio" value="KEEP_TARGET" /><span><b>以保留商品的库存为准</b><small>同一批货点了两次时选这个：被合并的 {{ chosenStock() }} 件清零</small></span></label>
          <label><input v-model="stockMode" type="radio" value="SUM" /><span><b>库存相加</b><small>两份档案是不同的货时选这个：合并后共 {{ currentInventory + chosenStock() }} 件</small></span></label>
        </fieldset>
        <p v-if="confirming" class="merge-confirm">将把 {{ selected.length }} 个档案并入「{{ productName }}」，条码、POS 对应和销售记录一起转过来，被合并的档案停用。合并后库存 {{ stockMode === 'SUM' ? currentInventory + chosenStock() : currentInventory }} 件。确认吗？</p>
        <p v-if="error" class="mgmt-sheet-error" role="alert">{{ error }}</p>
        <footer>
          <button class="mgmt-sheet-secondary" type="button" @click="confirming ? (confirming = false) : emit('close')">{{ confirming ? '返回' : '取消' }}</button>
          <button v-if="!confirming" class="mgmt-sheet-primary" type="button" :disabled="!selected.length" @click="confirming = true">合并</button>
          <button v-else class="mgmt-sheet-primary" type="button" :disabled="saving" @click="merge">{{ saving ? '正在合并…' : '确认合并' }}</button>
        </footer>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.mgmt-sheet-overlay { --s-bg: #fff; --s-ink: #24314d; --s-muted: #718096; --s-line: #e2e8f0; --s-field: #f7f9fc; --s-accent: #167f8e; --s-red: #d64545; --s-warn: #b26a00;
  position: fixed; inset: 0; z-index: 1000; display: flex; align-items: center; justify-content: center; padding: 16px; background: rgb(15 23 42 / 45%); }
:root[data-theme="dark"] .mgmt-sheet-overlay { --s-bg: #111b2a; --s-ink: #e8eef8; --s-muted: #93a1b5; --s-line: #26364d; --s-field: #0c1624; --s-accent: #3cc4cc; --s-red: #ff8a8a; --s-warn: #f3b25b; }
.mgmt-sheet { display: grid; gap: 12px; width: min(600px, 100%); max-height: calc(100dvh - 32px); overflow: auto; padding: 18px; color: var(--s-ink); border: 1px solid var(--s-line); border-radius: 14px; background: var(--s-bg); box-shadow: 0 20px 50px rgb(0 0 0 / 25%); }
.mgmt-sheet header { display: flex; flex-direction: row; align-items: flex-start; justify-content: space-between; gap: 12px; margin: 0; padding: 0; border: 0; background: none; position: static; }
.mgmt-sheet header > div { min-width: 0; }
.mgmt-sheet h3 { margin: 0; color: var(--s-ink); font-size: 17px; }
.mgmt-sheet header p, .mgmt-sheet-muted { margin: 4px 0 0; color: var(--s-muted); font-size: 13px; }
.mgmt-sheet-close { flex: none; width: 32px; min-width: 32px; height: 32px; min-height: 32px; padding: 0; color: var(--s-muted); border: 0; background: none; box-shadow: none; font-size: 22px; line-height: 1; cursor: pointer; }
.merge-search { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 8px; }
.merge-search input { min-height: 40px; padding: 0 10px; color: var(--s-ink); border: 1px solid var(--s-line); border-radius: 9px; background: var(--s-field); font-size: 14px; }
.merge-search button { min-height: 40px; padding: 0 16px; color: var(--s-ink); border: 1px solid var(--s-line); border-radius: 9px; background: transparent; box-shadow: none; font-weight: 600; cursor: pointer; }
.merge-list { display: grid; gap: 6px; max-height: 280px; margin: 0; padding: 0; overflow: auto; list-style: none; }
.merge-list label, .merge-mode label { display: flex; align-items: flex-start; gap: 10px; padding: 9px 10px; border: 1px solid var(--s-line); border-radius: 10px; cursor: pointer; }
.merge-list span, .merge-mode span { display: grid; gap: 2px; min-width: 0; }
.merge-list b, .merge-mode b { color: var(--s-ink); font-size: 13.5px; }
.merge-list small, .merge-mode small { color: var(--s-muted); font-size: 12px; overflow-wrap: anywhere; }
.merge-list input, .merge-mode input { flex: none; width: 18px; min-width: 18px; height: 18px; min-height: 0; margin: 2px 0 0; padding: 0; }
.merge-list label, .merge-mode label { justify-content: flex-start; text-align: left; }
.merge-mode { display: grid; gap: 6px; margin: 0; padding: 0; border: 0; }
.merge-mode legend { margin-bottom: 6px; color: var(--s-muted); font-size: 13px; font-weight: 600; }
.merge-confirm { margin: 0; padding: 10px 12px; color: var(--s-warn); border: 1px solid var(--s-warn); border-radius: 10px; font-size: 13px; line-height: 1.5; }
.mgmt-sheet-error { margin: 0; padding: 8px 10px; color: var(--s-red); border: 1px solid var(--s-red); border-radius: 9px; font-size: 13px; }
.mgmt-sheet footer { display: flex; justify-content: flex-end; gap: 8px; }
.mgmt-sheet-primary, .mgmt-sheet-secondary { min-height: 40px; padding: 0 18px; border-radius: 9px; font-size: 14px; font-weight: 600; box-shadow: none; cursor: pointer; }
.mgmt-sheet-primary { color: #fff; border: 0; background: var(--s-accent); }
.mgmt-sheet-primary:disabled { opacity: 0.5; cursor: default; }
.mgmt-sheet-secondary { color: var(--s-ink); border: 1px solid var(--s-line); background: transparent; }
@media (max-width: 720px) {
  .mgmt-sheet-overlay { align-items: flex-end; padding: 0; }
  .mgmt-sheet { width: 100%; max-height: 90dvh; border-radius: 16px 16px 0 0; padding-bottom: calc(18px + env(safe-area-inset-bottom)); }
  .mgmt-sheet footer button { flex: 1; min-height: 44px; }
}
</style>
