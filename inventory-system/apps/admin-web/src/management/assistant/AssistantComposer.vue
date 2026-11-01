<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { QUICK_QUESTIONS, useSunshineAssistant } from './useSunshineAssistant';

// The glowing input box: floating under the entry button at first, then docked at the bottom of the panel.
const props = defineProps<{ floating?: boolean; height?: number }>();
const { draft, send, close } = useSunshineAssistant();
const root = ref<HTMLElement | null>(null);
const input = ref<HTMLTextAreaElement | null>(null);
const quickOpen = ref(false);

function submit() {
  quickOpen.value = false;
  send(root.value?.getBoundingClientRect() ?? null);
}
// Enter sends, Shift+Enter starts a new line, Esc closes the floating box.
function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
    event.preventDefault();
    submit();
  } else if (event.key === 'Escape') {
    if (quickOpen.value) quickOpen.value = false;
    else if (props.floating) close();
  }
}
function pick(question: string) {
  draft.value = question;
  quickOpen.value = false;
  input.value?.focus();
}

onMounted(() => input.value?.focus());
defineExpose({ root });
</script>

<template>
  <div ref="root" class="sa-composer" :class="{ floating }">
    <div class="sa-body">
      <textarea ref="input" v-model="draft" class="sa-input" :style="height ? { height: `${height}px` } : undefined" rows="2"
                placeholder="粘贴客户的问题，例如：这款护肝片还有货吗？" aria-label="客户的问题" @keydown="onKeydown"></textarea>
      <div class="sa-bar">
        <div class="sa-quick-wrap">
          <button class="sa-quick" type="button" :aria-expanded="quickOpen" @click="quickOpen = !quickOpen">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z" /></svg>
            常用问题
          </button>
          <Transition name="sa-menu">
            <ul v-if="quickOpen" class="sa-quick-menu" :class="{ up: !floating }">
              <li v-for="question in QUICK_QUESTIONS" :key="question"><button type="button" @click="pick(question)">{{ question }}</button></li>
            </ul>
          </Transition>
        </div>
        <button class="sa-send" type="button" :disabled="!draft.trim()" aria-label="发送" @click="submit">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12 20 4l-4 16-4-7z" /></svg>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
