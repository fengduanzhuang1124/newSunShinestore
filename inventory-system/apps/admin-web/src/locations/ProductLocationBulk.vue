<script setup lang="ts">
// Place products by brand (CR-008 F5): pick a brand, a keyword or a current location, tick the products (all by
// default), choose a location and save once. Moving a shelf's goods elsewhere is the same flow filtered by location.
import { computed, onMounted, ref, watch } from 'vue';
import type { ProductLocation } from './ProductLocationChip.vue';

type BrandRow = { brand: string; productCount: number; placedCount: number; stock: number };
type PlaceRow = { productId: string; name: string; brand: string; barcodes: string[]; stock: number; location: ProductLocation | null };

const props = defineProps<{
  locations: ProductLocation[];
  request: (path: string, init?: RequestInit) => Promise<any>;
  focusLocationId?: string;
}>();
const emit = defineEmits<{ changed: [] }>();

const brands = ref<BrandRow[]>([]);
const brandFilter = ref('');
const inStock = ref(true);
const brand = ref('');
const keyword = ref('');
const locationFilter = ref('');
const products = ref<PlaceRow[]>([]);
const total = ref(0);
const selected = ref<string[]>([]);
const target = ref('');
const loading = ref(false);
const saving = ref(false);
const confirming = ref(false);
const error = ref('');
const notice = ref('');

const shownBrands = computed(() => {
  const text = brandFilter.value.trim().toLowerCase();
  return text ? brands.value.filter((row) => row.brand.toLowerCase().includes(text)) : brands.value;
});
const hasFilter = computed(() => Boolean(brand.value || keyword.value.trim() || locationFilter.value));
const allSelected = computed(() => products.value.length > 0 && selected.value.length === products.value.length);
const targetLocation = computed(() => props.locations.find((location) => location.locationId === target.value) ?? null);
// Ticked products already kept somewhere other than the chosen location: saving moves them, so it is confirmed first.
const moving = computed(() => products.value.filter((row) => selected.value.includes(row.productId) && row.location && row.location.locationId !== target.value));

async function loadBrands() {
  try {
    brands.value = await props.request(`/inventory/locations/brands?inStock=${inStock.value}`);
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : '品牌读取失败';
  }
}

async function loadProducts() {
  confirming.value = false;
  if (!hasFilter.value) { products.value = []; total.value = 0; selected.value = []; return; }
  loading.value = true;
  error.value = '';
  try {
    const params = new URLSearchParams({ inStock: String(inStock.value) });
    if (brand.value) params.set('brand', brand.value);
    if (keyword.value.trim()) params.set('q', keyword.value.trim());
    if (locationFilter.value) params.set('locationId', locationFilter.value);
    const data = await props.request(`/inventory/locations/products?${params.toString()}`);
    products.value = data.products ?? [];
    total.value = data.total ?? products.value.length;
    selected.value = products.value.map((row) => row.productId);
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : '商品读取失败';
  } finally {
    loading.value = false;
  }
}

function pickBrand(name: string) {
  brand.value = brand.value === name ? '' : name;
  keyword.value = '';
  locationFilter.value = '';
  void loadProducts();
}

function toggleAll() {
  selected.value = allSelected.value ? [] : products.value.map((row) => row.productId);
}

function askSave(clear = false) {
  notice.value = '';
  if (!selected.value.length) { error.value = '请先勾选商品'; return; }
  if (!clear && !target.value) { error.value = '请选择要放到的仓位'; return; }
  error.value = '';
  if (clear) { target.value = ''; confirming.value = true; return; }
  if (moving.value.length) { confirming.value = true; return; }
  void save();
}

async function save() {
  if (saving.value) return;
  saving.value = true;
  error.value = '';
  try {
    const count = selected.value.length;
    const data = await props.request('/inventory/locations/products', {
      method: 'PUT', body: JSON.stringify({ productIds: selected.value, locationId: target.value || null }),
    });
    notice.value = data.location ? `已把 ${count} 个商品放到 ${data.location.code} · ${data.location.name}` : `已清除 ${count} 个商品的仓位`;
    confirming.value = false;
    emit('changed');
    await Promise.all([loadProducts(), loadBrands()]);
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : '保存失败，请重试';
  } finally {
    saving.value = false;
  }
}

watch(inStock, () => { void loadBrands(); void loadProducts(); });
watch(() => props.focusLocationId, (locationId) => {
  if (!locationId) return;
  brand.value = '';
  keyword.value = '';
  locationFilter.value = locationId;
  void loadProducts();
});
onMounted(loadBrands);
</script>

