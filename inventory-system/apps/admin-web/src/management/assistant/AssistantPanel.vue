<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import AssistantComposer from './AssistantComposer.vue';
import AssistantFacts from './AssistantFacts.vue';
import AssistantSettings from './AssistantSettings.vue';
import { DOCK_QUERY, INPUT_HEIGHT, PANEL_WIDTH, QUICK_QUESTIONS, useSunshineAssistant, type AssistantMessage, type AssistantOutcome, type AssistantPick } from './useSunshineAssistant';

// The full-height question column on the right. Wide screens give it its own grid column so the page narrows
// beside it; narrower screens show it as a drawer over a backdrop.
const STEP = 16;
const assistant = useSunshineAssistant();
const { mode, messages, draft, width, inputHeight, docked, settingsOpen, administrator, close, newConversation, setWidth, setInputHeight } = assistant;
const OUTCOME_LABEL: Record<AssistantOutcome, string> = { ADOPTED: '已复制采用', EDITED: '已修改采用', REJECTED: '未采用', HANDOFF: '已转人工' };
const editingId = ref<number | null>(null);
const editText = ref('');
const actionError = ref('');
const thread = ref<HTMLElement | null>(null);
const composer = ref<InstanceType<typeof AssistantComposer> | null>(null);
const resizing = ref(false);
const ghost = ref<{ text: string; left: number; top: number; width: number; height: number } | null>(null);
const ghostEl = ref<HTMLElement | null>(null);

async function scrollToEnd() {
  await nextTick();
  thread.value?.scrollTo?.({ top: thread.value.scrollHeight, behavior: 'smooth' });
}

// The question just sent glides from the floating box to the panel's input; the drawer's own slide stands in on
// narrow screens.
async function glideFromLaunch() {
  const from = assistant.launchRect.value;
  assistant.launchRect.value = null;
  const target = composer.value?.root;
  if (!from || !target || !window.matchMedia?.(DOCK_QUERY).matches || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const to = target.getBoundingClientRect();
  const text = [...messages.value].reverse().find((message) => message.role === 'user')?.text ?? '';
  ghost.value = { text, left: from.left, top: from.top, width: from.width, height: from.height };
  await nextTick();
  if (!ghostEl.value?.animate) { ghost.value = null; return; }
  const animation = ghostEl.value.animate([
    { left: `${from.left}px`, top: `${from.top}px`, width: `${from.width}px`, height: `${from.height}px`, opacity: 1 },
    { left: `${to.left}px`, top: `${to.top}px`, width: `${to.width}px`, height: `${to.height}px`, opacity: .2 },
  ], { duration: 700, easing: 'cubic-bezier(.22, .8, .24, 1)', fill: 'forwards' });
  await animation.finished.catch(() => undefined);
  ghost.value = null;
}

let drag: { kind: 'width' | 'height'; start: number; base: number } | null = null;
function startDrag(kind: 'width' | 'height', event: PointerEvent) {
  if (event.button !== 0) return;
  drag = { kind, start: kind === 'width' ? event.clientX : event.clientY, base: kind === 'width' ? width.value : inputHeight.value };
  (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
  resizing.value = true;
}
// Both handles sit on the far side of what they resize, so moving left widens and moving up heightens.
function moveDrag(event: PointerEvent) {
  if (!drag) return;
  if (drag.kind === 'width') setWidth(drag.base + drag.start - event.clientX);
  else setInputHeight(drag.base + drag.start - event.clientY);
}
function endDrag() {
  drag = null;
  resizing.value = false;
}
function nudgeWidth(event: KeyboardEvent) {
  if (event.key === 'ArrowLeft') setWidth(width.value + STEP);
  else if (event.key === 'ArrowRight') setWidth(width.value - STEP);
  else return;
  event.preventDefault();
}
function nudgeHeight(event: KeyboardEvent) {
  if (event.key === 'ArrowUp') setInputHeight(inputHeight.value + STEP);
  else if (event.key === 'ArrowDown') setInputHeight(inputHeight.value - STEP);
  else return;
  event.preventDefault();
}
// The docked content is already in its final place while the column widens, so the glide can start at once.
function onEnter() {
  void scrollToEnd();
  void glideFromLaunch();
}
// Copying is how staff use a reply, so it also records the reply as adopted.
async function copyReply(message: AssistantMessage, text = message.text, outcome: AssistantOutcome = 'ADOPTED') {
  actionError.value = '';
  try {
    await navigator.clipboard?.writeText(text);
    await assistant.feedback(message, outcome, outcome === 'EDITED' ? text : undefined);
  } catch (reason) {
    actionError.value = reason instanceof Error ? reason.message : '操作失败';
  }
}
function startEdit(message: AssistantMessage) {
  editingId.value = message.id;
  editText.value = message.text;
}
async function saveEdit(message: AssistantMessage) {
  const text = editText.value.trim();
  if (!text) return;
  await copyReply(message, text, 'EDITED');
  editingId.value = null;
}
async function handOff(message: AssistantMessage) {
  actionError.value = '';
  try { await assistant.feedback(message, 'HANDOFF'); } catch (reason) { actionError.value = reason instanceof Error ? reason.message : '操作失败'; }
}
function askAgain(message: AssistantMessage, pick: AssistantPick | null = null) {
  if (message.question) assistant.send(null, message.question, pick);
}
function onPanelKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && !event.defaultPrevented) close();
}

