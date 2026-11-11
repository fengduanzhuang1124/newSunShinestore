import { flushPromises, mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import MarketTrends from './MarketTrends.vue';
import type { NewsFeed } from './market-types';

// Test-only articles and sources.
const feed = (overrides: Partial<NewsFeed> = {}): NewsFeed => ({
  days: 30, canManage: true, summary: { total: 2, related: 1 },
  items: [
    { id: '1', title: 'Probiotic gut health trial', summary: 'A trial in adults', link: 'https://n.example/1', publishedAt: '2026-11-10T09:00:00Z', fetchedAt: '2026-11-10T10:00:00Z',
      source: { id: '5', name: 'NutraIngredients', region: 'GLOBAL' }, related: true,
      topics: [{ key: '器官养护/益生菌', group: '器官养护', label: '益生菌', kind: 'function', inStock: 12 }] },
    { id: '2', title: 'Agency wins award', summary: null, link: 'https://s.example/2', publishedAt: null, fetchedAt: '2026-11-10T10:00:00Z',
      source: { id: '6', name: 'StopPress', region: 'ANZ' }, related: false, topics: [] },
  ],
  topics: [{ key: '器官养护/益生菌', group: '器官养护', label: '益生菌', kind: 'function', inStock: 12, count: 1 }],
  sources: [
    { id: '5', name: 'NutraIngredients', url: 'https://n.example/rss', region: 'GLOBAL', enabled: true, lastSuccessAt: '2026-11-10T10:00:00Z', lastFailureAt: null, lastError: null },
    { id: '6', name: 'StopPress', url: 'https://s.example/feed', region: 'ANZ', enabled: true, lastSuccessAt: null, lastFailureAt: '2026-11-10T10:00:00Z', lastError: '网站返回 HTTP 404' },
  ],
  ...overrides,
});

function setup(responses: Record<string, unknown> = {}, current = feed()) {
  const request = vi.fn(async (path: string) => {
    const route = path.split('?')[0];
    if (route in responses) {
      const value = responses[route];
      if (value instanceof Error) throw value;
      return value;
    }
    if (route === '/news') return current;
    throw new Error(`Unexpected ${path}`);
  });
  const wrapper = mount(MarketTrends, { props: { request: request as never, storeId: '3' } });
  return { wrapper, request };
}

describe('MarketTrends (REQ-016 part 3)', () => {
  it('lists news with source, topics and in-stock counts, and warns about a failing source', async () => {
    const { wrapper, request } = setup();
    await flushPromises();
    expect(request).toHaveBeenCalledWith('/news?storeId=3&days=30');
    // Only news about goods in stock by default; the rest is one click away.
    expect(wrapper.findAll('.nw-list li').map((item) => item.get('a').text())).toEqual(['Probiotic gut health trial']);
    expect(wrapper.text()).toContain('已隐藏 1 条与店内有货商品无关的新闻');
    await wrapper.get('.nw-check input').setValue(false);
    const items = wrapper.findAll('.nw-list li');
    expect(items).toHaveLength(2);
    expect(items[0].classes()).toContain('related');
    expect(items[0].get('a').attributes()).toMatchObject({ href: 'https://n.example/1', target: '_blank', rel: 'noopener noreferrer' });
    expect(items[0].text()).toContain('益生菌 · 店内有货 12 种');
    expect(items[1].text()).toContain('日期未注明');
    expect(wrapper.get('.nw-summary').text()).toContain('1 条与店内有货商品相关');
    expect(wrapper.get('.nw-warn').text()).toContain('StopPress（网站返回 HTTP 404）');
  });

  it('filters by period, region and topic through the API', async () => {
    const { wrapper, request } = setup();
    await flushPromises();
    await wrapper.findAll('.nw-seg button').find((button) => button.text() === '近 7 天')!.trigger('click');
    await wrapper.findAll('.nw-seg button').find((button) => button.text() === '澳新')!.trigger('click');
    await wrapper.findAll('.nw-topics button').find((button) => button.text().startsWith('益生菌'))!.trigger('click');
    await flushPromises();
    expect(request).toHaveBeenLastCalledWith('/news?storeId=3&days=7&region=ANZ&topic=%E5%99%A8%E5%AE%98%E5%85%BB%E6%8A%A4%2F%E7%9B%8A%E7%94%9F%E8%8F%8C');
  });

  it('lets administrators refresh and add sources; others only see the list', async () => {
    const created = { id: '7', name: 'TGA', url: 'https://tga.example/rss', region: 'ANZ', enabled: true, lastSuccessAt: null, lastFailureAt: '2026-11-11T00:00:00Z', lastError: '连接超时' };
    const { wrapper, request } = setup({ '/news/refresh': { results: [{ name: 'NutraIngredients', added: 3, error: null }, { name: 'StopPress', added: 0, error: '网站返回 HTTP 404' }] }, '/news/sources': created });
    await flushPromises();
    await wrapper.get('.nw-sources-toggle').trigger('click');
    await wrapper.get('.nw-actions .nw-primary').trigger('click');
    await flushPromises();
    expect(request).toHaveBeenCalledWith('/news/refresh?storeId=3', { method: 'POST' });
    expect(wrapper.get('.nw-actions').text()).toContain('已读取 2 个来源，新增 3 条；StopPress：网站返回 HTTP 404');

    const [name, url] = wrapper.findAll('.nw-add input');
    await name.setValue('TGA');
    await url.setValue('https://tga.example/rss');
    await wrapper.get('.nw-add').trigger('submit');
    await flushPromises();
    expect(request).toHaveBeenCalledWith('/news/sources?storeId=3', { method: 'POST', body: JSON.stringify({ name: 'TGA', url: 'https://tga.example/rss', region: 'ANZ' }) });
    expect(wrapper.get('.nw-actions').text()).toContain('已添加“TGA”，但读取失败：连接超时');

    const viewer = setup({}, feed({ canManage: false }));
    await flushPromises();
    await viewer.wrapper.get('.nw-sources-toggle').trigger('click');
    expect(viewer.wrapper.find('.nw-actions').exists()).toBe(false);
    expect(viewer.wrapper.find('.nw-add').exists()).toBe(false);
    expect(viewer.wrapper.find('.nw-source-list button').exists()).toBe(false);
  });

  it('shows empty, failed and no-permission states', async () => {
    const empty = setup({}, feed({ items: [], topics: [], summary: { total: 0, related: 0 } }));
    await flushPromises();
    expect(empty.wrapper.get('.nw-state').text()).toContain('近 30 天还没有新闻');
    const unrelated = setup({}, feed({ items: [feed().items[1]], summary: { total: 1, related: 0 } }));
    await flushPromises();
    expect(unrelated.wrapper.get('.nw-state').text()).toContain('没有符合条件的新闻');

    const failed = setup({ '/news': new Error('网络错误') });
    await flushPromises();
    expect(failed.wrapper.get('.nw-state').text()).toContain('行业新闻读取失败');
    expect(failed.wrapper.get('.nw-state button').text()).toBe('重新加载');

    const denied = setup({ '/news': new Error('缺少经营管理权限：management.sales.view') });
    await flushPromises();
    expect(denied.wrapper.get('.nw-state').text()).toContain('没有查看权限');
    expect(denied.wrapper.find('.nw-state button').exists()).toBe(false);
  });
});
