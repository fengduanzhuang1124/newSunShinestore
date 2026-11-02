<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { useSunshineAssistant } from './useSunshineAssistant';

// Administrator settings for 阳光小助手: mail-order milk details POS does not hold, customer wording and fixed answers.
// Prices are not edited here; they come from POS.
type MailItem = {
  productId: string; productName: string; productActive: boolean; priceCents: number | null; displayName: string;
  line: 'NORMAL' | 'EXPRESS'; stage: number | null; packCount: number; packUnit: string; transitText: string;
  shipFrom: string; promoText: string | null; promoDiscountCents: number | null; outOfStock: boolean; enabled: boolean;
};
type Alias = { id: string; term: string; keyword: string; enabled: boolean };
type Answer = { id: string; topic: string; keywords: string; reply: string; handoff: boolean; enabled: boolean };
type Tab = 'mail' | 'aliases' | 'answers';

const TABS: { id: Tab; label: string }[] = [{ id: 'mail', label: '邮寄奶粉' }, { id: 'aliases', label: '客人叫法' }, { id: 'answers', label: '固定回复' }];
const { request, storePath } = useSunshineAssistant();
const tab = ref<Tab>('mail');
const loading = ref(false);
const error = ref('');
const forbidden = ref(false);
const message = ref('');
const busy = ref('');
const mail = ref<MailItem[]>([]);
const undetected = ref(0);
const aliases = ref<Alias[]>([]);
const builtIn = ref<{ term: string; keyword: string }[]>([]);
const answers = ref<Answer[]>([]);
const newAlias = reactive({ term: '', keyword: '' });
const newAnswer = reactive({ topic: '', keywords: '', reply: '', handoff: false });

function fail(reason: unknown) {
  forbidden.value = (reason as { status?: number })?.status === 403;
  error.value = reason instanceof Error ? reason.message : '操作失败';
}

async function load() {
  loading.value = true;
  error.value = '';
  try {
    const [mailData, aliasData, answerData] = await Promise.all([
      request<{ items: MailItem[]; undetected: number }>(storePath('mail-milk')),
      request<{ items: Alias[]; builtIn: { term: string; keyword: string }[] }>(storePath('aliases')),
      request<{ items: Answer[] }>(storePath('answers')),
    ]);
    mail.value = mailData.items;
    undetected.value = mailData.undetected;
    aliases.value = aliasData.items;
    builtIn.value = aliasData.builtIn;
    answers.value = answerData.items;
  } catch (reason) { fail(reason); }
  finally { loading.value = false; }
}

async function run(key: string, action: () => Promise<unknown>, done: string) {
  busy.value = key;
  error.value = '';
  message.value = '';
  try {
    await action();
    message.value = done;
  } catch (reason) { fail(reason); }
  finally { busy.value = ''; }
}

function detect() {
  return run('detect', async () => {
    const result = await request<{ created: number }>(storePath('mail-milk/detect'), { method: 'POST' });
    await load();
    message.value = `新识别 ${result.created} 个邮寄奶粉，请逐个核对`;
  }, '');
}

function saveMail(item: MailItem) {
  const body = {
    displayName: item.displayName, line: item.line, stage: item.stage || null, packCount: Number(item.packCount), packUnit: item.packUnit,
    transitText: item.transitText, shipFrom: item.shipFrom, promoText: item.promoText ?? '',
    promoDiscountCents: item.promoDiscountCents, outOfStock: item.outOfStock, enabled: item.enabled,
  };
  return run(`mail-${item.productId}`, () => request(storePath(`mail-milk/${item.productId}`), { method: 'PATCH', body: JSON.stringify(body) }), `已保存：${item.displayName}`);
}

function promoAmount(item: MailItem, value: string) {
  item.promoDiscountCents = value === '' ? null : Math.round(Number(value) * 100);
}

function addAlias() {
  return run('alias-new', async () => {
    const saved = await request<Alias>(storePath('aliases'), { method: 'POST', body: JSON.stringify(newAlias) });
    aliases.value.push(saved);
    newAlias.term = '';
    newAlias.keyword = '';
  }, '叫法已添加');
}

function saveAlias(alias: Alias) {
  return run(`alias-${alias.id}`, () => request(storePath(`aliases/${alias.id}`), { method: 'PATCH', body: JSON.stringify({ term: alias.term, keyword: alias.keyword, enabled: alias.enabled }) }), `已保存：${alias.term}`);
}

function addAnswer() {
  return run('answer-new', async () => {
    const saved = await request<Answer>(storePath('answers'), { method: 'POST', body: JSON.stringify(newAnswer) });
    answers.value.push(saved);
    Object.assign(newAnswer, { topic: '', keywords: '', reply: '', handoff: false });
  }, '固定回复已添加');
}

