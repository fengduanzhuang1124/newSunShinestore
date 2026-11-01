<script setup lang="ts">
import { computed } from 'vue';

// A small trend line over the last few periods, oldest first. Decoration next to a number, so it carries no axis.
const props = defineProps<{ values: number[]; label: string }>();
const points = computed(() => {
  const max = Math.max(...props.values, 0);
  const min = Math.min(...props.values, 0);
  const span = max - min || 1;
  const step = props.values.length > 1 ? 100 / (props.values.length - 1) : 0;
  return props.values.map((value, index) => `${(index * step).toFixed(1)},${(26 - ((value - min) / span) * 22).toFixed(1)}`).join(' ');
});
</script>

<template>
  <svg class="mk-spark" viewBox="0 0 100 28" preserveAspectRatio="none" role="img" :aria-label="`${label}：${values.join('、')}`">
    <polyline :points="points" />
  </svg>
</template>

<style scoped>
.mk-spark { display: block; width: 100%; height: 28px; overflow: visible; }
.mk-spark polyline { fill: none; stroke: var(--mk-s1); stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; vector-effect: non-scaling-stroke; }
</style>
