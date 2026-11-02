<script setup lang="ts">
// Filters of a management page. On desktop the wrapper renders as `display: contents`,
// so the slotted filters keep their original layout. On phones (≤ 720 px) the page
// shows a one-line summary with a "筛选" button that opens the filters as a bottom
// sheet; submitting a slotted form closes it (REQ-008 M5).
import { ref } from 'vue';

defineProps<{ title: string; summary: string }>();
const open = ref(false);
</script>

<template>
  <div class="filter-sheet" :class="{ open }">
    <div class="filter-sheet-bar">
      <span>{{ summary }}</span>
      <button type="button" :aria-expanded="open" @click="open = true"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M7 12h10M10 18h4" /></svg>筛选</button>
    </div>
    <div class="filter-sheet-backdrop" aria-hidden="true" @click="open = false"></div>
    <div class="filter-sheet-panel" role="group" :aria-label="title" @submit="open = false">
      <header class="filter-sheet-header"><i aria-hidden="true"></i><h2>{{ title }}</h2><button type="button" aria-label="关闭筛选" @click="open = false"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg></button></header>
      <slot />
    </div>
  </div>
</template>

<style scoped>
.filter-sheet,
.filter-sheet-panel { display: contents; }
.filter-sheet-bar,
.filter-sheet-backdrop,
.filter-sheet-header { display: none; }

@media (max-width: 720px) {
  .filter-sheet { display: block; min-width: 0; }
  .filter-sheet-bar { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-width: 0; }
  .filter-sheet-bar > span { min-width: 0; overflow: hidden; color: var(--m-muted); font-size: 13px; line-height: 18px; text-overflow: ellipsis; white-space: nowrap; }
  .management-workspace .filter-sheet-bar > button {
    display: inline-flex;
    flex: none;
    align-items: center;
    gap: 6px;
    min-height: 36px;
    padding: 0 14px;
    color: var(--m-accent);
    border: 1px solid var(--m-line-strong);
    border-radius: 18px;
    background: var(--m-sheet);
    box-shadow: none;
    font-size: 14px;
    font-weight: 600;
  }
  .filter-sheet svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; }

  .filter-sheet-panel { display: none; }
  .filter-sheet.open .filter-sheet-backdrop { position: fixed; z-index: 64; inset: 0; display: block; background: var(--m-overlay); }
  .management-workspace .filter-sheet.open .filter-sheet-panel {
    position: fixed;
    z-index: 65;
    right: 0;
    bottom: 0;
    left: 0;
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 12px;
    max-height: calc(100dvh - 48px - env(safe-area-inset-top));
    padding: 8px max(16px, env(safe-area-inset-right)) calc(16px + env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left));
    overflow-y: auto;
    color: var(--m-ink);
    border: 1px solid var(--m-line);
    border-bottom: 0;
    border-radius: 20px 20px 0 0;
    background: var(--m-sheet);
    box-shadow: var(--m-shadow);
    animation: filter-sheet-rise .24s cubic-bezier(.22, 1, .36, 1);
  }
  .filter-sheet-header { display: grid; grid-template-columns: minmax(0, 1fr) 44px; align-items: center; }
  .filter-sheet-header > i { grid-column: 1 / -1; justify-self: center; width: 36px; height: 4px; margin-bottom: 4px; border-radius: 2px; background: var(--m-line-strong); }
  .filter-sheet-header h2 { margin: 0; color: var(--m-ink); font-size: 18px; font-weight: 600; line-height: 26px; }
  .management-workspace .filter-sheet-header > button { display: grid; width: 44px; height: 44px; min-height: 44px; place-items: center; padding: 0; color: var(--m-muted); border: 0; border-radius: 50%; background: transparent; box-shadow: none; }
  .filter-sheet-header svg { width: 22px; height: 22px; }

  /* Slotted filters: one column, full-width controls, actions at the bottom. */
  .filter-sheet-panel > :is(form, div):not(.filter-sheet-header) { display: grid; grid-template-columns: minmax(0, 1fr); gap: 12px; margin: 0; padding: 0; border: 0; background: none; box-shadow: none; }
  .filter-sheet-panel label { display: grid; gap: 6px; min-width: 0; color: var(--m-muted); font-size: 13px; }
  .filter-sheet-panel :is(input, select) { width: 100%; min-width: 0; min-height: 44px; font-size: 16px; }
  .filter-sheet-panel > :is(form, div):not(.filter-sheet-header) button { width: 100%; min-height: 44px; margin: 0; grid-column: 1 / -1; }
  .management-workspace .filter-sheet-panel > button { width: 100%; min-height: 44px; margin: 0; }
  .management-workspace .filter-sheet-panel > .period-shortcuts { display: flex; flex-wrap: wrap; gap: 8px; }
  .filter-sheet-panel > .period-shortcuts > span { width: 100%; }
  .management-workspace .filter-sheet-panel > .period-shortcuts button { width: auto; flex: 1 1 auto; min-height: 40px; grid-column: auto; }
}

@keyframes filter-sheet-rise { from { transform: translateY(100%); } }
@media (prefers-reduced-motion: reduce) { .filter-sheet-panel { animation: none !important; } }
</style>