function saveAnswer(answer: Answer) {
  const body = { topic: answer.topic, keywords: answer.keywords, reply: answer.reply, handoff: answer.handoff, enabled: answer.enabled };
  return run(`answer-${answer.id}`, () => request(storePath(`answers/${answer.id}`), { method: 'PATCH', body: JSON.stringify(body) }), `已保存：${answer.topic}`);
}

onMounted(load);
</script>

<template>
  <section class="sa-settings" aria-label="阳光小助手设置">
    <nav class="sa-tabs" role="tablist">
      <button v-for="item in TABS" :key="item.id" type="button" role="tab" :aria-selected="tab === item.id" :class="{ active: tab === item.id }" @click="tab = item.id">{{ item.label }}</button>
    </nav>
    <p v-if="loading" class="sa-state">正在加载设置…</p>
    <p v-else-if="forbidden" class="sa-state">只有管理员可以维护阳光小助手设置。</p>
    <template v-else>
      <p v-if="error" class="sa-state error" role="alert">{{ error }} <button type="button" @click="load">重试</button></p>
      <p v-if="message" class="sa-state ok" role="status">{{ message }}</p>

      <div v-if="tab === 'mail'" class="sa-list">
        <div class="sa-toolbar">
          <span>价格来自 POS（每小时同步）。这里填写线路、包装、时效、发货地和活动；保质期随批次变化，不在这里录入。</span>
          <button type="button" :disabled="busy === 'detect'" @click="detect">从 POS 识别{{ undetected ? `（${undetected} 个未设置）` : '' }}</button>
        </div>
        <p v-if="!mail.length" class="sa-state">还没有邮寄奶粉设置，点击"从 POS 识别"开始。</p>
        <article v-for="item in mail" :key="item.productId" class="sa-card" :class="{ off: !item.enabled }">
          <header><input v-model="item.displayName" aria-label="回复里的名称" /><small>{{ item.productName }} · {{ item.priceCents === null ? '无价格' : `${item.priceCents / 100} 纽币` }}</small></header>
          <div class="sa-fields">
            <label>线路<select v-model="item.line"><option value="NORMAL">普通线</option><option value="EXPRESS">顺丰线</option></select></label>
            <label>段数<input v-model.number="item.stage" type="number" min="1" max="4" placeholder="无" /></label>
            <label>包装<span class="sa-pack"><input v-model.number="item.packCount" type="number" min="1" max="24" /><select v-model="item.packUnit"><option>罐</option><option>袋</option></select></span></label>
            <label>时效<input v-model="item.transitText" /></label>
            <label>发货地<input v-model="item.shipFrom" /></label>
            <label>活动<input v-model="item.promoText" placeholder="如 买一箱立减5纽币" /></label>
            <label>减价（纽币）<input :value="item.promoDiscountCents === null ? '' : item.promoDiscountCents / 100" type="number" min="0" step="0.5" @input="promoAmount(item, ($event.target as HTMLInputElement).value)" /></label>
          </div>
          <footer>
            <label class="sa-check"><input v-model="item.outOfStock" type="checkbox" />断货</label>
            <label class="sa-check"><input v-model="item.enabled" type="checkbox" />启用</label>
            <button type="button" :disabled="busy === `mail-${item.productId}`" @click="saveMail(item)">保存</button>
          </footer>
        </article>
      </div>

      <div v-else-if="tab === 'aliases'" class="sa-list">
        <p class="sa-toolbar"><span>客人怎么叫 → 商品名称里的词。例如"蓝胖" → maxigenes。</span></p>
        <form class="sa-card sa-inline" @submit.prevent="addAlias">
          <input v-model="newAlias.term" placeholder="客人的叫法" required maxlength="60" />
          <input v-model="newAlias.keyword" placeholder="商品名称里的词" required maxlength="120" />
          <button type="submit" :disabled="busy === 'alias-new'">添加</button>
        </form>
        <p v-if="!aliases.length" class="sa-state">还没有自定义叫法。</p>
        <div v-for="alias in aliases" :key="alias.id" class="sa-card sa-inline" :class="{ off: !alias.enabled }">
          <input v-model="alias.term" aria-label="客人的叫法" />
          <input v-model="alias.keyword" aria-label="商品名称里的词" />
          <label class="sa-check"><input v-model="alias.enabled" type="checkbox" />启用</label>
          <button type="button" :disabled="busy === `alias-${alias.id}`" @click="saveAlias(alias)">保存</button>
        </div>
        <details class="sa-builtin"><summary>系统自带的叫法（{{ builtIn.length }}）</summary><span v-for="item in builtIn" :key="item.term">{{ item.term }} → {{ item.keyword }}</span></details>
      </div>

      <div v-else class="sa-list">
        <p class="sa-toolbar"><span>问题里出现任一关键词时，回复会加上这段话。勾选"转人工"的会提示客服亲自回复。</span></p>
        <form class="sa-card" @submit.prevent="addAnswer">
          <div class="sa-fields">
            <label>主题<input v-model="newAnswer.topic" required maxlength="60" placeholder="如 偏远地区运费" /></label>
            <label>关键词<input v-model="newAnswer.keywords" required maxlength="255" placeholder="用逗号分隔，如 新疆,甘肃" /></label>
          </div>
          <textarea v-model="newAnswer.reply" required maxlength="2000" placeholder="回复内容，语气温和，如：新疆3罐需另加10纽币运费哦～"></textarea>
          <footer><label class="sa-check"><input v-model="newAnswer.handoff" type="checkbox" />转人工</label><button type="submit" :disabled="busy === 'answer-new'">添加</button></footer>
        </form>
        <p v-if="!answers.length" class="sa-state">还没有固定回复。</p>
        <article v-for="answer in answers" :key="answer.id" class="sa-card" :class="{ off: !answer.enabled }">
          <div class="sa-fields">
            <label>主题<input v-model="answer.topic" /></label>
            <label>关键词<input v-model="answer.keywords" /></label>
          </div>
          <textarea v-model="answer.reply" aria-label="回复内容"></textarea>
          <footer>
            <label class="sa-check"><input v-model="answer.handoff" type="checkbox" />转人工</label>
            <label class="sa-check"><input v-model="answer.enabled" type="checkbox" />启用</label>
            <button type="button" :disabled="busy === `answer-${answer.id}`" @click="saveAnswer(answer)">保存</button>
          </footer>
        </article>
      </div>
    </template>
  </section>
