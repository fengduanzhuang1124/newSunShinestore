import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import FilterSheet from './FilterSheet.vue';

describe('FilterSheet', () => {
  const mountSheet = () => mount(FilterSheet, {
    props: { title: '销售筛选', summary: '2026-10-01 至 2026-10-22' },
    slots: { default: '<form class="sales-filter-panel" @submit.prevent><label>品牌<input /></label><button type="submit">更新分析</button></form>' },
  });

  it('keeps the slotted filters in place and summarises them for phones', () => {
    const wrapper = mountSheet();
    expect(wrapper.find('.sales-filter-panel').exists()).toBe(true);
    expect(wrapper.get('.filter-sheet-bar span').text()).toBe('2026-10-01 至 2026-10-22');
    expect(wrapper.get('.filter-sheet-panel').attributes('aria-label')).toBe('销售筛选');
    expect(wrapper.classes()).not.toContain('open');
  });

  it('opens from the summary bar and closes after the filters are applied', async () => {
    const wrapper = mountSheet();
    await wrapper.get('.filter-sheet-bar button').trigger('click');
    expect(wrapper.classes()).toContain('open');
    expect(wrapper.get('.filter-sheet-bar button').attributes('aria-expanded')).toBe('true');
    await wrapper.get('form').trigger('submit');
    expect(wrapper.classes()).not.toContain('open');
  });

  it('closes from the close button and the backdrop', async () => {
    const wrapper = mountSheet();
    await wrapper.get('.filter-sheet-bar button').trigger('click');
    await wrapper.get('.filter-sheet-header button').trigger('click');
    expect(wrapper.classes()).not.toContain('open');
    await wrapper.get('.filter-sheet-bar button').trigger('click');
    await wrapper.get('.filter-sheet-backdrop').trigger('click');
    expect(wrapper.classes()).not.toContain('open');
  });
});
