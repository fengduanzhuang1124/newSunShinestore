<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import CategorySelect from './CategorySelect.vue';
import { useManagementContext } from '../useManagementDashboard';

// CR-010 F3: products the name rules cannot place, and any product a person wants to place differently. A chosen
// category is saved to the product and wins over recognition; clearing it returns to recognition.
type Row = {
  productId: string; sku: string; barcode: string | null; productName: string; brandName: string;
  level1: string; level2: string; manualCategory: string | null; automaticCategory: string | null;
  functions: string[]; unitsLast90Days: number; currentInventory: number;
};
type Result = { summary: { products: number; unclassified: number; manual: number; unclassifiedSelling: number }; products: Row[] };

const { managementRequest, currentStoreId, productTaxonomy, ensureProductTaxonomy, managementAccess, showPurchaseMessage } = useManagementContext();
const view = ref<'UNCLASSIFIED' | 'MANUAL' | 'ALL'>('UNCLASSIFIED');
const query = ref('');
const result = ref<Result | null>(null);
const loading = ref(false);
const error = ref('');
const saving = ref<string | null>(null);
const choice = reactive<Record<string, string>>({});
const canEdit = computed(() => managementAccess.value?.administrator ?? false);

async function load() {
  const storeId = currentStoreId();
  if (!storeId) return;
  loading.value = true; error.value = '';
  try {
    const params = new URLSearchParams({ storeId, view: view.value });
    if (query.value.trim()) params.set('q', query.value.trim());
    result.value = await managementRequest<Result>(`/management/product-categories?${params.toString()}`);
    for (const row of result.value.products) choice[row.productId] = row.manualCategory ?? '';
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : '商品品类读取失败';
  } finally {
    loading.value = false;
  }
}
async function save(row: Row, category: string | null) {
  const storeId = currentStoreId();
  if (!storeId) return;
  saving.value = row.productId; error.value = '';
  try {
    const updated = await managementRequest<{ level1: string; level2: string; manualCategory: string | null; functions: string[] }>(`/management/product-categories/assign?storeId=${encodeURIComponent(storeId)}`, { method: 'POST', body: JSON.stringify({ productId: row.productId, category }) });
    Object.assign(row, { level1: updated.level1, level2: updated.level2, manualCategory: updated.manualCategory, functions: updated.functions });
    choice[row.productId] = updated.manualCategory ?? '';
    showPurchaseMessage(category ? `${row.productName} 已指定为 ${updated.level2}` : `${row.productName} 已恢复自动识别`);
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : '品类保存失败';
  } finally {
    saving.value = null;
  }
}
function switchView(next: typeof view.value) { view.value = next; query.value = ''; void load(); }

onMounted(() => { void ensureProductTaxonomy(); void load(); });
</script>

<template>
  <section class="system-card category-assign">
    <div class="card-title"><div><h3>品类指定</h3><p>系统按商品名称自动识别品类；识别不了或识别错的在这里指定，指定后优先使用，可随时恢复自动识别。</p></div></div>
    <div v-if="result" class="category-kpis">
      <button type="button" :aria-pressed="view === 'UNCLASSIFIED'" @click="switchView('UNCLASSIFIED')"><span>未识别</span><strong>{{ result.summary.unclassified }}</strong><small>近 90 天有销售 {{ result.summary.unclassifiedSelling }} 种</small></button>
      <button type="button" :aria-pressed="view === 'MANUAL'" @click="switchView('MANUAL')"><span>已人工指定</span><strong>{{ result.summary.manual }}</strong><small>优先于自动识别</small></button>
      <button type="button" :aria-pressed="view === 'ALL'" @click="switchView('ALL')"><span>在用商品</span><strong>{{ result.summary.products }}</strong><small>按近 90 天销量排序</small></button>
    </div>
    <form class="category-search" @submit.prevent="load"><input v-model="query" aria-label="搜索商品" placeholder="搜索名称、SKU 或条码" /><button type="submit" :disabled="loading">{{ loading ? '查询中…' : '搜索' }}</button></form>
    <p v-if="!canEdit" class="inline-notice">只有管理员可以修改品类；当前账号只能查看。</p>
    <p v-if="error" class="management-alert error" role="alert">{{ error }}</p>
    <div v-if="loading && !result" class="page-skeleton" aria-hidden="true"><i></i><i></i><i class="wide"></i></div>
    <ul v-else-if="result?.products.length" class="category-rows">
      <li v-for="row in result.products" :key="row.productId">
        <span class="category-name"><strong>{{ row.productName }}</strong><small>{{ row.brandName }} · {{ row.barcode || row.sku }}</small></span>
        <span class="category-figures"><span><b>{{ row.unitsLast90Days }}</b> 件 / 90 天</span><small>库存 {{ row.currentInventory }}</small></span>
        <span class="category-current">
          <b v-if="row.manualCategory || row.automaticCategory">{{ row.level2 }}</b>
          <em :class="row.manualCategory ? 'manual' : row.automaticCategory ? 'auto' : 'none'">{{ row.manualCategory ? '人工' : row.automaticCategory ? '自动' : '未识别' }}</em>
          <small v-if="row.functions.length">{{ row.functions.slice(0, 3).join('、') }}</small>
        </span>
        <span v-if="canEdit" class="category-edit">
          <CategorySelect v-model="choice[row.productId]" :taxonomy="productTaxonomy" :groups-selectable="false" all-label="选择品类" :aria-label="`${row.productName} 的品类`" />
          <button type="button" :disabled="saving === row.productId || !choice[row.productId] || choice[row.productId] === row.manualCategory" @click="save(row, choice[row.productId])">保存</button>
          <button v-if="row.manualCategory" type="button" class="secondary-action" :disabled="saving === row.productId" @click="save(row, null)">恢复自动</button>
        </span>
      </li>
    </ul>
    <p v-else-if="result" class="system-empty">{{ query ? '没有找到匹配的商品。' : view === 'UNCLASSIFIED' ? '所有商品都已识别出品类。' : view === 'MANUAL' ? '还没有人工指定的品类。' : '没有商品。' }}</p>
  </section>
