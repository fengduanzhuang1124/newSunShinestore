import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import SankeyChart from './SankeyChart.vue';
import type { SankeyData, SankeyProduct } from '../market-types';

const product = (productId: string, productName: string, revenue: number, coverageWeeks: number, inCurrentOrder = false): SankeyProduct => ({
  productId, productName, brandName: 'Blackmores', level1: '保健品', level2: '鱼油与 Omega-3', currentInventory: 4, weeklyUnits: 2,
  coverageWeeks, inCurrentOrder, revenue, units: 6,
});

// Test-only figures: fish oil for the family, calcium named for the elderly.
const data: SankeyData = {
  total: 300,
  nodes: [
    { id: 'p:家庭通用', layer: 0, name: '家庭通用', group: null, value: 200 },
    { id: 'p:中老年', layer: 0, name: '中老年', group: null, value: 100 },
    { id: 'g:心脑血管', layer: 1, name: '心脑血管', group: null, value: 200 },
    { id: 'g:骨骼关节', layer: 1, name: '骨骼关节', group: null, value: 100 },
    { id: 'f:心脑血管/鱼油与 Omega-3', layer: 2, name: '鱼油与 Omega-3', group: '心脑血管', value: 200 },
    { id: 'f:骨骼关节/补钙与维 D', layer: 2, name: '补钙与维 D', group: '骨骼关节', value: 100 },
  ],
  links: [
    { source: 'p:家庭通用', target: 'g:心脑血管', value: 200 },
    { source: 'p:中老年', target: 'g:骨骼关节', value: 100 },
    { source: 'g:心脑血管', target: 'f:心脑血管/鱼油与 Omega-3', value: 200 },
    { source: 'g:骨骼关节', target: 'f:骨骼关节/补钙与维 D', value: 100 },
  ],
  flows: [
    { people: '家庭通用', group: '心脑血管', label: '鱼油与 Omega-3', value: 200 },
    { people: '中老年', group: '骨骼关节', label: '补钙与维 D', value: 100 },
  ],
  products: {
    'p:家庭通用': [product('1', 'Blackmores 澳佳宝 鱼油 400粒', 200, 0.5)],
    'p:中老年': [product('2', 'Blackmores 澳佳宝 中老年钙 120粒', 100, 1, true)],
    'g:心脑血管': [product('1', 'Blackmores 澳佳宝 鱼油 400粒', 200, 0.5)],
    'g:骨骼关节': [product('2', 'Blackmores 澳佳宝 中老年钙 120粒', 100, 1, true)],
    'f:心脑血管/鱼油与 Omega-3': [product('1', 'Blackmores 澳佳宝 鱼油 400粒', 200, 0.5)],
    'f:骨骼关节/补钙与维 D': [product('2', 'Blackmores 澳佳宝 中老年钙 120粒', 100, 1, true)],
  },
};

