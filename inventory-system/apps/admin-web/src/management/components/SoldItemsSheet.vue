<script setup lang="ts">
// What a day's units figure is made of (CR-007 E4): every product sold, ranked by units, 50 a page, sliding in from
// the side (from the bottom on phones). Shipping fee lines are not goods and are left out, as in the figure itself.
// Units only: line amounts are list prices before discounts, not takings.
import { computed, onMounted, ref, watch } from 'vue';

type SoldItem = { productId: string | null; productName: string; brandName: string; quantity: number; revenue: number };

const props = defineProps<{ title: string; items: SoldItem[]; formatNumber: (value: number) => string }>();
const emit = defineEmits<{ close: [] }>();

const PAGE_SIZE = 50;
const visible = ref(false);
const query = ref('');
const page = ref(1);
onMounted(() => { visible.value = true; });
function close() { visible.value = false; }

const ranked = computed(() => props.items.map((item, index) => ({ ...item, rank: index + 1 })));
const filtered = computed(() => {
  const text = query.value.trim().toLowerCase();
  return text ? ranked.value.filter((item) => `${item.productName} ${item.brandName}`.toLowerCase().includes(text)) : ranked.value;
});
watch(query, () => { page.value = 1; });
const pageCount = computed(() => Math.max(1, Math.ceil(filtered.value.length / PAGE_SIZE)));
const pageItems = computed(() => filtered.value.slice((page.value - 1) * PAGE_SIZE, page.value * PAGE_SIZE));
const totalUnits = computed(() => props.items.reduce((sum, item) => sum + item.quantity, 0));
const maxUnits = computed(() => Math.max(1, ...props.items.map((item) => item.quantity)));
const share = (quantity: number) => `${Math.max(2, Math.round((quantity / maxUnits.value) * 100))}%`;
const listEl = ref<HTMLElement | null>(null);
function goTo(target: number) {
  page.value = Math.min(pageCount.value, Math.max(1, target));
  listEl.value?.scrollTo({ top: 0 });
}
</script>

<template>
  <Teleport to="body">
    <Transition name="sold-fade" @after-leave="emit('close')">
      <div v-if="visible" class="sold-overlay" role="presentation" @click.self="close">
        <Transition name="sold-slide" appear>
          <section v-if="visible" class="sold-panel" role="dialog" aria-modal="true" :aria-label="title">
            <header>
              <div><h3>{{ title }}</h3><p>运费不计入件数</p></div>
              <button class="sold-close" type="button" aria-label="关闭" @click="close">×</button>
            </header>
            <div class="sold-stats">
              <div><span>商品</span><strong>{{ items.length }}<small>种</small></strong></div>
              <div><span>件数</span><strong>{{ formatNumber(totalUnits) }}<small>件</small></strong></div>
              <div><span>最畅销</span><strong class="sold-top">{{ items[0]?.productName ?? '—' }}</strong></div>
            </div>
            <input v-model="query" class="sold-search" type="search" placeholder="搜索商品或品牌" aria-label="搜索已售商品" />
            <ol ref="listEl" class="sold-list">
              <li v-for="(item, index) in pageItems" :key="`${item.rank}-${item.productId ?? item.productName}`" :style="{ '--delay': `${Math.min(index, 20) * 18}ms` }">
                <em :class="{ top: item.rank <= 3 }">{{ item.rank }}</em>
                <span class="sold-name"><b>{{ item.productName }}</b><small>{{ item.brandName }}</small><i class="sold-bar"><i :style="{ width: share(item.quantity) }"></i></i></span>
                <strong>{{ formatNumber(item.quantity) }}<small>件</small></strong>
              </li>
              <li v-if="!pageItems.length" class="sold-empty">没有符合的商品。</li>
            </ol>
            <footer v-if="pageCount > 1" class="sold-pages">
              <button type="button" :disabled="page <= 1" @click="goTo(page - 1)">上一页</button>
              <span>第 {{ page }} / {{ pageCount }} 页 · 共 {{ filtered.length }} 种</span>
              <button type="button" :disabled="page >= pageCount" @click="goTo(page + 1)">下一页</button>
            </footer>
          </section>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.sold-overlay { --s-bg: #fff; --s-ink: #24314d; --s-muted: #718096; --s-line: #e7ecf3; --s-field: #f5f7fa; --s-accent: #167f8e; --s-accent-soft: rgb(22 127 142 / 14%); --s-gold: #c47a12;
  position: fixed; inset: 0; z-index: 1000; display: flex; justify-content: flex-end; background: rgb(15 23 42 / 40%); }