<template>
  <section class="bulk-place" aria-label="按品牌放置仓位">
    <header class="bulk-place-head">
      <div><h3>按品牌放置</h3><p>选品牌或输入关键词，勾选商品，选仓位后一次保存。挪货架时按“当前仓位”筛出商品再换位置。</p></div>
      <label class="bulk-place-toggle"><input v-model="inStock" type="checkbox" />只看有库存</label>
    </header>
    <div class="bulk-place-body">
      <aside class="bulk-brands">
        <input v-model="brandFilter" type="search" placeholder="筛选品牌" aria-label="筛选品牌" />
        <ul>
          <li v-for="row in shownBrands" :key="row.brand">
            <button type="button" :class="{ active: brand === row.brand, done: row.placedCount === row.productCount }" @click="pickBrand(row.brand)">
              <span>{{ row.brand }}</span><small>{{ row.placedCount }}/{{ row.productCount }}</small>
            </button>
          </li>
          <li v-if="!shownBrands.length" class="bulk-empty">没有品牌</li>
        </ul>
      </aside>
      <div class="bulk-main">
        <form class="bulk-filters" @submit.prevent="loadProducts">
          <input v-model="keyword" type="search" placeholder="关键词，如 帕氏 / swisse 护肝" aria-label="商品关键词" />
          <select v-model="locationFilter" aria-label="当前仓位" @change="loadProducts">
            <option value="">当前仓位：全部</option>
            <option value="NONE">还没放仓位的</option>
            <option v-for="location in locations" :key="location.locationId" :value="location.locationId">{{ location.code }} · {{ location.name }}</option>
          </select>
          <button type="submit" :disabled="loading">查找</button>
        </form>
        <p v-if="brand" class="bulk-current">品牌：<b>{{ brand }}</b><button type="button" class="bulk-link" @click="pickBrand(brand)">取消</button></p>
        <p v-if="!hasFilter" class="bulk-empty">从左边选一个品牌，或输入关键词开始。</p>
        <p v-else-if="loading" class="bulk-empty">正在读取…</p>
        <template v-else>
          <div class="bulk-table-head">
            <label><input type="checkbox" :checked="allSelected" @change="toggleAll" />全选</label>
            <span>共 {{ total }} 个<template v-if="total > products.length">（显示前 {{ products.length }} 个）</template>，已选 {{ selected.length }} 个</span>
          </div>
          <ul class="bulk-list">
            <li v-for="row in products" :key="row.productId">
              <label>
                <input v-model="selected" type="checkbox" :value="row.productId" />
                <span class="bulk-name"><b>{{ row.name }}</b><small>{{ row.barcodes[0] || '无条码' }} · 库存 {{ row.stock }}</small></span>
                <span class="bulk-where" :class="{ unplaced: !row.location }">{{ row.location ? row.location.code : '未放' }}</span>
              </label>
            </li>
            <li v-if="!products.length" class="bulk-empty">没有符合的商品。</li>
          </ul>
          <div class="bulk-actions">
            <select v-model="target" aria-label="放到仓位">
              <option value="">选择要放到的仓位</option>
              <option v-for="location in locations" :key="location.locationId" :value="location.locationId">{{ location.code }} · {{ location.name }}</option>
            </select>
            <button class="bulk-primary" type="button" :disabled="saving || !selected.length" @click="askSave()">放到这个仓位（{{ selected.length }}）</button>
            <button class="bulk-secondary" type="button" :disabled="saving || !selected.length" @click="askSave(true)">清除仓位</button>
          </div>
          <div v-if="confirming" class="bulk-confirm" role="alertdialog">
            <p v-if="targetLocation">已选 {{ selected.length }} 个商品，其中 {{ moving.length }} 个已放在别的仓位，会改到 <b>{{ targetLocation.code }} · {{ targetLocation.name }}</b>。确认吗？</p>
            <p v-else>将清除已选 {{ selected.length }} 个商品的仓位。确认吗？</p>
            <div><button class="bulk-secondary" type="button" @click="confirming = false">返回</button><button class="bulk-primary" type="button" :disabled="saving" @click="save">{{ saving ? '保存中…' : '确认' }}</button></div>
          </div>
        </template>
        <p v-if="notice" class="bulk-notice" role="status">{{ notice }}</p>
        <p v-if="error" class="bulk-error" role="alert">{{ error }}</p>
      </div>
    </div>
  </section>
</template>

