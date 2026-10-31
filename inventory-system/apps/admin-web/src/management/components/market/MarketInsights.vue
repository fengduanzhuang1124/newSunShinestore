<script setup lang="ts">
import { computed } from 'vue';
import type { InsightTab, MarketInsights } from './market-types';

// REQ-014 §4.3: store findings. Indicator cards double as tabs for the list; the side column holds the key finding,
// category movement and shortcuts to the pages where things are actually changed.
const props = defineProps<{ data: MarketInsights | null; loading: boolean; error: string; adding: string | null }>();
const emit = defineEmits<{ retry: []; 'add-to-order': [productId: string]; go: [section: 'procurement' | 'inventory' | 'products'] }>();

// The open list; the home page's findings open a specific one.
const tab = defineModel<InsightTab>('tab', { default: 'surges' });

const kpis = computed(() => {
  const summary = props.data?.summary;
  if (!summary) return [];
  const coverage = summary.categoryCoverage.total ? Math.round((summary.categoryCoverage.identified / summary.categoryCoverage.total) * 100) : 0;
  return [
    { id: 'surges' as const, label: '突然热销', value: summary.surgeProducts, unit: '种', note: `新品起量 ${summary.newlyRisingProducts} 种`, tone: 'up' },
    { id: 'overstock' as const, label: '超量滞销', value: summary.overstockProducts, unit: '种', note: `其中临期 ${summary.expiringOverstockProducts} 种`, tone: 'warn' },
    { id: 'pairs' as const, label: '常一起买', value: summary.pairs, unit: '组', note: '同一订单 ≥ 5 次', tone: 'info' },
    { id: 'categories' as const, label: '品类上升', value: summary.risingCategories, unit: '个', note: `下降 ${summary.fallingCategories} 个 · 识别率 ${coverage}%`, tone: 'violet' },
  ];
});

// The single most useful sentence: a best seller about to run short, else expiring overstock, else the top best seller.
const focus = computed(() => {
  const data = props.data;
  if (!data) return null;
  const short = data.surges.find((row) => !row.newlyRising && row.coverageWeeks !== null && row.coverageWeeks < 2 && !row.inCurrentOrder);
  if (short) return { title: '热销且库存不足', text: `${short.productName} 本期卖出 ${short.currentUnits} 件，是平时的 ${short.ratio} 倍；现有 ${short.currentInventory} 件，约够 ${short.coverageWeeks} 周。`, action: 'add' as const, productId: short.productId };
  const expiring = data.overstock.find((row) => row.expiring);
  if (expiring) return { title: '临期且卖得慢', text: `${expiring.productName} 还有 ${expiring.currentInventory} 件，最早 ${expiring.nearestExpiry} 到期${expiring.coverageWeeks ? `，按现在的卖法要 ${expiring.coverageWeeks} 周` : `，已 ${expiring.daysSinceLastSale ?? '60+'} 天无销售`}。可在活动策划中安排清货。`, action: 'inventory' as const, productId: expiring.productId };
  const top = data.surges.find((row) => !row.newlyRising);
  if (top) return { title: '本期最热', text: `${top.productName} 本期卖出 ${top.currentUnits} 件，是平时的 ${top.ratio} 倍。`, action: null, productId: top.productId };
  return null;
});

const movers = computed(() => (props.data?.categories ?? [])
  .filter((row) => row.changePercent !== null && row.trend !== 'FLAT')
  .sort((a, b) => Math.abs(b.changePercent!) - Math.abs(a.changePercent!))
  .slice(0, 6));
const maxMove = computed(() => Math.max(...movers.value.map((row) => Math.abs(row.changePercent!)), 1));
const fmt = (value: number) => (Number.isInteger(value) ? String(value) : value.toFixed(1));
</script>