@property --sa-angle { syntax: '<angle>'; inherits: false; initial-value: 0deg; }
.sa-composer {
  --sa-ring: conic-gradient(from var(--sa-angle), #6c5cff, #4d8dff 18%, #b56cff 38%, #ffb35c 58%, #ff8d4d 68%, #8a62ff 86%, #6c5cff);
  position: relative;
  isolation: isolate;
  padding: 1.5px;
  border-radius: 22px;
  background: var(--sa-ring);
  animation: sa-spin 10s linear infinite;
}
/* The textarea selectors outrank the management pages' global form styles. */
/* Soft halo that breathes behind the ring. */
.sa-composer::before {
  position: absolute;
  z-index: -1;
  inset: 2px;
  border-radius: inherit;
  content: "";
  background: var(--sa-ring);
  filter: blur(16px);
  opacity: .45;
  animation: sa-spin 10s linear infinite, sa-breathe 4.8s ease-in-out infinite;
}
.sa-composer.floating::before { inset: -2px; filter: blur(22px); }
@keyframes sa-spin { to { --sa-angle: 360deg; } }
@keyframes sa-breathe { 0%, 100% { opacity: .3; } 50% { opacity: .62; } }
.sa-body { display: grid; gap: 8px; padding: 14px 14px 10px; border-radius: 20.5px; background: rgb(13 15 32 / 94%); backdrop-filter: blur(18px); }
.floating .sa-body { padding: 18px 18px 12px; }
:root .sa-composer .sa-body textarea.sa-input {
  display: block;
  width: 100%;
  min-height: 48px;
  margin: 0;
  padding: 0 !important;
  resize: none;
  color: #f1f3ff !important;
  -webkit-text-fill-color: #f1f3ff !important;
  border: 0 !important;
  outline: none;
  background: transparent !important;
  box-shadow: none !important;
  font: inherit;
  font-size: 15px;
  line-height: 1.6;
}
:root .floating .sa-body textarea.sa-input { min-height: 64px; font-size: 17px; }
:root .sa-composer .sa-body textarea.sa-input::placeholder { color: #7f86a8 !important; -webkit-text-fill-color: #7f86a8 !important; }
.sa-bar { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.sa-quick-wrap { position: relative; }
.sa-composer .sa-quick {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  min-height: 34px;
  padding: 0 14px;
  color: #e9eaff;
  border: 0;
  border-radius: 999px;
  background: rgb(255 255 255 / 7%);
  box-shadow: none;
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: background .2s;
}
.sa-quick:hover, .sa-quick[aria-expanded="true"] { background: rgb(255 255 255 / 13%); }
.sa-quick svg { width: 16px; height: 16px; fill: #c9b8ff; }
.sa-quick-menu {
  position: absolute;
  z-index: 5;
  top: calc(100% + 8px);
  left: 0;
  display: grid;
  gap: 2px;
  width: max-content;
  max-width: 280px;
  margin: 0;
  padding: 6px;
  list-style: none;
  border: 1px solid rgb(255 255 255 / 12%);
  border-radius: 14px;
  background: rgb(20 22 44 / 97%);
  box-shadow: 0 18px 40px rgb(0 0 0 / 40%);
}
.sa-quick-menu.up { top: auto; bottom: calc(100% + 8px); }
.sa-quick-menu button { width: 100%; padding: 8px 10px; color: #e3e6ff; border: 0; border-radius: 9px; background: transparent; box-shadow: none; font: inherit; font-size: 13px; text-align: left; cursor: pointer; }
.sa-quick-menu button:hover { background: rgb(139 115 255 / 22%); }
.sa-composer .sa-send {
  display: grid;
  flex: none;
  width: 38px;
  height: 38px;
  min-height: 0;
  place-items: center;
  padding: 0;
  color: #a495ff;
  border: 1px solid rgb(255 255 255 / 22%);
  border-radius: 50%;
  background: rgb(255 255 255 / 4%);
  box-shadow: none;
  cursor: pointer;
  transition: color .2s, background .2s, box-shadow .2s;
}
.sa-send svg { width: 17px; height: 17px; fill: currentColor; }
.sa-send:not(:disabled):hover { color: #fff; background: linear-gradient(135deg, #6c5cff, #b56cff); box-shadow: 0 0 18px rgb(139 108 255 / 55%); }
.sa-send:disabled { opacity: .45; cursor: default; }
.sa-menu-enter-active, .sa-menu-leave-active { transition: opacity .2s ease, transform .2s ease; }
.sa-menu-enter-from, .sa-menu-leave-to { opacity: 0; transform: translateY(-4px); }

:root:not([data-theme="dark"]) .sa-body { background: rgb(255 255 255 / 94%); }
:root:not([data-theme="dark"]) .sa-composer .sa-body textarea.sa-input { color: #1d2a44 !important; -webkit-text-fill-color: #1d2a44 !important; }
:root:not([data-theme="dark"]) .sa-composer .sa-body textarea.sa-input::placeholder { color: #8a93a8 !important; -webkit-text-fill-color: #8a93a8 !important; }
:root:not([data-theme="dark"]) .sa-composer .sa-quick { color: #33395a; background: rgb(108 92 255 / 8%); }
:root:not([data-theme="dark"]) .sa-quick svg { fill: #7a5cff; }
:root:not([data-theme="dark"]) .sa-quick-menu { border-color: #e4e2f5; background: #fff; box-shadow: 0 18px 40px rgb(40 40 90 / 14%); }
:root:not([data-theme="dark"]) .sa-quick-menu button { color: #2c3352; }
:root:not([data-theme="dark"]) .sa-composer .sa-send { color: #6c5cff; border-color: #d9d5f3; background: #fff; }

@media (prefers-reduced-motion: reduce) {
  .sa-composer, .sa-composer::before { animation: none; }
}
</style>
