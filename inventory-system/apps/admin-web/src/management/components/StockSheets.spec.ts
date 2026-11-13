import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ProductMergeSheet from './ProductMergeSheet.vue';
import SoldItemsSheet from './SoldItemsSheet.vue';
import StockRecountSheet from './StockRecountSheet.vue';

afterEach(() => { document.body.innerHTML = ''; });
const stubs = { global: { stubs: { teleport: true } } };

describe('StockRecountSheet (CR-006 D1)', () => {
  it('loads the batches, saves the counted ones and reports the new stock', async () => {
    const request = vi.fn(async (path: string, init?: RequestInit) => {
      if (path.endsWith('/stock')) return { productId: '687', productName: 'GoodHealth 好健康鹿茸50caps', barcode: '9421', systemQuantity: 6, batches: [{ batchId: '1743', expiry: '2028-10', quantity: 6 }] };
      return { productId: '687', productName: 'GoodHealth 好健康鹿茸50caps', barcode: '9421', systemQuantity: 42, batches: [{ batchId: '1743', expiry: '2028-10', quantity: 42 }], body: init?.body };
    });
    const wrapper = mount(StockRecountSheet, { props: { productId: '687', request: request as never }, ...stubs });
    await flushPromises();

    await wrapper.get('.recount-qty').setValue(42);
    expect(wrapper.get('.recount-total').text()).toContain('实有 42 件（+36）');
    await wrapper.get('.mgmt-sheet-primary').trigger('click'); await flushPromises();

    const [path, init] = request.mock.calls[1];
    expect(path).toBe('/inventory/products/687/recount');
    expect(JSON.parse(String(init?.body))).toEqual({ lines: [{ expiry: '2028-10', quantity: 42 }], expected: [{ batchId: '1743', quantity: 6 }], requestId: expect.stringMatching(/^[0-9a-f-]{36}$/) });
    expect(wrapper.emitted('saved')?.[0][0]).toMatchObject({ systemQuantity: 42 });
  });
});

describe('ProductMergeSheet (CR-006 D2)', () => {
  it('lists other records, asks how to treat stock and merges after confirmation', async () => {
    const request = vi.fn(async (path: string, _init?: RequestInit) => path.startsWith('/inventory/products/search')
      ? [{ productId: '1609', name: 'swisse 200粒护肝1', barcodes: ['9311770601252'], posName: 'swisse liver detox 200s', stock: 42 }, { productId: '1607', name: 'swisse200粒护肝', barcodes: ['9311770597111'], posName: 'swisse liver 200ta', stock: 0 }]
      : { productId: '1609' });
    const wrapper = mount(ProductMergeSheet, { props: { productId: '1609', productName: 'swisse 200粒护肝1', currentInventory: 42, request: request as never }, ...stubs });
    await flushPromises();

    expect(request.mock.calls[0][0]).toBe('/inventory/products/search?q=swisse');
    expect(wrapper.findAll('.merge-list li')).toHaveLength(1);
    await wrapper.get('.merge-list input').setValue(true);
    expect(wrapper.get('.merge-mode').text()).toContain('被合并的 0 件清零');
    await wrapper.get('.mgmt-sheet-primary').trigger('click');
    expect(wrapper.get('.merge-confirm').text()).toContain('合并后库存 42 件');
    await wrapper.get('.mgmt-sheet-primary').trigger('click'); await flushPromises();

    const [path, init] = request.mock.calls[1];
    expect(path).toBe('/inventory/products/merge');
    expect(JSON.parse(String(init?.body))).toMatchObject({ intoProductId: '1609', fromProductIds: ['1607'], stockMode: 'KEEP_TARGET' });
    expect(wrapper.emitted('merged')).toHaveLength(1);
  });
});

describe('SoldItemsSheet (CR-007 E4)', () => {
  it('ranks what was sold, pages by 50 and filters by name', async () => {
    const items = Array.from({ length: 120 }, (_, index) => ({ productId: String(index + 1), productName: index === 0 ? 'TheraLady24k大金瓶精华液' : `商品${index + 1}`, brandName: 'B', quantity: 120 - index, revenue: 0 }));
    const wrapper = mount(SoldItemsSheet, { props: { title: '今日卖出的商品', items, formatNumber: String }, attachTo: document.body, ...stubs });
    await flushPromises();

    expect(wrapper.findAll('.sold-stats strong').map((cell) => cell.text())).toEqual(['120种', '7260件', 'TheraLady24k大金瓶精华液']);
    expect(wrapper.findAll('.sold-list li')).toHaveLength(50);
    expect(wrapper.get('.sold-list li em').text()).toBe('1');
    await wrapper.findAll('.sold-pages button')[1].trigger('click');
    expect(wrapper.get('.sold-list li em').text()).toBe('51');
    expect(wrapper.get('.sold-pages span').text()).toContain('第 2 / 3 页');
    await wrapper.get('.sold-search').setValue('thera');
    expect(wrapper.findAll('.sold-list li')).toHaveLength(1);
  });
});
