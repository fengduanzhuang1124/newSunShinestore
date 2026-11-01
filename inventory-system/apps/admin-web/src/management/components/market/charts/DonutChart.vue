<script setup lang="ts">
import { computed, ref } from 'vue';

// Share of a whole. Each slice keeps its own colour (passed in), the legend names every slice with its value, and
// hovering a slice or a legend row shows that slice in the middle.
export type DonutRow = { key: string; label: string; share: number; value: string; note?: string; color: string };
const props = defineProps<{ rows: DonutRow[]; total: string; totalLabel: string }>();

const radius = 64;
const circumference = 2 * Math.PI * radius;
const gap = 2;
const slices = computed(() => {
  const sum = props.rows.reduce((total, row) => total + row.share, 0) || 1;
  let offset = 0;
  return props.rows.map((row) => {
    const length = (row.share / sum) * circumference;
    const slice = { ...row, dash: `${Math.max(0, length - gap).toFixed(2)} ${circumference.toFixed(2)}`, offset: (-offset).toFixed(2) };
    offset += length;
    return slice;
  });
});
const active = ref<string | null>(null);
const focused = computed(() => props.rows.find((row) => row.key === active.value) ?? null);
</script>

<template>
  <div class="mk-donut">
    <svg viewBox="0 0 160 160" role="img" :aria-label="rows.map((row) => `${row.label} ${row.share}%`).join('，')">
      <g transform="rotate(-90 80 80)">
        <circle cx="80" cy="80" :r="radius" class="track" />
        <circle v-for="slice in slices" :key="slice.key" cx="80" cy="80" :r="radius" class="slice" :class="{ dim: active && active !== slice.key }"
                :style="{ stroke: slice.color, '--i': slices.indexOf(slice) }" :stroke-dasharray="slice.dash" :stroke-dashoffset="slice.offset"
                @pointerenter="active = slice.key" @pointerleave="active = null" />
      </g>
      <text x="80" y="76" text-anchor="middle" class="center-label">{{ focused ? focused.label : totalLabel }}</text>
      <text x="80" y="96" text-anchor="middle" class="center-value">{{ focused ? `${focused.share}%` : total }}</text>
    </svg>
    <ul class="legend">
      <li v-for="row in rows" :key="row.key" :class="{ dim: active && active !== row.key }" @pointerenter="active = row.key" @pointerleave="active = null">
        <i :style="{ background: row.color }"></i>
        <span>{{ row.label }}</span>
        <b>{{ row.share }}%</b>
        <small>{{ row.value }}<template v-if="row.note"> · {{ row.note }}</template></small>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.mk-donut { display: grid; grid-template-columns: minmax(150px, 200px) minmax(0, 1fr); align-items: center; gap: 18px; }
.mk-donut svg { width: 100%; max-width: 200px; }
.track { fill: none; stroke: var(--mk-line); stroke-width: 22; opacity: .4; }
.slice { fill: none; stroke-width: 22; transition: opacity .15s; cursor: pointer; animation: donut-in .7s ease backwards; animation-delay: calc(200ms + var(--i) * 140ms); }
@keyframes donut-in { from { opacity: 0; } }
@media (prefers-reduced-motion: reduce) { .slice { animation: none; } }
.slice.dim, .legend li.dim { opacity: .35; }
.center-label { fill: var(--mk-muted); font-size: 11px; }
.center-value { fill: var(--mk-ink); font-size: 18px; font-weight: 800; font-variant-numeric: tabular-nums; }
.legend { display: grid; gap: 8px; margin: 0; padding: 0; list-style: none; }
.legend li { display: grid; grid-template-columns: 10px minmax(0, 1fr) auto; align-items: center; column-gap: 8px; font-size: 13px; transition: opacity .15s; }
.legend i { width: 10px; height: 10px; border-radius: 3px; }
.legend span { overflow: hidden; color: var(--mk-ink); text-overflow: ellipsis; white-space: nowrap; }
.legend b { color: var(--mk-ink); font-variant-numeric: tabular-nums; }
.legend small { grid-column: 2 / -1; color: var(--mk-muted); font-size: 11px; font-variant-numeric: tabular-nums; }
@media (max-width: 560px) { .mk-donut { grid-template-columns: minmax(0, 1fr); justify-items: center; } .legend { width: 100%; } }
</style>