<template>
  <div class="mk-insights">
    <div v-if="loading && !data" class="mk-skeleton" aria-hidden="true"><i v-for="n in 4" :key="n"></i><i class="wide"></i></div>
    <div v-else-if="error && !data" class="mk-state error" role="alert">
      <strong>{{ error.includes('权限') ? '没有查看权限' : '经营发现读取失败' }}</strong>
      <p>{{ error }}</p>
      <button v-if="!error.includes('权限')" type="button" @click="emit('retry')">重新加载</button>
    </div>
    <template v-else-if="data">
      <p class="mk-range">本期 {{ data.period.from }} 至 {{ data.period.to }} · 上期 {{ data.period.previousFrom }} 至 {{ data.period.previousTo }}<span v-if="loading"> · 正在更新…</span></p>

      <div class="mk-kpis" role="tablist" aria-label="经营发现类型">
        <button v-for="item in kpis" :key="item.id" type="button" role="tab" class="mk-kpi" :class="[item.tone, { active: tab === item.id }]" :aria-selected="tab === item.id" @click="tab = item.id">
          <span>{{ item.label }}</span>
          <strong>{{ item.value }}<small>{{ item.unit }}</small></strong>
          <em>{{ item.note }}</em>
        </button>
      </div>

      <div class="mk-layout">
        <section class="mk-panel mk-list-panel" :aria-label="kpis.find((item) => item.id === tab)?.label">
          <template v-if="tab === 'surges'">
            <p v-if="data.period.baselineWindows === 0" class="mk-note">销售历史还不够比较前几期（目前 {{ data.period.historyDays }} 天），暂不计算突然热销。</p>
            <ul v-else-if="data.surges.length" class="mk-list surges">
              <li class="mk-head"><span>商品</span><span>本期 / 平时</span><span>倍数</span><span>库存</span><span></span></li>
              <li v-for="row in data.surges" :key="row.productId" class="mk-row">
                <span class="mk-name"><strong>{{ row.productName }}</strong><small>{{ row.level2 }} · {{ row.brandName }}</small></span>
                <span data-k="本期 / 平时"><b>{{ fmt(row.currentUnits) }}</b> / {{ fmt(row.baselineUnits) }} 件</span>
                <span data-k="倍数"><em v-if="row.newlyRising" class="mk-tag new">新品起量</em><em v-else class="mk-tag up">× {{ row.ratio }}</em></span>
                <span data-k="库存">{{ row.currentInventory }} 件<small v-if="row.coverageWeeks !== null">约 {{ row.coverageWeeks }} 周</small></span>
                <span class="mk-act">
                  <em v-if="row.inCurrentOrder" class="mk-tag done">已在进货单</em>
                  <button v-else type="button" :disabled="adding === row.productId" @click="emit('add-to-order', row.productId)">{{ adding === row.productId ? '加入中…' : '加入进货单' }}</button>
                </span>
              </li>
            </ul>
            <p v-else class="mk-empty">本期没有突然热销的商品。</p>
            <p class="mk-rule">规则：{{ data.rules.surge }}；前几期平均不足 1 件的归为“新品起量”。</p>
          </template>

          <template v-else-if="tab === 'overstock'">
            <ul v-if="data.overstock.length" class="mk-list overstock">
              <li class="mk-head"><span>商品</span><span>库存</span><span>还能卖</span><span>最早到期</span><span></span></li>
              <li v-for="row in data.overstock" :key="row.productId" class="mk-row">
                <span class="mk-name"><strong>{{ row.productName }}</strong><small>{{ row.level2 }} · {{ row.brandName }}</small></span>
                <span data-k="库存"><b>{{ row.currentInventory }}</b> 件</span>
                <span data-k="还能卖"><template v-if="row.reason === 'COVERAGE'">约 {{ row.coverageWeeks }} 周</template><template v-else>{{ row.daysSinceLastSale === null ? '60 天以上' : `${row.daysSinceLastSale} 天` }}无销售</template></span>
                <span data-k="最早到期">{{ row.nearestExpiry ?? '—' }}<em v-if="row.expiring" class="mk-tag warn">临期</em></span>
                <span class="mk-act"><button type="button" class="ghost" @click="emit('go', 'inventory')">库存经营 →</button></span>
              </li>
            </ul>
            <p v-else class="mk-empty">没有超量滞销的商品。</p>
            <p class="mk-rule">规则：{{ data.rules.overstock }}；临期按临期预警设置判断，临期的排在前面。显示前 100 个。</p>
          </template>

          <template v-else-if="tab === 'pairs'">
            <ul v-if="data.pairs.length" class="mk-list pairs">
              <li class="mk-head"><span>一起买的商品</span><span>同单次数</span><span>关联度</span></li>
              <li v-for="pair in data.pairs" :key="pair.products.map((p) => p.productId).join('-')" class="mk-row">
                <span class="mk-name"><strong>{{ pair.products[0].productName }}</strong><small>＋ {{ pair.products[1].productName }}</small></span>
                <span data-k="同单次数"><b>{{ pair.orders }}</b> 单</span>
                <span data-k="关联度" class="mk-share">买前者的 {{ pair.products[0].share }}% 也买后者<small>买后者的 {{ pair.products[1].share }}% 也买前者</small></span>
              </li>
            </ul>
            <p v-else class="mk-empty">本期没有同单出现 5 次以上的组合。</p>
            <p class="mk-rule">规则：{{ data.rules.pairs }}；显示前 20 组。适合做套装、搭配陈列。</p>
          </template>

          <template v-else>
            <p v-if="!data.period.previousComplete" class="mk-note">上期不在 POS 销售历史范围内，暂不比较品类变化，只显示本期销量。</p>
            <ul v-if="data.categories.length" class="mk-list categories">
              <li class="mk-head"><span>品类</span><span>本期</span><span>上期</span><span>变化</span></li>
              <li v-for="row in data.categories" :key="`${row.level1}/${row.level2}`" class="mk-row">
                <span class="mk-name"><strong>{{ row.level2 }}</strong><small>{{ row.level1 }}</small></span>
                <span data-k="本期"><b>{{ row.currentUnits }}</b> 件</span>
                <span data-k="上期">{{ row.previousUnits }} 件</span>
                <span data-k="变化"><em v-if="row.changePercent !== null" class="mk-tag" :class="row.trend === 'UP' ? 'up' : row.trend === 'DOWN' ? 'down' : 'flat'">{{ row.changePercent > 0 ? '+' : '' }}{{ row.changePercent }}%</em><template v-else>—</template></span>
              </li>
            </ul>
            <p v-else class="mk-empty">本期没有销售数据。</p>
            <p class="mk-rule">规则：{{ data.rules.category }}；品类由商品名称自动识别，人工填写的品类优先。</p>
          </template>
        </section>

        <aside class="mk-side">
          <section v-if="focus" class="mk-panel mk-focus">
            <small>重点</small>
            <strong>{{ focus.title }}</strong>
            <p>{{ focus.text }}</p>
            <button v-if="focus.action === 'add'" type="button" :disabled="adding === focus.productId" @click="emit('add-to-order', focus.productId)">加入本周进货单</button>
            <button v-else-if="focus.action === 'inventory'" type="button" @click="emit('go', 'inventory')">到库存经营查看</button>
          </section>
          <section class="mk-panel mk-movers">
            <h4>品类升降</h4>
            <ul v-if="movers.length">
              <li v-for="row in movers" :key="`${row.level1}/${row.level2}`" :class="row.trend === 'UP' ? 'up' : 'down'">
                <span>{{ row.level2 }}</span>
                <i :style="{ width: `${Math.max(6, (Math.abs(row.changePercent!) / maxMove) * 100)}%` }"></i>
                <b>{{ row.changePercent! > 0 ? '+' : '' }}{{ row.changePercent }}%</b>
              </li>
            </ul>
            <p v-else class="mk-empty small">{{ data.period.previousComplete ? '本期没有明显升降的品类。' : '上期数据不完整，暂不比较。' }}</p>
          </section>
          <section class="mk-panel mk-shortcuts">
            <h4>去处理</h4>
            <button type="button" @click="emit('go', 'procurement')">本周进货<small>补热销、缺货的商品</small></button>
            <button type="button" @click="emit('go', 'inventory')">库存经营<small>滞销、低库存完整清单</small></button>
            <button type="button" @click="emit('go', 'products')">商品分析<small>商品、品牌、品类明细</small></button>
          </section>
        </aside>
      </div>
    </template>
  </div>
