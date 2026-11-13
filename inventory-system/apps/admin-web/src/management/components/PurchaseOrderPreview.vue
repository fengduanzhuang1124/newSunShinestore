<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import type { PurchaseOrder } from '../useManagementDashboard';
import '../glass-pill.css';

// CR-009 P6: a read-only overview of this cycle's purchase order. A medicine box on the left fans out to the
// products (largest quantity at the top); the panel on the right lists every line.
const props = defineProps<{ order: PurchaseOrder; statusLabel: string }>();
const emit = defineEmits<{ close: []; download: [] }>();

const MAX_LINES = 20;
const VIEW_WIDTH = 640;
const BOX_X = 110;
const LINE_START_X = 172;

const sortedItems = computed(() => [...props.order.items].sort((a, b) => b.orderedQuantity - a.orderedQuantity || a.productName.localeCompare(b.productName)));
const shownItems = computed(() => sortedItems.value.slice(0, MAX_LINES));
const hiddenCount = computed(() => Math.max(0, sortedItems.value.length - MAX_LINES));
const totalUnits = computed(() => props.order.items.reduce((sum, item) => sum + item.orderedQuantity, 0));

const nodeCount = computed(() => shownItems.value.length + (hiddenCount.value ? 1 : 0));
// Each label has two lines, so nodes need about 30 units; the SVG scales down to fit instead of overlapping.
const viewHeight = computed(() => Math.max(520, 60 + nodeCount.value * 30));
const centerY = computed(() => viewHeight.value / 2);

// Rough rendered widths: CJK glyphs are about a full em, Latin about half.
function fitText(text: string, maxWidth: number, fontSize: number) {
  let width = 0;
  let result = '';
  for (const char of text) {
    width += /[⺀-鿿＀-￯]/.test(char) ? fontSize : fontSize * 0.56;
    if (width > maxWidth) return `${result.trimEnd()}…`;
    result += char;
  }
  return result;
}

type Node = { key: string; x: number; y: number; path: string; label: string; detail: string; weight: number; itemId: string | null; delay: string };
const nodes = computed<Node[]>(() => {
  const count = nodeCount.value;
  const spacing = Math.min(46, (viewHeight.value - 60) / Math.max(count - 1, 1));
  const top = centerY.value - (spacing * (count - 1)) / 2;
  const halfSpan = Math.max((spacing * (count - 1)) / 2, 1);
  const maxQuantity = Math.max(...shownItems.value.map((item) => item.orderedQuantity), 1);
  const place = (index: number) => {
    const y = top + index * spacing;
    const t = (y - centerY.value) / halfSpan;
    // Labels sit on an arc that bulges towards the panel, like the fan in the reference design.
    const x = 318 + 72 * (1 - t * t);
    const path = `M ${LINE_START_X} ${centerY.value} C ${LINE_START_X + 90} ${centerY.value}, ${x - 110} ${y}, ${x - 6} ${y}`;
    return { x, y, path, delay: `${index * 35}ms` };
  };
  const list: Node[] = shownItems.value.map((item, index) => {
    const position = place(index);
    const labelWidth = VIEW_WIDTH - (position.x + 12) - 8;
    return {
      key: item.id, itemId: item.id, ...position,
      label: fitText(item.productName, labelWidth, 13),
      detail: `进 ${item.orderedQuantity} 件 · 库存 ${item.currentInventory}`,
      weight: item.orderedQuantity / maxQuantity,
    };
  });
  if (hiddenCount.value) {
    const position = place(list.length);
    list.push({ key: 'more', itemId: null, ...position, label: `+ 其余 ${hiddenCount.value} 项`, detail: '见右侧清单', weight: 0 });
  }
  return list;
});

const activeId = ref<string | null>(null);
const panel = ref<HTMLElement | null>(null);
function onKey(event: KeyboardEvent) { if (event.key === 'Escape') emit('close'); }
onMounted(() => { window.addEventListener('keydown', onKey); panel.value?.focus(); });
onBeforeUnmount(() => window.removeEventListener('keydown', onKey));
</script>