watch(() => messages.value.length, scrollToEnd);
watch(mode, (value) => {
  if (value !== 'panel') return;
  docked.value = true;
  setWidth(width.value);
});
// A window that shrinks also shrinks the panel, so the page keeps its room.
const fitWidth = () => setWidth(width.value);
onMounted(() => {
  window.addEventListener('resize', fitWidth);
  fitWidth();
  if (mode.value === 'panel') void scrollToEnd();
});
onBeforeUnmount(() => window.removeEventListener('resize', fitWidth));
</script>

<template>
  <Transition name="sa-panel" @enter="onEnter" @after-leave="docked = false">
    <aside v-if="mode === 'panel'" class="sa-panel" :class="{ resizing }" :style="{ '--sa-width': `${width}px` }" aria-label="阳光小助手问答栏" @keydown="onPanelKeydown">
      <div class="sa-inner">
        <div class="sa-resize-x" role="separator" aria-orientation="vertical" aria-label="拖动调整问答栏宽度" tabindex="0"
             :aria-valuenow="width" :aria-valuemin="PANEL_WIDTH.min" :aria-valuemax="PANEL_WIDTH.max"
             @pointerdown="startDrag('width', $event)" @pointermove="moveDrag" @pointerup="endDrag" @pointercancel="endDrag" @keydown="nudgeWidth"></div>
        <header class="sa-head">
          <img src="/sunshine-fern-assistant.webp" alt="" draggable="false" />
          <span><strong>阳光小助手</strong><small>{{ settingsOpen ? '设置' : '粘贴客户问题，获得建议回复' }}</small></span>
          <button v-if="administrator()" type="button" :aria-label="settingsOpen ? '返回问答' : '小助手设置'" :title="settingsOpen ? '返回问答' : '设置'" :aria-pressed="settingsOpen" @click="settingsOpen = !settingsOpen">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" /></svg>
          </button>
          <button type="button" aria-label="新对话" title="新对话" :disabled="!messages.length" @click="newConversation">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
          </button>
          <button type="button" aria-label="收起问答栏" title="收起" @click="close">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
          </button>
        </header>

        <AssistantSettings v-if="settingsOpen" />
        <div v-else ref="thread" class="sa-thread" aria-live="polite">
          <div v-if="!messages.length" class="sa-empty">
            <img src="/sunshine-fern-assistant.webp" alt="" draggable="false" />
            <p>你好！把客户的问题粘贴进来</p>
            <small>价格、库存和日期实时查询本系统；邮寄奶粉按普通线、顺丰线回答</small>
            <div class="sa-chips">
              <button v-for="question in QUICK_QUESTIONS" :key="question" type="button" @click="draft = question">{{ question }}</button>
            </div>
          </div>
          <template v-for="message in messages" :key="message.id">
            <p v-if="message.role === 'user'" class="sa-ask">{{ message.text }}</p>
            <div v-else-if="message.role === 'reply' && message.pending" class="sa-reply"><p class="sa-typing"><i aria-hidden="true">…</i>正在查询系统</p></div>
            <div v-else-if="message.role === 'reply'" class="sa-reply">
              <div class="sa-answer" :class="{ human: message.needsHuman }">
                <b v-if="message.needsHuman">需人工确认</b>
                <textarea v-if="editingId === message.id" v-model="editText" aria-label="修改回复" @keydown.esc.stop="editingId = null"></textarea>
                <p v-else>{{ message.text }}</p>
              </div>
              <AssistantFacts v-if="message.facts" :facts="message.facts" @pick="askAgain(message, $event)" />
              <div class="sa-actions">
                <template v-if="editingId === message.id">
                  <button type="button" class="primary" @click="saveEdit(message)">保存并复制</button>
                  <button type="button" @click="editingId = null">取消</button>
                </template>
                <template v-else>
                  <button type="button" class="primary" @click="copyReply(message)">复制回复</button>
                  <button type="button" @click="startEdit(message)">修改后采用</button>
                  <button type="button" @click="askAgain(message)">重新生成</button>
                  <button type="button" :disabled="message.outcome === 'HANDOFF'" @click="handOff(message)">转人工</button>
                </template>
                <span v-if="message.outcome" class="sa-outcome">{{ OUTCOME_LABEL[message.outcome] }}</span>
              </div>
            </div>
            <div v-else class="sa-reply"><p><i aria-hidden="true">!</i>{{ message.text }}</p></div>
          </template>
          <p v-if="actionError" class="sa-action-error" role="alert">{{ actionError }}</p>
        </div>

        <footer v-show="!settingsOpen" class="sa-foot">
          <div class="sa-resize-y" role="separator" aria-orientation="horizontal" aria-label="拖动调整输入框高度" tabindex="0"
               :aria-valuenow="inputHeight" :aria-valuemin="INPUT_HEIGHT.min" :aria-valuemax="INPUT_HEIGHT.max"
               @pointerdown="startDrag('height', $event)" @pointermove="moveDrag" @pointerup="endDrag" @pointercancel="endDrag" @keydown="nudgeHeight"><i></i></div>
          <AssistantComposer ref="composer" :class="{ 'sa-waiting': ghost }" :height="inputHeight" />
          <small>Enter 发送 · Shift+Enter 换行 · 拖动边缘调整大小</small>
        </footer>
      </div>
    </aside>
  </Transition>
  <Transition name="sa-fade"><div v-if="mode === 'panel'" class="sa-backdrop" aria-hidden="true" @click="close"></div></Transition>
  <Teleport to="body">
    <div v-if="ghost" ref="ghostEl" class="sa-ghost" aria-hidden="true"><span>{{ ghost.text }}</span></div>
  </Teleport>
