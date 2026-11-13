<script setup lang="ts">
import AssistantComposer from './AssistantComposer.vue';
import { useSunshineAssistant } from './useSunshineAssistant';

// Entry at the top right of every management page; the input box grows out of it.
const { mode, toggle } = useSunshineAssistant();
</script>

<template>
  <div class="sa-launcher">
    <button class="sa-pill" type="button" :class="{ active: mode !== 'closed' }" :aria-expanded="mode !== 'closed'" aria-haspopup="dialog" @click="toggle">
      <img src="/sunshine-fern-assistant.webp" alt="" draggable="false" />
      <span>问问阳光小助手</span>
    </button>
    <Transition name="sa-rise">
      <div v-if="mode === 'composer'" class="sa-float" role="dialog" aria-label="问问阳光小助手">
        <AssistantComposer floating />
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.sa-launcher { position: relative; flex: none; }
.sa-launcher .sa-pill {
  position: relative;
  isolation: isolate;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 40px;
  padding: 3px 16px 3px 5px;
  color: #f4f1ff;
  border: 1px solid rgb(176 150 255 / 38%);
  border-radius: 999px;
  background: linear-gradient(135deg, rgb(108 92 255 / 22%), rgb(255 160 80 / 14%));
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 12%), 0 0 0 0 rgb(139 108 255 / 0%);
  font: inherit;
  font-size: 14px;
  font-weight: 700;
  white-space: nowrap;
  cursor: pointer;
  animation: sa-pill-breathe 4.8s ease-in-out infinite;
  transition: transform .2s ease, border-color .2s;
}
.sa-pill:hover { border-color: rgb(206 188 255 / 70%); transform: translateY(-1px); }
.sa-pill.active { border-color: rgb(255 190 120 / 70%); }
.sa-pill img { width: 32px; height: 32px; object-fit: contain; filter: drop-shadow(0 2px 6px rgb(255 196 70 / 45%)); }
@keyframes sa-pill-breathe {
  0%, 100% { box-shadow: inset 0 1px 0 rgb(255 255 255 / 12%), 0 0 10px rgb(139 108 255 / 18%); }
  50% { box-shadow: inset 0 1px 0 rgb(255 255 255 / 12%), 0 0 22px rgb(139 108 255 / 42%), 0 0 34px rgb(255 168 90 / 16%); }
}
/* The box opens under the button, aligned to its right edge. */
.sa-float { position: absolute; z-index: 40; top: calc(100% + 14px); right: 0; width: min(560px, calc(100vw - 48px)); transform-origin: top right; }
/* Grows out of the button: starts as a pill-sized window and unfolds while the blur clears. */
.sa-rise-enter-active { transition: clip-path .6s cubic-bezier(.2, .8, .2, 1), opacity .45s ease, transform .6s cubic-bezier(.2, .8, .2, 1), filter .6s ease; }
.sa-rise-leave-active { transition: opacity .25s ease, transform .25s ease, filter .25s ease; }
.sa-rise-enter-from { clip-path: inset(0 0 calc(100% - 44px) calc(100% - 190px) round 22px); opacity: 0; transform: translateY(-12px) scale(.96); filter: blur(6px); }
.sa-rise-enter-to { clip-path: inset(-40px -40px -40px -40px round 22px); }
.sa-rise-leave-to { opacity: 0; transform: translateY(-6px) scale(.98); filter: blur(4px); }

:root:not([data-theme="dark"]) .sa-launcher .sa-pill { color: #3b2f7a; border-color: rgb(124 98 255 / 30%); background: linear-gradient(135deg, rgb(255 255 255 / 92%), rgb(240 234 255 / 88%)); }

@media (max-width: 720px) { .sa-launcher { display: none; } }
@media (prefers-reduced-motion: reduce) { .sa-pill { animation: none; } }
</style>