:root[data-theme="dark"] .sold-overlay { --s-bg: #0f1a2a; --s-ink: #e8eef8; --s-muted: #93a1b5; --s-line: #22324a; --s-field: #0b1522; --s-accent: #3cc4cc; --s-accent-soft: rgb(60 196 204 / 16%); --s-gold: #f3b25b; }
.sold-panel { display: grid; grid-template-rows: auto auto auto minmax(0, 1fr) auto; gap: 14px; width: min(560px, 100%); height: 100%; padding: 22px 22px 16px; color: var(--s-ink); background: var(--s-bg); box-shadow: -18px 0 40px rgb(0 0 0 / 22%); }
.sold-panel header { display: flex; flex-direction: row; align-items: flex-start; justify-content: space-between; gap: 12px; margin: 0; padding: 0; border: 0; background: none; position: static; }
.sold-panel h3 { margin: 0; color: var(--s-ink); font-size: 18px; }
.sold-panel header p { margin: 4px 0 0; color: var(--s-muted); font-size: 12.5px; }
.sold-close { flex: none; width: 34px; min-width: 34px; height: 34px; min-height: 34px; padding: 0; color: var(--s-muted); border: 0; border-radius: 50%; background: var(--s-field); box-shadow: none; font-size: 20px; line-height: 1; cursor: pointer; }
.sold-stats { display: grid; grid-template-columns: 1fr 1fr 1.6fr; gap: 8px; }
.sold-stats div { display: grid; gap: 4px; min-width: 0; padding: 10px 12px; border-radius: 12px; background: var(--s-field); }
.sold-stats span { color: var(--s-muted); font-size: 12px; }
.sold-stats strong { overflow: hidden; color: var(--s-ink); font-size: 20px; font-variant-numeric: tabular-nums; text-overflow: ellipsis; white-space: nowrap; }
.sold-stats strong small { margin-left: 2px; color: var(--s-muted); font-size: 12px; font-weight: 500; }
.sold-stats .sold-top { font-size: 13.5px; line-height: 24px; }
.sold-search { min-height: 40px; padding: 0 12px; color: var(--s-ink); border: 1px solid var(--s-line); border-radius: 10px; background: var(--s-field); font-size: 14px; }
.sold-list { min-height: 0; margin: 0 -4px; padding: 0 4px; overflow: auto; list-style: none; }
.sold-list li { display: grid; grid-template-columns: 34px minmax(0, 1fr) auto; align-items: center; gap: 12px; padding: 10px 2px; border-top: 1px solid var(--s-line); animation: sold-row 0.35s ease both; animation-delay: var(--delay); }
.sold-list li:first-child { border-top: 0; }
.sold-list em { display: grid; place-items: center; width: 28px; height: 28px; color: var(--s-muted); border-radius: 8px; background: var(--s-field); font-size: 12.5px; font-style: normal; font-weight: 700; font-variant-numeric: tabular-nums; }
.sold-list em.top { color: var(--s-gold); background: color-mix(in srgb, var(--s-gold) 16%, transparent); }
.sold-name { display: grid; gap: 3px; min-width: 0; }
.sold-name b { overflow: hidden; color: var(--s-ink); font-size: 13.5px; font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }
.sold-name small { overflow: hidden; color: var(--s-muted); font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
.sold-bar { display: block; height: 5px; margin-top: 3px; overflow: hidden; border-radius: 3px; background: var(--s-field); }
.sold-bar i { display: block; height: 100%; border-radius: 3px; background: var(--s-accent); transform-origin: left; animation: sold-bar 0.6s ease both; animation-delay: var(--delay); }
.sold-list strong { min-width: 52px; color: var(--s-accent); font-size: 16px; text-align: right; font-variant-numeric: tabular-nums; }
.sold-list strong small { margin-left: 2px; color: var(--s-muted); font-size: 11.5px; font-weight: 500; }
.sold-list .sold-empty { display: block; color: var(--s-muted); font-size: 13px; animation: none; }
.sold-pages { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding-top: 10px; border-top: 1px solid var(--s-line); }
.sold-pages span { color: var(--s-muted); font-size: 12.5px; }
.sold-pages button { min-height: 36px; padding: 0 14px; color: var(--s-ink); border: 1px solid var(--s-line); border-radius: 9px; background: transparent; box-shadow: none; font-size: 13px; font-weight: 600; cursor: pointer; }
.sold-pages button:disabled { opacity: 0.4; cursor: default; }
@keyframes sold-row { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
@keyframes sold-bar { from { transform: scaleX(0); } to { transform: scaleX(1); } }
.sold-fade-enter-active, .sold-fade-leave-active { transition: opacity 0.3s ease; }
.sold-fade-enter-from, .sold-fade-leave-to { opacity: 0; }
.sold-slide-enter-active, .sold-slide-leave-active { transition: transform 0.38s cubic-bezier(0.22, 1, 0.36, 1); }
.sold-slide-enter-from, .sold-slide-leave-to { transform: translateX(100%); }
@media (max-width: 720px) {
  .sold-overlay { align-items: flex-end; }
  .sold-panel { width: 100%; height: 88dvh; padding: 18px 16px calc(14px + env(safe-area-inset-bottom)); border-radius: 18px 18px 0 0; box-shadow: 0 -12px 30px rgb(0 0 0 / 25%); }
  .sold-slide-enter-from, .sold-slide-leave-to { transform: translateY(100%); }
  .sold-stats { grid-template-columns: 1fr 1fr; }
  .sold-stats div:last-child { grid-column: 1 / -1; }
}
@media (prefers-reduced-motion: reduce) {
  .sold-list li, .sold-bar i { animation: none; }
  .sold-fade-enter-active, .sold-fade-leave-active, .sold-slide-enter-active, .sold-slide-leave-active { transition: none; }
}
</style>
