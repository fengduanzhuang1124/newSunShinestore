import { flushPromises, mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import ProductLocationBulk from './ProductLocationBulk.vue';
import ProductLocationChip from './ProductLocationChip.vue';

const locations = [{ locationId: '5', code: 'A-01', name: '保健品 A 架' }, { locationId: '9', code: 'B-02', name: '护肤 B 架' }];

describe('ProductLocationBulk (CR-008)', () => {
  it('lists a brand with every product ticked, confirms moving placed ones, then saves them in one request', async () => {
    const request = vi.fn(async (path: string, init?: RequestInit) => {
      if (path.startsWith('/inventory/locations/brands')) return [{ brand: '帕氏', productCount: 2, placedCount: 1, stock: 6 }];
      if (path.startsWith('/inventory/locations/products?')) return { total: 2, products: [
        { productId: '10', name: 'Parrs 蜂毒眼霜', brand: '帕氏', barcodes: ['9410'], stock: 4, location: null },
        { productId: '11', name: 'parrs 精华', brand: '帕氏', barcodes: [], stock: 2, location: locations[1] },
      ] };
      if (path === '/inventory/locations/products' && init?.method === 'PUT') return { updated: 2, location: locations[0] };
      throw new Error(`unexpected ${path}`);
    });
    const wrapper = mount(ProductLocationBulk, { props: { locations, request } });
    await flushPromises();

    await wrapper.findAll('.bulk-brands button').find((button) => button.text().includes('帕氏'))!.trigger('click');
    await flushPromises();
    expect(request).toHaveBeenCalledWith('/inventory/locations/products?inStock=true&brand=%E5%B8%95%E6%B0%8F');
    expect(wrapper.text()).toContain('已选 2 个');

    await wrapper.get('select[aria-label="放到仓位"]').setValue('5');
    await wrapper.findAll('button').find((button) => button.text().startsWith('放到这个仓位'))!.trigger('click');
    expect(wrapper.text()).toContain('其中 1 个已放在别的仓位');
    expect(request).not.toHaveBeenCalledWith('/inventory/locations/products', expect.anything());

    await wrapper.findAll('.bulk-confirm button').find((button) => button.text() === '确认')!.trigger('click');
    await flushPromises();
    expect(request).toHaveBeenCalledWith('/inventory/locations/products', { method: 'PUT', body: JSON.stringify({ productIds: ['10', '11'], locationId: '5' }) });
    expect(wrapper.text()).toContain('已把 2 个商品放到 A-01 · 保健品 A 架');
    expect(wrapper.emitted('changed')).toHaveLength(1);
  });
});

describe('ProductLocationChip (CR-008)', () => {
  it('shows where a product is kept and lets staff change it', async () => {
    const request = vi.fn(async () => ({ updated: 1, location: locations[1] }));
    const wrapper = mount(ProductLocationChip, { props: { productId: '10', location: locations[0], locations, request, editable: true } });
    expect(wrapper.text()).toContain('A-01 · 保健品 A 架');

    await wrapper.get('button[aria-label="修改仓位"]').trigger('click');
    await wrapper.get('select').setValue('9');
    await wrapper.findAll('button').find((button) => button.text() === '保存')!.trigger('click');
    await flushPromises();

    expect(request).toHaveBeenCalledWith('/inventory/locations/products', { method: 'PUT', body: JSON.stringify({ productIds: ['10'], locationId: '9' }) });
    expect(wrapper.emitted('changed')?.[0]).toEqual([locations[1]]);
  });

  it('shows unplaced products', () => {
    const wrapper = mount(ProductLocationChip, { props: { productId: '10', location: null, request: vi.fn() } });
    expect(wrapper.text()).toContain('未放仓位');
    expect(wrapper.find('button').exists()).toBe(false);
  });
});
