<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import MarketComingSoon from '../components/market/MarketComingSoon.vue';
import MarketHome from '../components/market/MarketHome.vue';
import MarketInsights from '../components/market/MarketInsights.vue';
import { MARKET_MODULES, PERIOD_LABEL, type InsightTab, type MarketInsights as Insights, type MarketModuleId, type MarketPeriod } from '../components/market/market-types';
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

const insightTab = ref<InsightTab>('surges');
function openModule(id: MarketModuleId, tab?: InsightTab) {
  // A module card opens on the first list; a finding on the home page opens its own list.
  insightTab.value = tab ?? 'surges';
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
        <button type="button" class="mk-back" @click="view = 'home'">← 市场分析</button>
        <nav class="mk-modules" aria-label="市场分析模块">
          <button v-for="module in MARKET_MODULES" :key="module.id" type="button" :class="{ active: view === module.id }" :aria-pressed="view === module.id" @click="view = module.id">
            {{ module.title }}<small v-if="!module.ready">即将上线</small>
          </button>
        </nav>
        <div v-if="view === 'insights'" class="mk-period" role="group" aria-label="统计周期">
          <button v-for="option in (['WEEK', 'MONTH', 'QUARTER'] as const)" :key="option" type="button" :aria-pressed="period === option" :class="{ active: period === option }" :disabled="loading" @click="period = option">{{ PERIOD_LABEL[option] }}</button>
        </div>
      </header>
      <h3 class="mk-title">{{ current?.title }}<small>{{ current?.summary }}</small></h3>

      <MarketInsights v-if="view === 'insights'" v-model:tab="insightTab" :data="insights" :loading="loading" :error="error" :adding="adding"
                      @retry="loadInsights" @add-to-order="addToOrder" @go="selectSection($event)" />
      <MarketComingSoon v-else :id="view" />
    </template>
  </section>
</template>

<style scoped>
.market-page {
  --mk-ink: #eaf2ff; --mk-muted: #8d9cb3; --mk-line: #22324a; --mk-panel: rgb(12 21 35 / 88%); --mk-card: #0f1b2c; --mk-accent: #4fd6e3;
  display: grid; align-content: start; gap: 16px; min-width: 0;
}
:root:not([data-theme="dark"]) .market-page {
  --mk-ink: #1f2c45; --mk-muted: #6c7a92; --mk-line: #dde3ee; --mk-panel: rgb(255 255 255 / 92%); --mk-card: #f7f9fd; --mk-accent: #1f9fb0;
}
.mk-topbar { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; }
.mk-back { min-height: 38px; padding: 6px 14px; color: var(--mk-ink); border: 1px solid var(--mk-line); border-radius: 999px; background: var(--mk-panel); font: inherit; font-weight: 800; cursor: pointer; }
.mk-modules, .mk-period { display: flex; gap: 4px; padding: 4px; border: 1px solid var(--mk-line); border-radius: 14px; background: var(--mk-panel); }
.mk-modules { flex: 1 1 auto; min-width: 0; overflow-x: auto; }
.mk-modules button, .mk-period button { display: inline-flex; flex: none; align-items: center; gap: 6px; min-height: 34px; padding: 6px 12px; color: var(--mk-muted); border: 0; border-radius: 10px; background: transparent; font: inherit; font-size: 13px; font-weight: 800; white-space: nowrap; cursor: pointer; }
.mk-modules button small { padding: 1px 6px; border: 1px solid var(--mk-line); border-radius: 999px; font-size: 10px; font-weight: 600; }
.mk-modules button.active, .mk-period button.active { color: #fff; background: linear-gradient(135deg, #176c8b, #475bc8); }
.mk-period button:disabled { cursor: progress; }
.mk-title { display: flex; flex-wrap: wrap; align-items: baseline; gap: 10px; margin: 0; color: var(--mk-ink); font-size: 20px; }
.mk-title small { color: var(--mk-muted); font-size: 12px; font-weight: 600; }
@media (max-width: 720px) {
  .mk-topbar { display: grid; grid-template-columns: minmax(0, 1fr); }
  .mk-back { justify-self: start; }
  .mk-period button { flex: 1; justify-content: center; }
}
</style>