</template>

<style scoped>
.mk-insights { display: grid; gap: 14px; min-width: 0; }
.mk-range { margin: 0; color: var(--mk-muted); font-size: 12px; }
.mk-kpis { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
.mk-kpi { --tone: 54 199 213; display: grid; gap: 4px; min-width: 0; padding: 14px 16px; color: var(--mk-ink); border: 1px solid var(--mk-line); border-radius: 18px; background: var(--mk-card); font: inherit; text-align: left; cursor: pointer; transition: border-color .2s, transform .2s; }
.mk-kpi.up { --tone: 54 199 213; } .mk-kpi.warn { --tone: 245 166 72; } .mk-kpi.info { --tone: 96 150 255; } .mk-kpi.violet { --tone: 160 120 255; }
.mk-kpi span { color: var(--mk-muted); font-size: 12px; font-weight: 700; }
.mk-kpi strong { font-size: 28px; font-variant-numeric: tabular-nums; line-height: 1.1; }
.mk-kpi strong small { margin-left: 3px; color: var(--mk-muted); font-size: 12px; }
.mk-kpi em { overflow: hidden; color: var(--mk-muted); font-size: 11px; font-style: normal; text-overflow: ellipsis; white-space: nowrap; }
.mk-kpi:hover { transform: translateY(-1px); }
.mk-kpi.active { border-color: rgb(var(--tone) / 70%); background: linear-gradient(160deg, rgb(var(--tone) / 16%), var(--mk-card) 70%); box-shadow: 0 0 0 1px rgb(var(--tone) / 25%); }
.mk-kpi:focus-visible { outline: 2px solid rgb(var(--tone)); outline-offset: 2px; }

.mk-layout { display: grid; grid-template-columns: minmax(0, 1fr) 300px; gap: 14px; align-items: start; }
.mk-panel { min-width: 0; padding: 16px; border: 1px solid var(--mk-line); border-radius: 18px; background: var(--mk-panel); }
.mk-list-panel { display: grid; gap: 10px; }
.mk-list { display: grid; max-height: min(560px, 62dvh); margin: 0; padding: 0; overflow: auto; list-style: none; scrollbar-gutter: stable; }
.mk-list li { display: grid; align-items: center; gap: 10px; padding: 10px 6px; border-top: 1px solid var(--mk-line); font-size: 13px; }
.mk-list .mk-head { position: sticky; z-index: 1; top: 0; padding-block: 8px; color: var(--mk-muted); border-top: 0; background: var(--mk-panel); font-size: 11px; font-weight: 700; }
.mk-list.surges li { grid-template-columns: minmax(0, 2.4fr) 1.1fr .8fr 1fr 112px; }
.mk-list.overstock li { grid-template-columns: minmax(0, 2.4fr) .8fr 1.1fr 1.1fr 112px; }
.mk-list.pairs li { grid-template-columns: minmax(0, 2.6fr) .8fr 1.6fr; }
.mk-list.categories li { grid-template-columns: minmax(0, 2fr) 1fr 1fr 1fr; }
.mk-name { display: grid; gap: 2px; min-width: 0; }
.mk-name strong, .mk-name small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mk-name strong { color: var(--mk-ink); font-size: 13px; }
.mk-list small { display: block; color: var(--mk-muted); font-size: 11px; }
.mk-list b { color: var(--mk-ink); font-variant-numeric: tabular-nums; }
.mk-share { font-size: 12px; }
.mk-tag { display: inline-block; margin-left: 4px; padding: 3px 8px; border-radius: 999px; font-size: 11px; font-style: normal; font-weight: 800; white-space: nowrap; }
.mk-tag.up { color: #4fe0c2; background: rgb(79 224 194 / 14%); }
.mk-tag.new { color: #9fc2ff; background: rgb(96 150 255 / 16%); }
.mk-tag.warn { color: #ffb45c; background: rgb(245 166 72 / 16%); }
.mk-tag.down { color: #ff8a8a; background: rgb(255 107 107 / 14%); }
.mk-tag.flat { color: var(--mk-muted); background: rgb(140 150 170 / 12%); }
.mk-tag.done { margin-left: 0; color: var(--mk-muted); background: rgb(140 150 170 / 12%); }
.mk-act { display: flex; justify-content: flex-end; }
.mk-act button, .mk-focus button, .mk-state button { min-height: 32px; padding: 5px 12px; color: #effcff; border: 1px solid #2c7f96; border-radius: 10px; background: #176c8b; font: inherit; font-size: 12px; font-weight: 800; white-space: nowrap; cursor: pointer; }
.mk-act button.ghost { color: var(--mk-ink); border-color: var(--mk-line); background: transparent; }
.mk-act button:disabled { cursor: progress; opacity: .6; }
.mk-note { margin: 0; padding: 10px 12px; color: #ffcf8a; border: 1px solid rgb(245 166 72 / 35%); border-radius: 12px; background: rgb(245 166 72 / 10%); font-size: 12px; }
.mk-rule { margin: 0; color: var(--mk-muted); font-size: 11px; }
.mk-empty { margin: 0; padding: 26px 0; color: var(--mk-muted); text-align: center; }
.mk-empty.small { padding: 10px 0; font-size: 12px; }

.mk-side { display: grid; gap: 12px; min-width: 0; }
.mk-side h4 { margin: 0 0 10px; color: var(--mk-ink); font-size: 14px; }
.mk-focus { display: grid; gap: 6px; border-color: rgb(54 199 213 / 45%); background: linear-gradient(160deg, rgb(54 199 213 / 16%), rgb(100 90 255 / 10%) 60%, var(--mk-panel)); }
.mk-focus small { color: var(--mk-accent); font-size: 11px; font-weight: 800; letter-spacing: .14em; }
.mk-focus strong { color: var(--mk-ink); font-size: 16px; }
.mk-focus p { margin: 0 0 4px; color: var(--mk-ink); font-size: 13px; line-height: 1.6; }
.mk-focus button { justify-self: start; }
.mk-movers ul { display: grid; gap: 9px; margin: 0; padding: 0; list-style: none; }
.mk-movers li { display: grid; grid-template-columns: 96px minmax(0, 1fr) 58px; align-items: center; gap: 8px; font-size: 12px; }
.mk-movers li span { overflow: hidden; color: var(--mk-ink); text-overflow: ellipsis; white-space: nowrap; }
.mk-movers li i { height: 8px; border-radius: 4px; background: linear-gradient(90deg, rgb(79 224 194 / 40%), #4fe0c2); }
.mk-movers li.down i { background: linear-gradient(90deg, rgb(255 107 107 / 40%), #ff8a8a); }
.mk-movers li b { color: var(--mk-ink); text-align: right; font-variant-numeric: tabular-nums; }
.mk-shortcuts { display: grid; gap: 8px; }
.mk-shortcuts h4 { margin-bottom: 2px; }
.mk-shortcuts button { display: grid; gap: 2px; padding: 10px 12px; color: var(--mk-ink); border: 1px solid var(--mk-line); border-radius: 12px; background: var(--mk-card); font: inherit; font-size: 13px; font-weight: 800; text-align: left; cursor: pointer; }
.mk-shortcuts button small { color: var(--mk-muted); font-size: 11px; font-weight: 500; }
.mk-shortcuts button:hover { border-color: var(--mk-accent); }

.mk-state { display: grid; justify-items: center; gap: 8px; padding: 40px 16px; border: 1px solid var(--mk-line); border-radius: 18px; background: var(--mk-panel); text-align: center; }
.mk-state p { margin: 0; color: var(--mk-muted); }
.mk-skeleton { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
.mk-skeleton i { height: 96px; border-radius: 18px; background: linear-gradient(90deg, var(--mk-card), var(--mk-panel), var(--mk-card)); background-size: 200% 100%; animation: mk-shimmer 1.4s infinite; }
.mk-skeleton i.wide { grid-column: 1 / -1; height: 320px; }
@keyframes mk-shimmer { to { background-position: -200% 0; } }

@media (max-width: 1100px) {
  .mk-layout { grid-template-columns: minmax(0, 1fr); }
  .mk-side { grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); }
}
@media (max-width: 720px) {
  .mk-kpis, .mk-skeleton { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .mk-kpi strong { font-size: 24px; }
  .mk-list { max-height: none; overflow: visible; }
  .mk-list .mk-head { display: none; }
  .mk-list li, .mk-list.surges li, .mk-list.overstock li, .mk-list.pairs li, .mk-list.categories li { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px 12px; padding: 12px 4px; }
  .mk-list .mk-name, .mk-list .mk-act { grid-column: 1 / -1; }
  .mk-act { justify-content: flex-start; }
  .mk-list [data-k]::before { display: block; content: attr(data-k); color: var(--mk-muted); font-size: 10px; }
  .mk-act button { min-height: 40px; }
}
@media (prefers-reduced-motion: reduce) { .mk-skeleton i { animation: none; } .mk-kpi { transition: none; } }
</style>
