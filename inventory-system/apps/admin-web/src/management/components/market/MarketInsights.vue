<script setup lang="ts">
import { computed } from 'vue';
import DonutChart, { type DonutRow } from './charts/DonutChart.vue';
import HeatmapChart from './charts/HeatmapChart.vue';
import Sparkline from './charts/Sparkline.vue';
import SankeyChart from './charts/SankeyChart.vue';
import { LEVEL1_SLOT, marketMoney as money, WEEKDAYS, type Highlight, type InsightTab, type MarketInsights, type ProductList } from './market-types';

// CR-011: the detail area under the card wall. The selected card decides what is shown; content fades in piece by
// piece when the selection changes. Read only except "加入进货单".
const props = defineProps<{ data: MarketInsights | null; loading: boolean; error: string; adding: string | null }>();
const emit = defineEmits<{ retry: []; 'add-to-order': [productId: string]; go: [section: 'procurement' | 'inventory' | 'products'] }>();
const tab = defineModel<InsightTab>('tab', { default: 'overview' });
const list = defineModel<ProductList>('list', { default: 'top' });

const count = new Intl.NumberFormat('en-NZ');
const signed = (value: number, unit = '%') => `${value > 0 ? '+' : ''}${value}${unit}`;
const points = (share: number, previous: number | null) => (previous === null ? null : Math.round((share - previous) * 10) / 10);

const HIGHLIGHT_ACTION: Record<NonNullable<Highlight['action']>, string> = { procurement: '去本周进货', inventory: '去库存经营', demand: '看为谁买', categories: '看品类' };
function act(highlight: Highlight) {
  if (highlight.action === 'procurement' || highlight.action === 'inventory') emit('go', highlight.action);
  else if (highlight.action === 'categories') tab.value = 'mix';
  else document.getElementById('mk-demand')?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
}

const color = (level1: string) => (LEVEL1_SLOT[level1] ? `var(--mk-s${LEVEL1_SLOT[level1]})` : 'var(--mk-other)');
const donutRows = computed<DonutRow[]>(() => (props.data?.categoryShare ?? []).map((row) => {
  const move = points(row.share, row.previousShare);
  return { key: row.level1, label: row.level1, share: row.share, value: money(row.revenue), note: move === null ? undefined : `比上期 ${signed(move, ' 个百分点')}`, color: color(row.level1) };
}));
const moverMax = computed(() => Math.max(1, ...[...(props.data?.categoryMovers.gains ?? []), ...(props.data?.categoryMovers.losses ?? [])].map((row) => Math.abs(row.delta))));

// Largest groups first; the catch-all family group goes last.
const demandRows = computed(() => (props.data?.demand.rows ?? []).filter((row) => row.orders > 0 || row.group !== '家庭通用')
  .sort((a, b) => Number(a.group === '家庭通用') - Number(b.group === '家庭通用') || b.share - a.share));

const LISTS: { id: ProductList; label: string }[] = [
  { id: 'top', label: '热销榜' }, { id: 'surges', label: '突然热销' }, { id: 'falling', label: '下滑榜' },
  { id: 'short', label: '热销缺货' }, { id: 'overstock', label: '滞销与临期' },
];
const shortStock = computed(() => (props.data?.surges ?? []).filter((row) => !row.newlyRising && row.coverageWeeks !== null && row.coverageWeeks < 2));
const listCount = computed<Record<ProductList, number>>(() => ({
  top: props.data?.rankings.top.length ?? 0, surges: props.data?.surges.length ?? 0, falling: props.data?.rankings.falling.length ?? 0,
  short: shortStock.value.length, overstock: props.data?.summary.overstockProducts ?? 0,
}));
const ranked = computed(() => (list.value === 'falling' ? props.data?.rankings.falling : props.data?.rankings.top) ?? []);

const busiest = computed(() => {
  const heat = props.data?.heatmap;
  if (!heat || !heat.hours.length) return null;
  const days = heat.cells.map((row) => row.reduce((sum, value) => sum + value, 0));
  const hours = heat.hours.map((_, index) => heat.cells.reduce((sum, row) => sum + row[index], 0));
  const day = days.indexOf(Math.max(...days));
  const hour = hours.indexOf(Math.max(...hours));
  const quiet = days.indexOf(Math.min(...days));
  return { day: WEEKDAYS[day], dayOrders: days[day], hour: heat.hours[hour], hourOrders: hours[hour], quiet: WEEKDAYS[quiet], quietOrders: days[quiet] };
});
</script>

