<script setup lang="ts">
// CR-020 F5–F7 (admins only): rename a product, discontinue one that is no longer sold, or review discontinued
// products and put them back on sale. Discontinuing needs zero stock; the server checks it again.
import { computed, onMounted, ref } from 'vue';

export type ProductStatusMode = 'rename' | 'discontinue' | 'discontinued';
type Names = { name: string; chineseName: string | null; englishName: string | null; posNames: string[] };
type DiscontinuedRow = { productId: string; productName: string; barcodes: string[]; discontinuedAt: string; reason: string | null; performedBy: string };

const props = defineProps<{
  mode: ProductStatusMode;
  product?: { productId: string; productName: string; totalQuantity: number } | null;
  request: (path: string, init?: RequestInit) => Promise<any>;
}>();
const emit = defineEmits<{ close: []; renamed: [productId: string, name: string]; discontinued: [productId: string]; restored: [productName: string] }>();

const names = ref<Names | null>(null);
const name = ref(props.product?.productName ?? '');
const reason = ref('');
const rows = ref<DiscontinuedRow[]>([]);
const loading = ref(false);
const saving = ref(false);
const error = ref('');
const notice = ref('');
const hasStock = computed(() => (props.product?.totalQuantity ?? 0) !== 0);
const title = computed(() => ({ rename: '修改商品名称', discontinue: '停售商品', discontinued: '已停售商品' })[props.mode]);

async function run<T>(task: () => Promise<T>, fallback: string) {
  error.value = '';
  try {
    return await task();
  } catch (failure) {
    error.value = failure instanceof Error ? failure.message : fallback;
    return null;
  }
}

async function loadList() {
  loading.value = true;
  rows.value = (await run(() => props.request('/inventory/products/discontinued'), '读取失败')) ?? [];
  loading.value = false;
}

onMounted(async () => {
  if (props.mode === 'discontinued') await loadList();
  if (props.mode === 'rename' && props.product) names.value = await run(() => props.request(`/inventory/products/${props.product!.productId}/names`), '读取名称失败');
});

async function rename() {
  if (!props.product || !name.value.trim() || saving.value) return;
  saving.value = true;
  const saved = await run(() => props.request(`/inventory/products/${props.product!.productId}/name`, { method: 'PATCH', body: JSON.stringify({ name: name.value.trim() }) }), '保存失败');
  saving.value = false;
  if (saved) emit('renamed', props.product.productId, saved.name);
}

async function discontinue() {
  if (!props.product || !reason.value.trim() || hasStock.value || saving.value) return;
  saving.value = true;
  const saved = await run(() => props.request(`/inventory/products/${props.product!.productId}/discontinue`, { method: 'POST', body: JSON.stringify({ reason: reason.value.trim() }) }), '停售失败');
  saving.value = false;
  if (saved) emit('discontinued', props.product.productId);
}

async function restore(row: DiscontinuedRow) {
  if (saving.value) return;
  saving.value = true;
  const saved = await run(() => props.request(`/inventory/products/${row.productId}/restore`, { method: 'POST' }), '恢复失败');
  saving.value = false;
  if (!saved) return;
  notice.value = `已恢复销售：${row.productName}`;
  rows.value = rows.value.filter((item) => item.productId !== row.productId);
  emit('restored', row.productName);
}
</script>

