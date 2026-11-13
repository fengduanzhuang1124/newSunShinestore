<script setup lang="ts">
import type { MarketModuleId } from './market-types';

// One glowing symbol per module with particles and faint guide circles; colours come from --art-a / --art-b.
defineProps<{ id: MarketModuleId }>();
const particles = [[34, 40, 1.6], [168, 30, 1.2], [150, 112, 1.8], [44, 122, 1.1], [182, 78, 1.4], [70, 22, 1], [118, 138, 1.2]];
</script>

<template>
  <svg class="market-art" viewBox="0 0 200 150" aria-hidden="true">
    <defs>
      <radialGradient :id="`halo-${id}`" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="rgb(var(--art-b))" stop-opacity=".55" />
        <stop offset="60%" stop-color="rgb(var(--art-a))" stop-opacity=".12" />
        <stop offset="100%" stop-color="rgb(var(--art-a))" stop-opacity="0" />
      </radialGradient>
      <filter :id="`bloom-${id}`" x="-40%" y="-40%" width="180%" height="180%">
        <feGaussianBlur stdDeviation="3.2" result="blur" />
        <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
      </filter>
    </defs>
    <!-- Guide circles turn slowly and glow; the dots on them make the rotation visible. -->
    <g class="art-orbits" :filter="`url(#bloom-${id})`" fill="none" stroke="rgb(var(--art-b))">
      <circle cx="100" cy="75" r="40" stroke-dasharray="3 7" />
      <circle cx="100" cy="75" r="56" stroke-dasharray="1 9" />
      <circle cx="100" cy="75" r="72" stroke-dasharray="14 10" stroke-width=".8" />
      <circle cx="156" cy="75" r="2.6" fill="rgb(var(--art-b))" stroke="none" />
      <circle cx="49" cy="124" r="2" fill="rgb(var(--art-b))" stroke="none" />
    </g>
    <circle class="art-halo" cx="100" cy="75" r="62" :fill="`url(#halo-${id})`" />
    <!-- Outer group pulses brightness (CSS filter); inner group keeps the SVG bloom, which a CSS filter would replace. -->
    <g class="art-symbol"><g :filter="`url(#bloom-${id})`" fill="none" stroke="rgb(var(--art-b))" stroke-linecap="round" stroke-linejoin="round">
      <template v-if="id === 'insights'">
        <path d="M24 86c18 0 22-30 40-30s20 40 38 40 18-52 36-52 22 34 38 34" stroke-width="5" />
        <path d="M24 98c18 0 22-18 40-18s20 26 38 26 18-34 36-34 22 22 38 22" stroke-width="1.6" stroke-opacity=".55" />
      </template>
      <template v-else-if="id === 'report'">
        <ellipse cx="100" cy="75" rx="78" ry="26" transform="rotate(-22 100 75)" stroke-width="1.8" stroke-opacity=".75" />
        <circle cx="100" cy="75" r="28" stroke-width="5" />
        <circle cx="164" cy="44" r="4.5" fill="rgb(var(--art-b))" stroke="none" />
      </template>
      <template v-else-if="id === 'trends'">
        <circle cx="100" cy="75" r="30" fill="rgb(var(--art-a) / 55%)" stroke-width="3" />
        <ellipse cx="100" cy="75" rx="76" ry="30" transform="rotate(14 100 75)" stroke-width="1.4" stroke-opacity=".7" />
        <ellipse cx="100" cy="75" rx="60" ry="46" transform="rotate(-30 100 75)" stroke-width="1" stroke-opacity=".5" />
        <circle cx="30" cy="92" r="4.5" fill="rgb(var(--art-b))" stroke="none" />
        <circle cx="166" cy="60" r="3" fill="rgb(var(--art-b))" stroke="none" />
      </template>
      <template v-else>
        <path d="M70 112c4-26 16-52 74-74-8 24-30 52-54 60l-8 16z" stroke-width="5" fill="rgb(var(--art-a) / 22%)" />
        <path d="M60 116l-14 14M76 120l-8 12" stroke-width="2" stroke-opacity=".6" />
      </template>
    </g></g>
    <g class="art-particles" fill="rgb(var(--art-b))">
      <circle v-for="([x, y, r], index) in particles" :key="index" class="art-particle" :cx="x" :cy="y" :r="r" :style="{ animationDelay: `${index * 0.45}s` }" />
    </g>
  </svg>
</template>

<style scoped>
.market-art { display: block; width: 100%; height: 100%; overflow: visible; }
.art-orbits, .art-particles, .art-halo { transform-box: view-box; transform-origin: 100px 75px; }
.art-orbits { animation: art-spin 26s linear infinite, art-orbit-glow 3.6s ease-in-out infinite; }
.art-particles { animation: art-spin 40s linear infinite reverse; }
.art-halo { animation: art-breathe 3.6s ease-in-out infinite; }
.art-symbol { animation: art-symbol 3.6s ease-in-out infinite; }
.art-particle { animation: art-twinkle 2.8s ease-in-out infinite; }
@keyframes art-spin { to { transform: rotate(360deg); } }
@keyframes art-orbit-glow { 0%, 100% { stroke-opacity: .14; opacity: .55; } 50% { stroke-opacity: .55; opacity: 1; } }
@keyframes art-breathe { 0%, 100% { opacity: .3; transform: scale(.82); } 50% { opacity: 1; transform: scale(1.12); } }
@keyframes art-symbol { 0%, 100% { opacity: .7; filter: brightness(.85); } 50% { opacity: 1; filter: brightness(1.35); } }
@keyframes art-twinkle { 0%, 100% { opacity: .15; } 50% { opacity: 1; } }
@media (prefers-reduced-motion: reduce) { .art-orbits, .art-particles, .art-halo, .art-symbol, .art-particle { animation: none; } }
</style>