<template>
  <div class="mk-insights">
    <div v-if="loading && !data" class="mk-skeleton" aria-hidden="true"><i v-for="n in 5" :key="n"></i><i class="wide"></i></div>
    <div v-else-if="error && !data" class="mk-state error" role="alert">
      <strong>{{ error.includes('权限') ? '没有查看权限' : '经营发现读取失败' }}</strong>
      <p>{{ error }}</p>
      <button v-if="!error.includes('权限')" type="button" @click="emit('retry')">重新加载</button>
    </div>
    <Transition v-else-if="data" name="mk-stage" mode="out-in">
      <!-- 经营画像: how the period went, what was bought and for whom, and what to do about it. -->
      <div v-if="tab === 'overview'" key="overview" class="mk-stage">
        <section class="mk-panel mk-structure mk-reveal" style="--d: 0">
          <header class="mk-panel-head"><h4>买了什么</h4><button type="button" class="mk-link" @click="tab = 'mix'">看品类与时段 →</button></header>
          <div class="mk-stack" role="img" :aria-label="donutRows.map((row) => `${row.label} ${row.share}%`).join('，')">
            <i v-for="row in donutRows" :key="row.key" :style="{ flexGrow: row.share, background: row.color }" :title="`${row.label} ${row.share}%`"></i>
          </div>
          <ul class="mk-stack-legend"><li v-for="row in donutRows.slice(0, 6)" :key="row.key"><i :style="{ background: row.color }"></i>{{ row.label }} <b>{{ row.share }}%</b></li></ul>
        </section>
        <div class="mk-two">
          <section id="mk-demand" class="mk-panel mk-demand mk-reveal" style="--d: 1">
            <header class="mk-panel-head"><h4>为谁买</h4><span>共 {{ count.format(data.demand.orders) }} 单</span></header>
            <ul>
              <li v-for="(row, index) in demandRows" :key="row.group" :class="{ general: row.group === '家庭通用' }" :style="{ '--i': index }">
                <span class="name">{{ row.group }}</span>
                <span class="bar"><i :style="{ width: `${Math.min(100, row.share)}%` }"></i></span>
                <b>{{ row.share }}%</b>
                <em v-if="points(row.share, row.previousShare) !== null" :class="points(row.share, row.previousShare)! >= 3 ? 'up' : points(row.share, row.previousShare)! <= -3 ? 'down' : ''">{{ signed(points(row.share, row.previousShare)!, '') }}</em>
                <small>{{ count.format(row.orders) }} 单 · {{ money(row.revenue) }}<template v-if="row.topCategory"> · 买得最多：{{ row.topCategory }}</template></small>
              </li>
            </ul>
            <p class="mk-rule">人群按所购商品判定，代表购买需求，不是顾客本人的年龄或性别；一单可计入多个人群，比例合计可超过 100%。右侧数字为比上期增减的百分点。</p>
          </section>
          <section class="mk-panel mk-highlights mk-reveal" style="--d: 1">
            <header class="mk-panel-head"><h4>经营重点</h4><span>按规则生成，不建议价格</span></header>
            <ul v-if="data.highlights.length">
              <li v-for="(item, index) in data.highlights" :key="item.title" :class="item.tone" :style="{ '--i': index }">
                <strong>{{ item.title }}</strong>
                <p>{{ item.text }}</p>
                <p class="advice">建议：{{ item.advice }}</p>
                <button v-if="item.action" type="button" @click="act(item)">{{ HIGHLIGHT_ACTION[item.action] }} →</button>
              </li>
            </ul>
            <p v-else class="mk-empty small">本期各项平稳，没有需要特别注意的。</p>
          </section>
        </div>
        <section v-if="data.sankey && data.sankey.total > 0" id="mk-flow" class="mk-panel mk-flow mk-reveal" style="--d: 1">
          <header class="mk-panel-head"><h4>人群与功能需求</h4><span>商品销售额 {{ money(data.sankey.total) }}</span></header>
          <SankeyChart :data="data.sankey" :adding="adding" @add-to-order="emit('add-to-order', $event)" />
          <p class="mk-rule">{{ data.rules.sankey }}。线越粗代表销售额越多；点击节点查看对应商品。电脑上只显示前 7 个功能大类和前 10 个功能细分，其余合并为“其他”。</p>
        </section>
      </div>

      <!-- 商品榜: best sellers, risers, fallers, and what needs dealing with now. -->
      <div v-else-if="tab === 'products'" key="products" class="mk-stage">
        <section class="mk-panel mk-list-panel mk-reveal" style="--d: 0">
          <div class="mk-seg" role="group" aria-label="商品榜">
            <button v-for="item in LISTS" :key="item.id" type="button" :aria-pressed="list === item.id" @click="list = item.id">{{ item.label }}<small>{{ listCount[item.id] }}</small></button>
          </div>
          <Transition name="mk-stage" mode="out-in">
            <div v-if="list === 'top' || list === 'falling'" :key="list" class="mk-reveal" style="--d: 1">
              <ul v-if="ranked.length" class="mk-list ranked">
                <li class="mk-head"><span>商品</span><span>近五期销量</span><span>本期 / 上期</span><span>销售额</span><span>库存</span></li>
                <li v-for="(row, index) in ranked" :key="row.productId" class="mk-row" :style="{ '--i': index }">
                  <span class="mk-name"><strong><b class="rank">{{ index + 1 }}</b>{{ row.productName }}</strong><small>{{ row.level2 }} · {{ row.brandName }}</small></span>
                  <span data-k="近五期销量"><Sparkline :values="row.history" :label="`${row.productName}近五期销量`" /></span>
                  <span data-k="本期 / 上期"><b>{{ row.units }}</b> / {{ row.previousUnits }} 件<em v-if="row.changePercent !== null" class="mk-tag" :class="row.changePercent >= 0 ? 'up' : 'down'">{{ signed(row.changePercent) }}</em></span>
                  <span data-k="销售额">{{ money(row.revenue) }}</span>
                  <span data-k="库存">{{ row.currentInventory }} 件<small v-if="row.coverageWeeks !== null">约 {{ row.coverageWeeks }} 周</small></span>
                </li>
              </ul>
              <p v-else class="mk-empty">{{ list === 'falling' && !data.period.previousComplete ? '上期不完整，暂不比较。' : '没有符合条件的商品。' }}</p>
              <p class="mk-rule">{{ list === 'top' ? '按本期销售额（标价）排序，前 10 个。' : '上期至少 5 件且本期下降 30% 以上，按减少的件数排序。' }}</p>
            </div>
            <div v-else-if="list === 'surges' || list === 'short'" :key="list" class="mk-reveal" style="--d: 1">
              <p v-if="list === 'surges' && data.period.baselineWindows === 0" class="mk-note">销售历史还不够比较前几期（目前 {{ data.period.historyDays }} 天），暂不计算突然热销。</p>
              <ul v-else-if="(list === 'surges' ? data.surges : shortStock).length" class="mk-list surges">
                <li class="mk-head"><span>商品</span><span>本期 / 平时</span><span>倍数</span><span>库存</span><span></span></li>
                <li v-for="(row, index) in (list === 'surges' ? data.surges : shortStock)" :key="row.productId" class="mk-row" :style="{ '--i': index }">
                  <span class="mk-name"><strong>{{ row.productName }}</strong><small>{{ row.level2 }} · {{ row.brandName }}</small></span>
                  <span data-k="本期 / 平时"><b>{{ row.currentUnits }}</b> / {{ row.baselineUnits }} 件</span>
                  <span data-k="倍数"><em v-if="row.newlyRising" class="mk-tag new">新品起量</em><em v-else class="mk-tag up">× {{ row.ratio }}</em></span>
                  <span data-k="库存">{{ row.currentInventory }} 件<small v-if="row.coverageWeeks !== null">约 {{ row.coverageWeeks }} 周</small></span>
                  <span class="mk-act">
                    <em v-if="row.inCurrentOrder" class="mk-tag done">已在进货单</em>
                    <button v-else type="button" :disabled="adding === row.productId" @click="emit('add-to-order', row.productId)">{{ adding === row.productId ? '加入中…' : '加入进货单' }}</button>
                  </span>
                </li>
              </ul>
              <p v-else class="mk-empty">{{ list === 'surges' ? '本期没有突然热销的商品。' : '没有库存不足的热销商品。' }}</p>
              <p class="mk-rule">{{ list === 'surges' ? `规则：${data.rules.surge}；前几期平均不足 1 件的归为“新品起量”。` : '突然热销且按近 28 天销量库存约够不到 2 周。' }}</p>
            </div>
            <div v-else key="overstock" class="mk-reveal" style="--d: 1">
              <ul v-if="data.overstock.length" class="mk-list overstock">
                <li class="mk-head"><span>商品</span><span>库存</span><span>还能卖</span><span>最早到期</span><span></span></li>
                <li v-for="(row, index) in data.overstock" :key="row.productId" class="mk-row" :style="{ '--i': Math.min(index, 12) }">
                  <span class="mk-name"><strong>{{ row.productName }}</strong><small>{{ row.level2 }} · {{ row.brandName }}</small></span>
                  <span data-k="库存"><b>{{ row.currentInventory }}</b> 件</span>
                  <span data-k="还能卖"><template v-if="row.reason === 'COVERAGE'">约 {{ row.coverageWeeks }} 周</template><template v-else>{{ row.daysSinceLastSale === null ? '60 天以上' : `${row.daysSinceLastSale} 天` }}无销售</template></span>
                  <span data-k="最早到期">{{ row.nearestExpiry ?? '—' }}<em v-if="row.expiring" class="mk-tag warn">临期</em></span>
                  <span class="mk-act"><button type="button" class="ghost" @click="emit('go', 'inventory')">库存经营 →</button></span>
                </li>
              </ul>
              <p v-else class="mk-empty">没有超量滞销的商品。</p>
              <p class="mk-rule">规则：{{ data.rules.overstock }}；临期按临期预警设置判断，临期的排在前面。共 {{ data.summary.overstockProducts }} 种，其中临期 {{ data.summary.expiringOverstockProducts }} 种，显示前 100 个。近期可在活动策划中安排清货。</p>
            </div>
          </Transition>
        </section>
      </div>

      <!-- 品类与时段: what sells and when. -->
      <div v-else-if="tab === 'mix'" key="mix" class="mk-stage">
        <div class="mk-two">
          <div class="mk-col">
            <section class="mk-panel mk-reveal" style="--d: 0">
              <header class="mk-panel-head"><h4>销售额占比</h4><span>一级品类</span></header>
              <DonutChart v-if="donutRows.length" :rows="donutRows" :total="`${donutRows.length} 类`" total-label="一级品类" />
              <p v-else class="mk-empty">本期没有销售。</p>
            </section>
            <section v-if="busiest" class="mk-panel mk-facts mk-reveal" style="--d: 2">
              <header class="mk-panel-head"><h4>时段结论</h4></header>
              <dl>
                <div><dt>最忙的一天</dt><dd>{{ busiest.day }}<small>{{ busiest.dayOrders }} 单</small></dd></div>
                <div><dt>最忙的时段</dt><dd>{{ busiest.hour }}:00–{{ busiest.hour + 1 }}:00<small>{{ busiest.hourOrders }} 单</small></dd></div>
                <div v-if="data.heatmap.peak"><dt>最忙的格子</dt><dd>{{ WEEKDAYS[data.heatmap.peak.weekday] }} {{ data.heatmap.peak.hour }} 点<small>{{ data.heatmap.peak.orders }} 单</small></dd></div>
                <div><dt>最空的一天</dt><dd>{{ busiest.quiet }}<small>{{ busiest.quietOrders }} 单</small></dd></div>
              </dl>
              <p class="mk-rule">用于安排人手、补货上架和活动时间：忙时保证人手和库存，空闲时适合理货和做活动。</p>
            </section>
          </div>
          <section class="mk-panel mk-movers mk-reveal" style="--d: 1">
            <header class="mk-panel-head"><h4>谁在拉动、谁在拖累</h4><span>二级品类，按销售额增减</span></header>
            <p v-if="!data.period.previousComplete" class="mk-empty small">上期不在销售历史范围内，暂不比较。</p>
            <template v-else>
              <h5>拉动</h5>
              <ul><li v-for="(row, index) in data.categoryMovers.gains" :key="row.level2" class="up" :style="{ '--i': index }"><span>{{ row.level2 }}<small>{{ row.level1 }}</small></span><i :style="{ width: `${(row.delta / moverMax) * 100}%` }"></i><b>+{{ money(row.delta) }}<small>{{ row.changePercent === null ? '新增' : signed(row.changePercent) }}</small></b></li></ul>
              <h5>拖累</h5>
              <ul class="losses"><li v-for="(row, index) in data.categoryMovers.losses" :key="row.level2" class="down" :style="{ '--i': index + 6 }"><span>{{ row.level2 }}<small>{{ row.level1 }}</small></span><i :style="{ width: `${(Math.abs(row.delta) / moverMax) * 100}%` }"></i><b>−{{ money(Math.abs(row.delta)) }}<small>{{ row.changePercent === null ? '—' : signed(row.changePercent) }}</small></b></li></ul>
              <div class="mk-movers-note">
                <p v-if="data.categoryMovers.gains[0]">拉动最多：<b>{{ data.categoryMovers.gains[0].level2 }}</b>，比上期多 {{ money(data.categoryMovers.gains[0].delta) }}。</p>
                <p v-if="data.categoryMovers.losses[0]">拖累最多：<b>{{ data.categoryMovers.losses[0].level2 }}</b>，比上期少 {{ money(Math.abs(data.categoryMovers.losses[0].delta)) }}，可检查是否缺货或安排活动。</p>
                <p class="mk-rule">品类金额按商品标价计算，用于比较占比和增减；品类由商品名称自动识别，人工指定的优先。</p>
              </div>
            </template>
          </section>
        </div>
          <section class="mk-panel mk-heat-panel mk-reveal" style="--d: 3">
            <header class="mk-panel-head"><h4>星期 × 小时订单数</h4><span>本期</span></header>
            <HeatmapChart v-if="data.heatmap.hours.length" :hours="data.heatmap.hours" :cells="data.heatmap.cells" :peak="data.heatmap.peak" />
            <p v-else class="mk-empty">本期没有订单。</p>
          </section>
      </div>

      <!-- 连带购买 -->
      <div v-else key="pairs" class="mk-stage">
        <div v-if="data.pairs.length" class="mk-combos">
          <article v-for="(pair, index) in data.pairs" :key="pair.products.map((p) => p.productId).join('-')" class="mk-combo mk-reveal" :style="{ '--d': Math.min(index, 8) * 0.5 }">
            <div class="items"><strong>{{ pair.products[0].productName }}</strong><span aria-hidden="true">＋</span><strong>{{ pair.products[1].productName }}</strong></div>
            <p><b>{{ pair.orders }}</b> 单同时购买</p>
            <small>买前者的 {{ pair.products[0].share }}% 也买后者 · 买后者的 {{ pair.products[1].share }}% 也买前者</small>
          </article>
        </div>
        <p v-else class="mk-empty mk-panel">本期没有同单出现 5 次以上的组合。</p>
        <p class="mk-rule">规则：{{ data.rules.pairs }}；显示前 20 组。适合做套装、搭配陈列。</p>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.mk-insights { display: grid; gap: 14px; min-width: 0; }

