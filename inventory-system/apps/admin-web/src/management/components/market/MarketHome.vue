<script setup lang="ts">
import { computed } from 'vue';
import MarketArt from './MarketArt.vue';
import { MARKET_MODULES, PERIOD_LABEL, type InsightTab, type MarketInsights, type MarketModuleId } from './market-types';

// REQ-014 §4.1.2: four frosted-glass module cards, then the findings that need attention
// now so the page is useful without opening a module.
const props = defineProps<{ insights: MarketInsights | null; loading: boolean; metrics: Record<MarketModuleId, string> }>();
const emit = defineEmits<{ open: [id: MarketModuleId, tab?: InsightTab] }>();

const modules = MARKET_MODULES;

const shortSellers = computed(() => {
  const rows = (props.insights?.surges ?? []).filter((row) => !row.newlyRising);
  const short = rows.filter((row) => row.coverageWeeks !== null && row.coverageWeeks < 3).sort((a, b) => (a.coverageWeeks ?? 0) - (b.coverageWeeks ?? 0));
  return (short.length ? short : rows).slice(0, 3);
});
const slowExpiring = computed(() => {
  const rows = props.insights?.overstock ?? [];
  const expiring = rows.filter((row) => row.expiring);
  return (expiring.length ? expiring : rows).slice(0, 3);
});
const movers = computed(() => (props.insights?.categories ?? [])
  .filter((row) => row.changePercent !== null && row.trend !== 'FLAT')
  .sort((a, b) => Math.abs(b.changePercent!) - Math.abs(a.changePercent!))
  .slice(0, 4));