</template>

<style scoped>
.sa-panel {
  --sa-bg: #0c0e1d;
  --sa-panel: rgb(19 21 40 / 96%);
  --sa-line: rgb(255 255 255 / 9%);
  --sa-ink: #eef0ff;
  --sa-muted: #8c91b0;
  position: fixed;
  z-index: 60;
  top: 0;
  right: 0;
  bottom: 0;
  width: min(var(--sa-width), 100vw);
  overflow: hidden;
}
.sa-inner {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  width: min(var(--sa-width), 100vw);
  border: 1px solid var(--sa-line);
  border-radius: 18px 0 0 18px;
  background:
    radial-gradient(120% 60% at 50% 115%, rgb(52 64 170 / 38%), transparent 70%),
    linear-gradient(180deg, var(--sa-panel), var(--sa-bg));
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 5%), -18px 0 50px rgb(0 0 0 / 30%);
  color: var(--sa-ink);
}
@media (min-width: 1360px) {
  /* Docked: a grid column beside the page. The content is pinned right and revealed as the column widens. */
  .sa-panel { position: relative; z-index: 1; top: auto; right: auto; bottom: auto; grid-column: 3; grid-row: 1 / -1; width: var(--sa-width); height: 100%; min-height: 0; border-radius: 18px; }
  .sa-inner { width: var(--sa-width); border-radius: 18px; box-shadow: inset 0 1px 0 rgb(255 255 255 / 5%), 0 18px 42px rgb(0 0 0 / 22%); }
  .sa-backdrop { display: none; }
}
.sa-panel-enter-active, .sa-panel-leave-active { transition: width .55s cubic-bezier(.22, .8, .24, 1), transform .5s cubic-bezier(.22, .8, .24, 1), opacity .4s ease; }
.sa-panel-enter-from, .sa-panel-leave-to { transform: translateX(100%); opacity: 0; }
@media (min-width: 1360px) {
  .sa-panel-enter-from, .sa-panel-leave-to { width: 0; transform: none; opacity: .4; }
}
.sa-panel.resizing, .sa-panel.resizing * { transition: none !important; user-select: none; }

