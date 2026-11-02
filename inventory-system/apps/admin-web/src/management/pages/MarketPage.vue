<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import '../glass-pill.css';
import MarketComingSoon from '../components/market/MarketComingSoon.vue';
import MarketHome from '../components/market/MarketHome.vue';
import MarketInsightHub from '../components/market/MarketInsightHub.vue';
import MarketInsights from '../components/market/MarketInsights.vue';
import { MARKET_MODULES, PERIOD_LABEL, type InsightTab, type ProductList, type MarketInsights as Insights, type MarketModuleId, type MarketPeriod } from '../components/market/market-types';
import { useManagementContext } from '../useManagementDashboard';

// REQ-014 market analysis. Loads its own data; nothing here writes except "加入进货单", which goes through the
// existing purchase order flow.
const { managementRequest, currentStoreId, selectSection, addToPurchaseOrder } = useManagementContext();

const view = ref<'home' | MarketModuleId>('home');
const period = ref<MarketPeriod>('WEEK');
const insights = ref<Insights | null>(null);
const loading = ref(false);
const error = ref('');
const adding = ref<string | null>(null);

// CR-011: store insights show a card row; the selected card decides the detail below. A finding on the home page
// selects the card (and list) that holds it.
const insightTab = ref<InsightTab>('overview');
const productList = ref<ProductList>('top');
function openModule(id: MarketModuleId, tab?: InsightTab, list?: ProductList) {
  insightTab.value = tab ?? 'overview';
  productList.value = list ?? 'top';
  view.value = id;
}

async function loadInsights() {
  const storeId = currentStoreId();
  if (!storeId) return;
  loading.value = true;
  error.value = '';
  try {
    insights.value = await managementRequest<Insights>(`/management/market-insights?storeId=${encodeURIComponent(storeId)}&period=${period.value}`);
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : '经营发现读取失败';
  } finally {
    loading.value = false;
  }
}
watch(period, () => { void loadInsights(); });

async function addToOrder(productId: string) {
  adding.value = productId;
  try {
    await addToPurchaseOrder(productId, 'HOT_SALES');
    await loadInsights();
  } finally {
    adding.value = null;
  }
}

const metrics = computed<Record<MarketModuleId, string>>(() => {
  const summary = insights.value?.summary;
  return {
    insights: summary ? `${summary.surgeProducts} 种突然热销 · ${summary.overstockProducts} 种超量滞销` : loading.value ? '正在读取…' : '点击查看',
    report: '即将上线', trends: '即将上线', campaigns: '即将上线',
  };
});
const current = computed(() => MARKET_MODULES.find((module) => module.id === view.value));

onMounted(() => { void loadInsights(); });
</script>

<template>
  <section class="market-page">
    <MarketHome v-if="view === 'home'" :insights="insights" :loading="loading" :metrics="metrics" @open="openModule" />

    <template v-else>
      <header class="mk-topbar">
        <button type="button" class="glass-pill back mk-back" @click="view = 'home'"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>返回</button>
        <h3 class="mk-title">{{ current?.title }}</h3>
        <div v-if="view === 'insights'" class="mk-period" role="group" aria-label="统计周期">
          <button v-for="option in (['WEEK', 'MONTH', 'QUARTER'] as const)" :key="option" type="button" :aria-pressed="period === option" :class="{ active: period === option }" :disabled="loading" @click="period = option">{{ PERIOD_LABEL[option] }}</button>
        </div>
      </header>
      <p v-if="view === 'insights' && insights" class="mk-range">本期 {{ insights.period.from }} 至 {{ insights.period.to }}（{{ insights.period.days }} 个完整天）· 上期 {{ insights.period.previousFrom }} 至 {{ insights.period.previousTo }}<em v-if="insights.period.stale"> · POS 数据只同步到 {{ insights.period.dataThrough }}</em><span v-if="loading"> · 正在更新…</span></p>

      <MarketInsightHub v-if="view === 'insights' && insights" v-model="insightTab" :data="insights" />
      <MarketInsights v-if="view === 'insights'" v-model:tab="insightTab" v-model:list="productList" :data="insights" :loading="loading" :error="error" :adding="adding"
                      @retry="loadInsights" @add-to-order="addToOrder" @go="selectSection($event)" />
      <MarketComingSoon v-else :id="view" />
    </template>
  </section>
