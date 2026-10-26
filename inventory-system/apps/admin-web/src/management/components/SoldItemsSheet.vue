<script setup lang="ts">
// What today's units figure is made of: every product sold, most units first (shipping fee lines are not goods and
// are left out, as in the figure itself). Units only: line amounts are list prices before discounts, not takings.
import { computed, ref } from 'vue';

type SoldItem = { productId: string | null; productName: string; brandName: string; quantity: number; revenue: number };

const props = defineProps<{ title: string; items: SoldItem[]; formatNumber: (value: number) => string }>();
const emit = defineEmits<{ close: [] }>();

const query = ref('');
const visible = computed(() => {
  const text = query.value.trim().toLowerCase();
  return text ? props.items.filter((item) => `${item.productName} ${item.brandName}`.toLowerCase().includes(text)) : props.items;
});
const totalUnits = computed(() => visible.value.reduce((sum, item) => sum + item.quantity, 0));
</script>

<template>
  <Teleport to="body">
    <div class="mgmt-sheet-overlay" role="presentation" @click.self="emit('close')">
      <section class="mgmt-sheet" role="dialog" aria-modal="true" :aria-label="title">
        <header>
          <div><h3>{{ title }}</h3><p>{{ visible.length }} 种商品 · {{ formatNumber(totalUnits) }} 件（运费不计入件数）</p></div>
          <button class="mgmt-sheet-close" type="button" aria-label="关闭" @click="emit('close')">×</button>
        </header>
        <input v-model="query" class="sold-search" type="search" placeholder="搜索商品或品牌" aria-label="搜索已售商品" />
        <ol class="sold-list">
          <li v-for="item in visible" :key="item.productId ?? item.productName">
            <span><b>{{ item.productName }}</b><small>{{ item.brandName }}</small></span>
            <strong>{{ formatNumber(item.quantity) }} 件</strong>
          </li>
        </ol>
        <p v-if="!visible.length" class="sold-empty">没有符合的商品。</p>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.mgmt-sheet-overlay { --s-bg: #fff; --s-ink: #24314d; --s-muted: #718096; --s-line: #e2e8f0; --s-field: #f7f9fc; --s-accent: #167f8e;
  position: fixed; inset: 0; z-index: 1000; display: flex; align-items: center; justify-content: center; padding: 16px; background: rgb(15 23 42 / 45%); }
:root[data-theme="dark"] .mgmt-sheet-overlay { --s-bg: #111b2a; --s-ink: #e8eef8; --s-muted: #93a1b5; --s-line: #26364d; --s-field: #0c1624; --s-accent: #3cc4cc; }
.mgmt-sheet { display: grid; grid-template-rows: auto auto minmax(0, 1fr) auto; gap: 12px; width: min(620px, 100%); max-height: calc(100dvh - 32px); padding: 18px; color: var(--s-ink); border: 1px solid var(--s-line); border-radius: 14px; background: var(--s-bg); box-shadow: 0 20px 50px rgb(0 0 0 / 25%); }
.mgmt-sheet header { display: flex; flex-direction: row; align-items: flex-start; justify-content: space-between; gap: 12px; margin: 0; padding: 0; border: 0; background: none; position: static; }
.mgmt-sheet header > div { min-width: 0; }
.mgmt-sheet h3 { margin: 0; color: var(--s-ink); font-size: 17px; }
.mgmt-sheet header p { margin: 4px 0 0; color: var(--s-muted); font-size: 13px; }
.mgmt-sheet-close { flex: none; width: 32px; min-width: 32px; height: 32px; min-height: 32px; padding: 0; color: var(--s-muted); border: 0; background: none; box-shadow: none; font-size: 22px; line-height: 1; cursor: pointer; }
.sold-search { min-height: 40px; padding: 0 12px; color: var(--s-ink); border: 1px solid var(--s-line); border-radius: 9px; background: var(--s-field); font-size: 14px; }
.sold-list { min-height: 0; margin: 0; padding: 0; overflow: auto; list-style: none; counter-reset: sold; }
.sold-list li { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 12px; padding: 9px 2px; border-top: 1px solid var(--s-line); }
.sold-list li:first-child { border-top: 0; }
.sold-list span { display: grid; gap: 2px; min-width: 0; }
.sold-list b { overflow: hidden; color: var(--s-ink); font-size: 13.5px; font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }
.sold-list small { color: var(--s-muted); font-size: 12px; }
.sold-list strong { color: var(--s-accent); font-size: 14px; font-variant-numeric: tabular-nums; }
.sold-empty { margin: 0; color: var(--s-muted); font-size: 13px; }
@media (max-width: 720px) {
  .mgmt-sheet-overlay { align-items: flex-end; padding: 0; }
  .mgmt-sheet { width: 100%; max-height: 88dvh; border-radius: 16px 16px 0 0; padding-bottom: calc(18px + env(safe-area-inset-bottom)); }
}
</style>