describe('SankeyChart (CR-021)', () => {
  it('draws three columns with shares and lists the products of the largest function group first', async () => {
    const wrapper = mount(SankeyChart, { props: { data, adding: null } });
    expect(wrapper.findAll('.sk-node')).toHaveLength(6);
    expect(wrapper.findAll('.sk-bands path')).toHaveLength(4);
    expect(wrapper.findAll('.sk-bands path.faded')).toHaveLength(0);
    expect(wrapper.text()).toContain('66.7%');
    expect(wrapper.get('.sk-products h5').text()).toBe('心脑血管 · 卖得最好的商品');

    await wrapper.findAll('.sk-node').find((node) => node.text().includes('骨骼关节'))!.trigger('click');
    expect(wrapper.get('.sk-products').text()).toContain('中老年钙');
    expect(wrapper.get('.sk-products').text()).toContain('已在进货单');
    // Bands that do not touch the node someone picked fade out; nothing is faded on load.
    expect(wrapper.findAll('.sk-bands path.faded')).toHaveLength(2);
  });

  it('offers 提醒进货 only for a product running short, and puts it on the purchase order', async () => {
    const wrapper = mount(SankeyChart, { props: { data: { ...data, products: { ...data.products, 'g:心脑血管': [
      product('1', 'Blackmores 澳佳宝 鱼油 400粒', 200, 0.5), product('3', 'Blackmores 澳佳宝 辅酶 Q10', 80, 6),
    ] } }, adding: null } });
    const rows = wrapper.findAll('.sk-products li');
    expect(rows[0].get('button').text()).toBe('提醒进货');
    expect(rows[1].find('button').exists()).toBe(false);
    expect(rows[1].text()).toContain('库存够用');
    await rows[0].get('button').trigger('click');
    expect(wrapper.emitted('add-to-order')).toEqual([['1']]);
  });

  it('drills people → function group → function on a phone', async () => {
    const wrapper = mount(SankeyChart, { props: { data, adding: null } });
    const rows = () => wrapper.findAll('.sk-drill li button');
    expect(rows().map((row) => row.get('.sk-drill-name').text())).toEqual(['家庭通用', '中老年']);
    await rows()[1].trigger('click');
    expect(rows().map((row) => row.get('.sk-drill-name').text())).toEqual(['骨骼关节']);
    expect(wrapper.get('.sk-products h5').text()).toBe('中老年 · 卖得最好的商品');
    await rows()[0].trigger('click');
    expect(rows().map((row) => row.get('.sk-drill-name').text())).toEqual(['补钙与维 D']);
    await rows()[0].trigger('click');
    // Products behind a function are for every group; the heading says so while a group is chosen.
    expect(wrapper.get('.sk-products h5').text()).toBe('补钙与维 D · 卖得最好的商品（全部人群）');
    await wrapper.get('.sk-path button').trigger('click');
    expect(wrapper.get('.sk-path').text()).toContain('中老年');
  });

  it('lets the product panel be widened from the keyboard, remembers it, and resets on double-click (CR-022)', async () => {
    localStorage.removeItem('sunshine.market.sankeySide');
    const wrapper = mount(SankeyChart, { props: { data, adding: null } });
    const splitter = wrapper.get('.sk-splitter');
    expect(wrapper.get('.sk').attributes('style')).toContain('--sk-side: 400px');
    await splitter.trigger('keydown', { key: 'ArrowLeft' });
    expect(wrapper.get('.sk').attributes('style')).toContain('--sk-side: 420px');
    expect(localStorage.getItem('sunshine.market.sankeySide')).toBe('420');
    // Never narrower than 300px.
    for (let step = 0; step < 10; step += 1) await splitter.trigger('keydown', { key: 'ArrowRight' });
    expect(splitter.attributes('aria-valuenow')).toBe('300');
    await splitter.trigger('dblclick');
    expect(splitter.attributes('aria-valuenow')).toBe('400');
    expect(mount(SankeyChart, { props: { data, adding: null } }).get('.sk-splitter').attributes('aria-valuenow')).toBe('400');
  });

  it('draws every function of at least 1% and folds smaller ones within their own group (REQ-016 A5)', async () => {
    // 20 functions of 3.6% each under 外用护理 would all have been folded after the 10th before.
    const big = Array.from({ length: 20 }, (_, index) => ({ id: `f:外用护理/细分${index + 1}`, layer: 2 as const, name: `细分${index + 1}`, group: '外用护理', value: 36 }));
    const tiny = [{ id: 'f:外用护理/小A', layer: 2 as const, name: '小A', group: '外用护理', value: 4 }, { id: 'f:外用护理/小B', layer: 2 as const, name: '小B', group: '外用护理', value: 3 },
      { id: 'f:食品/唯一小', layer: 2 as const, name: '唯一小', group: '食品', value: 5 }];
    const wide: SankeyData = {
      total: 1000,
      nodes: [
        { id: 'p:家庭通用', layer: 0, name: '家庭通用', group: null, value: 1000 },
        { id: 'g:外用护理', layer: 1, name: '外用护理', group: null, value: 727 },
        { id: 'g:日常营养', layer: 1, name: '日常营养', group: null, value: 268 },
        { id: 'g:食品', layer: 1, name: '食品', group: null, value: 5 },
        ...big, ...tiny,
        { id: 'f:日常营养/日常营养', layer: 2, name: '日常营养', group: '日常营养', value: 268 },
      ],
      links: [], flows: [],
      products: { 'f:外用护理/小A': [product('7', '小A 面霜', 4, 6)], 'f:外用护理/小B': [product('8', '小B 面膜', 3, 6)] },
    };
    const wrapper = mount(SankeyChart, { props: { data: wide, adding: null } });
    const names = wrapper.findAll('.sk-node .sk-name').map((node) => node.text());
    expect(names).toContain('细分20');
    expect(names).toContain('外用护理·其他');
    expect(names).not.toContain('小A');
    // Only a group with less than 1% folds into 其他大类, and its functions into 其他细分.
    expect(names.filter((name) => name === '其他大类' || name === '其他细分')).toEqual(['其他大类', '其他细分']);
    // Functions follow their groups: 外用护理 first, its 其他 last within it, then 日常营养.
    const column = wrapper.findAll('.sk-node').map((node) => ({ name: node.get('.sk-name').text(), x: Number(node.findAll('rect')[1].attributes('x')), y: Number(node.findAll('rect')[1].attributes('y')) }));
    const right = Math.max(...column.map((node) => node.x));
    const third = column.filter((node) => node.x === right).sort((a, b) => a.y - b.y).map((node) => node.name);
    expect(third.slice(20)).toEqual(['外用护理·其他', '日常营养', '其他细分']);
    await wrapper.findAll('.sk-node').find((node) => node.text().includes('外用护理·其他'))!.trigger('click');
    expect(wrapper.get('.sk-products').text()).toContain('小A 面霜');
    expect(wrapper.get('.sk-products').text()).toContain('小B 面膜');
    expect(Number(wrapper.get('.sk-svg').attributes('height'))).toBeGreaterThan(500);
  });
});
