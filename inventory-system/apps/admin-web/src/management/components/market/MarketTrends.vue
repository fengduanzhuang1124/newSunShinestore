<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { NEWS_REGION_LABEL, type NewsFeed, type NewsRegion, type NewsSource } from './market-types';

// REQ-016 part 3: industry news from public RSS feeds, tagged with the store's topics. Administrators maintain the
// sources and can read them at once; everyone with market analysis access can read the news.
const props = defineProps<{ request: <T>(path: string, init?: RequestInit) => Promise<T>; storeId: string | null }>();

const days = ref<7 | 30 | 90>(30);
const region = ref<NewsRegion | ''>('');
const topic = ref('');
// Feeds such as Campaign Brief publish many general marketing stories; this keeps only those touching goods in stock.
const relatedOnly = ref(true);
const feed = ref<NewsFeed | null>(null);
const loading = ref(false);
const error = ref('');
const sourcesOpen = ref(false);
const refreshing = ref(false);
const notice = ref('');
const saving = ref<string | null>(null);
const draft = reactive({ name: '', url: '', region: 'ANZ' as NewsRegion });

const query = computed(() => {
  const params = new URLSearchParams({ storeId: props.storeId ?? '', days: String(days.value) });
  if (region.value) params.set('region', region.value);
  if (topic.value) params.set('topic', topic.value);
  return params.toString();
});

async function load() {
  if (!props.storeId) return;
  loading.value = true;
  error.value = '';
  try {
    feed.value = await props.request<NewsFeed>(`/news?${query.value}`);
    // A topic that no longer has news in the chosen period would leave an empty list with no visible filter.
    if (topic.value && !feed.value.topics.some((item) => item.key === topic.value)) topic.value = '';
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : '行业新闻读取失败';
  } finally {
    loading.value = false;
  }
}
watch(query, () => { void load(); });
onMounted(() => { void load(); });

const dateText = new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric' });
const timeText = new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
const when = (value: string | null) => (value ? dateText.format(new Date(value)) : '日期未注明');

const shown = computed(() => (feed.value?.items ?? []).filter((item) => !relatedOnly.value || item.related));
const hidden = computed(() => (feed.value?.items.length ?? 0) - shown.value.length);
const failing = computed(() => (feed.value?.sources ?? []).filter((source) => source.enabled && source.lastError));
const lastRead = computed(() => {
  const times = (feed.value?.sources ?? []).map((source) => source.lastSuccessAt).filter((value): value is string => Boolean(value)).sort();
  return times.length ? timeText.format(new Date(times[times.length - 1])) : null;
});

async function refreshNow() {
  refreshing.value = true;
  notice.value = '';
  try {
    const result = await props.request<{ results: { name: string; added: number; error: string | null }[] }>(`/news/refresh?storeId=${encodeURIComponent(props.storeId ?? '')}`, { method: 'POST' });
    const added = result.results.reduce((sum, row) => sum + row.added, 0);
    const failed = result.results.filter((row) => row.error);
    notice.value = `已读取 ${result.results.length} 个来源，新增 ${added} 条${failed.length ? `；${failed.map((row) => `${row.name}：${row.error}`).join('；')}` : ''}`;
    await load();
  } catch (reason) {
    notice.value = reason instanceof Error ? reason.message : '更新失败';
  } finally {
    refreshing.value = false;
  }
}

async function toggle(source: NewsSource) {
  saving.value = source.id;
  try {
    await props.request(`/news/sources/${source.id}?storeId=${encodeURIComponent(props.storeId ?? '')}`, { method: 'PATCH', body: JSON.stringify({ enabled: !source.enabled }) });
    await load();
  } catch (reason) {
    notice.value = reason instanceof Error ? reason.message : '保存失败';
  } finally {
    saving.value = null;
  }
}

async function addSource() {
  saving.value = 'new';
  notice.value = '';
  try {
    const source = await props.request<NewsSource>(`/news/sources?storeId=${encodeURIComponent(props.storeId ?? '')}`, { method: 'POST', body: JSON.stringify({ name: draft.name.trim(), url: draft.url.trim(), region: draft.region }) });
    notice.value = source.lastError ? `已添加“${source.name}”，但读取失败：${source.lastError}` : `已添加“${source.name}”并完成第一次读取`;
    draft.name = '';
    draft.url = '';
    await load();
  } catch (reason) {
    notice.value = reason instanceof Error ? reason.message : '添加失败';
  } finally {
    saving.value = null;
  }
}
const canAdd = computed(() => draft.name.trim().length >= 2 && /^https:\/\/\S+$/.test(draft.url.trim()) && saving.value === null);
</script>