</template>

<style scoped>
.market-page {
  --mk-ink: #eaf2ff; --mk-muted: #8d9cb3; --mk-line: #22324a; --mk-panel: rgb(12 21 35 / 88%); --mk-card: #0f1b2c; --mk-accent: #4fd6e3; --mk-surface: #0d1626;
  /* CR-011 chart colours: categorical slots (fixed per first-level category), status colours kept separate. */
  --mk-s1: #3987e5; --mk-s2: #d95926; --mk-s3: #199e70; --mk-s4: #c98500; --mk-s5: #d55181; --mk-s6: #2f9e44; --mk-s7: #9085e9; --mk-other: #5d6b80;
  --mk-up: #3fcf9f; --mk-down: #ff7b7b; --mk-warn: #ffb45c;
  /* Card wall glass (CR-011). */
  --hub-glass: linear-gradient(165deg, rgb(64 104 196 / 30%), rgb(16 26 46 / 92%) 46%, rgb(10 17 30 / 96%));
  --hub-hero: radial-gradient(120% 90% at 80% 10%, rgb(84 128 255 / 34%), transparent 60%), linear-gradient(165deg, rgb(52 86 170 / 42%), rgb(12 20 36 / 96%) 60%);
  --hub-border: rgb(140 170 255 / 18%); --hub-border-hover: rgb(120 190 255 / 48%); --hub-glow: rgb(70 140 255 / 30%); --hub-inset: rgb(0 0 0 / 14%);
  display: grid; align-content: start; gap: 16px; min-width: 0;
}
:root:not([data-theme="dark"]) .market-page {
  --mk-ink: #1f2c45; --mk-muted: #6c7a92; --mk-line: #dde3ee; --mk-panel: rgb(255 255 255 / 92%); --mk-card: #f7f9fd; --mk-accent: #1f9fb0; --mk-surface: #fff;
  --mk-s1: #2a78d6; --mk-s2: #eb6834; --mk-s3: #1baf7a; --mk-s4: #eda100; --mk-s5: #e87ba4; --mk-s6: #008300; --mk-s7: #6250d6; --mk-other: #9aa5b5;
  --mk-up: #0f9d6e; --mk-down: #d64545; --mk-warn: #c27400;
  --hub-glass: linear-gradient(165deg, rgb(214 228 255 / 92%), rgb(255 255 255 / 96%) 50%);
  --hub-hero: radial-gradient(120% 90% at 80% 10%, rgb(120 160 255 / 30%), transparent 60%), linear-gradient(165deg, rgb(226 236 255), #fff 60%);
  --hub-border: #d9e2f2; --hub-border-hover: #9cc0ff; --hub-glow: rgb(80 130 230 / 18%); --hub-inset: rgb(255 255 255 / 72%);
}
.mk-topbar { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; }
.mk-back { gap: 6px; padding-left: 12px; }
.mk-back svg { width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 2.4; stroke-linecap: round; stroke-linejoin: round; }
.mk-period { margin-left: auto; }
.mk-period { display: flex; gap: 4px; padding: 4px; border: 1px solid var(--mk-line); border-radius: 14px; background: var(--mk-panel); }
.mk-period button { display: inline-flex; flex: none; align-items: center; gap: 6px; min-height: 34px; padding: 6px 12px; color: var(--mk-muted); border: 0; border-radius: 10px; background: transparent; font: inherit; font-size: 13px; font-weight: 800; white-space: nowrap; cursor: pointer; }
.mk-period button.active { color: #fff; background: linear-gradient(135deg, #176c8b, #475bc8); }
.mk-period button:disabled { cursor: progress; }
.mk-title { display: flex; align-items: baseline; gap: 8px; margin: 0 4px; color: var(--mk-ink); font-size: 18px; white-space: nowrap; }
.mk-range { margin: -6px 0 0; color: var(--mk-muted); font-size: 12px; }
.mk-range em { color: var(--mk-warn); font-style: normal; }
@media (max-width: 720px) {
  .mk-topbar { display: grid; grid-template-columns: minmax(0, 1fr); }
  .mk-back { justify-self: start; }
  .mk-period button { flex: 1; justify-content: center; }
}
</style>