</template>

<style scoped>
.category-assign { display: grid; gap: 14px; }
.category-kpis { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
.category-kpis button { display: grid; gap: 3px; padding: 12px 14px; color: inherit; border: 1px solid #263751; border-radius: 14px; background: #0e1828; font: inherit; text-align: left; cursor: pointer; }
.category-kpis button[aria-pressed='true'] { border-color: #36c7d5; box-shadow: 0 0 0 1px rgb(54 199 213 / 30%); }
.category-kpis span, .category-kpis small { color: #8d9cb3; font-size: 11px; }
.category-kpis strong { font-size: 22px; font-variant-numeric: tabular-nums; }
.category-search { display: flex; gap: 8px; }
.category-search input { flex: 1; min-width: 0; min-height: 40px; padding: 8px 12px; color: inherit; border: 1px solid #29384f; border-radius: 10px; background: #09111d; font: inherit; }
.category-search button, .category-edit button { min-height: 38px; padding: 6px 14px; color: #effcff; border: 1px solid #2c7f96; border-radius: 10px; background: #176c8b; font: inherit; font-weight: 800; white-space: nowrap; cursor: pointer; }
.category-edit button:disabled, .category-search button:disabled { cursor: not-allowed; opacity: .5; }
.category-edit .secondary-action { color: #b9c8db; border-color: #314058; background: #101b2a; }
.category-rows { display: grid; margin: 0; padding: 0; list-style: none; }
.category-rows li { display: grid; grid-template-columns: minmax(0, 2fr) 120px minmax(0, 1.3fr) minmax(0, 1.9fr); align-items: center; gap: 12px; padding: 11px 4px; border-top: 1px solid #223149; font-size: 13px; }
.category-name, .category-current, .category-figures { white-space: nowrap; }
.category-figures { display: grid; gap: 3px; min-width: 0; }
.category-name strong, .category-name small, .category-current small { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.category-rows small { color: #8d9cb3; font-size: 11px; }
.category-current { grid-template-columns: auto auto; justify-content: start; align-items: center; column-gap: 6px; }
.category-current small { grid-column: 1 / -1; }
.category-current em { padding: 2px 7px; border-radius: 999px; font-size: 10px; font-style: normal; font-weight: 800; }
.category-current em.auto { color: #7fe0ec; background: rgb(54 199 213 / 14%); }
.category-current em.manual { color: #c8b8ff; background: rgb(160 120 255 / 16%); }
.category-current em.none { color: #ffb45c; background: rgb(245 166 72 / 16%); }
.category-edit { display: flex; align-items: center; gap: 6px; min-width: 0; }
.category-edit select { flex: 1; min-width: 0; min-height: 38px; padding: 6px 8px; color: inherit; border: 1px solid #29384f; border-radius: 10px; background: #09111d; font: inherit; }
:root:not([data-theme="dark"]) .category-kpis button, :root:not([data-theme="dark"]) .category-search input, :root:not([data-theme="dark"]) .category-edit select { color: #24314d; border-color: #dbe2ee; background: #fff; }
:root:not([data-theme="dark"]) .category-rows li { border-color: #e6e9f2; }
@media (max-width: 900px) {
  .category-rows li { grid-template-columns: minmax(0, 1fr) auto; }
  .category-current, .category-edit { grid-column: 1 / -1; }
}
@media (max-width: 720px) {
  .category-kpis { grid-template-columns: minmax(0, 1fr); }
  .category-edit { flex-wrap: wrap; }
  .category-edit select { flex-basis: 100%; min-height: 44px; font-size: 16px; }
  .category-edit button { flex: 1; min-height: 44px; }
}
</style>