<template>
  <Teleport to="body">
    <div class="mgmt-sheet-overlay" role="presentation" @click.self="emit('close')">
      <section class="mgmt-sheet" role="dialog" aria-modal="true" :aria-label="title">
        <header>
          <div><h3>{{ title }}</h3><p v-if="product">{{ product.productName }}</p></div>
          <button class="mgmt-sheet-close" type="button" aria-label="关闭" @click="emit('close')">×</button>
        </header>

        <template v-if="mode === 'rename'">
          <dl v-if="names" class="status-names">
            <div><dt>中文名</dt><dd>{{ names.chineseName || '—' }}</dd></div>
            <div><dt>英文名</dt><dd>{{ names.englishName || '—' }}</dd></div>
            <div><dt>POS 名称</dt><dd>{{ names.posNames.join(' / ') || '没有对应 POS 商品' }}</dd></div>
          </dl>
          <label class="status-field">新名称<input v-model="name" maxlength="255" aria-label="新商品名称" placeholder="英文品牌 中文品牌 产品名 规格" /></label>
          <p class="mgmt-sheet-muted">建议格式：英文品牌 + 中文品牌 + 产品名 + 规格，例如 Blackmores 澳佳宝 钙+镁+D3 200 片。</p>
        </template>

        <template v-else-if="mode === 'discontinue'">
          <p v-if="hasStock" class="status-warn" role="alert">该商品还有 {{ product?.totalQuantity }} 件库存，请先盘点或出库到 0 再停售。</p>
          <template v-else>
            <p class="mgmt-sheet-muted">停售后不再出现在库存台账、盘点、进货建议和临期预警中，条码保留。可在“已停售”中恢复；再次扫码入库会自动恢复。</p>
            <label class="status-field">停售原因<input v-model="reason" maxlength="255" aria-label="停售原因" placeholder="例如：厂家停产、不再进货" /></label>
          </template>
        </template>

        <template v-else>
          <p v-if="loading" class="mgmt-sheet-muted">正在读取…</p>
          <p v-else-if="!rows.length" class="mgmt-sheet-muted">没有停售商品。</p>
          <ul v-else class="status-list">
            <li v-for="row in rows" :key="row.productId">
              <span><b>{{ row.productName }}</b><small>{{ row.barcodes[0] || '无条码' }} · {{ new Date(row.discontinuedAt).toLocaleDateString() }} · {{ row.performedBy }}<template v-if="row.reason"> · {{ row.reason }}</template></small></span>
              <button type="button" :disabled="saving" @click="restore(row)">恢复销售</button>
            </li>
          </ul>
        </template>

        <p v-if="notice" class="status-notice" role="status">{{ notice }}</p>
        <p v-if="error" class="mgmt-sheet-error" role="alert">{{ error }}</p>
        <footer>
          <button class="mgmt-sheet-secondary" type="button" @click="emit('close')">{{ mode === 'discontinued' ? '关闭' : '取消' }}</button>
          <button v-if="mode === 'rename'" class="mgmt-sheet-primary" type="button" :disabled="saving || !name.trim()" @click="rename">{{ saving ? '保存中…' : '保存名称' }}</button>
          <button v-if="mode === 'discontinue' && !hasStock" class="mgmt-sheet-primary danger" type="button" :disabled="saving || !reason.trim()" @click="discontinue">{{ saving ? '处理中…' : '确认停售' }}</button>
        </footer>
      </section>
    </div>
  </Teleport>
</template>

<style scoped src="../management/components/sheet-base.css"></style>
<style scoped>
.mgmt-sheet-muted { margin: 0; line-height: 1.5; }
.status-names { display: grid; gap: 6px; margin: 0; padding: 10px 12px; border: 1px solid var(--s-line); border-radius: 10px; background: var(--s-field); }
.status-names div { display: grid; grid-template-columns: 72px minmax(0, 1fr); gap: 8px; font-size: 13px; }
.status-names dt { color: var(--s-muted); }
.status-names dd { margin: 0; overflow-wrap: anywhere; }
.status-field { display: grid; gap: 6px; font-size: 13px; font-weight: 600; }
.status-field input { min-height: 44px; padding: 0 12px; color: var(--s-ink); border: 1px solid var(--s-line); border-radius: 9px; background: var(--s-field); font-size: 16px; }
.status-warn { margin: 0; padding: 10px 12px; color: var(--s-warn); border: 1px solid var(--s-warn); border-radius: 10px; font-size: 13px; }
.status-list { display: grid; gap: 6px; max-height: 360px; margin: 0; padding: 0; overflow: auto; list-style: none; }
.status-list li { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 9px 10px; border: 1px solid var(--s-line); border-radius: 10px; }
.status-list span { display: grid; gap: 2px; min-width: 0; }
.status-list b { font-size: 13.5px; overflow-wrap: anywhere; }
.status-list small { color: var(--s-muted); font-size: 12px; }
.status-list button { flex: none; min-height: 36px; padding: 0 12px; color: var(--s-accent); border: 1px solid var(--s-accent); border-radius: 9px; background: transparent; box-shadow: none; font-size: 13px; font-weight: 600; cursor: pointer; }
.status-notice { margin: 0; padding: 8px 10px; color: var(--s-accent); border: 1px solid var(--s-accent); border-radius: 9px; font-size: 13px; }
.mgmt-sheet-primary.danger { background: var(--s-red); }
</style>