.mk-two { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; align-items: stretch; }
/* Columns end level: a side-by-side pair stretches to the same height and the last panel of a column fills it. */
.mk-col { display: flex; flex-direction: column; gap: 14px; min-width: 0; }
.mk-col > :last-child { flex: 1; }
.mk-link { padding: 0; color: var(--mk-accent); border: 0; background: none; font: inherit; font-size: 12px; font-weight: 800; cursor: pointer; }
.mk-stack { display: flex; gap: 2px; height: 14px; overflow: hidden; border-radius: 4px; }
.mk-stack i { min-width: 2px; }
.mk-stack-legend { display: flex; flex-wrap: wrap; gap: 6px 16px; margin: 0; padding: 0; color: var(--mk-muted); font-size: 12px; list-style: none; }
.mk-stack-legend li { display: inline-flex; align-items: center; gap: 6px; }
.mk-stack-legend i { width: 10px; height: 10px; border-radius: 3px; }
.mk-stack-legend b { color: var(--mk-ink); font-variant-numeric: tabular-nums; }
.mk-heat-panel :deep(.cell) { aspect-ratio: auto; height: 30px; }
.mk-panel { display: grid; align-content: start; gap: 12px; min-width: 0; padding: 16px; border: 1px solid var(--mk-line); border-radius: 18px; background: var(--mk-panel); }
.mk-panel-head { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 6px 12px; }
.mk-panel-head h4 { margin: 0; color: var(--mk-ink); font-size: 15px; }
.mk-panel-head > span { color: var(--mk-muted); font-size: 12px; }
.mk-legend { display: inline-flex; align-items: center; gap: 6px; }
.mk-legend i.line { width: 16px; height: 2px; margin-left: 6px; background: var(--mk-s1); }
.mk-legend i.line.dashed { background: repeating-linear-gradient(90deg, var(--mk-muted) 0 4px, transparent 4px 8px); }