</template>

<style scoped>
.sa-settings { display: grid; align-content: start; gap: 10px; min-height: 0; padding: 12px 16px 18px; overflow-y: auto; overscroll-behavior: contain; font-size: 13px; }
.sa-tabs { display: flex; gap: 6px; }
.sa-panel .sa-tabs button { min-height: 0; padding: 6px 12px; color: var(--sa-muted); border: 1px solid var(--sa-line); border-radius: 999px; background: transparent; box-shadow: none; font: inherit; cursor: pointer; }
.sa-panel .sa-tabs button.active { color: var(--sa-ink); border-color: rgb(176 150 255 / 50%); background: rgb(139 108 255 / 16%); }
.sa-state { margin: 0; color: var(--sa-muted); }
.sa-state.error { color: #ff8a8a; }
.sa-state.ok { color: #7fe0b0; }
.sa-list { display: grid; gap: 10px; }
.sa-toolbar { display: grid; gap: 8px; margin: 0; color: var(--sa-muted); font-size: 12px; line-height: 1.6; }
.sa-card { display: grid; gap: 8px; padding: 10px; border: 1px solid var(--sa-line); border-radius: 12px; background: rgb(255 255 255 / 3%); }
.sa-card.off { opacity: .55; }
.sa-card header { display: grid; gap: 2px; }
.sa-card header small { color: var(--sa-muted); font-size: 11px; overflow-wrap: anywhere; }
.sa-fields { display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 8px; }
.sa-fields label { display: grid; gap: 3px; color: var(--sa-muted); font-size: 11px; }
.sa-pack { display: grid; grid-template-columns: minmax(0, 1fr) 56px; gap: 4px; }
.sa-card footer { display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-end; gap: 12px; }
.sa-inline { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto auto; align-items: center; }
.sa-check { display: inline-flex; align-items: center; gap: 4px; color: var(--sa-muted); font-size: 12px; white-space: nowrap; }
.sa-panel .sa-settings input:not([type="checkbox"]), .sa-panel .sa-settings select, .sa-panel .sa-settings textarea {
  width: 100%; min-height: 0; padding: 6px 8px; color: var(--sa-ink); border: 1px solid var(--sa-line); border-radius: 8px; background: rgb(255 255 255 / 5%); box-shadow: none; font: inherit; font-size: 13px; font-weight: 400;
}
.sa-panel .sa-settings textarea { min-height: 64px; resize: vertical; }
.sa-panel .sa-settings :is(input, textarea)::placeholder { color: var(--sa-muted); font-weight: 400; opacity: .6; }
.sa-panel .sa-settings button:not([role="tab"]) { min-height: 0; padding: 6px 14px; color: #0c0e1d; border: 0; border-radius: 999px; background: linear-gradient(120deg, #ffb35c, #b56cff); box-shadow: none; font: inherit; font-size: 12px; font-weight: 600; cursor: pointer; }
.sa-panel .sa-settings button:disabled { opacity: .5; cursor: progress; }
.sa-builtin { color: var(--sa-muted); font-size: 12px; }
.sa-builtin span { display: inline-block; margin: 4px 10px 0 0; }
@media (max-width: 520px) { .sa-inline { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); } }
</style>