<template>
  <div class="nw">
    <div class="nw-bar">
      <div class="nw-seg" role="group" aria-label="时间范围">
        <button v-for="option in ([7, 30, 90] as const)" :key="option" type="button" :class="{ active: days === option }" :aria-pressed="days === option" @click="days = option">近 {{ option }} 天</button>
      </div>
      <div class="nw-seg" role="group" aria-label="地区">
        <button type="button" :class="{ active: region === '' }" :aria-pressed="region === ''" @click="region = ''">全部地区</button>
        <button v-for="(label, code) in NEWS_REGION_LABEL" :key="code" type="button" :class="{ active: region === code }" :aria-pressed="region === code" @click="region = code">{{ label }}</button>
      </div>
      <label class="nw-check"><input v-model="relatedOnly" type="checkbox">只看与店内相关</label>
      <p v-if="feed" class="nw-summary">共 {{ feed.summary.total }} 条 · <b>{{ feed.summary.related }}</b> 条与店内有货商品相关<template v-if="lastRead"> · 最近读取 {{ lastRead }}</template></p>
    </div>

    <div v-if="feed?.topics.length" class="nw-topics" role="group" aria-label="主题">
      <button type="button" :class="{ active: topic === '' }" :aria-pressed="topic === ''" @click="topic = ''">全部主题</button>
      <button v-for="item in feed.topics" :key="item.key" type="button" :class="{ active: topic === item.key }" :aria-pressed="topic === item.key"
              :title="item.inStock === null ? undefined : `店内有货 ${item.inStock} 种`" @click="topic = topic === item.key ? '' : item.key">
        {{ item.label }} <small>{{ item.count }}</small>
      </button>
    </div>

    <p v-if="failing.length" class="nw-warn" role="status">读取失败：{{ failing.map((source) => `${source.name}（${source.lastError}）`).join('；') }}；其他来源不受影响。</p>

    <div v-if="loading && !feed" class="nw-skeleton" aria-hidden="true"><i v-for="n in 4" :key="n"></i></div>
    <div v-else-if="error && !feed" class="nw-state" role="alert">
      <strong>{{ error.includes('权限') ? '没有查看权限' : '行业新闻读取失败' }}</strong>
      <p>{{ error }}</p>
      <button v-if="!error.includes('权限')" type="button" @click="load">重新加载</button>
    </div>
    <template v-else-if="feed">
      <p v-if="error" class="nw-warn" role="alert">{{ error }}</p>
      <ul v-if="shown.length" class="nw-list" :aria-busy="loading">
        <li v-for="item in shown" :key="item.id" :class="{ related: item.related }">
          <p class="nw-meta"><span>{{ item.source.name }}</span><span>{{ NEWS_REGION_LABEL[item.source.region] }}</span><span>{{ when(item.publishedAt) }}</span></p>
          <a class="nw-title" :href="item.link" target="_blank" rel="noopener noreferrer">{{ item.title }}</a>
          <p v-if="item.summary" class="nw-text">{{ item.summary }}</p>
          <p v-if="item.topics.length" class="nw-tags">
            <span v-for="tag in item.topics" :key="tag.key" :class="{ stocked: (tag.inStock ?? 0) > 0 }">{{ tag.label }}<template v-if="(tag.inStock ?? 0) > 0"> · 店内有货 {{ tag.inStock }} 种</template></span>
          </p>
        </li>
      </ul>
      <div v-else class="nw-state">
        <strong>{{ topic || region || (relatedOnly && feed.items.length) ? '没有符合条件的新闻' : `近 ${days} 天还没有新闻` }}</strong>
        <p>来源每天自动读取一次<template v-if="feed.canManage">，也可以在下方“新闻来源”中立即更新</template>。</p>
      </div>
      <p v-if="relatedOnly && hidden > 0" class="nw-rule">已隐藏 {{ hidden }} 条与店内有货商品无关的新闻（如广告营销行业动态），取消勾选“只看与店内相关”即可查看。</p>
      <p class="nw-rule">新闻来自各网站公开的 RSS，标题和摘要为原文，点击标题打开原网站。主题按文章中的关键词识别，“店内有货”按商品名称识别的功能或品类统计，仅供参考。</p>

      <section class="nw-sources">
        <button type="button" class="nw-sources-toggle" :aria-expanded="sourcesOpen" @click="sourcesOpen = !sourcesOpen">新闻来源（{{ feed.sources.filter((source) => source.enabled).length }} 个启用）{{ sourcesOpen ? '▴' : '▾' }}</button>
        <div v-if="sourcesOpen" class="nw-sources-body">
          <div v-if="feed.canManage" class="nw-actions">
            <button type="button" class="nw-primary" :disabled="refreshing" @click="refreshNow">{{ refreshing ? '正在读取…' : '立即更新' }}</button>
            <span v-if="notice" role="status">{{ notice }}</span>
          </div>
          <ul class="nw-source-list">
            <li v-for="source in feed.sources" :key="source.id" :class="{ off: !source.enabled }">
              <span class="name">{{ source.name }} <small>{{ NEWS_REGION_LABEL[source.region] }}</small></span>
              <span class="status">
                <template v-if="!source.enabled">已停用</template>
                <em v-else-if="source.lastError" class="bad">读取失败：{{ source.lastError }}</em>
                <template v-else-if="source.lastSuccessAt">最近读取 {{ timeText.format(new Date(source.lastSuccessAt)) }}</template>
                <template v-else>等待第一次读取</template>
              </span>
              <button v-if="feed.canManage" type="button" :disabled="saving === source.id" @click="toggle(source)">{{ source.enabled ? '停用' : '启用' }}</button>
            </li>
          </ul>
          <form v-if="feed.canManage" class="nw-add" @submit.prevent="addSource">
            <input v-model="draft.name" maxlength="80" placeholder="名称，如 TGA 新闻" aria-label="来源名称">
            <input v-model="draft.url" maxlength="500" type="url" placeholder="RSS 地址（https://…）" aria-label="RSS 地址">
            <select v-model="draft.region" aria-label="地区"><option v-for="(label, code) in NEWS_REGION_LABEL" :key="code" :value="code">{{ label }}</option></select>
            <button type="submit" class="nw-primary" :disabled="!canAdd">{{ saving === 'new' ? '正在读取…' : '添加' }}</button>
          </form>
          <p class="nw-rule">只接受网站公开提供的 RSS 地址；添加后立即读取一次，读取失败会显示原因。</p>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.nw { display: grid; gap: 12px; min-width: 0; }