.mk-highlights ul { display: grid; gap: 10px; margin: 0; padding: 0; list-style: none; }
.mk-highlights li { --tone: var(--mk-s1); display: grid; gap: 3px; padding: 11px 12px 11px 14px; border: 1px solid var(--mk-line); border-left: 3px solid var(--tone); border-radius: 12px; background: var(--mk-card); }
.mk-highlights li.urgent { --tone: var(--mk-down); } .mk-highlights li.warn { --tone: var(--mk-warn); } .mk-highlights li.up { --tone: var(--mk-up); } .mk-highlights li.down { --tone: var(--mk-down); }
.mk-highlights strong { color: var(--mk-ink); font-size: 14px; }
.mk-highlights p { margin: 0; color: var(--mk-muted); font-size: 12px; line-height: 1.55; }
.mk-highlights p.advice { color: var(--mk-ink); }
.mk-highlights button { justify-self: start; margin-top: 4px; padding: 0; color: var(--mk-accent); border: 0; background: none; font: inherit; font-size: 12px; font-weight: 800; cursor: pointer; }

.mk-movers { display: flex; flex-direction: column; }
.mk-movers-note { display: grid; gap: 6px; margin-top: auto; padding: 12px 14px; border: 1px solid var(--mk-line); border-radius: 12px; background: var(--mk-card); }
.mk-movers-note p { margin: 0; color: var(--mk-muted); font-size: 12px; line-height: 1.6; }
.mk-movers-note b { color: var(--mk-ink); }
.mk-movers h5 { margin: 0; color: var(--mk-muted); font-size: 12px; }
.mk-movers ul, .mk-demand ul { display: grid; gap: 9px; margin: 0; padding: 0; list-style: none; }
.mk-movers li { display: grid; grid-template-columns: minmax(96px, 150px) minmax(0, 1fr) 104px; align-items: center; gap: 10px; font-size: 13px; }
.mk-movers li span { overflow: hidden; color: var(--mk-ink); text-overflow: ellipsis; white-space: nowrap; }
.mk-movers li span small { margin-left: 6px; color: var(--mk-muted); font-size: 11px; }
.mk-movers li i { height: 10px; min-width: 4px; border-radius: 0 4px 4px 0; background: var(--mk-up); }
.mk-movers li.down i { background: var(--mk-down); }
.mk-movers li b { display: grid; color: var(--mk-ink); text-align: right; font-variant-numeric: tabular-nums; }
.mk-movers li b small { color: var(--mk-muted); font-size: 11px; font-weight: 600; }