.sa-resize-x { position: absolute; z-index: 3; top: 0; bottom: 0; left: -4px; width: 10px; cursor: ew-resize; touch-action: none; }
.sa-resize-x::after { position: absolute; top: 50%; left: 4px; width: 3px; height: 44px; margin-top: -22px; border-radius: 3px; content: ""; background: rgb(255 255 255 / 0%); transition: background .2s; }
.sa-resize-x:hover::after, .sa-resize-x:focus-visible::after, .resizing .sa-resize-x::after { background: linear-gradient(#6c5cff, #ffb35c); }
.sa-resize-x:focus-visible, .sa-resize-y:focus-visible { outline: none; }

.sa-head { display: grid; grid-template-columns: 34px minmax(0, 1fr) auto auto auto; align-items: center; gap: 10px; padding: 14px 14px 12px 16px; border-bottom: 1px solid var(--sa-line); }
.sa-head img { width: 34px; height: 34px; object-fit: contain; filter: drop-shadow(0 2px 6px rgb(255 196 70 / 40%)); }
.sa-head span { display: grid; min-width: 0; }
.sa-head strong { font-size: 16px; }
.sa-head small { overflow: hidden; color: var(--sa-muted); font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
.sa-panel .sa-head button { display: grid; width: 34px; height: 34px; min-height: 0; place-items: center; padding: 0; color: var(--sa-muted); border: 0; border-radius: 50%; background: transparent; box-shadow: none; cursor: pointer; transition: background .2s, color .2s; }
.sa-head button:not(:disabled):hover { color: var(--sa-ink); background: rgb(255 255 255 / 8%); }
.sa-head button:disabled { opacity: .35; cursor: default; }
.sa-head svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; }

.sa-thread { display: flex; flex-direction: column; gap: 14px; min-height: 0; padding: 18px 16px; overflow-y: auto; overscroll-behavior: contain; }
.sa-empty { display: grid; justify-items: center; gap: 8px; margin: auto 0; text-align: center; }
.sa-empty img { width: 56px; height: 56px; object-fit: contain; animation: sa-float 4s ease-in-out infinite; }
.sa-empty p { margin: 6px 0 0; font-size: 19px; font-weight: 300; }
.sa-empty small { max-width: 260px; color: var(--sa-muted); font-size: 12px; line-height: 1.6; }
.sa-chips { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; margin-top: 14px; }
.sa-panel .sa-chips button { min-height: 0; padding: 8px 13px; color: var(--sa-ink); border: 1px solid var(--sa-line); border-radius: 999px; background: rgb(255 255 255 / 5%); box-shadow: none; font: inherit; font-size: 13px; cursor: pointer; transition: background .2s, border-color .2s; }
.sa-chips button:hover { border-color: rgb(176 150 255 / 45%); background: rgb(139 108 255 / 14%); }
@keyframes sa-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }

/* The question keeps the glowing outline of the input box it came from. */
.sa-ask {
  align-self: flex-end;
  max-width: 88%;
  margin: 0;
  padding: 11px 14px;
  border: 1.5px solid transparent;
  border-radius: 14px;
  background: linear-gradient(rgb(30 30 62), rgb(30 30 62)) padding-box, linear-gradient(120deg, #ffb35c, #b56cff 45%, #6c5cff) border-box;
  box-shadow: 0 0 18px rgb(139 108 255 / 30%);
  font-size: 14px;
  line-height: 1.6;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  animation: sa-in .5s ease backwards;
}
.sa-reply { display: grid; gap: 8px; animation: sa-in .5s ease .25s backwards; }
.sa-reply > p { display: flex; gap: 8px; margin: 0; padding: 11px 13px; color: #c3c7e2; border: 1px dashed rgb(255 255 255 / 14%); border-radius: 12px; background: rgb(255 255 255 / 3%); font-size: 13px; line-height: 1.6; }
.sa-reply i { display: grid; flex: none; width: 18px; height: 18px; margin-top: 2px; place-items: center; color: #0c0e1d; border-radius: 50%; background: #ffb35c; font-size: 11px; font-style: normal; font-weight: 800; }
.sa-actions { display: flex; flex-wrap: wrap; gap: 6px; }
.sa-panel .sa-actions button { min-height: 0; padding: 5px 11px; color: var(--sa-muted); border: 1px solid var(--sa-line); border-radius: 999px; background: transparent; box-shadow: none; font: inherit; font-size: 12px; }
.sa-panel .sa-actions button:not(:disabled) { cursor: pointer; }
.sa-panel .sa-actions button.primary { color: var(--sa-ink); border-color: rgb(176 150 255 / 50%); background: rgb(139 108 255 / 16%); }
.sa-actions button:disabled { opacity: .55; cursor: not-allowed; }
.sa-outcome { align-self: center; color: #7fe0b0; font-size: 12px; }
.sa-answer { display: grid; gap: 6px; padding: 11px 13px; border: 1px solid rgb(176 150 255 / 28%); border-radius: 12px; background: rgb(139 108 255 / 9%); }
.sa-answer.human { border-color: rgb(255 179 92 / 55%); }
.sa-answer b { justify-self: start; padding: 1px 8px; color: #0c0e1d; border-radius: 999px; background: #ffb35c; font-size: 11px; }
.sa-answer p { margin: 0; color: var(--sa-ink); font-size: 14px; line-height: 1.7; white-space: pre-wrap; overflow-wrap: anywhere; }
.sa-panel .sa-answer textarea { width: 100%; min-height: 84px; padding: 6px 8px; color: var(--sa-ink); border: 1px solid var(--sa-line); border-radius: 8px; background: rgb(255 255 255 / 5%); box-shadow: none; font: inherit; font-size: 14px; resize: vertical; }
.sa-typing { animation: sa-breathe 1.4s ease-in-out infinite; }
.sa-action-error { margin: 0; color: #ff8a8a; font-size: 12px; }
@keyframes sa-breathe { 50% { opacity: .5; } }
@keyframes sa-in { from { opacity: 0; transform: translateY(8px); } }

.sa-foot { position: relative; display: grid; gap: 6px; padding: 6px 14px 12px; }
.sa-foot > small { color: var(--sa-muted); font-size: 11px; text-align: center; }
.sa-resize-y { display: grid; height: 12px; place-items: center; cursor: ns-resize; touch-action: none; }
.sa-resize-y i { width: 36px; height: 4px; border-radius: 4px; background: rgb(255 255 255 / 14%); transition: background .2s; }
.sa-resize-y:hover i, .sa-resize-y:focus-visible i, .resizing .sa-resize-y i { background: linear-gradient(90deg, #6c5cff, #ffb35c); }
.sa-waiting { opacity: 0; }
.sa-foot .sa-composer { transition: opacity .35s ease; }

.sa-backdrop { position: fixed; z-index: 59; inset: 0; background: rgb(4 6 14 / 48%); backdrop-filter: blur(2px); }
.sa-fade-enter-active, .sa-fade-leave-active { transition: opacity .35s ease; }
.sa-fade-enter-from, .sa-fade-leave-to { opacity: 0; }

.sa-ghost {
  position: fixed;
  z-index: 80;
  display: flex;
  padding: 16px 18px;
  overflow: hidden;
  pointer-events: none;
  color: #f1f3ff;
  border: 1.5px solid transparent;
  border-radius: 22px;
  background: linear-gradient(rgb(13 15 32 / 94%), rgb(13 15 32 / 94%)) padding-box, linear-gradient(120deg, #6c5cff, #b56cff 40%, #ffb35c) border-box;
  box-shadow: 0 0 30px rgb(139 108 255 / 40%);
  font-size: 15px;
  line-height: 1.6;
}
.sa-ghost span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

:root:not([data-theme="dark"]) .sa-panel { --sa-bg: #f3f1fb; --sa-panel: rgb(255 255 255 / 96%); --sa-line: rgb(60 50 140 / 12%); --sa-ink: #1d2340; --sa-muted: #6d7390; }
:root:not([data-theme="dark"]) .sa-inner { background: radial-gradient(120% 60% at 50% 115%, rgb(160 140 255 / 22%), transparent 70%), linear-gradient(180deg, var(--sa-panel), var(--sa-bg)); box-shadow: 0 18px 42px rgb(60 60 120 / 12%); }
:root:not([data-theme="dark"]) .sa-ask { background: linear-gradient(#fff, #fff) padding-box, linear-gradient(120deg, #ffb35c, #b56cff 45%, #6c5cff) border-box; box-shadow: 0 0 14px rgb(139 108 255 / 18%); }
:root:not([data-theme="dark"]) .sa-reply > p { color: #4d5373; border-color: rgb(60 50 140 / 18%); background: rgb(255 255 255 / 70%); }
:root:not([data-theme="dark"]) .sa-answer { background: rgb(139 108 255 / 7%); }
:root:not([data-theme="dark"]) .sa-resize-y i { background: rgb(60 50 140 / 16%); }
:root:not([data-theme="dark"]) .sa-head button:not(:disabled):hover, :root:not([data-theme="dark"]) .sa-chips button { background: rgb(108 92 255 / 7%); }
:root:not([data-theme="dark"]) .sa-ghost { color: #1d2a44; background: linear-gradient(#fff, #fff) padding-box, linear-gradient(120deg, #6c5cff, #b56cff 40%, #ffb35c) border-box; }

@media (max-width: 720px) {
  .sa-panel, .sa-inner { width: 100vw; }
  .sa-inner { border-radius: 0; }
}
@media (prefers-reduced-motion: reduce) {
  .sa-panel-enter-active, .sa-panel-leave-active, .sa-fade-enter-active, .sa-fade-leave-active { transition: none; }
  .sa-ask, .sa-reply, .sa-empty img, .sa-typing { animation: none; }
}
</style>