const maxMove = computed(() => Math.max(...movers.value.map((row) => Math.abs(row.changePercent!)), 1));
const pairs = computed(() => (props.insights?.pairs ?? []).slice(0, 2));
const coverage = computed(() => {
  const value = props.insights?.summary.categoryCoverage;
  return value?.total ? Math.round((value.identified / value.total) * 100) : null;
});
const generated = computed(() => props.insights ? new Date(props.insights.generatedAt).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');
</script>

<template>
  <section class="market-home">
    <header class="market-home-head">
      <small>MARKET ANALYSIS</small>
      <h2>从店铺数据到<span>经营行动</span></h2>
      <p>系统先整理事实，再给出可执行的事项；价格与活动力度由你决定。</p>
    </header>

    <div class="glass-grid">
      <button v-for="(module, index) in modules" :key="module.id" type="button" class="glass-card" :class="{ soon: !module.ready }"
              :style="{ '--art-a': module.tint[0], '--art-b': module.tint[1], '--delay': `${index * -0.9}s` }" @click="emit('open', module.id)">
        <span class="glass-glow" aria-hidden="true"></span>
        <span class="glass-label">{{ module.english }}</span>
        <span class="glass-art"><MarketArt :id="module.id" /></span>
        <span class="glass-panel">
          <strong>{{ module.title }}</strong>
          <i class="glass-rule" aria-hidden="true"></i>
          <em>{{ module.summary }}</em>
          <b :class="{ muted: !module.ready }">{{ metrics[module.id] }}</b>
          <span class="glass-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24"><path v-if="module.id === 'insights'" d="M3 13c3 0 3-5 6-5s3 9 6 9 3-6 6-6" /><path v-else-if="module.id === 'report'" d="M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2z" /><g v-else-if="module.id === 'trends'"><circle cx="12" cy="12" r="4" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2" /></g><path v-else d="M3 12h4l2-5 4 10 2-5h6" /></svg>
          </span>
        </span>
      </button>
    </div>

    <section class="market-brief" aria-label="本期要点">
      <header><h3>本期要点</h3><span>{{ insights ? `${PERIOD_LABEL[insights.period.type]} · ${insights.period.from} 至 ${insights.period.to}` : loading ? '正在读取…' : '暂无数据' }}</span></header>
      <div class="brief-grid">
        <button type="button" class="brief-card" style="--art-a: 40 150 220; --art-b: 128 220 255" @click="emit('open', 'insights', 'surges')">
          <span class="brief-title">热销且库存不足<small>→</small></span>
          <ul v-if="shortSellers.length"><li v-for="row in shortSellers" :key="row.productId"><span>{{ row.productName }}</span><b>× {{ row.ratio }}</b><em>{{ row.coverageWeeks === null ? '—' : `够 ${row.coverageWeeks} 周` }}</em></li></ul>
          <p v-else>{{ loading ? '读取中…' : '本期没有突然热销的商品' }}</p>
        </button>
        <button type="button" class="brief-card" style="--art-a: 226 132 30; --art-b: 255 206 110" @click="emit('open', 'insights', 'overstock')">
          <span class="brief-title">临期且卖得慢<small>→</small></span>
          <ul v-if="slowExpiring.length"><li v-for="row in slowExpiring" :key="row.productId"><span>{{ row.productName }}</span><b>{{ row.currentInventory }} 件</b><em :class="{ warn: row.expiring }">{{ row.nearestExpiry ?? '—' }}</em></li></ul>
          <p v-else>{{ loading ? '读取中…' : '没有超量滞销的商品' }}</p>
        </button>
        <button type="button" class="brief-card" style="--art-a: 118 82 230; --art-b: 196 160 255" @click="emit('open', 'insights', 'categories')">
          <span class="brief-title">品类升降<small>→</small></span>
          <ul v-if="movers.length" class="bars"><li v-for="row in movers" :key="`${row.level1}/${row.level2}`" :class="row.trend === 'UP' ? 'up' : 'down'"><span>{{ row.level2 }}</span><i :style="{ width: `${Math.max(8, (Math.abs(row.changePercent!) / maxMove) * 100)}%` }"></i><b>{{ row.changePercent! > 0 ? '+' : '' }}{{ row.changePercent }}%</b></li></ul>
          <p v-else>{{ loading ? '读取中…' : insights && !insights.period.previousComplete ? '上期数据不完整，暂不比较' : '没有明显升降的品类' }}</p>
        </button>
        <button type="button" class="brief-card" style="--art-a: 42 160 104; --art-b: 150 236 186" @click="emit('open', 'insights', 'pairs')">
          <span class="brief-title">常一起买<small>→</small></span>
          <ul v-if="pairs.length" class="pairs"><li v-for="pair in pairs" :key="pair.products.map((p) => p.productId).join('-')"><span>{{ pair.products[0].productName }}<small>＋ {{ pair.products[1].productName }}</small></span><b>{{ pair.orders }} 单</b></li></ul>
          <p v-else>{{ loading ? '读取中…' : '本期没有常一起买的组合' }}</p>
        </button>
      </div>
      <footer class="brief-meta">
        <span><small>统计口径</small>POS 已付款订单 · 正式库存</span>
        <span><small>数据读取</small>{{ generated }}</span>
        <span><small>品类识别率</small>{{ coverage === null ? '—' : `${coverage}%（按商品名称自动识别）` }}</span>
      </footer>
    </section>
  </section>
</template>

<style scoped>
.market-home { position: relative; isolation: isolate; display: grid; gap: 26px; min-width: 0; padding: 22px 22px 26px; overflow: hidden; border-radius: 26px; }
.market-home { background: radial-gradient(ellipse at 20% 0%, rgb(64 132 255 / 14%), transparent 55%), radial-gradient(ellipse at 85% 10%, rgb(160 120 255 / 12%), transparent 50%); }
:root:not([data-theme="dark"]) .market-home { background: radial-gradient(ellipse at 20% 0%, rgb(64 160 255 / 12%), transparent 55%), radial-gradient(ellipse at 85% 10%, rgb(160 120 255 / 10%), transparent 50%); }

.market-home-head { display: grid; justify-items: start; gap: 0; }
.market-home-head small { color: var(--mk-accent); font-size: 11px; font-weight: 800; letter-spacing: .2em; }
.market-home-head h2 { margin: 6px 0 4px; color: var(--mk-ink); font-size: clamp(24px, 3vw, 36px); line-height: 1.15; text-shadow: 0 2px 18px rgb(0 0 0 / 35%); }
:root:not([data-theme="dark"]) .market-home-head h2 { text-shadow: none; }
.market-home-head h2 span { margin-left: 6px; background: linear-gradient(90deg, #6fd8ff, #b59cff); -webkit-background-clip: text; background-clip: text; color: transparent; }
.market-home-head p { margin: 0; color: var(--mk-muted); font-size: 13px; }

/* Frosted glass module cards: glowing symbol above, pale information panel overlapping the lower part. */
.glass-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 24px; padding-inline: 8px; }
.glass-card { position: relative; display: grid; grid-template-rows: auto 1fr auto; min-width: 0; min-height: 380px; padding: 18px 18px 0; color: #16202e; border: 1.5px solid rgb(var(--art-b) / 55%); border-radius: 28px;
  background: linear-gradient(165deg, rgb(var(--art-a) / 30%), rgb(8 14 26 / 72%) 52%, rgb(var(--art-a) / 22%));
  box-shadow: inset 0 0 0 1px rgb(255 255 255 / 8%), inset 0 1px 22px rgb(var(--art-b) / 22%), 0 22px 50px rgb(0 0 0 / 35%);
  backdrop-filter: blur(14px) saturate(140%); font: inherit; text-align: left; cursor: pointer;
  animation: glass-rim 3.6s ease-in-out infinite; animation-delay: var(--delay);
  transition: transform .4s cubic-bezier(.2, .8, .2, 1), opacity .35s ease, filter .35s ease; }
.glass-card::after { position: absolute; inset: 0; content: ''; border-radius: inherit; background: linear-gradient(225deg, rgb(255 255 255 / 18%), transparent 26%); pointer-events: none; }
.glass-card:focus-visible { outline: 2px solid rgb(var(--art-b)); outline-offset: 4px; }
.glass-glow { position: absolute; z-index: -1; inset: 4px; border-radius: inherit; box-shadow: 0 0 64px 16px rgb(var(--art-a) / 75%); animation: glass-breathe 3.6s ease-in-out infinite; animation-delay: var(--delay); pointer-events: none; transition: box-shadow .35s ease; }
.glass-label { color: rgb(var(--art-b)); font-size: 11px; font-weight: 700; letter-spacing: .16em; }
.glass-label::after { display: block; width: 28px; height: 1.5px; margin-top: 8px; content: ''; background: rgb(var(--art-b) / 70%); }
.glass-art { height: 150px; min-height: 0; margin: 4px -6px 6px; }
.glass-panel { position: relative; display: grid; align-content: start; gap: 6px; min-height: 168px; margin: 0 -12px -12px; padding: 18px 64px 18px 18px; border: 1px solid rgb(255 255 255 / 70%); border-radius: 18px;
  background: linear-gradient(160deg, rgb(255 255 255 / 88%), rgb(var(--art-b) / 42%)); box-shadow: 0 -6px 24px rgb(var(--art-a) / 20%), 0 14px 30px rgb(0 0 0 / 28%), inset 0 1px 0 #fff; backdrop-filter: blur(16px); }
.glass-panel::before { position: absolute; top: -13px; right: -1px; width: 56%; height: 22px; content: ''; border: 1px solid rgb(255 255 255 / 70%); border-bottom: 0; border-radius: 14px 18px 0 0; background: rgb(255 255 255 / 86%); clip-path: inset(0 0 9px 0); }
.glass-panel strong { color: #121b2a; font-size: 20px; letter-spacing: -.01em; }
.glass-rule { display: block; width: 30px; height: 2px; background: rgb(var(--art-a)); }
.glass-panel em { display: -webkit-box; overflow: hidden; color: #4b5870; font-size: 12px; font-style: normal; line-height: 1.5; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
.glass-panel b { justify-self: start; margin-top: 4px; padding: 4px 10px; color: #10203a; border-radius: 999px; background: rgb(var(--art-a) / 18%); font-size: 12px; font-variant-numeric: tabular-nums; }
.glass-panel b.muted { color: #46536a; background: rgb(120 130 150 / 14%); font-weight: 600; }
.glass-icon { position: absolute; right: 14px; bottom: 16px; display: grid; width: 42px; height: 42px; place-items: center; border: 1px solid rgb(255 255 255 / 80%); border-radius: 50%; background: radial-gradient(circle, rgb(255 255 255 / 95%), rgb(var(--art-b) / 45%)); box-shadow: 0 0 18px rgb(var(--art-a) / 45%); }
.glass-icon svg { width: 20px; height: 20px; fill: none; stroke: rgb(var(--art-a)); stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
:root:not([data-theme="dark"]) .glass-label { color: #fff; text-shadow: 0 1px 6px rgb(0 0 0 / 35%); }
:root:not([data-theme="dark"]) .glass-card { background: linear-gradient(165deg, rgb(var(--art-a) / 55%), rgb(14 22 38 / 92%) 50%, rgb(var(--art-a) / 40%)); box-shadow: inset 0 0 0 1px rgb(255 255 255 / 12%), inset 0 1px 22px rgb(var(--art-b) / 22%), 0 18px 40px rgb(40 70 110 / 22%); }

/* Findings that need attention now. */
.market-brief { display: grid; gap: 12px; padding: 18px; border: 1px solid var(--mk-line); border-radius: 22px; background: var(--mk-panel); backdrop-filter: blur(12px); }
.market-brief > header { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 8px; }
.market-brief h3 { margin: 0; color: var(--mk-ink); font-size: 16px; }
.market-brief > header span { color: var(--mk-muted); font-size: 12px; }
.brief-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
.brief-card { display: grid; align-content: start; gap: 10px; min-width: 0; padding: 14px; color: var(--mk-ink); border: 1px solid rgb(var(--art-a) / 35%); border-radius: 16px; background: linear-gradient(160deg, rgb(var(--art-a) / 14%), var(--mk-card) 65%); font: inherit; text-align: left; cursor: pointer; transition: border-color .2s, transform .2s; }
.brief-card:hover { border-color: rgb(var(--art-b) / 70%); transform: translateY(-2px); }
.brief-card:focus-visible { outline: 2px solid rgb(var(--art-b)); outline-offset: 2px; }
.brief-title { display: flex; justify-content: space-between; color: rgb(var(--art-b)); font-size: 13px; font-weight: 800; }
:root:not([data-theme="dark"]) .brief-title { color: rgb(var(--art-a)); }
.brief-card ul { display: grid; gap: 8px; margin: 0; padding: 0; list-style: none; }
.brief-card li { display: grid; grid-template-columns: minmax(0, 1fr) auto auto; align-items: center; gap: 8px; font-size: 12px; }
.brief-card li > span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.brief-card li b { font-variant-numeric: tabular-nums; }
.brief-card li em { color: var(--mk-muted); font-size: 11px; font-style: normal; white-space: nowrap; }
.brief-card li em.warn { color: #ffb45c; }
.brief-card ul.bars li { grid-template-columns: 76px minmax(0, 1fr) 56px; }
.brief-card ul.bars i { height: 7px; border-radius: 4px; background: linear-gradient(90deg, rgb(79 224 194 / 35%), #4fe0c2); }
.brief-card ul.bars li.down i { background: linear-gradient(90deg, rgb(255 107 107 / 35%), #ff8a8a); }
.brief-card ul.bars b { text-align: right; }
.brief-card ul.pairs li { grid-template-columns: minmax(0, 1fr) auto; }
.brief-card ul.pairs small { display: block; overflow: hidden; color: var(--mk-muted); font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }
.brief-card p { margin: 0; color: var(--mk-muted); font-size: 12px; }
.brief-meta { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; padding-top: 12px; color: var(--mk-ink); border-top: 1px solid var(--mk-line); font-size: 12px; }
.brief-meta span + span { padding-left: 12px; border-left: 1px solid var(--mk-line); }
.brief-meta small { display: block; margin-bottom: 3px; color: var(--mk-muted); font-size: 10px; letter-spacing: .08em; }

@keyframes glass-breathe { 0%, 100% { opacity: .08; } 50% { opacity: 1; } }
@keyframes glass-rim { 0%, 100% { border-color: rgb(var(--art-b) / 30%); } 50% { border-color: rgb(var(--art-b) / 100%); } }

/* Hover focus: the card under the pointer grows and glows; the others shrink, dim and step aside. */
@media (hover: hover) {
  .glass-card:is(:hover, :focus-visible) { z-index: 2; transform: translateY(-10px) scale(1.07); }
  .glass-card:is(:hover, :focus-visible) .glass-glow { animation: none; opacity: 1; box-shadow: 0 0 90px 24px rgb(var(--art-a) / 85%); }
  .glass-grid:has(.glass-card:is(:hover, :focus-visible)) .glass-card:not(:hover, :focus-visible) { opacity: .5; filter: saturate(.6) brightness(.75); }
  .glass-card:is(:hover, :focus-visible) ~ .glass-card { transform: translateX(18px) scale(.9); }
  .glass-card:has(~ .glass-card:is(:hover, :focus-visible)) { transform: translateX(-18px) scale(.9); }
}

@media (max-width: 1100px) {
  .glass-grid, .brief-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 720px) {
  .market-home { gap: 20px; padding: 16px 14px 18px; border-radius: 20px; }
  /* Phones: two compact cards per row so the brief is reached quickly. */
  .glass-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px 12px; padding-inline: 4px; }
  .glass-card { min-height: 0; padding: 12px 12px 0; border-radius: 20px; }
  .glass-label { font-size: 9px; letter-spacing: .1em; }
  .glass-art { height: 78px; margin: 0 -4px 2px; }
  .glass-panel { min-height: 128px; margin: 0 -6px -6px; padding: 12px 10px 44px; border-radius: 14px; }
  .glass-panel::before { top: -10px; height: 18px; }
  .glass-panel strong { font-size: 15px; }
  .glass-panel em { font-size: 11px; }
  .glass-panel b { font-size: 11px; padding: 3px 8px; }
  .glass-icon { right: 10px; bottom: 8px; width: 30px; height: 30px; }
  .glass-icon svg { width: 16px; height: 16px; }
  .brief-grid, .brief-meta { grid-template-columns: minmax(0, 1fr); }
  .brief-meta span + span { padding-left: 0; border-left: 0; }
}
@media (prefers-reduced-motion: reduce) { .glass-glow, .glass-card { animation: none; } .glass-glow { opacity: .6; } .glass-card, .brief-card { transition: none; } }
</style>