.mk-demand li { display: grid; grid-template-columns: 96px minmax(0, 1fr) 54px 44px; align-items: center; column-gap: 10px; row-gap: 2px; }
.mk-demand .name { color: var(--mk-ink); font-size: 13px; font-weight: 800; white-space: nowrap; }
.mk-demand .bar { height: 12px; border-radius: 0 4px 4px 0; background: color-mix(in srgb, var(--mk-line) 50%, transparent); }
.mk-demand .bar i { display: block; height: 100%; min-width: 3px; border-radius: 0 4px 4px 0; background: var(--mk-s1); }
.mk-demand li.general .bar i { background: var(--mk-other); }
.mk-demand li.general .name { color: var(--mk-muted); }
.mk-demand b { color: var(--mk-ink); text-align: right; font-variant-numeric: tabular-nums; }
.mk-demand em { color: var(--mk-muted); font-size: 12px; font-style: normal; font-weight: 800; text-align: right; font-variant-numeric: tabular-nums; }
.mk-demand em.up { color: var(--mk-up); } .mk-demand em.down { color: var(--mk-down); }
.mk-demand small { grid-column: 2 / -1; color: var(--mk-muted); font-size: 11px; }

.mk-facts dl { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin: 0; }
.mk-facts dl > div { display: grid; gap: 4px; padding: 10px 12px; border: 1px solid var(--mk-line); border-radius: 12px; background: var(--mk-card); }
.mk-facts dt { color: var(--mk-muted); font-size: 12px; }
.mk-facts dd { margin: 0; color: var(--mk-ink); font-size: 16px; font-weight: 800; font-variant-numeric: tabular-nums; }
.mk-facts dd small { margin-left: 6px; color: var(--mk-muted); font-size: 12px; font-weight: 600; }

