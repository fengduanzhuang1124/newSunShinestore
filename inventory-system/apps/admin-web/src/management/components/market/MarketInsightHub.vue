<script setup lang="ts">
import { computed } from 'vue';
import { LEVEL1_SLOT, marketMoney as money, WEEKDAYS, type InsightTab, type MarketInsights } from './market-types';

// CR-011: the card row of store insights. Each card is a short preview; the selected card decides what the detail
// area below shows. Kept low so the detail has room.
const props = defineProps<{ data: MarketInsights }>();
const selected = defineModel<InsightTab>({ required: true });

const overview = computed(() => props.data.overview);
const revenueDelta = computed(() => {
  const previous = overview.value.previous?.revenue;
  return previous ? Math.round(((overview.value.current.revenue - previous) / previous) * 1000) / 10 : null;
});
const daily = computed(() => props.data.daily.current.map((day) => day.revenue));
const dailyMax = computed(() => Math.max(1, ...daily.value));
const curvePoints = computed(() => daily.value
  .map((value, index) => `${daily.value.length > 1 ? (index / (daily.value.length - 1)) * 200 : 100},${38 - (value / dailyMax.value) * 32}`)
  .join(' '));
const groups = computed(() => props.data.demand.rows.filter((row) => row.group !== '家庭通用' && row.orders > 0)
  .sort((a, b) => b.share - a.share).slice(0, 2));

const topProduct = computed(() => props.data.rankings.top[0] ?? null);
const shortCount = computed(() => props.data.surges.filter((row) => !row.newlyRising && row.coverageWeeks !== null && row.coverageWeeks < 2).length);

const ring = computed(() => {
  let start = 0;
  const stops = props.data.categoryShare.map((row) => {
    const colour = LEVEL1_SLOT[row.level1] ? `var(--mk-s${LEVEL1_SLOT[row.level1]})` : 'var(--mk-other)';
    const stop = `${colour} ${start}% ${start + row.share}%`;
    start += row.share;
    return stop;
  });
  return `conic-gradient(${stops.join(', ')}, var(--mk-line) ${start}% 100%)`;
});
const topCategory = computed(() => props.data.categoryShare[0] ?? null);
const dayTotals = computed(() => props.data.heatmap.cells.map((row) => row.reduce((sum, value) => sum + value, 0)));
const busiestDay = computed(() => (dayTotals.value.length ? WEEKDAYS[dayTotals.value.indexOf(Math.max(...dayTotals.value))] : '—'));

const pair = computed(() => props.data.pairs[0] ?? null);
</script>

<template>
  <div class="hub" role="tablist" aria-label="店铺经营发现">
    <button type="button" role="tab" class="hub-card c-overview" :class="{ active: selected === 'overview' }" :aria-selected="selected === 'overview'" @click="selected = 'overview'">
      <span class="hub-head"><b>经营画像</b><small>买了什么 · 为谁买 · 重点</small></span>
      <span class="hub-figure"><strong>{{ money(overview.current.revenue) }}</strong><em v-if="revenueDelta !== null" :class="revenueDelta >= 0 ? 'up' : 'down'">{{ revenueDelta >= 0 ? '▲' : '▼' }} {{ revenueDelta > 0 ? '+' : '' }}{{ revenueDelta }}%</em></span>
      <svg class="hub-curve" viewBox="0 0 200 40" preserveAspectRatio="none" aria-hidden="true"><polyline :points="curvePoints" /></svg>
      <small class="hub-note"><template v-for="(row, index) in groups" :key="row.group">{{ index ? ' · ' : '' }}{{ row.group }} {{ row.share }}%</template></small>
    </button>

    <button type="button" role="tab" class="hub-card c-products" :class="{ active: selected === 'products' }" :aria-selected="selected === 'products'" @click="selected = 'products'">
      <span class="hub-head"><b>商品榜</b><small>热销 · 滞销与待处理</small></span>
      <span class="hub-top-product">{{ topProduct ? topProduct.productName : '本期没有销售' }}<small v-if="topProduct">本期第一 · {{ money(topProduct.revenue) }}</small></span>
      <span class="hub-counts"><span><b class="down">{{ shortCount }}</b>热销缺货</span><span><b class="warn">{{ data.summary.expiringOverstockProducts }}</b>临期滞销</span><span><b>{{ data.summary.overstockProducts }}</b>超量滞销</span></span>
    </button>

    <button type="button" role="tab" class="hub-card c-mix" :class="{ active: selected === 'mix' }" :aria-selected="selected === 'mix'" @click="selected = 'mix'">
      <span class="hub-head"><b>品类与时段</b><small>卖什么 · 什么时候卖</small></span>
      <span class="hub-mix">
        <i class="ring" :style="{ background: ring }" aria-hidden="true"></i>
        <span><b>{{ topCategory ? `${topCategory.level1} ${topCategory.share}%` : '—' }}</b><small>最忙：{{ busiestDay }}<template v-if="data.heatmap.peak"> · {{ data.heatmap.peak.hour }} 点</template></small></span>
      </span>
    </button>

    <button type="button" role="tab" class="hub-card c-pairs" :class="{ active: selected === 'pairs' }" :aria-selected="selected === 'pairs'" @click="selected = 'pairs'">
      <span class="hub-head"><b>连带购买</b><small>和什么一起买</small></span>
      <span v-if="pair" class="hub-combo"><span>{{ pair.products[0].productName }}</span><em>＋ {{ pair.products[1].productName }}</em></span>
      <small class="hub-note">{{ pair ? `${pair.orders} 单同时购买 · 共 ${data.pairs.length} 组` : '本期没有常一起买的组合' }}</small>
    </button>
  </div>