<template>
  <Teleport to="body">
    <div class="po-preview" role="dialog" aria-modal="true" aria-label="进货单预览" @click.self="emit('close')">
      <div class="po-preview-frame" @click.self="emit('close')">
        <svg class="po-constellation" :viewBox="`0 0 ${VIEW_WIDTH} ${viewHeight}`" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
          <defs>
            <radialGradient id="po-core-glow">
              <stop offset="0%" stop-color="#8f7bff" stop-opacity=".55" />
              <stop offset="60%" stop-color="#3fc6d6" stop-opacity=".12" />
              <stop offset="100%" stop-color="#3fc6d6" stop-opacity="0" />
            </radialGradient>
            <linearGradient id="po-line" x1="0" x2="1">
              <stop offset="0%" stop-color="#f5d48a" />
              <stop offset="100%" stop-color="#7fe0ec" />
            </linearGradient>
          </defs>

          <circle :cx="BOX_X" :cy="centerY" r="100" fill="url(#po-core-glow)" />
          <g class="po-orbit" :style="{ transformOrigin: `${BOX_X}px ${centerY}px` }">
            <circle :cx="BOX_X" :cy="centerY" r="84" fill="none" stroke="#9d8cff" stroke-opacity=".45" stroke-dasharray="2 6" />
            <circle :cx="BOX_X + 84" :cy="centerY" r="3" fill="#c8bfff" />
          </g>
          <circle :cx="BOX_X" :cy="centerY" r="68" fill="none" stroke="#5fd3e0" stroke-opacity=".22" />

          <!-- Medicine box line art -->
          <g class="po-box" fill="none" stroke="#e9f4ff" stroke-width="1.6" stroke-linejoin="round">
            <path :d="`M ${BOX_X - 40} ${centerY - 22} L ${BOX_X - 14} ${centerY - 40} L ${BOX_X + 52} ${centerY - 40} L ${BOX_X + 26} ${centerY - 22} Z`" fill="rgb(143 123 255 / 18%)" />
            <path :d="`M ${BOX_X + 26} ${centerY - 22} L ${BOX_X + 52} ${centerY - 40} L ${BOX_X + 52} ${centerY + 20} L ${BOX_X + 26} ${centerY + 38} Z`" fill="rgb(63 198 214 / 14%)" />
            <rect :x="BOX_X - 40" :y="centerY - 22" width="66" height="60" rx="2" fill="rgb(10 20 34 / 70%)" />
            <path :d="`M ${BOX_X - 19} ${centerY} h 8 v -8 h 8 v 8 h 8 v 8 h -8 v 8 h -8 v -8 h -8 Z`" stroke="#7fe0ec" fill="rgb(127 224 236 / 18%)" />
            <path :d="`M ${BOX_X - 32} ${centerY + 30} h 50`" stroke-opacity=".5" />
          </g>
          <text :x="BOX_X" :y="centerY + 112" class="po-core-title" text-anchor="middle">{{ order.orderNo }}</text>
          <text :x="BOX_X" :y="centerY + 132" class="po-core-meta" text-anchor="middle">{{ order.items.length }} 种 · {{ totalUnits }} 件</text>

          <g v-for="node in nodes" :key="node.key" class="po-node" :class="{ active: activeId === node.itemId, dim: activeId !== null && activeId !== node.itemId, more: !node.itemId }"
             @mouseenter="activeId = node.itemId" @mouseleave="activeId = null">
            <path :d="node.path" pathLength="1" class="po-line" :style="{ animationDelay: node.delay, strokeWidth: 0.8 + node.weight * 2.2, strokeOpacity: 0.3 + node.weight * 0.6 }" stroke="url(#po-line)" fill="none" />
            <circle :cx="node.x - 6" :cy="node.y" r="3.2" class="po-dot" :style="{ animationDelay: node.delay }" />
            <text :x="node.x + 4" :y="node.y - 2" class="po-label" :style="{ animationDelay: node.delay }">{{ node.label }}</text>
            <text :x="node.x + 4" :y="node.y + 12" class="po-detail" :style="{ animationDelay: node.delay }">{{ node.detail }}</text>
          </g>
        </svg>

        <section ref="panel" class="po-panel" tabindex="-1">
          <span class="po-corner tl" /><span class="po-corner tr" /><span class="po-corner bl" /><span class="po-corner br" />
          <header>
            <small>PURCHASE ORDER · 本周进货单</small>
            <h2>{{ order.orderNo }}</h2>
            <p>周期 {{ order.weekStart }}<template v-if="order.weekEnd"> 至 {{ order.weekEnd }}</template> · {{ statusLabel }}</p>
            <div class="po-stats"><span><b>{{ order.items.length }}</b>种商品</span><span><b>{{ totalUnits }}</b>件进货</span></div>
          </header>
          <div class="po-table">
            <table>
              <thead><tr><th>商品名称</th><th>库存</th><th>进货数量</th></tr></thead>
              <tbody>
                <tr v-for="item in sortedItems" :key="item.id" :class="{ active: activeId === item.id }" @mouseenter="activeId = item.id" @mouseleave="activeId = null">
                  <td :title="item.productName">{{ item.productName }}</td>
                  <td>{{ item.currentInventory }}</td>
                  <td><b>{{ item.orderedQuantity }}</b></td>
                </tr>
              </tbody>
            </table>
          </div>
          <footer>
            <button class="glass-pill small back" type="button" @click="emit('close')">返回</button>
            <button class="glass-pill small download" type="button" @click="emit('download')">下载</button>
          </footer>
        </section>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.po-preview {
  position: fixed;
  z-index: 1200;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 16px;
  background: radial-gradient(circle at 22% 50%, rgb(70 52 160 / 38%), transparent 46%), rgb(3 8 16 / 88%);
  backdrop-filter: blur(10px);
  animation: po-fade .28s ease-out;
}
.po-preview-frame {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(340px, 40%);
  grid-template-rows: minmax(0, 1fr);
  gap: 20px;
  width: min(1280px, 100%);
  height: min(780px, calc(100dvh - 32px));
  min-height: 0;
}
.po-constellation { width: 100%; height: 100%; min-width: 0; min-height: 0; max-height: 100%; overflow: visible; }
.po-orbit { animation: po-spin 26s linear infinite; }
.po-box { filter: drop-shadow(0 0 8px rgb(143 123 255 / 55%)); }
.po-core-title { fill: #f4f7ff; font-size: 13px; font-weight: 800; letter-spacing: .04em; }
.po-core-meta { fill: #9fb0c8; font-size: 11px; }
.po-line { stroke-dasharray: 1; stroke-dashoffset: 1; stroke-linecap: round; animation: po-draw .8s ease-out forwards; transition: stroke-opacity .2s; }
.po-dot { fill: #f5d48a; opacity: 0; animation: po-appear .3s ease-out .5s forwards; }
.po-label { fill: #eef4ff; font-size: 13px; font-weight: 700; opacity: 0; animation: po-appear .4s ease-out .45s forwards; }
.po-detail { fill: #8fa2bc; font-size: 10px; opacity: 0; animation: po-appear .4s ease-out .5s forwards; }
.po-node { cursor: default; transition: opacity .2s; }
.po-node.dim { opacity: .28; }
.po-node.active .po-line { stroke-opacity: 1 !important; stroke-width: 3px !important; }
.po-node.active .po-label { fill: #fff; }
.po-node.more .po-label { fill: #9fb0c8; font-weight: 600; }

.po-panel {
  position: relative;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  gap: 14px;
  min-width: 0;
  min-height: 0;
  padding: 22px 22px 18px;
  color: #e9f2ff;
  border: 1px solid rgb(127 224 236 / 28%);
  border-radius: 22px;
  outline: none;
  background: linear-gradient(160deg, rgb(52 82 110 / 55%), rgb(14 26 42 / 82%) 45%, rgb(10 18 30 / 90%));
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 16%), 0 0 0 1px rgb(143 123 255 / 12%), 0 30px 80px rgb(0 0 0 / 55%), 0 0 40px rgb(63 198 214 / 12%);
  backdrop-filter: blur(22px) saturate(140%);
  animation: po-slide .4s cubic-bezier(.2, .8, .2, 1);
}
.po-corner { position: absolute; width: 18px; height: 18px; border: 2px solid #7fe0ec; pointer-events: none; filter: drop-shadow(0 0 6px rgb(127 224 236 / 70%)); }
.po-corner.tl { top: -1px; left: -1px; border-right: 0; border-bottom: 0; border-top-left-radius: 22px; }
.po-corner.tr { top: -1px; right: -1px; border-left: 0; border-bottom: 0; border-top-right-radius: 22px; }
.po-corner.bl { bottom: -1px; left: -1px; border-right: 0; border-top: 0; border-bottom-left-radius: 22px; }
.po-corner.br { right: -1px; bottom: -1px; border-left: 0; border-top: 0; border-bottom-right-radius: 22px; }
.po-panel header { display: grid; gap: 6px; min-width: 0; }
.po-panel header small { color: #7fe0ec; font-size: 10px; font-weight: 800; letter-spacing: .18em; }
.po-panel h2 { margin: 0; overflow: hidden; font-size: 22px; text-overflow: ellipsis; white-space: nowrap; }
.po-panel header p { margin: 0; color: #9fb0c8; font-size: 12px; }
.po-stats { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 4px; }
.po-stats span { display: inline-flex; align-items: baseline; gap: 5px; padding: 6px 12px; color: #9fb0c8; border: 1px solid rgb(127 224 236 / 20%); border-radius: 12px; background: rgb(127 224 236 / 7%); font-size: 11px; }
.po-stats b { color: #f5d48a; font-size: 18px; font-variant-numeric: tabular-nums; }
.po-table { min-height: 0; overflow: auto; border: 1px solid rgb(127 224 236 / 14%); border-radius: 14px; scrollbar-gutter: stable; }
.po-table table { width: 100%; border-collapse: collapse; table-layout: fixed; }
.po-table th { position: sticky; z-index: 1; top: 0; padding: 9px 12px; color: #8fa2bc; background: rgb(14 26 42 / 96%); font-size: 11px; font-weight: 700; text-align: left; }
.po-table th:nth-child(2), .po-table th:nth-child(3), .po-table td:nth-child(2), .po-table td:nth-child(3) { width: 74px; text-align: right; }
.po-table td { padding: 9px 12px; border-top: 1px solid rgb(127 224 236 / 9%); font-size: 13px; font-variant-numeric: tabular-nums; }
.po-table td:first-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.po-table td b { color: #f5d48a; font-size: 14px; }
.po-table tr { transition: background .15s; }
.po-table tbody tr.active { background: rgb(127 224 236 / 12%); }
.po-panel footer { display: flex; justify-content: flex-end; gap: 10px; }

@keyframes po-fade { from { opacity: 0; } }
@keyframes po-slide { from { opacity: 0; transform: translateX(24px); } }
@keyframes po-draw { to { stroke-dashoffset: 0; } }
@keyframes po-appear { to { opacity: 1; } }
@keyframes po-spin { to { transform: rotate(360deg); } }

@media (max-width: 760px) {
  .po-preview { padding: 0; }
  .po-preview-frame { grid-template-columns: minmax(0, 1fr); height: 100dvh; }
  .po-constellation { display: none; }
  .po-panel { border-radius: 0; padding: 18px 16px 16px; }
  .po-corner { display: none; }
}
@media (prefers-reduced-motion: reduce) {
  .po-preview, .po-panel, .po-orbit { animation: none; }
  .po-line { animation: none; stroke-dashoffset: 0; }
  .po-dot, .po-label, .po-detail { animation: none; opacity: 1; }
}
</style>
