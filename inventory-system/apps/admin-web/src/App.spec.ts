import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App.vue';

describe('App', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('shows the employee login before inventory tools', () => {
    const wrapper = mount(App);

    expect(wrapper.text()).toContain('员工登录');
    expect(wrapper.text()).toContain('点货入库、上货架出库和库存日期查询');
  });

  it('automatically shows the recently received product after switching to inventory query', async () => {
    localStorage.setItem('sunshine_inventory_access_token', 'test-token');
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({
        data: { productName: '测试商品', currentQuantity: 8 },
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        data: {
          products: [{
            productId: '1',
            productName: '测试商品',
            barcodes: ['9400000000001'],
            batches: [{ batchId: '1', expiryDate: '2027-03-01', expiryPrecision: 'DATE', quantity: 8 }],
            totalQuantity: 8,
          }],
        },
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

    const wrapper = mount(App);
    await wrapper.get('input[placeholder="扫描条码"]').setValue('9400000000001');
    await wrapper.get('input[required][maxlength="255"]').setValue('测试商品');
    await wrapper.get('input[type="month"]').setValue('2027-03');
    await wrapper.get('input[aria-label="到期日（可不选）"]').setValue('1');
    await wrapper.get('form.receive-form').trigger('submit');
    await flushPromises();

    expect(wrapper.text()).toContain('可到“查询”核对');
    await wrapper.get('nav').findAll('button')[2].trigger('click');
    await flushPromises();

    expect(wrapper.get('input[aria-label="商品关键词或条码"]').element).toHaveProperty('value', '9400000000001');
    expect(wrapper.text()).toContain('已自动显示刚刚入库商品的最新库存');
    expect(wrapper.text()).toContain('总库存 8 件');
    expect(wrapper.text()).toContain('到期日期');
    expect(wrapper.text()).toContain('库存数量');
    expect(wrapper.text()).toContain('2027-03-01');
  });

  it('finds an existing product by a partial name during receiving', async () => {
    localStorage.setItem('sunshine_inventory_access_token', 'test-token');
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify({
      data: {
        products: [{
          productId: '2',
          productName: '纽乐植物酵素60粒',
          barcodes: ['94005810038224'],
          batches: [{ batchId: '2', expiryDate: '2027-12', expiryPrecision: 'MONTH', quantity: 12 }],
          totalQuantity: 12,
        }],
      },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

    const wrapper = mount(App);
    await flushPromises();
    expect(wrapper.text()).toContain('扫码输入就绪');
    await wrapper.get('input[aria-label="查询条码或商品名称"]').setValue('纽乐');
    await wrapper.get('input[aria-label="查询条码或商品名称"]').trigger('keydown.enter');
    await flushPromises();

    expect(wrapper.text()).toContain('找到 1 个商品');
    expect(wrapper.text()).toContain('纽乐植物酵素60粒');
    expect(wrapper.text()).toContain('选择这个商品入库');
    expect(wrapper.text()).toContain('到期日期');
  });
});
