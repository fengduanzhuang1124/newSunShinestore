import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App.vue';

describe('App', () => {
  beforeEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset.theme;
    vi.restoreAllMocks();
  });

  it('shows the employee login before inventory tools', () => {
    const wrapper = mount(App);

    expect(wrapper.text()).toContain('员工登录');
    expect(wrapper.text()).toContain('点货入库、上货架出库和库存日期查询');
  });

  it('switches between light and dark themes and remembers the choice', async () => {
    const wrapper = mount(App);
    const toggle = wrapper.get('button[aria-label="切换到深色模式"]');

    await toggle.trigger('click');

    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(localStorage.getItem('sunshine_inventory_theme')).toBe('dark');
    expect(wrapper.get('button[aria-label="切换到浅色模式"]').text()).toContain('Light');
  });

  it('automatically shows the recently received product after switching to inventory query', async () => {
    localStorage.setItem('sunshine_inventory_access_token', 'test-token');
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({
        data: { productName: '测试商品', currentQuantity: 8, receiptNo: 'RK-TEST-001' },
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

    expect(wrapper.text()).toContain('已加入入库单 RK-TEST-001');
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

  it('shows daily receipts in the records and reports tab', async () => {
    localStorage.setItem('sunshine_inventory_access_token', 'test-token');
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify({
      data: {
        warehouseName: '主仓库',
        summary: { receiptCount: 1, productCount: 2, totalQuantity: 15 },
        receipts: [{
          receiptId: '1', receiptNo: 'RK-20260801-ABC123', status: 'OPEN', employeeName: '员工1',
          createdAt: '2026-08-01T01:00:00.000Z', completedAt: null, productCount: 2, totalQuantity: 15,
          items: [{ itemId: '1', barcode: '9400000000001', productName: '测试商品', expiryDate: '2027-08', quantity: 15, createdAt: '2026-08-01T01:00:00.000Z' }],
        }],
      },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

    const wrapper = mount(App);
    const tabs = wrapper.get('nav').findAll('button');
    expect(tabs).toHaveLength(4);
    await tabs[3].trigger('click');
    await flushPromises();

    expect(wrapper.text()).toContain('记录与报表');
    expect(wrapper.text()).toContain('RK-20260801-ABC123');
    expect(wrapper.text()).toContain('测试商品');
    expect(wrapper.text()).toContain('15 件');
    expect(wrapper.text()).toContain('导出 CSV');
  });

  it('shows expiry inventory grouped by the 2, 3 and 6 month levels', async () => {
    localStorage.setItem('sunshine_inventory_access_token', 'test-token');
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({
        data: { warehouseName: '主仓库', summary: { receiptCount: 0, productCount: 0, totalQuantity: 0 }, receipts: [] },
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        data: {
          warehouseName: '主仓库', thresholds: { urgentMonths: 2, warningMonths: 3, earlyWarningMonths: 6 },
          summary: { EXPIRED: 1, URGENT: 2, WARNING: 3, EARLY: 4 },
          items: [{ productId: '1', productName: '临期测试商品', barcodes: ['9400000000002'], batchId: '9', expiryDate: '2026-09', quantity: 7, level: 'URGENT', levelLabel: '紧急临期', daysRemaining: 31 }],
        },
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

    const wrapper = mount(App);
    await wrapper.get('nav').findAll('button')[3].trigger('click');
    await flushPromises();
    const reportButtons = wrapper.findAll('.report-switch button');
    expect(reportButtons).toHaveLength(4);
    await reportButtons[2].trigger('click');
    await flushPromises();

    expect(wrapper.text()).toContain('2个月内紧急临期');
    expect(wrapper.text()).toContain('临期测试商品');
    expect(wrapper.text()).toContain('紧急临期');
    expect(wrapper.text()).toContain('剩余 31 天');
    expect(wrapper.text()).toContain('导出 CSV');
  });

  it('shows stocktake controls and immutable inventory movements', async () => {
    localStorage.setItem('sunshine_inventory_access_token', 'test-token');
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({
        data: { warehouseName: '主仓库', summary: { receiptCount: 0, productCount: 0, totalQuantity: 0 }, receipts: [] },
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        data: { warehouseName: '主仓库', movements: [{ movementId: '1', movementNo: 'RCV-1', movementType: 'RECEIPT', movementLabel: '入库', productName: '测试商品', barcodes: ['9400000000001'], expiryDate: '2027-08', quantityDelta: 10, reason: null, performedBy: '门店账号', createdAt: '2026-08-01T01:00:00.000Z' }] },
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        data: { warehouseName: '主仓库', productCount: 1, totalQuantity: 10, products: [{ productId: '1', productName: '测试商品', barcodes: ['9400000000001'], batches: [{ batchId: '1', expiryDate: '2027-08', expiryPrecision: 'MONTH', quantity: 10 }], totalQuantity: 10 }] },
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

    const wrapper = mount(App);
    await wrapper.get('nav').findAll('button')[3].trigger('click');
    await flushPromises();
    const reportButtons = wrapper.findAll('.report-switch button');
    expect(reportButtons).toHaveLength(4);
    await reportButtons[3].trigger('click');
    await flushPromises();

    expect(wrapper.text()).toContain('库存盘点');
    expect(wrapper.text()).toContain('最近库存流水');
    expect(wrapper.text()).toContain('确认调整');
    expect(wrapper.text()).toContain('测试商品');
    expect(wrapper.text()).toContain('+10');
  });
});