</template>

<style scoped>
.hub { display: grid; grid-template-columns: minmax(0, 1.25fr) repeat(3, minmax(0, 1fr)); gap: 12px; min-width: 0; }
.hub-card {
  --tint: 64 120 220;
  position: relative; display: flex; flex-direction: column; gap: 8px; min-width: 0; min-height: 150px; padding: 14px 16px;
  overflow: hidden; color: var(--mk-ink); border: 1px solid rgb(var(--tint) / 28%); border-radius: 20px;
  background: linear-gradient(165deg, rgb(var(--tint) / 30%), rgb(16 26 46 / 92%) 48%, rgb(10 17 30 / 96%));
  backdrop-filter: blur(16px); font: inherit; text-align: left; cursor: pointer;
  animation: hub-breathe 3.6s ease-in-out infinite;
  transition: transform .25s ease, border-color .25s ease, opacity .25s ease;
}
/* Each card keeps its own colour (the same four as the market analysis home). */
.hub-card.c-overview { --tint: 40 150 220; }
.hub-card.c-products { --tint: 226 132 30; }
.hub-card.c-mix { --tint: 128 92 240; }
.hub-card.c-pairs { --tint: 42 170 110; }
.hub-card:not(.active) { opacity: .82; }
.hub-card:hover { opacity: 1; transform: translateY(-2px); border-color: rgb(var(--tint) / 60%); }
/* All cards breathe softly; the selected one is lit and breathes more strongly. */
.hub-card.active {
  border-color: rgb(var(--tint) / 70%);
  background: radial-gradient(120% 90% at 85% 0%, rgb(var(--tint) / 38%), transparent 60%), linear-gradient(165deg, rgb(var(--tint) / 42%), rgb(14 22 38 / 94%) 62%);
  animation-name: hub-breathe-strong;
}
.hub-card.active::after { position: absolute; inset: auto 16px 0; height: 3px; content: ''; border-radius: 3px 3px 0 0; background: rgb(var(--tint)); box-shadow: 0 0 12px rgb(var(--tint)); }
.hub-card:focus-visible { outline: 2px solid rgb(var(--tint)); outline-offset: 3px; }
@keyframes hub-breathe {
  0%, 100% { box-shadow: inset 0 1px 0 rgb(255 255 255 / 8%), 0 12px 26px rgb(0 0 0 / 18%), 0 0 4px rgb(var(--tint) / 12%); }
  50% { box-shadow: inset 0 1px 0 rgb(255 255 255 / 12%), 0 12px 26px rgb(0 0 0 / 18%), 0 0 16px rgb(var(--tint) / 26%); }
}
@keyframes hub-breathe-strong {
  0%, 100% { box-shadow: inset 0 1px 0 rgb(255 255 255 / 14%), 0 14px 30px rgb(0 0 0 / 22%), 0 0 12px rgb(var(--tint) / 30%); }
  50% { box-shadow: inset 0 1px 0 rgb(255 255 255 / 20%), 0 14px 30px rgb(0 0 0 / 22%), 0 0 34px rgb(var(--tint) / 55%); }
}
:root:not([data-theme="dark"]) .hub-card { background: linear-gradient(165deg, rgb(var(--tint) / 18%), rgb(255 255 255 / 96%) 55%); }
:root:not([data-theme="dark"]) .hub-card.active { background: radial-gradient(120% 90% at 85% 0%, rgb(var(--tint) / 24%), transparent 60%), linear-gradient(165deg, rgb(var(--tint) / 26%), #fff 65%); }

.hub-head { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }
.hub-head b { font-size: 15px; white-space: nowrap; }
.hub-head small { overflow: hidden; color: var(--mk-muted); font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }
.hub-note { overflow: hidden; color: var(--mk-muted); font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
.up { color: var(--mk-up); } .down { color: var(--mk-down); } .warn { color: var(--mk-warn); }

.hub-figure { display: flex; flex-wrap: wrap; align-items: baseline; gap: 8px; }
.hub-figure strong { font-size: 26px; font-variant-numeric: tabular-nums; line-height: 1.1; }
.hub-figure em { font-size: 13px; font-style: normal; font-weight: 800; font-variant-numeric: tabular-nums; }
.hub-curve { width: 100%; height: 34px; overflow: visible; }
.hub-curve polyline { fill: none; stroke: rgb(var(--tint)); stroke-width: 2; stroke-linejoin: round; stroke-linecap: round; vector-effect: non-scaling-stroke; filter: drop-shadow(0 0 4px rgb(var(--tint))); }

.hub-top-product { display: grid; gap: 2px; overflow: hidden; font-size: 14px; font-weight: 800; }
.hub-top-product, .hub-top-product small { text-overflow: ellipsis; white-space: nowrap; }
.hub-top-product small { overflow: hidden; color: var(--mk-muted); font-size: 11px; font-weight: 600; }
.hub-counts { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; margin-top: auto; }
.hub-counts > span { display: grid; gap: 1px; padding: 6px 8px; color: var(--mk-muted); border-radius: 10px; background: var(--hub-inset); font-size: 10px; white-space: nowrap; }
.hub-counts b { font-size: 17px; font-variant-numeric: tabular-nums; }
.hub-counts b:not(.down):not(.warn) { color: var(--mk-ink); }

.hub-mix { display: grid; grid-template-columns: 64px minmax(0, 1fr); align-items: center; gap: 12px; margin-top: auto; }
.ring { width: 64px; aspect-ratio: 1; border-radius: 50%; -webkit-mask: radial-gradient(circle, transparent 54%, #000 55%); mask: radial-gradient(circle, transparent 54%, #000 55%); }
.hub-mix > span { display: grid; gap: 4px; min-width: 0; }
.hub-mix b { font-size: 16px; white-space: nowrap; }
.hub-mix small { overflow: hidden; color: var(--mk-muted); font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }

.hub-combo { display: grid; gap: 3px; min-width: 0; font-size: 13px; font-weight: 800; }
.hub-combo span, .hub-combo em { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.hub-combo em { color: rgb(var(--tint)); font-style: normal; }
.hub-card .hub-note:last-child { margin-top: auto; }

@media (max-width: 1100px) { .hub { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 720px) {
  .hub { gap: 8px; }
  .hub-card { min-height: 128px; padding: 12px; border-radius: 16px; }
  .hub-head small { display: none; }
  .hub-figure strong { font-size: 20px; }
  .hub-mix { grid-template-columns: 48px minmax(0, 1fr); gap: 8px; }
  .ring { width: 48px; }
  .hub-counts { gap: 4px; }
  .hub-counts > span { padding: 4px 5px; overflow: hidden; font-size: 9px; text-overflow: ellipsis; }
  .hub-counts b { font-size: 15px; }
}
@media (prefers-reduced-motion: reduce) { .hub-card { transition: none; } .hub-card.active { animation: none; } }
</style>
