import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App.vue';

describe('App', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
    localStorage.setItem('sunshine_inventory_profile', JSON.stringify({
      id: '1',
      displayName: '测试员工',
      roles: [{ code: 'ADMIN', storeId: '3', storeName: '测试门店' }],
      warehouses: [{ warehouseId: '7', warehouseName: '测试仓库', storeId: '3', canReceive: true }],
    }));
    localStorage.setItem('sunshine_inventory_mode', 'receive');
    delete document.documentElement.dataset.theme;
    vi.restoreAllMocks();
  });

  it('shows the employee login before inventory tools', () => {
    const wrapper = mount(App);

    expect(wrapper.text()).toContain('阳光特产库存管理');
    expect(wrapper.text()).toContain('扫码点货、上架出库、日期查询，一站完成');
  });

  it('switches between light and dark themes and remembers the choice', async () => {
    const wrapper = mount(App);
    const toggle = wrapper.get('button[aria-label="切换到深色模式"]');

    await toggle.trigger('click');

    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(localStorage.getItem('sunshine_inventory_theme')).toBe('dark');
    expect(wrapper.get('button[aria-label="切换到浅色模式"]').text()).toContain('Light');
  });

  it('shows the mobile workbench with live inventory shortcuts', async () => {
    localStorage.setItem('sunshine_inventory_access_token', 'test-token');
    localStorage.removeItem('sunshine_inventory_mode');
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: {
        warehouseName: '测试仓库', summary: { receiptCount: 2, productCount: 3, totalQuantity: 18 }, receipts: [],
      } }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: {
        warehouseName: '测试仓库', productCount: 12, totalQuantity: 96, products: [],
      } }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: {
        warehouseName: '测试仓库', thresholds: { urgentMonths: 2, warningMonths: 3, earlyWarningMonths: 6 },
        summary: { EXPIRED: 1, URGENT: 2, WARNING: 3, EARLY: 4 }, items: [],
      } }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

    const wrapper = mount(App);
    await flushPromises();

    expect(wrapper.text()).toContain('仓管通');
    expect(wrapper.text()).toContain('当前库存96');
    expect(wrapper.text()).toContain('今日入库18');
    expect(wrapper.text()).toContain('到期关注10');
    expect(wrapper.findAll('.mobile-bottom-nav button')).toHaveLength(3);
    expect(wrapper.findAll('.mobile-bottom-nav button').map((button) => button.text()))
      .toEqual(['⌂工作台', '⌕库存', '▤记录']);
    await wrapper.get('.workbench-profile').trigger('click');
    expect(wrapper.text()).toContain('账户与设置');
    expect(wrapper.text()).toContain('退出当前账号');
    expect(wrapper.text()).not.toContain('奶粉商品人工核对');
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

    expect(wrapper.text()).toContain('本次点货清单');
    expect(wrapper.text()).toContain('先核对清单，确认后才写入库存');
    expect(wrapper.text()).toContain('1 项 · 1 件');
    await wrapper.get('button.confirm-draft').trigger('click');
    await flushPromises();
    expect(wrapper.text()).toContain('入库单 RK-TEST-001 已写入：1 项');
    await wrapper.get('nav').findAll('button')[1].trigger('click');
    await flushPromises();

    expect(wrapper.get('input[aria-label="商品关键词或条码"]').element).toHaveProperty('value', '9400000000001');
    expect(wrapper.text()).toContain('已自动显示刚刚入库商品的最新库存');
    expect(wrapper.text()).toContain('总库存 8 件');
    expect(wrapper.text()).toContain('到期日期');
    expect(wrapper.text()).toContain('库存数量');
    expect(wrapper.text()).toContain('2027-03-01');
  });

  it('shows product matches in a compact dropdown before opening one product', async () => {
    localStorage.setItem('sunshine_inventory_access_token', 'test-token');
    localStorage.setItem('sunshine_inventory_mode', 'query');
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify({
      data: { products: [
        { productId: '1', productName: '康维他 麦卢卡蜂蜜 5+ 500g', chineseName: '康维他5+ 500g', englishName: 'Comvita UMF 5+ 500g', sku: 'C5', barcodes: ['9401'], batches: [{ batchId: '1', expiryDate: '2029-03', expiryPrecision: 'MONTH', quantity: 12 }], totalQuantity: 12 },
        { productId: '2', productName: '康维他 麦卢卡蜂蜜 10+ 500g', chineseName: '康维他10+ 500g', englishName: 'Comvita UMF 10+ 500g', sku: 'C10', barcodes: ['9402'], batches: [], totalQuantity: 0 },
      ] },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

    const wrapper = mount(App);
    await wrapper.get('input[aria-label="商品关键词或条码"]').setValue('umf 5+');
    await wrapper.get('.inventory-search-row .action-secondary').trigger('click');
    await flushPromises();

    expect(wrapper.find('.product-search-dropdown').exists()).toBe(true);
    expect(wrapper.findAll('.product-search-dropdown [role="option"]')).toHaveLength(2);
    expect(wrapper.find('.result-list').exists()).toBe(false);
    await wrapper.get('.product-search-dropdown [role="option"]').trigger('pointerdown');

    expect(wrapper.find('.product-search-dropdown').exists()).toBe(false);
    expect(wrapper.get('.result-list').text()).toContain('总库存 12 件');
    expect(wrapper.get('.result-list').text()).toContain('2029-03');
  });

  it('combines repeated scans with the same barcode and expiry before confirmation', async () => {
    localStorage.setItem('sunshine_inventory_access_token', 'test-token');
    const wrapper = mount(App);

    for (const quantity of [2, 3]) {
      await wrapper.get('input[placeholder="扫描条码"]').setValue('9421025560361');
      await wrapper.get('input[required][maxlength="255"]').setValue('测试镁片');
      await wrapper.get('input[type="month"]').setValue('2027-09');
      await wrapper.get('input[type="number"][min="1"][step="1"]').setValue(quantity);
      await wrapper.get('form.receive-form').trigger('submit');
    }

    expect(wrapper.text()).toContain('1 项 · 5 件');
    expect(wrapper.get('input[aria-label="测试镁片 清单数量"]').element).toHaveProperty('value', '5');
    expect(wrapper.find('button.confirm-draft').exists()).toBe(true);
    expect(wrapper.text()).toContain('删除');
  });

  it('submits the selected warehouse and reuses the draft id as the idempotency key', async () => {
    localStorage.setItem('sunshine_inventory_access_token', 'test-token');
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify({
      data: { productName: '测试商品', currentQuantity: 1, receiptNo: 'RK-TEST-002' },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    const wrapper = mount(App);

    await wrapper.get('input[placeholder="扫描条码"]').setValue('9421907983356');
    await wrapper.get('input[required][maxlength="255"]').setValue('测试商品');
    await wrapper.get('input[type="month"]').setValue('2027-11');
    await wrapper.get('form.receive-form').trigger('submit');
    await wrapper.get('button.confirm-draft').trigger('click');
    await flushPromises();

    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const body = JSON.parse(String(request.body));
    expect(body.warehouseId).toBe('7');
    expect(body.idempotencyKey).toMatch(/^[0-9a-f-]{36}$/i);
  });

  it('submits a barcode-free product and keeps the generated internal code', async () => {
    localStorage.setItem('sunshine_inventory_access_token', 'test-token');
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify({
      data: {
        barcode: 'LOCAL-22', productName: '整箱奶粉', currentQuantity: 6,
        receiptNo: 'RK-TEST-003', generatedInternalBarcode: true, createdProduct: true,
      },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    const wrapper = mount(App);

    await wrapper.get('input[required][maxlength="255"]').setValue('整箱奶粉');
    await wrapper.get('input[type="month"]').setValue('2027-12');
    await wrapper.get('input[type="number"][min="1"][step="1"]').setValue(6);
    await wrapper.get('form.receive-form').trigger('submit');
    expect(wrapper.text()).toContain('无条码（自动编号）');
    await wrapper.get('button.confirm-draft').trigger('click');
    await flushPromises();

    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const body = JSON.parse(String(request.body));
    expect(body).not.toHaveProperty('barcode');
    expect(body.productName).toBe('整箱奶粉');
    expect(wrapper.text()).toContain('入库单 RK-TEST-003 已写入：1 项');
  });

  it('adds a received item when randomUUID is unavailable on a phone HTTP connection', async () => {
    localStorage.setItem('sunshine_inventory_access_token', 'test-token');
    vi.stubGlobal('crypto', {
      getRandomValues(values: Uint8Array) {
        values.fill(7);
        return values;
      },
    });
    const wrapper = mount(App);

    await wrapper.get('input[placeholder="扫描条码"]').setValue('9421907983356');
    await wrapper.get('input[required][maxlength="255"]').setValue('手机测试商品');
    await wrapper.get('input[type="month"]').setValue('2027-11');
    await wrapper.get('input[type="number"][min="1"][step="1"]').setValue(112);
    await wrapper.get('form.receive-form').trigger('submit');

    expect(wrapper.text()).toContain('1 项 · 112 件');
    expect(wrapper.text()).toContain('手机测试商品');
    expect(wrapper.text()).not.toContain('扫描并填写日期后，商品会先出现在这里');
  });

  it('offers a reusable phone camera scanner and explains unavailable camera access', async () => {
    localStorage.setItem('sunshine_inventory_access_token', 'test-token');
    const wrapper = mount(App);

    await wrapper.get('button[aria-label="打开手机相机扫码入库"]').trigger('click');
    await flushPromises();

    expect(wrapper.get('[aria-label="手机相机扫码"]')).toBeTruthy();
    expect(wrapper.text()).toContain('扫码入库');
    expect(wrapper.text()).toContain('当前浏览器无法调用摄像头');
    await wrapper.get('button[aria-label="关闭相机扫码"]').trigger('click');
    expect(wrapper.find('[aria-label="手机相机扫码"]').exists()).toBe(false);
  });

  it('restores an unsubmitted receiving draft after the phone page reloads', async () => {
    localStorage.setItem('sunshine_inventory_access_token', 'test-token');
    const firstPage = mount(App);
    await firstPage.get('input[placeholder="扫描条码"]').setValue('9400000000018');
    await firstPage.get('input[required][maxlength="255"]').setValue('锁屏恢复测试商品');
    await firstPage.get('input[type="month"]').setValue('2028-06');
    await firstPage.get('input[type="number"][min="1"][step="1"]').setValue(4);
    await firstPage.get('form.receive-form').trigger('submit');
    expect(firstPage.text()).toContain('1 项 · 4 件');
    firstPage.unmount();

    const restoredPage = mount(App);
    expect(restoredPage.text()).toContain('已恢复上次未提交的入库草稿');
    expect(restoredPage.text()).toContain('锁屏恢复测试商品');
    expect(restoredPage.text()).toContain('1 项 · 4 件');
    expect(restoredPage.get('input[aria-label="锁屏恢复测试商品 清单数量"]').element)
      .toHaveProperty('value', '4');
  });

  it('keeps today\'s unsubmitted receiving list after leaving and returning', async () => {
    localStorage.setItem('sunshine_inventory_access_token', 'test-token');
    const wrapper = mount(App);
    await wrapper.get('input[placeholder="扫描条码"]').setValue('9400000000094');
    await wrapper.get('input[required][maxlength="255"]').setValue('当天草稿测试商品');
    await wrapper.get('input[type="month"]').setValue('2028-09');
    await wrapper.get('form.receive-form').trigger('submit');

    await wrapper.get('nav').findAll('button')[0].trigger('click');
    expect(wrapper.text()).toContain('当天未提交');
    expect(wrapper.text()).toContain('1 种商品，共 1 件');
    await wrapper.get('.draft-reminder button').trigger('click');

    expect(wrapper.text()).toContain('当天草稿测试商品');
    expect(wrapper.text()).toContain('1 项 · 1 件');
    expect(wrapper.find('button.confirm-draft').exists()).toBe(true);
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
    expect(wrapper.find('.product-search-dropdown').exists()).toBe(true);
    await wrapper.get('.product-search-dropdown [role="option"]').trigger('pointerdown');
    expect(wrapper.text()).toContain('已识别商品');
    expect(wrapper.text()).toContain('到期日期');
  });

  it('shows bilingual product details and moves focus to expiry after a barcode scan', async () => {
    localStorage.setItem('sunshine_inventory_access_token', 'test-token');
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify({
      data: {
        products: [{
          productId: '12',
          productName: '纽乐植物酵素60粒',
          sku: '07520',
          englishName: 'Good Health Enzyme 60 Capsules',
          chineseName: '纽乐植物酵素60粒',
          barcodes: ['9400581003822'],
          batches: [],
          totalQuantity: 0,
        }],
      },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

    const wrapper = mount(App, { attachTo: document.body });
    await wrapper.get('input[aria-label="查询条码或商品名称"]').setValue('9400581003822');
    await wrapper.get('input[aria-label="查询条码或商品名称"]').trigger('keydown.enter');
    await flushPromises();

    expect(wrapper.text()).toContain('已识别商品');
    expect(wrapper.text()).toContain('纽乐植物酵素60粒');
    expect(wrapper.text()).toContain('Good Health Enzyme 60 Capsules');
    expect(wrapper.text()).toContain('07520');
    expect(wrapper.find('input[placeholder="扫描条码"]').exists()).toBe(false);
    expect(document.activeElement).toBe(wrapper.get('input[aria-label="到期年月"]').element);
    wrapper.unmount();
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
    expect(tabs).toHaveLength(3);
    await tabs[2].trigger('click');
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
    await wrapper.get('nav').findAll('button')[2].trigger('click');
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

  it('keeps stocktake with the inventory ledger', async () => {
    localStorage.setItem('sunshine_inventory_access_token', 'test-token');
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify({
      data: { warehouseName: '主仓库', productCount: 1, totalQuantity: 10, products: [{ productId: '1', productName: '测试商品', barcodes: ['9400000000001'], batches: [{ batchId: '1', expiryDate: '2027-08', expiryPrecision: 'MONTH', quantity: 10 }], totalQuantity: 10 }] },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

    const wrapper = mount(App);
    await wrapper.get('nav').findAll('button')[1].trigger('click');
    await flushPromises();
    const inventoryButtons = wrapper.findAll('.inventory-section-tabs button');
    expect(inventoryButtons).toHaveLength(2);
    expect(inventoryButtons.map((button) => button.text())).toEqual(['库存台账', '库存盘点']);
    await inventoryButtons[1].trigger('click');

    expect(wrapper.text()).toContain('库存盘点');
    expect(wrapper.get('input[aria-label="筛选盘点商品"]')).toBeTruthy();
    expect(wrapper.text()).toContain('确认调整');
    expect(wrapper.text()).toContain('确认盘点');
    expect(wrapper.text()).toContain('测试商品');
    await wrapper.get('input[aria-label="筛选盘点商品"]').setValue('不存在商品');
    expect(wrapper.text()).toContain('没有找到匹配的盘点商品');
  });

  it('increases an existing inventory batch from the inventory page', async () => {
    localStorage.setItem('sunshine_inventory_access_token', 'test-token');
    const inventory = { warehouseName: '主仓库', productCount: 1, totalQuantity: 10, products: [{
      productId: '2', productName: '测试商品', barcodes: ['9400000000001'],
      batches: [{ batchId: '3', expiryDate: '2027-08', expiryPrecision: 'MONTH', quantity: 10 }], totalQuantity: 10,
    }] };
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: inventory }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: {
        productName: '测试商品', expiryDate: '2027-08', quantityAdded: 5, previousQuantity: 10, currentQuantity: 15,
      } }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { ...inventory, totalQuantity: 15 } }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

    const wrapper = mount(App);
    await wrapper.get('nav').findAll('button')[1].trigger('click');
    await flushPromises();
    await wrapper.findAll('button').find((button) => button.text() === '库存增加')!.trigger('click');
    await wrapper.get('input[aria-label="库存增加数量"]').setValue('5');
    await wrapper.get('input[aria-label="库存增加原因"]').setValue('后续发现库存');
    await wrapper.findAll('button').find((button) => button.text().startsWith('确认增加'))!.trigger('click');
    await flushPromises();

    const request = fetchSpy.mock.calls.find(([url]) => String(url).endsWith('/inventory/stock-increase'));
    expect(request).toBeTruthy();
    expect(JSON.parse(String((request?.[1] as RequestInit).body))).toMatchObject({
      productId: '2', batchId: '3', quantity: 5, reason: '后续发现库存', warehouseId: '7',
    });
    expect(wrapper.text()).toContain('库存增加成功');
    expect(wrapper.text()).toContain('增加 5 件');
  });

  it('decreases a selected inventory batch and sends the employee reason', async () => {
    localStorage.setItem('sunshine_inventory_access_token', 'test-token');
    const inventory = { warehouseName: '主仓库', productCount: 1, totalQuantity: 10, products: [{
      productId: '2', productName: '测试商品', barcodes: ['9400000000001'],
      batches: [{ batchId: '3', expiryDate: '2027-08', expiryPrecision: 'MONTH', quantity: 10 }], totalQuantity: 10,
    }] };
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: inventory }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: {
        productName: '测试商品', expiryDate: '2027-08', quantityDecreased: 3, previousQuantity: 10, currentQuantity: 7,
      } }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { ...inventory, totalQuantity: 7 } }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

    const wrapper = mount(App);
    await wrapper.get('nav').findAll('button')[1].trigger('click');
    await flushPromises();
    await wrapper.findAll('button').find((button) => button.text() === '库存减少')!.trigger('click');
    await wrapper.get('input[aria-label="库存减少数量"]').setValue('3');
    await wrapper.get('input[aria-label="库存减少原因"]').setValue('发现破损');
    await wrapper.findAll('button').find((button) => button.text().startsWith('确认减少'))!.trigger('click');
    await flushPromises();

    const request = fetchSpy.mock.calls.find(([url]) => String(url).endsWith('/inventory/stock-decrease'));
    expect(request).toBeTruthy();
    expect(JSON.parse(String((request?.[1] as RequestInit).body))).toMatchObject({
      productId: '2', batchId: '3', quantity: 3, reason: '发现破损', warehouseId: '7',
    });
    expect(wrapper.text()).toContain('库存减少成功');
    expect(wrapper.text()).toContain('减少 3 件');
  });

  it('shows immutable inventory movements in records', async () => {
    localStorage.setItem('sunshine_inventory_access_token', 'test-token');
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({
        data: { warehouseName: '主仓库', summary: { receiptCount: 0, productCount: 0, totalQuantity: 0 }, receipts: [] },
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        data: { warehouseName: '主仓库', movements: [{ movementId: '1', movementNo: 'RCV-1', movementType: 'RECEIPT', movementLabel: '入库', productName: '测试商品', barcodes: ['9400000000001'], expiryDate: '2027-08', quantityDelta: 10, reason: null, performedBy: '门店账号', reversalOfMovementNo: null, reversedByMovementNo: null, reversed: false, canReverse: true, createdAt: '2026-08-01T01:00:00.000Z' }] },
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        data: { warehouseName: '主仓库', productCount: 1, totalQuantity: 10, products: [{ productId: '1', productName: '测试商品', barcodes: ['9400000000001'], batches: [{ batchId: '1', expiryDate: '2027-08', expiryPrecision: 'MONTH', quantity: 10 }], totalQuantity: 10 }] },
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

    const wrapper = mount(App);
    await wrapper.get('nav').findAll('button')[2].trigger('click');
    await flushPromises();
    const reportButtons = wrapper.findAll('.report-switch button');
    expect(reportButtons.map((button) => button.text()))
      .toEqual(['当天入库表', '总库存表', '临期预警', '库存流水']);
    await reportButtons[3].trigger('click');
    await flushPromises();

    expect(wrapper.text()).toContain('库存流水');
    expect(wrapper.text()).toContain('测试商品');
    expect(wrapper.text()).toContain('+10');
    expect(wrapper.text()).toContain('撤销');
    expect(wrapper.get('input[aria-label="RCV-1 撤销原因"]')).toBeTruthy();
  });
});
