<script setup lang="ts">
// CR-021: who the goods were for → function group → function, weighted by list-price revenue. Desktop draws a
// three-column Sankey; a phone drills layer by layer. REQ-016 A5: every group and function of at least 1% of revenue
// is drawn on its own; smaller functions fold into "<group>·其他" within their group, smaller groups into 其他大类.
// Clicking a node lists its best sellers; one running short can be put on this week's purchase order (提醒进货).
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { marketMoney as money, type SankeyData, type SankeyNode, type SankeyProduct } from '../market-types';

const props = defineProps<{ data: SankeyData; adding: string | null }>();
const emit = defineEmits<{ 'add-to-order': [productId: string] }>();

const GROUP_LIMIT = 7;
const SHOW_SHARE = 0.01;
const OTHER_GROUP = 'g:__other';
const OTHER_FUNCTION = 'f:__other';
const otherOf = (group: string) => `f:__other:${group}`;
const NO_FUNCTION = 'g:无明确功能';
// The chart is drawn at its real width so text never scales; its height matches the product panel beside it.
const MIN_H = 470; const NODE_W = 12; const GAP = 8; const LABEL_H = 17; const LEFT_LABELS = 150; const RIGHT_LABELS = 168;
const HEADERS = ['买给谁', '功能大类', '功能细分'];
const CHART_MIN = 560;
const root = ref<HTMLElement>();
const chart = ref<HTMLElement>();
const W = ref(900);
const rootWidth = ref(0);
let resizer: ResizeObserver | null = null;
onMounted(() => {
  if (!root.value || !chart.value || typeof ResizeObserver === 'undefined') return;
  resizer = new ResizeObserver((entries) => {
    for (const { target, contentRect } of entries) {
      const width = Math.round(contentRect.width);
      if (!width) continue;
      if (target === chart.value) W.value = Math.max(CHART_MIN, width); else rootWidth.value = width;
    }
  });
  resizer.observe(root.value);
  resizer.observe(chart.value);
});
onBeforeUnmount(() => resizer?.disconnect());