.nw-bar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; }
.nw-seg { display: flex; gap: 4px; padding: 4px; border: 1px solid var(--mk-line); border-radius: 14px; background: var(--mk-panel); }
.nw-seg button, .nw-topics button { min-height: 32px; padding: 5px 12px; color: var(--mk-muted); border: 0; border-radius: 10px; background: transparent; font: inherit; font-size: 13px; font-weight: 800; white-space: nowrap; cursor: pointer; }
.nw-seg button.active { color: #fff; background: linear-gradient(135deg, #a5600f, #d88a1c); }
.nw-check { display: inline-flex; align-items: center; gap: 6px; color: var(--mk-ink); font-size: 13px; font-weight: 700; cursor: pointer; }
.nw-check input { width: 16px; height: 16px; accent-color: #d88a1c; }
.nw-summary { margin: 0 0 0 auto; color: var(--mk-muted); font-size: 12px; }
.nw-summary b { color: var(--mk-ink); }
.nw-topics { display: flex; flex-wrap: wrap; gap: 6px; }
.nw-topics button { border: 1px solid var(--mk-line); background: var(--mk-panel); font-size: 12px; }
.nw-topics button small { margin-left: 2px; color: var(--mk-muted); font-weight: 700; }
.nw-topics button.active { color: var(--mk-ink); border-color: rgb(226 132 30 / 70%); background: rgb(226 132 30 / 18%); }
.nw-warn { margin: 0; padding: 8px 12px; color: var(--mk-warn); border: 1px solid rgb(255 180 92 / 35%); border-radius: 12px; font-size: 12px; }

.nw-list { display: grid; gap: 10px; margin: 0; padding: 0; list-style: none; }
.nw-list[aria-busy="true"] { opacity: .6; }
.nw-list li { display: grid; gap: 6px; min-width: 0; padding: 14px 16px; border: 1px solid var(--mk-line); border-radius: 16px; background: var(--mk-panel); }
.nw-list li.related { border-left: 3px solid #d88a1c; }
.nw-meta { display: flex; flex-wrap: wrap; gap: 4px 10px; margin: 0; color: var(--mk-muted); font-size: 11px; }
.nw-meta span + span::before { margin-right: 10px; content: '·'; }
.nw-title { color: var(--mk-ink); font-size: 15px; font-weight: 800; line-height: 1.45; text-decoration: none; overflow-wrap: anywhere; }
.nw-title:hover, .nw-title:focus-visible { color: var(--mk-accent); text-decoration: underline; }
.nw-text { display: -webkit-box; margin: 0; overflow: hidden; color: var(--mk-muted); font-size: 13px; line-height: 1.6; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
.nw-tags { display: flex; flex-wrap: wrap; gap: 6px; margin: 0; }
.nw-tags span { padding: 2px 8px; color: var(--mk-muted); border: 1px solid var(--mk-line); border-radius: 999px; font-size: 11px; }
.nw-tags span.stocked { color: var(--mk-ink); border-color: rgb(226 132 30 / 55%); }
.nw-rule { margin: 0; color: var(--mk-muted); font-size: 11px; line-height: 1.6; }

.nw-state { display: grid; justify-items: center; gap: 8px; padding: 36px 16px; border: 1px solid var(--mk-line); border-radius: 18px; background: var(--mk-panel); text-align: center; }
.nw-state strong { color: var(--mk-ink); }
.nw-state p { margin: 0; color: var(--mk-muted); font-size: 13px; }
.nw-state button { padding: 6px 14px; color: var(--mk-accent); border: 1px solid var(--mk-line); border-radius: 10px; background: transparent; font: inherit; cursor: pointer; }
.nw-skeleton { display: grid; gap: 10px; }
.nw-skeleton i { height: 92px; border-radius: 16px; background: linear-gradient(90deg, var(--mk-card), var(--mk-panel), var(--mk-card)); background-size: 200% 100%; animation: nw-shimmer 1.4s infinite; }
@keyframes nw-shimmer { to { background-position: -200% 0; } }

.nw-sources { border: 1px solid var(--mk-line); border-radius: 16px; background: var(--mk-panel); }
.nw-sources-toggle { width: 100%; padding: 12px 16px; color: var(--mk-ink); border: 0; background: none; font: inherit; font-size: 13px; font-weight: 800; text-align: left; cursor: pointer; }
.nw-sources-body { display: grid; gap: 10px; padding: 0 16px 14px; }
.nw-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; color: var(--mk-muted); font-size: 12px; }
.nw-primary { min-height: 34px; padding: 6px 14px; color: #fff; border: 0; border-radius: 10px; background: linear-gradient(135deg, #a5600f, #d88a1c); font: inherit; font-size: 13px; font-weight: 800; cursor: pointer; }
.nw-primary:disabled { opacity: .55; cursor: not-allowed; }
.nw-source-list { display: grid; gap: 6px; margin: 0; padding: 0; list-style: none; }
.nw-source-list li { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.4fr) auto; align-items: center; gap: 10px; padding: 8px 10px; border-radius: 10px; background: var(--mk-card); font-size: 13px; }
.nw-source-list li.off { opacity: .6; }
.nw-source-list .name { color: var(--mk-ink); font-weight: 800; }
.nw-source-list .name small { margin-left: 4px; color: var(--mk-muted); font-weight: 600; }
.nw-source-list .status { color: var(--mk-muted); font-size: 12px; }
.nw-source-list .bad { color: var(--mk-down); font-style: normal; }
.nw-source-list button { padding: 4px 10px; color: var(--mk-ink); border: 1px solid var(--mk-line); border-radius: 8px; background: transparent; font: inherit; font-size: 12px; cursor: pointer; }
.nw-add { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 2fr) auto auto; gap: 8px; }
.nw-add input, .nw-add select { min-width: 0; min-height: 34px; padding: 6px 10px; color: var(--mk-ink); border: 1px solid var(--mk-line); border-radius: 10px; background: var(--mk-card); font: inherit; font-size: 16px; }

@media (max-width: 720px) {
  .nw-bar { display: grid; }
  .nw-seg { overflow-x: auto; }
  .nw-seg button { flex: 1; }
  .nw-summary { margin: 0; }
  .nw-source-list li { grid-template-columns: minmax(0, 1fr) auto; }
  .nw-source-list .status { grid-column: 1 / -1; grid-row: 2; }
  .nw-add { grid-template-columns: minmax(0, 1fr); }
}
@media (prefers-reduced-motion: reduce) { .nw-skeleton i { animation: none; } }
</style>
