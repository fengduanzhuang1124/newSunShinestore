import { inject, provide, ref, watch, type InjectionKey } from 'vue';

// 阳光小助手 (REQ-015): staff paste a customer's question and get a suggested reply built from this system's prices,
// stock and expiry dates. The state lives on the management shell so the conversation survives page switches; it is
// kept for this browser session only.
export type AssistantOutcome = 'ADOPTED' | 'EDITED' | 'REJECTED' | 'HANDOFF';
export type AssistantBatch = { expiryDate: string; label: string; quantity: number };
export type AssistantMailRow = {
  productId: string; displayName: string; line: 'NORMAL' | 'EXPRESS'; stage: number | null; packCount: number; packUnit: string;
  priceCents: number | null; transitText: string; shipFrom: string; promoText: string | null;
  promoDiscountCents: number | null; outOfStock: boolean;
};
export type AssistantFacts = {
  kind: 'store' | 'mail' | 'none';
  store: { name: string; priceCents: number | null; totalQuantity: number; batches: AssistantBatch[]; recentDiscountCents: number | null } | null;
  mail: AssistantMailRow[] | null;
  candidates: { productId: string; name: string; kind: 'mail' | 'store' }[];
  answers: string[];
  notes: string[];
};
export type AssistantMessage = {
  id: number; role: 'user' | 'reply' | 'notice'; text: string;
  question?: string; replyId?: string; needsHuman?: boolean; facts?: AssistantFacts; outcome?: AssistantOutcome; pending?: boolean;
};
type AssistantReply = { replyId: string; reply: string; needsHuman: boolean; facts: AssistantFacts };
export type AssistantRequest = <T>(path: string, init?: RequestInit) => Promise<T>;
export type AssistantOptions = { request: AssistantRequest; storeId: () => string; administrator: () => boolean };
export type AssistantMode = 'closed' | 'composer' | 'panel';

const SESSION_KEY = 'sunshine_assistant_session';
const SIZE_KEY = 'sunshine_assistant_size';
export const PANEL_WIDTH = { min: 320, max: 720, initial: 400 };
// From this width the panel docks as a page column; below it opens as a drawer.
export const DOCK_QUERY = '(min-width: 1360px)';
// Docked, the page keeps at least 860px beside the icon rail, grid gaps, padding and the outer frame (184px together).
const DOCKED_PAGE_RESERVE = 1044;
export const INPUT_HEIGHT = { min: 72, max: 320, initial: 96 };
export const QUICK_QUESTIONS = ['可瑞康山羊奶1段多少钱？', '爱他美铂金3段顺丰几天到？', '这款鱼油还有货吗？', '日期新吗？'];
const INTERRUPTED = '上次查询没有完成，请重新发送。';

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

// A reply still waiting when the page was reloaded will never arrive.
function restoreMessages(saved: AssistantMessage[] | undefined) {
  if (!Array.isArray(saved)) return [];
  return saved.map((message) => (message.pending ? { id: message.id, role: 'notice' as const, text: INTERRUPTED } : message));
}

export function createSunshineAssistant(options: AssistantOptions) {
  const saved = readJson<{ messages: AssistantMessage[]; open: boolean }>(() => sessionStorage, SESSION_KEY);
  const size = readJson<{ width: number; inputHeight: number }>(() => localStorage, SIZE_KEY);
  const messages = ref<AssistantMessage[]>(restoreMessages(saved?.messages));
  const settingsOpen = ref(false);
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
  function storePath(path: string) {
    return `/assistant/${path}?storeId=${encodeURIComponent(options.storeId())}`;
  }
  async function ask(question: string) {
    const id = nextId++;
    messages.value.push({ id, role: 'reply', text: '', question, pending: true });
    let next: AssistantMessage;
    try {
      const result = await options.request<AssistantReply>(storePath('replies'), { method: 'POST', body: JSON.stringify({ question }) });
      next = { id, role: 'reply', text: result.reply, question, replyId: result.replyId, needsHuman: result.needsHuman, facts: result.facts };
    } catch (reason) {
      next = { id, role: 'notice', text: reason instanceof Error ? reason.message : '查询失败，请稍后再试' };
    }
    // The conversation may have been cleared while waiting.
    const index = messages.value.findIndex((message) => message.id === id);
    if (index >= 0) messages.value[index] = next;
  }
  function send(from: DOMRect | null = null, question = draft.value) {
    const text = question.trim();
    if (!text) return;
    messages.value.push({ id: nextId++, role: 'user', text });
    if (question === draft.value) draft.value = '';
    launchRect.value = mode.value === 'composer' ? from : null;
    mode.value = 'panel';
    settingsOpen.value = false;
    void ask(text);
  }
  async function feedback(message: AssistantMessage, outcome: AssistantOutcome, editedReply?: string) {
    if (!message.replyId) return;
    await options.request(storePath(`replies/${message.replyId}/feedback`), { method: 'POST', body: JSON.stringify({ outcome, editedReply }) });
    const target = messages.value.find((item) => item.id === message.id);
    if (target) {
      target.outcome = outcome;
      if (outcome === 'EDITED' && editedReply) target.text = editedReply;
    }
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

  return {
    mode, messages, draft, docked, width, inputHeight, launchRect, settingsOpen, administrator: options.administrator, request: options.request, storePath,
    toggle, openPanel, close, send, feedback, newConversation, setWidth, setInputHeight,
  };
}

export type SunshineAssistant = ReturnType<typeof createSunshineAssistant>;
const ASSISTANT_KEY: InjectionKey<SunshineAssistant> = Symbol('sunshine-assistant');
export function provideSunshineAssistant(assistant: SunshineAssistant) { provide(ASSISTANT_KEY, assistant); }
export function useSunshineAssistant() {
  const assistant = inject(ASSISTANT_KEY);
  if (!assistant) throw new Error('阳光小助手未初始化');
  return assistant;
}
