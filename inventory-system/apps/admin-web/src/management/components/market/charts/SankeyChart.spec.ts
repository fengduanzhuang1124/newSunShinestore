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
});