// CR-022: on wide screens the product panel beside the chart can be dragged wider or narrower. The width is a
// per-viewer convenience kept in this browser; when storage is blocked the default is used.
const SIDE_DEFAULT = 400; const SIDE_MIN = 300; const SIDE_STEP = 20; const SPLITTER_W = 14;
const SIDE_KEY = 'sunshine.market.sankeySide';
function storedSide() {
  try { return Number(localStorage.getItem(SIDE_KEY)) || SIDE_DEFAULT; } catch { return SIDE_DEFAULT; }
}
// At most 55% of the block, and never so wide that the chart drops below its minimum.
function clampSide(value: number) {
  const max = rootWidth.value ? Math.max(SIDE_MIN, Math.min(rootWidth.value * 0.55, rootWidth.value - CHART_MIN - SPLITTER_W)) : Infinity;
  return Math.round(Math.min(Math.max(value, SIDE_MIN), max));
}
const side = ref(storedSide());
const sideWidth = computed(() => clampSide(side.value));
function setSide(value: number) {
  side.value = clampSide(value);
  try { localStorage.setItem(SIDE_KEY, String(side.value)); } catch { /* the width just is not remembered */ }
}
let drag: { x: number; side: number } | null = null;
function startDrag(event: PointerEvent) {
  (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
  drag = { x: event.clientX, side: sideWidth.value };
}
// The panel is on the right, so moving the splitter left widens it.
function moveDrag(event: PointerEvent) { if (drag) side.value = drag.side + drag.x - event.clientX; }
function endDrag() { if (drag) { drag = null; setSide(side.value); } }
function splitterKey(event: KeyboardEvent) {
  const next = { ArrowLeft: sideWidth.value + SIDE_STEP, ArrowRight: sideWidth.value - SIDE_STEP, Home: SIDE_DEFAULT }[event.key];
  if (next === undefined) return;
  event.preventDefault();
  setSide(next);
}
const columnX = computed(() => {
  const right = W.value - RIGHT_LABELS - NODE_W;
  return [LEFT_LABELS, Math.round((LEFT_LABELS + right) / 2), right];
});

const percent = (value: number) => (props.data.total > 0 ? `${Math.round((value / props.data.total) * 1000) / 10}%` : '0%');

// Function groups keep their color by size rank (slots 1–7); 其他 and 无明确功能 are grey.
const groupSlot = computed(() => new Map(props.data.nodes.filter((node) => node.layer === 1 && node.id !== NO_FUNCTION).slice(0, GROUP_LIMIT).map((node, index) => [node.id, index + 1])));
const colorOf = (groupId: string | null) => (groupId && groupSlot.value.has(groupId) ? `var(--mk-s${groupSlot.value.get(groupId)})` : 'var(--mk-other)');

// Desktop folding: every node maps to the node it is drawn as.
const shownAs = computed(() => {
  const map = new Map<string, string>();
  const small = (node: SankeyNode) => node.value < props.data.total * SHOW_SHARE;
  for (const node of props.data.nodes) {
    if (node.layer === 0) map.set(node.id, node.id);
    if (node.layer === 1) map.set(node.id, node.id === NO_FUNCTION || !small(node) ? node.id : OTHER_GROUP);
  }
  const smallByGroup = new Map<string, number>();
  for (const node of props.data.nodes) if (node.layer === 2 && small(node)) smallByGroup.set(node.group ?? '', (smallByGroup.get(node.group ?? '') ?? 0) + 1);
  for (const node of props.data.nodes) {
    if (node.layer !== 2) continue;
    const group = node.group ?? '';
    if (map.get(`g:${group}`) === OTHER_GROUP) map.set(node.id, OTHER_FUNCTION);
    else map.set(node.id, small(node) && (smallByGroup.get(group) ?? 0) > 1 ? otherOf(group) : node.id);
  }
  return map;
});

// Taller when a column has many nodes, so every node keeps a line for its label.
const chartH = computed(() => {
  const counts = [0, 1, 2].map((layer) => new Set([...shownAs.value].filter(([id]) => props.data.nodes.find((node) => node.id === id)?.layer === layer).map(([, shown]) => shown)).size);
  return Math.max(MIN_H, Math.max(...counts) * (LABEL_H + GAP + 4));
});
type Box = SankeyNode & { x: number; y: number; h: number; slot: number; color: string };
const isCatchAll = (id: string) => id.includes('__other') || id === NO_FUNCTION;
// Pixels per dollar for one column: nodes too small for a label get a fixed slot and the rest share what is left.
function columnScale(column: Box[]) {
  const room = chartH.value - GAP * Math.max(column.length - 1, 0);
  const total = column.reduce((sum, box) => sum + box.value, 0) || 1;
  let scale = room / total;
  for (let pass = 0; pass < 3; pass += 1) {
    const tiny = column.filter((box) => box.value * scale < LABEL_H);
    const rest = total - tiny.reduce((sum, box) => sum + box.value, 0);
    if (rest > 0) scale = Math.max(room - LABEL_H * tiny.length, 0) / rest;
  }
  return scale;
}
const layout = computed(() => {
  const boxes = new Map<string, Box>();
  for (const node of props.data.nodes) {
    const id = shownAs.value.get(node.id)!;
    const existing = boxes.get(id);
    if (existing) { existing.value += node.value; continue; }
    const name = id === OTHER_GROUP ? '其他大类' : id === OTHER_FUNCTION ? '其他细分' : id.startsWith('f:__other:') ? `${node.group}·${node.group === '无明确功能' ? '其他品类' : '其他'}` : node.name;
    const groupId = node.layer === 1 ? id : node.layer === 2 && id !== OTHER_FUNCTION ? `g:${node.group}` : null;
    boxes.set(id, { ...node, id, name, x: columnX.value[node.layer], y: 0, h: 0, slot: 0, color: node.layer === 0 ? 'var(--mk-ink)' : colorOf(groupId) });
  }
  const order = (a: Box, b: Box) => Number(isCatchAll(a.id)) - Number(isCatchAll(b.id)) || b.value - a.value;
  const columns = [0, 1].map((layer) => [...boxes.values()].filter((box) => box.layer === layer).sort(order));
  // Functions follow the order of their groups, so bands from one group stay together and cross less.
  const groupRank = new Map(columns[1].map((box, index) => [box.id, index]));
  const rankOf = (box: Box) => groupRank.get(box.id === OTHER_FUNCTION ? OTHER_GROUP : `g:${box.group}`) ?? groupRank.size;
  const withinGroup = (a: Box, b: Box) => Number(a.id.startsWith('f:__other:')) - Number(b.id.startsWith('f:__other:')) || b.value - a.value;
  columns.push([...boxes.values()].filter((box) => box.layer === 2).sort((a, b) => rankOf(a) - rankOf(b) || withinGroup(a, b)));
  const H = chartH.value;
  // Every node keeps at least one label line of space, so small groups such as 孕产 and 青少年 never overlap.
  const scale = Math.min(...columns.map(columnScale));
  for (const column of columns) {
    for (const box of column) { box.h = Math.max(box.value * scale, 2); box.slot = Math.max(box.h, LABEL_H); }
    let y = (H - column.reduce((sum, box) => sum + box.slot, 0) - GAP * (column.length - 1)) / 2;
    for (const box of column) { box.y = y + (box.slot - box.h) / 2; y += box.slot + GAP; }
  }
  const linkValues = new Map<string, number>();
  for (const link of props.data.links) {
    const key = `${shownAs.value.get(link.source)}\u0000${shownAs.value.get(link.target)}`;
    linkValues.set(key, (linkValues.get(key) ?? 0) + link.value);
  }
  const links = [...linkValues].map(([key, value]) => { const [source, target] = key.split('\u0000'); return { source: boxes.get(source)!, target: boxes.get(target)!, value }; })
    .sort((a, b) => a.source.y - b.source.y || a.target.y - b.target.y);
  const outOffset = new Map<string, number>(); const inOffset = new Map<string, number>();
  const bands = links.map((link) => {
    const thickness = Math.max(link.value * scale, 1);
    const y0 = link.source.y + (outOffset.get(link.source.id) ?? 0);
    const y1 = link.target.y + (inOffset.get(link.target.id) ?? 0);
    outOffset.set(link.source.id, (outOffset.get(link.source.id) ?? 0) + thickness);
    inOffset.set(link.target.id, (inOffset.get(link.target.id) ?? 0) + thickness);
    const x0 = link.source.x + NODE_W; const x1 = link.target.x; const mid = (x0 + x1) / 2;
    const path = `M${x0},${y0}C${mid},${y0} ${mid},${y1} ${x1},${y1}L${x1},${y1 + thickness}C${mid},${y1 + thickness} ${mid},${y0 + thickness} ${x0},${y0 + thickness}Z`;
    // The centre line carries the moving dashes that show the direction of the flow; hairline bands get none.
    const centre = thickness >= 4 ? `M${x0},${y0 + thickness / 2}C${mid},${y0 + thickness / 2} ${mid},${y1 + thickness / 2} ${x1},${y1 + thickness / 2}` : null;
    // Both stages take the colour of the function group they pass through, so one group reads as one colour.
    const color = link.source.layer === 0 ? link.target.color : link.source.color;
    return { key: `${link.source.id}>${link.target.id}`, path, centre, color, source: link.source.id, target: link.target.id, value: link.value, label: `${link.source.name} → ${link.target.name}` };
  });
  return { boxes: [...boxes.values()], bands };
});

const selected = ref<string>('');
watch(() => props.data, () => {
  selected.value = layout.value.boxes.filter((box) => box.layer === 1 && !isCatchAll(box.id)).sort((a, b) => b.value - a.value)[0]?.id ?? '';
}, { immediate: true });
// Bands fade only after someone picks a node; the node chosen on load just fills the product list.
const picked = ref(false);
function pick(id: string) { selected.value = id; picked.value = true; }
const touches = (band: { source: string; target: string }) => !picked.value || band.source === selected.value || band.target === selected.value;
// A phone can pick a function that the desktop folds into 其他, so fall back to the original node.
const selectedBox = computed<SankeyNode | null>(() => layout.value.boxes.find((box) => box.id === selected.value) ?? props.data.nodes.find((node) => node.id === selected.value) ?? null);

// Products behind a node; a folded node merges the products of the nodes inside it.
function productsOf(id: string): SankeyProduct[] {
  const members = id.includes('__other') ? [...shownAs.value].filter(([, shown]) => shown === id).map(([original]) => original) : [id];
  const merged = new Map<string, SankeyProduct>();
  for (const member of members) for (const row of props.data.products[member] ?? []) {
    const existing = merged.get(row.productId);
    merged.set(row.productId, existing ? { ...existing, revenue: existing.revenue + row.revenue } : { ...row });
  }
  return [...merged.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 10);
}
const shownProducts = computed(() => (selected.value ? productsOf(selected.value) : []));
// Out of stock, or less than two weeks left at the current pace, and not already on this week's order.
const needsRestock = (row: SankeyProduct) => !row.inCurrentOrder && (row.currentInventory <= 0 || (row.coverageWeeks !== null && row.coverageWeeks < 2));

// Phone: people → group → function, using the exact triples.
const drillPeople = ref(''); const drillGroup = ref('');
const drillRows = computed(() => {
  const flows = props.data.flows.filter((flow) => (!drillPeople.value || flow.people === drillPeople.value) && (!drillGroup.value || flow.group === drillGroup.value));
  const key = drillGroup.value ? 'label' : drillPeople.value ? 'group' : 'people';
  const sums = new Map<string, number>();
  for (const flow of flows) sums.set(flow[key], (sums.get(flow[key]) ?? 0) + flow.value);
  const base = [...sums.values()].reduce((sum, value) => sum + value, 0) || 1;
  return [...sums].sort((a, b) => b[1] - a[1]).map(([name, value]) => ({
    name, value, share: Math.round((value / base) * 1000) / 10,
    color: key === 'people' ? 'var(--mk-ink)' : colorOf(`g:${key === 'group' ? name : drillGroup.value}`),
  }));
});
function drill(name: string) {
  if (!drillPeople.value) { drillPeople.value = name; selected.value = `p:${name}`; return; }
  if (!drillGroup.value) { drillGroup.value = name; selected.value = `g:${name}`; return; }
  selected.value = `f:${drillGroup.value}/${name}`;
}
function drillBack() {
  if (drillGroup.value) { drillGroup.value = ''; selected.value = `p:${drillPeople.value}`; } else { drillPeople.value = ''; }
}
</script>

<template>
  <div ref="root" class="sk" :style="{ '--sk-side': `${sideWidth}px` }">
    <div ref="chart" class="sk-chart">
    <svg class="sk-svg" :width="W" :height="chartH + 30" :viewBox="`0 -30 ${W} ${chartH + 30}`" role="img" :aria-label="`人群与功能需求桑基图，合计 ${money(data.total)}`">
      <text v-for="(header, index) in HEADERS" :key="header" class="sk-header" :x="columnX[index] + (index === 0 ? NODE_W : 0)" y="-14" :text-anchor="index === 0 ? 'end' : 'start'">{{ header }}</text>
      <g class="sk-bands">
        <path v-for="band in layout.bands" :key="band.key" :d="band.path" :fill="band.color" :class="{ faded: !touches(band) }"><title>{{ band.label }}：{{ money(band.value) }}（{{ percent(band.value) }}）</title></path>
      </g>
      <g class="sk-flow" aria-hidden="true">
        <template v-for="band in layout.bands" :key="band.key"><path v-if="band.centre" :d="band.centre" :class="{ faded: !touches(band) }" /></template>
      </g>
      <g v-for="box in layout.boxes" :key="box.id" class="sk-node" :class="{ active: box.id === selected }" role="button" tabindex="0" :aria-label="`${box.name} ${money(box.value)}`" @click="pick(box.id)" @keydown.enter="pick(box.id)">
        <rect :x="box.x - 6" :y="box.y - 3" :width="NODE_W + 12" :height="box.h + 6" fill="transparent" />
        <rect :x="box.x" :y="box.y" :width="NODE_W" :height="box.h" :fill="box.color" rx="3" />
        <text :x="box.layer === 0 ? box.x - 8 : box.x + NODE_W + 8" :y="box.y + box.h / 2" :text-anchor="box.layer === 0 ? 'end' : 'start'" dominant-baseline="middle">
          <tspan class="sk-name">{{ box.name }}</tspan><tspan class="sk-value" dx="6">{{ percent(box.value) }}</tspan>
        </text>
        <title>{{ box.name }}：{{ money(box.value) }}（{{ percent(box.value) }}）</title>
      </g>
    </svg>
    </div>

    <div class="sk-splitter" role="separator" tabindex="0" aria-orientation="vertical" aria-label="调整商品栏宽度"
      :aria-valuenow="sideWidth" :aria-valuemin="SIDE_MIN" title="拖动调整宽度，双击恢复默认"
      @pointerdown="startDrag" @pointermove="moveDrag" @pointerup="endDrag" @pointercancel="endDrag"
      @dblclick="setSide(SIDE_DEFAULT)" @keydown="splitterKey"></div>

    <div class="sk-drill">
      <p class="sk-path"><button v-if="drillPeople" type="button" @click="drillBack">‹ 返回</button><span>{{ drillPeople || '买给谁' }}<template v-if="drillGroup"> · {{ drillGroup }}</template></span></p>
      <ul>
        <li v-for="row in drillRows" :key="row.name"><button type="button" :class="{ active: drillGroup && selected === `f:${drillGroup}/${row.name}` }" @click="drill(row.name)">
          <span class="sk-drill-name">{{ row.name }}</span><span class="sk-drill-bar"><i :style="{ width: `${Math.min(100, row.share)}%`, background: row.color }"></i></span><b>{{ row.share }}%</b><small>{{ money(row.value) }}</small>
        </button></li>
      </ul>
    </div>

    <section v-if="selectedBox" class="sk-products" aria-live="polite">
      <header><h5>{{ selectedBox.name }} · 卖得最好的商品<small v-if="drillPeople && selectedBox.layer > 0">（全部人群）</small></h5><span>{{ money(selectedBox.value) }} · 占 {{ percent(selectedBox.value) }}</span></header>
      <ul>
        <li v-for="row in shownProducts" :key="row.productId">
          <span class="sk-product"><strong>{{ row.productName }}</strong><small>{{ row.level2 }} · {{ row.brandName }}</small><small class="sk-facts">计入 <b>{{ money(row.revenue) }}</b> · 本期 <b>{{ row.units }}</b> 件 · 库存 <b>{{ row.currentInventory }}</b> 件<template v-if="row.coverageWeeks !== null">（约 {{ row.coverageWeeks }} 周）</template></small></span>
          <button v-if="needsRestock(row)" type="button" :disabled="adding === row.productId" @click="emit('add-to-order', row.productId)">{{ adding === row.productId ? '加入中…' : '提醒进货' }}</button>
          <em v-else class="sk-stock-note">{{ row.inCurrentOrder ? '已在进货单' : '库存够用' }}</em>
        </li>
        <li v-if="!shownProducts.length" class="sk-empty">没有商品明细。</li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
.sk { display: grid; gap: 14px; }
.sk-chart { min-width: 0; overflow: hidden; }
.sk-svg { display: block; overflow: visible; font-size: 12px; }
.sk-header { fill: var(--mk-muted); font-size: 11px; font-weight: 700; letter-spacing: .04em; }
.sk-bands path { opacity: .5; transition: opacity .2s ease; }
.sk-bands path:hover { opacity: .8; }
.sk-bands path.faded { opacity: .12; }
.sk-flow path { fill: none; stroke: rgb(255 255 255 / 55%); stroke-width: 1.5; stroke-linecap: round; stroke-dasharray: 14 90; animation: sk-flow 3.2s linear infinite; pointer-events: none; }
.sk-flow path.faded { opacity: 0; }
@keyframes sk-flow { to { stroke-dashoffset: -104; } }
@media (prefers-reduced-motion: reduce) { .sk-flow path { animation: none; } }
.sk-node { cursor: pointer; outline: none; }
.sk-node text { fill: var(--mk-ink); paint-order: stroke; stroke: var(--mk-surface); stroke-width: 3px; stroke-linejoin: round; }
.sk-name { font-weight: 700; }
.sk-value { fill: var(--mk-muted); font-variant-numeric: tabular-nums; }
.sk-node.active .sk-name { text-decoration: underline; text-underline-offset: 3px; }
.sk-node:focus-visible rect:last-of-type { stroke: var(--mk-accent); stroke-width: 2; }
.sk-drill, .sk-splitter { display: none; }
.sk-path { display: flex; align-items: center; gap: 8px; margin: 0 0 6px; color: var(--mk-muted); font-size: 13px; font-weight: 700; }
.sk-path button { min-height: 32px; padding: 4px 10px; color: var(--mk-ink); border: 1px solid var(--mk-line); border-radius: 8px; background: transparent; font: inherit; }
.sk-drill ul, .sk-products ul { display: grid; margin: 0; padding: 0; list-style: none; }
.sk-drill li button { display: grid; grid-template-columns: 84px minmax(0, 1fr) 46px; align-items: center; column-gap: 8px; width: 100%; min-height: 48px; padding: 6px 2px; color: var(--mk-ink); border: 0; border-top: 1px solid var(--mk-line); background: transparent; font: inherit; text-align: left; }
.sk-drill li button.active { background: color-mix(in srgb, var(--mk-accent) 10%, transparent); }
.sk-drill-name { font-size: 13px; font-weight: 800; line-height: 1.25; }
.sk-drill-bar { height: 10px; border-radius: 0 4px 4px 0; background: color-mix(in srgb, var(--mk-line) 50%, transparent); }
.sk-drill-bar i { display: block; height: 100%; min-width: 3px; border-radius: 0 4px 4px 0; }
.sk-drill b { text-align: right; font-variant-numeric: tabular-nums; }
.sk-drill small { grid-column: 2 / -1; color: var(--mk-muted); font-size: 11px; }
.sk-products { display: grid; gap: 6px; }
.sk-products header { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; }
.sk-products h5 { margin: 0; color: var(--mk-ink); font-size: 14px; }
.sk-products header span { color: var(--mk-muted); font-size: 12px; }
.sk-products li { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 10px; padding: 9px 2px; border-top: 1px solid var(--mk-line); color: var(--mk-ink); font-size: 13px; }
.sk-product { display: grid; gap: 2px; min-width: 0; }
.sk-product strong { display: -webkit-box; overflow: hidden; -webkit-box-orient: vertical; -webkit-line-clamp: 2; line-clamp: 2; line-height: 1.35; }
.sk-product small { color: var(--mk-muted); font-size: 11px; }
.sk-facts b { color: var(--mk-ink); font-variant-numeric: tabular-nums; }
.sk-products button { min-height: 34px; padding: 4px 10px; color: var(--mk-accent); border: 1px solid var(--mk-accent); border-radius: 9px; background: transparent; font: inherit; font-size: 12px; font-weight: 700; white-space: nowrap; }
.sk-stock-note { color: var(--mk-muted); font-size: 12px; font-style: normal; white-space: nowrap; }
.sk-products li.sk-empty { display: block; color: var(--mk-muted); }
.sk-products h5 small { margin-left: 4px; font-weight: 600; }
/* Wide screens: the chart takes the width and the products of the chosen node sit beside it, split by a draggable bar. */
@media (min-width: 1200px) {
  .sk { grid-template-columns: minmax(0, 1fr) 14px var(--sk-side); column-gap: 0; align-items: stretch; }
  .sk-splitter { display: block; position: relative; cursor: col-resize; touch-action: none; outline: none; }
  .sk-splitter::before { content: ''; position: absolute; inset: 0 6px; border-radius: 1px; background: var(--mk-line); transition: background .15s ease; }
  .sk-splitter:hover::before, .sk-splitter:focus-visible::before, .sk-splitter:active::before { inset: 0 5px; background: var(--mk-accent); }
  .sk-products { grid-template-rows: auto minmax(0, 1fr); height: 500px; align-content: start; }
  .sk-products ul { align-content: start; overflow-y: auto; overscroll-behavior: contain; }
}
@media (max-width: 720px) {
  .sk-chart { display: none; }
  .sk-drill { display: block; }
  .sk-products li { grid-template-columns: minmax(0, 1fr); }
  .sk-products button { width: 100%; min-height: 40px; }
}
</style>
