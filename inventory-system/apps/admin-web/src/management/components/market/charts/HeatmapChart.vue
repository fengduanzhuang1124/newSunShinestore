<script setup lang="ts">
import { computed, ref } from 'vue';
import { WEEKDAYS } from '../market-types';

// Orders by weekday and hour: one hue, darker for busier. Hover a cell for its count; the busiest slot is outlined.
const props = defineProps<{ hours: number[]; cells: number[][]; peak: { weekday: number; hour: number; orders: number } | null }>();
const values = computed(() => props.cells.flat().filter((value) => value > 0));
const max = computed(() => Math.max(1, ...values.value));
const min = computed(() => Math.min(max.value, ...values.value));
// Spread the busiest and quietest slots over the whole scale so differences show; empty slots stay blank.
const alpha = (value: number) => (value ? 0.1 + ((value - min.value) / (max.value - min.value || 1)) * 0.9 : 0);
const hover = ref<{ weekday: number; hour: number; orders: number } | null>(null);
</script>

<template>
  <div class="mk-heat">
    <div class="grid" :style="{ gridTemplateColumns: `40px repeat(${hours.length}, minmax(0, 1fr))` }" role="table" aria-label="星期与小时的订单数">
      <span></span>
      <span v-for="hour in hours" :key="`h${hour}`" class="axis">{{ hour }}</span>
      <template v-for="(row, weekday) in cells" :key="weekday">
        <span class="axis day">{{ WEEKDAYS[weekday] }}</span>
        <span v-for="(orders, index) in row" :key="index" class="cell" role="cell"
              :class="{ peak: peak && peak.weekday === weekday && peak.hour === hours[index] }"
              :style="{ '--a': alpha(orders), '--w': weekday + index * 0.15 }" :aria-label="`${WEEKDAYS[weekday]} ${hours[index]} 点：${orders} 单`"
              @pointerenter="hover = { weekday, hour: hours[index], orders }" @pointerleave="hover = null"></span>
      </template>
    </div>
    <p class="readout">{{ hover ? `${WEEKDAYS[hover.weekday]} ${hover.hour}:00–${hover.hour + 1}:00 · ${hover.orders} 单` : '鼠标移到格子上查看订单数；颜色越深订单越多' }}</p>
  </div>
</template>

<style scoped>
.mk-heat { display: grid; gap: 8px; min-width: 0; }
.grid { display: grid; gap: 3px; }
.axis { color: var(--mk-muted); font-size: 11px; text-align: center; font-variant-numeric: tabular-nums; }
.axis.day { align-self: center; text-align: left; }
/* Cells fade in row by row. */
.cell { animation: heat-in .6s ease both; animation-delay: calc(300ms + var(--w) * 120ms); }
@keyframes heat-in { from { opacity: 0; transform: scale(.6); } }
@media (prefers-reduced-motion: reduce) { .cell { animation: none; } }
.cell { aspect-ratio: 1.6; min-height: 18px; border-radius: 4px; background: color-mix(in srgb, var(--mk-s1) calc(var(--a) * 100%), var(--mk-card)); cursor: default; }
.cell.peak { outline: 2px solid var(--mk-ink); outline-offset: -2px; }
.cell:hover { outline: 2px solid var(--mk-muted); outline-offset: -2px; }
.readout { margin: 0; color: var(--mk-muted); font-size: 12px; font-variant-numeric: tabular-nums; }
</style>