.mk-combos { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 12px; }
.mk-combo { display: grid; gap: 6px; padding: 14px 16px; border: 1px solid var(--mk-line); border-radius: 16px; background: var(--mk-card); }
.mk-combo .items { display: grid; gap: 2px; }
.mk-combo .items strong { overflow: hidden; color: var(--mk-ink); font-size: 13px; text-overflow: ellipsis; white-space: nowrap; }
.mk-combo .items span { color: var(--mk-accent); font-weight: 800; }
.mk-combo p { margin: 0; color: var(--mk-muted); font-size: 12px; }
.mk-combo p b { color: var(--mk-ink); font-size: 18px; font-variant-numeric: tabular-nums; }
.mk-combo small { color: var(--mk-muted); font-size: 11px; }

.mk-seg { display: inline-flex; justify-self: start; gap: 4px; padding: 3px; border: 1px solid var(--mk-line); border-radius: 12px; }
.mk-seg button { min-height: 32px; padding: 4px 12px; color: var(--mk-muted); border: 0; border-radius: 9px; background: transparent; font: inherit; font-size: 13px; font-weight: 800; cursor: pointer; }
.mk-seg button[aria-pressed='true'] { color: #fff; background: linear-gradient(135deg, #176c8b, #475bc8); }

.mk-list-panel { gap: 10px; }
.mk-list { display: grid; max-height: min(560px, 62dvh); margin: 0; padding: 0; overflow: auto; list-style: none; scrollbar-gutter: stable; }
.mk-list li { display: grid; align-items: center; gap: 10px; padding: 10px 6px; border-top: 1px solid var(--mk-line); font-size: 13px; }
.mk-list .mk-head { position: sticky; z-index: 1; top: 0; padding-block: 8px; color: var(--mk-muted); border-top: 0; background: var(--mk-panel); font-size: 11px; font-weight: 700; }
.mk-list.surges li { grid-template-columns: minmax(0, 2.4fr) 1.1fr .8fr 1fr 112px; }
.mk-list.overstock li { grid-template-columns: minmax(0, 2.4fr) .8fr 1.1fr 1.1fr 112px; }
.mk-list.ranked li { grid-template-columns: minmax(0, 2.4fr) 110px 1.3fr .9fr .9fr; }
.mk-name { display: grid; gap: 2px; min-width: 0; }
.mk-name strong, .mk-name small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mk-name strong { color: var(--mk-ink); font-size: 13px; }
.mk-name .rank { display: inline-block; min-width: 20px; margin-right: 6px; color: var(--mk-muted); }
.mk-list small { display: block; color: var(--mk-muted); font-size: 11px; }
.mk-list b { color: var(--mk-ink); font-variant-numeric: tabular-nums; }
.mk-tag { display: inline-block; margin-left: 4px; padding: 3px 8px; border-radius: 999px; font-size: 11px; font-style: normal; font-weight: 800; white-space: nowrap; }
.mk-tag.up { color: var(--mk-up); background: color-mix(in srgb, var(--mk-up) 14%, transparent); }
.mk-tag.new { color: #9fc2ff; background: rgb(96 150 255 / 16%); }
.mk-tag.warn { color: var(--mk-warn); background: color-mix(in srgb, var(--mk-warn) 16%, transparent); }
.mk-tag.down { color: var(--mk-down); background: color-mix(in srgb, var(--mk-down) 14%, transparent); }
.mk-tag.done { margin-left: 0; color: var(--mk-muted); background: rgb(140 150 170 / 12%); }
.mk-act { display: flex; justify-content: flex-end; }
.mk-act button, .mk-state button { min-height: 32px; padding: 5px 12px; color: #effcff; border: 1px solid #2c7f96; border-radius: 10px; background: #176c8b; font: inherit; font-size: 12px; font-weight: 800; white-space: nowrap; cursor: pointer; }
.mk-act button.ghost { color: var(--mk-ink); border-color: var(--mk-line); background: transparent; }
.mk-act button:disabled { cursor: progress; opacity: .6; }
.mk-note { margin: 0; padding: 10px 12px; color: var(--mk-warn); border: 1px solid color-mix(in srgb, var(--mk-warn) 35%, transparent); border-radius: 12px; background: color-mix(in srgb, var(--mk-warn) 10%, transparent); font-size: 12px; }
.mk-rule { margin: 0; color: var(--mk-muted); font-size: 11px; line-height: 1.6; }
.mk-empty { margin: 0; padding: 26px 0; color: var(--mk-muted); text-align: center; }
.mk-empty.small { padding: 10px 0; font-size: 12px; }

.mk-state { display: grid; justify-items: center; gap: 8px; padding: 40px 16px; border: 1px solid var(--mk-line); border-radius: 18px; background: var(--mk-panel); text-align: center; }
.mk-state p { margin: 0; color: var(--mk-muted); }
.mk-skeleton { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 12px; }
.mk-skeleton i { height: 96px; border-radius: 18px; background: linear-gradient(90deg, var(--mk-card), var(--mk-panel), var(--mk-card)); background-size: 200% 100%; animation: mk-shimmer 1.4s infinite; }
.mk-skeleton i.wide { grid-column: 1 / -1; height: 320px; }
@keyframes mk-shimmer { to { background-position: -200% 0; } }


/* CR-011: the detail area changes with the selected card; pieces rise in one after another and bars grow. */
.mk-stage { display: grid; gap: 14px; min-width: 0; }
.mk-stage-enter-active { transition: opacity .45s ease, transform .45s ease; }
.mk-stage-leave-active { transition: opacity .18s ease; }
.mk-stage-enter-from { opacity: 0; transform: translateY(12px); }
.mk-stage-leave-to { opacity: 0; }
.mk-reveal { animation: mk-rise .8s cubic-bezier(.22, 1, .36, 1) both; animation-delay: calc(var(--d, 0) * 220ms); }
.mk-highlights li, .mk-list .mk-row { animation: mk-rise .6s ease both; animation-delay: calc(500ms + var(--i, 0) * 90ms); }
.mk-movers li i { transform-origin: left; animation: mk-grow 1.4s cubic-bezier(.22, 1, .36, 1) both; animation-delay: calc(700ms + var(--i, 0) * 110ms); }
/* 为谁买: rows fade in one after another over about two seconds, then each bar grows slowly from the left. */
.mk-demand li { animation: mk-rise .6s ease both; animation-delay: calc(var(--i, 0) * 200ms); }
.mk-demand .bar i { transform-origin: left; animation: mk-grow 2s cubic-bezier(.22, 1, .36, 1) both; animation-delay: calc(200ms + var(--i, 0) * 200ms); }
.mk-seg small { margin-left: 5px; font-size: 11px; font-weight: 600; opacity: .75; }
@keyframes mk-rise { from { opacity: 0; transform: translateY(14px); } }
@keyframes mk-grow { from { transform: scaleX(0); } }

@media (max-width: 1100px) {
    .mk-two { grid-template-columns: minmax(0, 1fr); }
}
@media (max-width: 720px) {
  .mk-skeleton { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .mk-movers li { grid-template-columns: minmax(0, 1fr) 96px; }
  .mk-movers li i { grid-column: 1 / -1; grid-row: 2; }
  .mk-demand li { grid-template-columns: 76px minmax(0, 1fr) 48px 36px; column-gap: 8px; }
  .mk-demand .name { white-space: normal; line-height: 1.25; }
  .mk-list { max-height: none; overflow: visible; }
  .mk-list .mk-head { display: none; }
  .mk-list li, .mk-list.surges li, .mk-list.overstock li, .mk-list.ranked li { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px 12px; padding: 12px 4px; }
  .mk-list .mk-name, .mk-list .mk-act { grid-column: 1 / -1; }
  .mk-act { justify-content: flex-start; }
  .mk-list [data-k]::before { display: block; content: attr(data-k); color: var(--mk-muted); font-size: 10px; }
  .mk-act button { min-height: 40px; }
  .mk-seg { justify-self: stretch; } .mk-seg button { flex: 1; }
}
@media (prefers-reduced-motion: reduce) {
  .mk-skeleton i, .mk-reveal, .mk-highlights li, .mk-list .mk-row, .mk-demand li, .mk-demand .bar i, .mk-movers li i { animation: none; }
  .mk-stage-enter-active, .mk-stage-leave-active { transition: none; }
}
</style>
