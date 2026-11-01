import { inject, provide, ref, watch, type InjectionKey } from 'vue';

// 阳光小助手 (REQ-015): staff paste a customer's question and get a suggested reply. The state lives on the management
// shell so the conversation survives page switches; it is kept for this browser session only.
export type AssistantMessage = { id: number; role: 'user' | 'notice'; text: string };
export type AssistantMode = 'closed' | 'composer' | 'panel';

const SESSION_KEY = 'sunshine_assistant_session';
const SIZE_KEY = 'sunshine_assistant_size';
export const PANEL_WIDTH = { min: 320, max: 720, initial: 400 };
// From this width the panel docks as a page column; below it opens as a drawer.
export const DOCK_QUERY = '(min-width: 1360px)';
// Docked, the page keeps at least 860px beside the icon rail, grid gaps, padding and the outer frame (184px together).
const DOCKED_PAGE_RESERVE = 1044;
export const INPUT_HEIGHT = { min: 72, max: 320, initial: 96 };
// Stage 1 has no Q&A library yet, so nothing is answered on its behalf.
export const PENDING_REPLY = '问答库整理中，暂未接入。接入后这里会给出建议回复，可直接复制发给客户。';
export const QUICK_QUESTIONS = ['这款还有货吗？', '这个多少钱？会员价多少？', '日期新吗？什么时候到期？', '今天几点关门？'];

function readJson<T>(storage: () => Storage, key: string): T | null {
  try {
    const raw = storage().getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}
function writeJson(storage: () => Storage, key: string, value: unknown) {
  try { storage().setItem(key, JSON.stringify(value)); } catch { /* private window or blocked storage: keep in memory only */ }
}
const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), Math.max(min, max));

export function createSunshineAssistant() {
  const saved = readJson<{ messages: AssistantMessage[]; open: boolean }>(() => sessionStorage, SESSION_KEY);
  const size = readJson<{ width: number; inputHeight: number }>(() => localStorage, SIZE_KEY);
  const messages = ref<AssistantMessage[]>(Array.isArray(saved?.messages) ? saved.messages : []);
  const mode = ref<AssistantMode>(saved?.open && messages.value.length ? 'panel' : 'closed');
  const draft = ref('');
  const width = ref(clamp(Number(size?.width) || PANEL_WIDTH.initial, PANEL_WIDTH.min, PANEL_WIDTH.max));
  const inputHeight = ref(clamp(Number(size?.inputHeight) || INPUT_HEIGHT.initial, INPUT_HEIGHT.min, INPUT_HEIGHT.max));
  // True from the moment the panel opens until its closing animation ends; the page keeps its third column meanwhile.
  const docked = ref(mode.value === 'panel');
  // Where the floating input box was when the question was sent; the panel's input glides in from there.
  const launchRect = ref<DOMRect | null>(null);
  let nextId = messages.value.reduce((max, message) => Math.max(max, message.id), 0) + 1;

  // Opening again goes straight back to an existing conversation.
  function toggle() {
    if (mode.value !== 'closed') mode.value = 'closed';
    else mode.value = messages.value.length ? 'panel' : 'composer';
  }
  function openPanel() { mode.value = 'panel'; }
  function close() { mode.value = 'closed'; }
  function send(from: DOMRect | null = null) {
    const text = draft.value.trim();
    if (!text) return;
    messages.value.push({ id: nextId++, role: 'user', text }, { id: nextId++, role: 'notice', text: PENDING_REPLY });
    draft.value = '';
    launchRect.value = mode.value === 'composer' ? from : null;
    mode.value = 'panel';
  }
  function newConversation() {
    messages.value = [];
    draft.value = '';
  }
  // Docked, the page beside the panel keeps its minimum width; as a drawer it takes at most half the window.
  function setWidth(value: number) {
    const room = window.matchMedia?.(DOCK_QUERY).matches ? window.innerWidth - DOCKED_PAGE_RESERVE : window.innerWidth / 2;
    width.value = Math.round(clamp(value, PANEL_WIDTH.min, Math.min(PANEL_WIDTH.max, room)));
  }
  function setInputHeight(value: number) { inputHeight.value = Math.round(clamp(value, INPUT_HEIGHT.min, INPUT_HEIGHT.max)); }

  watch([messages, mode], () => writeJson(() => sessionStorage, SESSION_KEY, { messages: messages.value, open: mode.value === 'panel' }), { deep: true });
  watch([width, inputHeight], () => writeJson(() => localStorage, SIZE_KEY, { width: width.value, inputHeight: inputHeight.value }));

  return { mode, messages, draft, docked, width, inputHeight, launchRect, toggle, openPanel, close, send, newConversation, setWidth, setInputHeight };
}

export type SunshineAssistant = ReturnType<typeof createSunshineAssistant>;
const ASSISTANT_KEY: InjectionKey<SunshineAssistant> = Symbol('sunshine-assistant');
export function provideSunshineAssistant(assistant: SunshineAssistant) { provide(ASSISTANT_KEY, assistant); }
export function useSunshineAssistant() {
  const assistant = inject(ASSISTANT_KEY);
  if (!assistant) throw new Error('阳光小助手未初始化');
  return assistant;
}
