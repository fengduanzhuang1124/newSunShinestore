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
    expect(wrapper.findAll('.mobile-bottom-nav button')).toHaveLength(5);
    expect(wrapper.findAll('.mobile-bottom-nav button').map((button) => button.text()))
      .toEqual(['⌂工作台', '＋入库', '−出库', '⌕库存', '•••更多']);
    expect(wrapper.get('.management-entry').text()).toBe('经营管理');
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
    await wrapper.get('.product-search-dropdown [role="option"]').trigger('click');

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

  it('keeps the newest receiving item at the top and opens a numeric mobile keypad for barcodes', async () => {
    localStorage.setItem('sunshine_inventory_access_token', 'test-token');
    const wrapper = mount(App);
    const barcodeInput = wrapper.get('input[placeholder="扫描条码"]');
    expect(barcodeInput.attributes('inputmode')).toBe('numeric');

    for (const [code, name] of [['9400000000001', '先录入商品'], ['9400000000002', '后录入商品']]) {
      await barcodeInput.setValue(code);
      await wrapper.get('input[required][maxlength="255"]').setValue(name);
      await wrapper.get('input[type="month"]').setValue('2027-09');
      await wrapper.get('form.receive-form').trigger('submit');
    }

    const rows = wrapper.findAll('.receive-draft-table tbody tr');
    expect(rows).toHaveLength(2);
    expect(rows[0].text()).toContain('后录入商品');
    expect(rows[1].text()).toContain('先录入商品');
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
    await wrapper.get('.product-search-dropdown [role="option"]').trigger('click');
    expect(wrapper.text()).toContain('已识别商品');
    expect(wrapper.text()).toContain('到期日期');
  });

  it('asks whether a draft line for an expiry that already has stock is new stock or a recount', async () => {
    localStorage.setItem('sunshine_inventory_access_token', 'test-token');
    const json = (data: unknown) => new Response(JSON.stringify({ data }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(json({ products: [{
        productId: '2', productName: '纽乐植物酵素60粒', barcodes: ['94005810038224'],
        batches: [{ batchId: '7', expiryDate: '2027-12', expiryPrecision: 'MONTH', quantity: 12 }, { batchId: '8', expiryDate: '2099-12', expiryPrecision: 'MONTH', quantity: 3 }],
        totalQuantity: 15,
      }] }))
      .mockResolvedValueOnce(json({ movementId: '9', productName: '纽乐植物酵素60粒', expiryDate: '2027-12', previousQuantity: 12, actualQuantity: 10, difference: -2 }));

    const wrapper = mount(App);
    await flushPromises();
    await wrapper.get('input[aria-label="查询条码或商品名称"]').setValue('纽乐');
    await wrapper.get('input[aria-label="查询条码或商品名称"]').trigger('keydown.enter');
    await flushPromises();
    await wrapper.get('.product-search-dropdown [role="option"]').trigger('click');
    await wrapper.get('input[aria-label="到期年月"]').setValue('2027-12');
    await wrapper.get('.receive-form input[type="number"][min="1"][step="1"]').setValue(10);
    await wrapper.get('form.receive-form').trigger('submit');

    expect(wrapper.text()).toContain('该日期已有 12 件');
    const confirm = wrapper.get('.confirm-draft');
    expect(confirm.attributes('disabled')).toBeDefined();
    await wrapper.findAll('button').find((button) => button.text() === '重新点货（以本次为准）')!.trigger('click');
    expect(confirm.attributes('disabled')).toBeUndefined();
    await confirm.trigger('click');
    await flushPromises();

    const call = fetchMock.mock.calls.find(([url]) => String(url).includes('/inventory/stocktake-adjustment'));
    expect(JSON.parse(String(call?.[1]?.body))).toEqual({ batchId: '7', actualQuantity: 10, reason: '重新点货（以本次为准）' });
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/inventory/scan-receive'))).toBe(false);
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

  it('exports today\'s count with unsubmitted drafts and saved receipts', async () => {
    localStorage.setItem('sunshine_inventory_access_token', 'test-token');
    localStorage.setItem('sunshine_inventory_receive_draft:1:3', JSON.stringify({
      version: 1, receiveDraft: [{ draftId: 'd1', barcode: '9400000000009', productName: '未提交商品', expiryMonth: '2028-01', expiryDisplay: '2028-01', quantity: 4 }],
    }));
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(JSON.stringify({
      data: {
        warehouseName: '主仓库', summary: { receiptCount: 1, productCount: 1, totalQuantity: 6 },
        receipts: [{
          receiptId: '1', receiptNo: 'RK-20261020-ABC123', status: 'OPEN', employeeName: '员工1',
          createdAt: '2026-10-20T01:00:00.000Z', completedAt: null, productCount: 2, totalQuantity: 6,
          items: [
            { itemId: '1', batchId: '1', barcode: '9400000000001', productName: '已入库商品', expiryDate: '2027-08', quantity: 6, reversed: false, createdAt: '2026-10-20T01:00:00.000Z' },
            { itemId: '2', batchId: '2', barcode: '9400000000002', productName: '已撤销商品', expiryDate: '2027-09', quantity: 2, reversed: true, createdAt: '2026-10-20T01:05:00.000Z' },
          ],
        }],
      },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    let exported: Blob | undefined;
    URL.createObjectURL = vi.fn((blob: Blob) => { exported = blob; return 'blob:today'; });
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

    const wrapper = mount(App);
    await flushPromises();
    const button = wrapper.findAll('button').find((candidate) => candidate.text() === '导出今日点货');
    expect(button).toBeDefined();
    await button!.trigger('click');
    await flushPromises();

    expect(String(fetchMock.mock.calls.at(-1)?.[0])).toContain('/inventory/receipts?date=');
    const csv = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.readAsText(exported!);
    });
    expect(csv).toContain('"未提交（本机）","","","9400000000009","未提交商品","2028-01","4"');
    expect(csv).toContain('"已入库","RK-20261020-ABC123","员工1","9400000000001","已入库商品","2027-08","6"');
    expect(csv).not.toContain('已撤销商品');
    expect(wrapper.text()).toContain('已导出今日点货：未提交 1 项，已入库 1 项。');
  });

  it('counts a near-expiry batch as sold out from the expiry list', async () => {
    localStorage.setItem('sunshine_inventory_access_token', 'test-token');
    const json = (data: unknown) => new Response(JSON.stringify({ data }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    const expiryList = (quantity: number) => ({
      warehouseName: '主仓库', thresholds: { urgentMonths: 2, warningMonths: 3, earlyWarningMonths: 6 },
      summary: { EXPIRED: 0, URGENT: 1, WARNING: 0, EARLY: 0 },
      items: quantity ? [{ productId: '1', productName: '红印美白牙膏', barcodes: ['9415991001904'], batchId: '9', expiryDate: '2027-01', quantity, level: 'URGENT', levelLabel: '临期预警', daysRemaining: 102, action: null }] : [],
    });
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(json({ warehouseName: '主仓库', summary: { receiptCount: 0, productCount: 0, totalQuantity: 0 }, receipts: [] }))
      .mockResolvedValueOnce(json(expiryList(47)))
      .mockResolvedValueOnce(json({ movementId: '5', productName: '红印美白牙膏', expiryDate: '2027-01', previousQuantity: 47, actualQuantity: 0, difference: -47 }))
      .mockResolvedValueOnce(json(expiryList(0)));

    const wrapper = mount(App);
    await wrapper.get('nav').findAll('button')[2].trigger('click');
    await flushPromises();
    await wrapper.findAll('.report-switch button')[2].trigger('click');
    await flushPromises();

    await wrapper.findAll('button').find((button) => button.text() === '实盘')!.trigger('click');
    await wrapper.findAll('button').find((button) => button.text() === '已售完（0 件）')!.trigger('click');
    await wrapper.get('form[aria-label="临期实盘"]').trigger('submit');
    await flushPromises();

    const call = fetchMock.mock.calls.find(([url]) => String(url).includes('/inventory/stocktake-adjustment'));
    expect(call?.[1]?.method).toBe('POST');
    expect(JSON.parse(String(call?.[1]?.body))).toEqual({ batchId: '9', actualQuantity: 0, reason: '临期实盘' });
    expect(wrapper.text()).toContain('47 → 0 件');
    expect(wrapper.find('form[aria-label="临期实盘"]').exists()).toBe(false);
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
          items: [{ productId: '1', productName: '临期测试商品', barcodes: ['9400000000002'], batchId: '9', expiryDate: '2026-09', quantity: 7, level: 'URGENT', levelLabel: '紧急临期', daysRemaining: 31, action: { actionId: '2', handlingMethod: '移至临期专区优先销售', status: 'OPEN', completedAt: null, updatedAt: '2026-10-12T01:00:00.000Z' } }],
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
    expect(wrapper.text()).toContain('移至临期专区优先销售');
    expect(wrapper.text()).toContain('完成');
    expect(wrapper.text()).toContain('修改');
    expect(wrapper.text()).toContain('删除预警');
    expect(wrapper.text()).toContain('已过期及6个月内');
    expect(wrapper.text()).toContain('导出 CSV');
    await wrapper.findAll('button').find((button) => button.text() === '删除预警')!.trigger('click');
    expect(wrapper.text()).toContain('删除后该批次不再出现在临期预警中');
    expect(wrapper.text()).toContain('不会删除库存、入库记录或库存流水');
  });

  it('lists items to review and counts a negative batch back to the real quantity', async () => {
    localStorage.setItem('sunshine_inventory_access_token', 'test-token');
    const json = (data: unknown) => new Response(JSON.stringify({ data }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    const review = (quantity: number) => ({
      negative: quantity < 0 ? [{ productId: '270', productName: 'BePure儿童多维60粒', barcode: '9421907678405', batchId: '33', expiryDate: '2027-01', quantity }] : [],
      expired: [{ productId: '7', productName: 'NutraLife 植物消化素60粒', barcode: '9400581003822', batchId: '2148', expiryDate: '2026-01-03', quantity: 28 }],
      posUnmapped: [{ productId: '3734', productName: '8分钟Pro 精华液', barcode: '9421907711157', quantity: 240 }],
    });
    let reviewReads = 0;
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('/inventory/review-items')) return json(review(reviewReads++ === 0 ? -5 : 0));
      if (url.includes('/inventory/stocktake-adjustment')) return json({ movementId: '9', productName: 'BePure儿童多维60粒', expiryDate: '2027-01', previousQuantity: -5, actualQuantity: 1, difference: 6 });
      if (url.includes('/inventory/locations')) return json({ locations: [] });
      return json({ warehouseName: '主仓库', productCount: 0, totalQuantity: 0, products: [] });
    });

    const wrapper = mount(App);
    await wrapper.get('nav').findAll('button')[1].trigger('click');
    await flushPromises();
    await wrapper.findAll('.inventory-section-tabs button').find((button) => button.text() === '待核查')!.trigger('click');
    await flushPromises();

    expect(wrapper.text()).toContain('BePure儿童多维60粒');
    expect(wrapper.text()).toContain('NutraLife 植物消化素60粒');
    expect(wrapper.text()).toContain('8分钟Pro 精华液');
    await wrapper.get('.review-group button.action-primary').trigger('click');
    expect(wrapper.text()).toContain('负库存实盘');
    await wrapper.get('form[aria-label="负库存实盘"] input[type="number"]').setValue(1);
    await wrapper.get('form[aria-label="负库存实盘"]').trigger('submit');
    await flushPromises();

    const call = fetchMock.mock.calls.find(([url]) => String(url).includes('/inventory/stocktake-adjustment'));
    expect(JSON.parse(String(call?.[1]?.body))).toEqual({ batchId: '33', actualQuantity: 1, reason: '负库存实盘' });
    expect(fetchMock.mock.calls.filter(([url]) => String(url).includes('/inventory/review-items'))).toHaveLength(2);
    expect(wrapper.text()).toContain('没有负库存');
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
    expect(inventoryButtons).toHaveLength(4);
    expect(inventoryButtons.map((button) => button.text())).toEqual(['库存台账', '库存盘点', '仓位管理', '待核查']);
    await inventoryButtons[1].trigger('click');

    expect(wrapper.text()).toContain('库存盘点');
    expect(wrapper.get('button[aria-label="打开手机相机扫码筛选盘点商品"]')).toBeTruthy();
    expect(wrapper.get('input[aria-label="筛选盘点商品"]')).toBeTruthy();
    expect(wrapper.text()).toContain('确认调整');
    expect(wrapper.text()).toContain('确认盘点');
    expect(wrapper.text()).toContain('测试商品');
    await wrapper.get('input[aria-label="筛选盘点商品"]').setValue('不存在商品');
    expect(wrapper.text()).toContain('没有找到匹配的盘点商品');
  });

  it('clamps an invalid expiry day when the corrected month has fewer days', async () => {
    localStorage.setItem('sunshine_inventory_access_token', 'test-token');
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify({
      data: { warehouseName: '主仓库', productCount: 1, totalQuantity: 10, products: [{ productId: '1', productName: '日期测试商品', barcodes: ['9400000000031'], batches: [{ batchId: '1', expiryDate: '2026-10-31', expiryPrecision: 'DATE', quantity: 10 }], totalQuantity: 10 }] },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

    const wrapper = mount(App);
    await wrapper.get('nav').findAll('button')[1].trigger('click');
    await flushPromises();
    expect(wrapper.get('button[aria-label="打开手机相机扫码查询库存"]')).toBeTruthy();
    await wrapper.findAll('button').find((button) => button.text() === '修正')!.trigger('click');
    await wrapper.get('.expiry-correction-sheet input[type="month"]').setValue('2038-06');
    await flushPromises();

    const dayInput = wrapper.get('.expiry-correction-sheet input[type="number"]');
    expect(dayInput.attributes('max')).toBe('30');
    expect(dayInput.element).toHaveProperty('value', '30');
    expect(wrapper.text()).toContain('所选月份最多 30 天');
  });

  it('increases an existing inventory batch from the inventory page', async () => {
    localStorage.setItem('sunshine_inventory_access_token', 'test-token');
    const inventory = { warehouseName: '主仓库', productCount: 1, totalQuantity: 10, products: [{
      productId: '2', productName: '测试商品', barcodes: ['9400000000001'],
      batches: [{ batchId: '3', expiryDate: '2027-08', expiryPrecision: 'MONTH', quantity: 10 }], totalQuantity: 10,
    }] };
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: inventory }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { warehouseName: '主仓库', canManage: true, unassignedTotal: 10, locations: [] } }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
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
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { warehouseName: '主仓库', canManage: true, unassignedTotal: 10, locations: [] } }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
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