<style scoped>
.bulk-place { --b-ink: #24314d; --b-muted: #718096; --b-line: #e2e8f0; --b-field: #f7f9fc; --b-accent: #167f8e; --b-warn: #b26a00; --b-red: #d64545;
  display: grid; gap: 14px; margin-top: 18px; padding: 18px; color: var(--b-ink); border: 1px solid var(--b-line); border-radius: 16px; background: var(--surface, #fff); }
:root[data-theme="dark"] .bulk-place { --b-ink: #e8eef8; --b-muted: #93a1b5; --b-line: #26364d; --b-field: #0c1624; --b-accent: #3cc4cc; --b-warn: #f3b25b; --b-red: #ff8a8a; background: #111b2a; }
.bulk-place-head { display: flex; flex-direction: row; align-items: flex-start; justify-content: space-between; gap: 12px; margin: 0; padding: 0; border: 0; background: none; position: static; }
.bulk-place-head h3 { margin: 0; font-size: 17px; }
.bulk-place-head p { margin: 4px 0 0; color: var(--b-muted); font-size: 13px; }
.bulk-place-toggle { display: inline-flex; flex: none; align-items: center; gap: 6px; color: var(--b-muted); font-size: 13px; white-space: nowrap; }
.bulk-place input[type="checkbox"] { flex: none; width: 18px; min-width: 18px; height: 18px; min-height: 0; margin: 0; padding: 0; }
.bulk-place-body { display: grid; grid-template-columns: 240px minmax(0, 1fr); gap: 14px; }
.bulk-brands { display: grid; grid-template-rows: auto minmax(0, 1fr); gap: 8px; max-height: 560px; min-height: 0; }
.bulk-place input[type="search"], .bulk-place select { width: 100%; min-height: 38px; padding: 0 10px; color: var(--b-ink); border: 1px solid var(--b-line); border-radius: 9px; background: var(--b-field); font-size: 13.5px; }
.bulk-brands ul, .bulk-list { margin: 0; padding: 0; overflow: auto; list-style: none; }
.bulk-brands button { display: flex; width: 100%; min-height: 34px; align-items: center; justify-content: space-between; gap: 8px; padding: 0 10px; color: var(--b-ink); border: 0; border-radius: 8px; background: transparent; box-shadow: none; font-size: 13.5px; font-weight: 500; text-align: left; cursor: pointer; }
.bulk-brands button span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.bulk-brands button small { flex: none; color: var(--b-muted); font-size: 12px; font-variant-numeric: tabular-nums; }
.bulk-brands button.done small { color: var(--b-accent); }
.bulk-brands button.active { color: #fff; background: var(--b-accent); }
.bulk-brands button.active small { color: rgb(255 255 255 / 85%); }
.bulk-main { display: grid; align-content: start; gap: 10px; min-width: 0; }
.bulk-filters { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 220px) auto; gap: 8px; }
.bulk-filters button, .bulk-primary, .bulk-secondary { width: auto; min-height: 38px; padding: 0 16px; border-radius: 9px; box-shadow: none; font-size: 13.5px; font-weight: 600; cursor: pointer; }
.bulk-filters button, .bulk-secondary { color: var(--b-ink); border: 1px solid var(--b-line); background: transparent; }
.bulk-primary { color: #fff; border: 0; background: var(--b-accent); }
.bulk-primary:disabled, .bulk-secondary:disabled { opacity: 0.5; cursor: default; }
.bulk-current { display: flex; align-items: center; gap: 8px; margin: 0; font-size: 13.5px; }
.bulk-link { width: auto; min-height: 0; padding: 0; color: var(--b-accent); border: 0; background: none; box-shadow: none; font-size: 13px; cursor: pointer; }
.bulk-table-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; color: var(--b-muted); font-size: 13px; }
.bulk-table-head label { display: inline-flex; align-items: center; gap: 6px; color: var(--b-ink); font-weight: 600; }
.bulk-list { max-height: 420px; border: 1px solid var(--b-line); border-radius: 10px; }
.bulk-list li + li { border-top: 1px solid var(--b-line); }
.bulk-list label { display: grid; grid-template-columns: 18px minmax(0, 1fr) auto; align-items: center; gap: 10px; padding: 9px 12px; text-align: left; cursor: pointer; }
.bulk-name { display: grid; gap: 2px; min-width: 0; }
.bulk-name b { overflow: hidden; font-size: 13.5px; font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }
.bulk-name small { color: var(--b-muted); font-size: 12px; }
.bulk-where { padding: 2px 8px; color: var(--b-accent); border-radius: 999px; background: color-mix(in srgb, var(--b-accent) 14%, transparent); font-size: 12px; font-weight: 600; white-space: nowrap; }
.bulk-where.unplaced { color: var(--b-warn); background: color-mix(in srgb, var(--b-warn) 14%, transparent); }
.bulk-actions { display: grid; grid-template-columns: minmax(0, 1fr) auto auto; gap: 8px; }
.bulk-confirm { display: grid; gap: 10px; padding: 12px; color: var(--b-warn); border: 1px solid var(--b-warn); border-radius: 10px; font-size: 13.5px; }
.bulk-confirm p { margin: 0; line-height: 1.5; }
.bulk-confirm div { display: flex; justify-content: flex-end; gap: 8px; }
.bulk-empty { margin: 0; padding: 12px; color: var(--b-muted); font-size: 13px; }
.bulk-notice { margin: 0; padding: 8px 10px; color: var(--b-accent); border: 1px solid var(--b-accent); border-radius: 9px; font-size: 13px; }
.bulk-error { margin: 0; padding: 8px 10px; color: var(--b-red); border: 1px solid var(--b-red); border-radius: 9px; font-size: 13px; }
@media (max-width: 720px) {
  .bulk-place { padding: 14px; }
  .bulk-place-head { flex-direction: column; }
  .bulk-place-body { grid-template-columns: 1fr; }
  .bulk-brands { max-height: 220px; }
  .bulk-filters { grid-template-columns: 1fr; }
  .bulk-actions { grid-template-columns: 1fr 1fr; }
  .bulk-actions select { grid-column: 1 / -1; }
  .bulk-actions button { min-height: 44px; }
}
</style>
