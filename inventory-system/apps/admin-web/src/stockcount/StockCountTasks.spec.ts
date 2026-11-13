import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import StockCountTasks from './StockCountTasks.vue';

const task = { id: '3', code: 'RECOUNT-20261024', title: '10-24 重新点货', total: 3, confirmed: 0, ignored: 0, pending: 3 };
const item = (id: string, name: string, overrides: Record<string, unknown> = {}) => ({
  id, productId: `p${id}`, productName: name, brandName: null, barcode: `9421${id}`, priority: 1, reasons: '10-20 入库单叠加在基准数上；多次入库录入',
  source: 'PLANNED', status: 'PENDING', systemQuantity: 222, countedQuantity: null, confirmCount: 0, confirmedAt: null,
  batches: [{ batchId: `b${id}`, expiry: '2028-03-11', quantity: 201 }, { batchId: `c${id}`, expiry: '2028-03', quantity: 21 }],
  ...overrides,
});

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function setup(handler?: (path: string, init?: RequestInit) => Response | undefined) {
  const items = [item('1', 'TheraLady 大金瓶精华液'), item('2', '8+面膜 提亮'), item('3', '贺寿利羊奶', { priority: 2 })];
  const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const path = String(input).replace('/api/v1', '');
    const custom = handler?.(path, init as RequestInit);
    if (custom) return custom;
    if (path === '/inventory/count-tasks/current') return json(200, { data: { task, items } });
    if (path.endsWith('/confirm')) {
      const body = JSON.parse(String((init as RequestInit).body));
      const counted = body.lines.reduce((sum: number, line: { quantity: number }) => sum + line.quantity, 0);
      return json(200, { data: {
        item: { ...item('1', 'TheraLady 大金瓶精华液'), status: 'CONFIRMED', countedQuantity: counted, confirmCount: 1, confirmedAt: '2026-10-24T03:00:00.000Z', systemQuantity: counted, batches: body.lines.map((line: { expiry: string; quantity: number }, index: number) => ({ batchId: `n${index}`, ...line })) },
        task: { ...task, confirmed: 1, pending: 2 },
      } });
    }
    throw new Error(`Unexpected request ${path}`);
  });
  // The sheet is teleported to <body> in the app; render it in place here.
  const wrapper = mount(StockCountTasks, { props: { apiBaseUrl: '/api/v1', token: 'test', scanned: null }, attachTo: document.body, global: { stubs: { teleport: true } } });
  return { wrapper, fetchSpy };
}

afterEach(() => { vi.restoreAllMocks(); document.body.innerHTML = ''; });

describe('StockCountTasks', () => {
  it('shows progress and the pending products by priority', async () => {
    const { wrapper } = setup(); await flushPromises();

    expect(wrapper.get('.count-header strong').text()).toBe('剩余 3');
    expect(wrapper.findAll('.count-tabs button').map((button) => button.text())).toEqual(['高2', '中1', '低0', '已完成0', '已忽略0']);
    expect(wrapper.findAll('.count-list .count-name').map((name) => name.text())).toEqual(['TheraLady 大金瓶精华液', '8+面膜 提亮']);
  });

  it('confirms a corrected count, moves the product to done and opens the next one', async () => {
    const { wrapper, fetchSpy } = setup(); await flushPromises();
    await wrapper.findAll('.count-list button')[0].trigger('click');

    expect(wrapper.get('.count-confirm').text()).toBe('与系统一致，确认');
    await wrapper.findAll('.count-stepper input')[0].setValue(195);
    await wrapper.findAll('.count-month')[1].setValue('2028-04');
    expect((wrapper.findAll('.count-day')[0].element as HTMLSelectElement).value).toBe('11');
    expect(wrapper.get('.count-total').text()).toContain('实点 216 件（-6）');
    expect(wrapper.get('.count-confirm').text()).toBe('确认修改');
    await wrapper.get('.count-confirm').trigger('click'); await flushPromises();

    const call = fetchSpy.mock.calls.find(([url]) => String(url).endsWith('/count-tasks/3/items/1/confirm'))!;
    expect(JSON.parse(String((call[1] as RequestInit).body))).toEqual({
      lines: [{ expiry: '2028-03-11', quantity: 195 }, { expiry: '2028-04', quantity: 21 }],
      expected: [{ batchId: 'b1', quantity: 201 }, { batchId: 'c1', quantity: 21 }],
      requestId: expect.stringMatching(/^[0-9a-f-]{36}$/),
    });
    expect(wrapper.get('.count-toast').text()).toBe('已确认：TheraLady 大金瓶精华液（-6）');
    expect(wrapper.get('.count-sheet h3').text()).toBe('8+面膜 提亮');
    expect(wrapper.get('.count-header strong').text()).toBe('剩余 2');
    expect(wrapper.findAll('.count-tabs button')[3].text()).toBe('已完成1');
  });

  it('blocks invalid expiry dates and reloads when stock moved meanwhile', async () => {
    let conflict = true;
    const { wrapper } = setup((path) => {
      if (path.endsWith('/confirm') && conflict) { conflict = false; return json(409, { message: '该商品库存刚刚发生变化（可能是 POS 刚扣减），请刷新后重新确认' }); }
      return undefined;
    }); await flushPromises();
    await wrapper.findAll('.count-list button')[0].trigger('click');

    await wrapper.findAll('.count-month')[0].setValue('');
    expect(wrapper.get('.count-row small').text()).toBe('请选择到期年月');
    expect(wrapper.get('.count-confirm').attributes('disabled')).toBeDefined();
    await wrapper.findAll('.count-month')[0].setValue('2028-03');
    expect(wrapper.find('.count-row small').exists()).toBe(false);
    await wrapper.get('.count-confirm').trigger('click'); await flushPromises();

    expect(wrapper.get('.count-error').text()).toContain('已刷新为最新库存');
    expect(wrapper.get('.count-sheet h3').text()).toBe('TheraLady 大金瓶精华液');
  });

  it('picks the expiry as a month and an optional day', async () => {
    const { wrapper, fetchSpy } = setup(); await flushPromises();
    await wrapper.findAll('.count-list button')[0].trigger('click');

    expect(wrapper.findAll('.count-month').map((input) => (input.element as HTMLInputElement).type)).toEqual(['month', 'month']);
    await wrapper.findAll('.count-day')[0].setValue('31');
    await wrapper.findAll('.count-month')[0].setValue('2028-02');
    expect(wrapper.get('.count-row small').text()).toBe('所选日期超出该月天数');
    await wrapper.findAll('.count-day')[0].setValue('');
    await wrapper.get('.count-confirm').trigger('click'); await flushPromises();

    const call = fetchSpy.mock.calls.find(([url]) => String(url).endsWith('/confirm'))!;
    expect(JSON.parse(String((call[1] as RequestInit).body)).lines).toEqual([{ expiry: '2028-02', quantity: 201 }, { expiry: '2028-03', quantity: 21 }]);
  });

  it('ignores a discontinued product without counting it and can restore it', async () => {
    const { wrapper, fetchSpy } = setup((path, init) => {
      if (path.endsWith('/items/1/ignore')) return json(200, { data: { item: item('1', 'TheraLady 大金瓶精华液', { status: 'IGNORED' }), task: { ...task, ignored: 1, pending: 2 } } });
      if (path.endsWith('/items/1/restore')) return json(200, { data: { item: item('1', 'TheraLady 大金瓶精华液'), task } });
      return undefined;
    }); await flushPromises();
    await wrapper.findAll('.count-list button')[0].trigger('click');

    await wrapper.get('.count-ignore').trigger('click');
    expect(wrapper.get('.count-ignore-confirm').text()).toContain('系统库存 222 件保持不变');
    expect((wrapper.get('.count-ignore-confirm input').element as HTMLInputElement).checked).toBe(true);
    await wrapper.get('.count-ignore-ok').trigger('click'); await flushPromises();

    const call = fetchSpy.mock.calls.find(([url]) => String(url).endsWith('/items/1/ignore'))!;
    expect(JSON.parse(String((call[1] as RequestInit).body))).toEqual({ alsoHidePurchasing: true });
    expect(wrapper.get('.count-toast').text()).toBe('已忽略：TheraLady 大金瓶精华液');
    expect(wrapper.get('.count-sheet h3').text()).toBe('8+面膜 提亮');
    expect(wrapper.get('.count-progress-text').text()).toBe('已完成 0 · 已忽略 1 / 3');
    await wrapper.get('.count-sheet header button').trigger('click');

    await wrapper.findAll('.count-tabs button')[4].trigger('click');
    expect(wrapper.get('.count-list .count-result').text()).toBe('已忽略 · 系统 222 件保持不变');
    await wrapper.get('.count-list button').trigger('click');
    await wrapper.get('.count-ignored .count-confirm').trigger('click'); await flushPromises();
    expect(wrapper.get('.count-toast').text()).toBe('已恢复为待盘点：TheraLady 大金瓶精华液');
    expect(wrapper.find('.count-ignore').exists()).toBe(true);
  });

  it('caps a batch at 9999 and asks twice before saving an unusually large count (CR-005)', async () => {
    const { wrapper, fetchSpy } = setup(); await flushPromises();
    await wrapper.findAll('.count-list button')[0].trigger('click');

    await wrapper.findAll('.count-stepper input')[0].setValue(100000);
    expect(wrapper.get('.count-row small').text()).toBe('单个批次最多 9999 件，请核对');
    expect(wrapper.get('.count-confirm').attributes('disabled')).toBeDefined();

    await wrapper.findAll('.count-stepper input')[0].setValue(2010);
    await wrapper.get('.count-confirm').trigger('click'); await flushPromises();
    expect(fetchSpy.mock.calls.some(([url]) => String(url).endsWith('/confirm'))).toBe(false);
    expect(wrapper.get('.count-error').text()).toContain('实点 2031 件');
    expect(wrapper.get('.count-confirm').text()).toBe('数量无误，再次确认');

    await wrapper.get('.count-confirm').trigger('click'); await flushPromises();
    expect(fetchSpy.mock.calls.some(([url]) => String(url).endsWith('/count-tasks/3/items/1/confirm'))).toBe(true);
  });

  it('flags POS-unmapped and direct-ship products in the sheet (CR-005)', async () => {
    const { wrapper } = setup((path) => {
      if (path === '/inventory/count-tasks/current') return json(200, { data: { task, items: [item('1', 'Anchor Full cream 1kg SF *6', { posMapped: true, directShip: true }), item('2', '8+面膜 提亮', { posMapped: false })] } });
      return undefined;
    }); await flushPromises();

    await wrapper.findAll('.count-list button')[1].trigger('click');
    expect(wrapper.get('.count-flag').text()).toContain('POS 未对应');

    await wrapper.findAll('.count-list button')[0].trigger('click');
    expect(wrapper.get('.count-flag').text()).toContain('直邮商品');
  });

  it('links a POS-unmapped product by scanning, merging the duplicate after confirmation (REQ-013)', async () => {
    const linkBodies: unknown[] = [];
    const unmapped = item('2', '纽乐辅酶300mg 60粒', { posMapped: false, systemQuantity: 5, batches: [{ batchId: 'b2', expiry: '2028-01', quantity: 5 }] });
    const { wrapper } = setup((path, init) => {
      if (path === '/inventory/count-tasks/current') return json(200, { data: { task, items: [item('1', 'TheraLady 大金瓶精华液', { posMapped: true }), unmapped] } });
      if (path.endsWith('/pos-link')) {
        const body = JSON.parse(String(init?.body));
        linkBodies.push(body);
        const other = { productId: '1250', name: 'nutralife q10 300mg 60cap', posName: 'nutralife q10 300mg 60cap', posMapped: true, stock: 270 };
        return json(200, { data: body.confirm
          ? { result: 'LINKED', merged: other, item: { ...unmapped, posMapped: true }, task }
          : { result: 'CONFIRM_MERGE', other } });
      }
      return undefined;
    }); await flushPromises();

    expect(wrapper.get('.count-unmapped').text()).toContain('POS 未对应 1 种');
    await wrapper.get('.count-unmapped').trigger('click');
    expect(wrapper.findAll('.count-list .count-name').map((name) => name.text())).toEqual(['纽乐辅酶300mg 60粒']);
    await wrapper.get('.count-list button').trigger('click');

    await wrapper.get('.count-link-actions button').trigger('click');
    expect(wrapper.emitted('scan')).toHaveLength(1);
    await wrapper.setProps({ scanned: { code: '9415', at: 1 } }); await flushPromises();
    expect(wrapper.get('.count-link-confirm').text()).toContain('nutralife q10 300mg 60cap');
    expect(wrapper.get('.count-link-warn').text()).toContain('270 件将清零');

    await wrapper.get('.count-link-ok').trigger('click'); await flushPromises();
    expect(linkBodies).toEqual([{ barcode: '9415' }, { barcode: '9415', confirm: true }]);
    expect(wrapper.get('.count-toast').text()).toBe('已对应 POS：nutralife q10 300mg 60cap');
    expect(wrapper.find('.count-link').exists()).toBe(false);
    expect(wrapper.get('.count-sheet h3').text()).toBe('纽乐辅酶300mg 60粒');
  });

  it('starts negative batches from 0 and asks twice when the count is far below the system (REQ-013)', async () => {
    const { wrapper, fetchSpy } = setup((path) => {
      if (path === '/inventory/count-tasks/current') return json(200, { data: { task, items: [
        item('1', 'Nutralife辅酶q10 150mg', { systemQuantity: -11, batches: [{ batchId: 'b1', expiry: '2028-06-30', quantity: -11 }] }),
        item('2', 'swiss120粒护肝', { systemQuantity: 63, batches: [{ batchId: 'b2', expiry: '2028-08', quantity: 63 }] }),
      ] } });
      return undefined;
    }); await flushPromises();

    await wrapper.findAll('.count-list button')[0].trigger('click');
    expect((wrapper.get('.count-stepper input').element as HTMLInputElement).value).toBe('0');

    await wrapper.findAll('.count-list button')[1].trigger('click');
    await wrapper.get('.count-stepper input').setValue(3);
    await wrapper.get('.count-confirm').trigger('click'); await flushPromises();
    expect(fetchSpy.mock.calls.some(([url]) => String(url).endsWith('/confirm'))).toBe(false);
    expect(wrapper.get('.count-error').text()).toContain('不到系统 63 件的一半');
  });

  it('asks before closing a product with unconfirmed changes', async () => {
    const { wrapper } = setup(); await flushPromises();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
    await wrapper.findAll('.count-list button')[0].trigger('click');

    await wrapper.get('.count-sheet header button').trigger('click');
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(wrapper.find('.count-sheet').exists()).toBe(false);

    await wrapper.findAll('.count-list button')[0].trigger('click');
    await wrapper.findAll('.count-stepper input')[0].setValue(190);
    await wrapper.get('.count-sheet header button').trigger('click');
    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(wrapper.find('.count-sheet').exists()).toBe(true);
    await wrapper.get('.count-sheet header button').trigger('click');
    expect(wrapper.find('.count-sheet').exists()).toBe(false);
  });

  it('opens a scanned product from the list or offers to add an unlisted one', async () => {
    const { wrapper } = setup((path, init) => {
      if (path === '/inventory/barcode/9400000000001') return json(200, { data: { productId: 'p99', productName: '康维他蜂胶喷雾' } });
      if (path === '/inventory/count-tasks/3/items' && init?.method === 'POST') return json(200, { data: item('99', '康维他蜂胶喷雾', { source: 'ADDED', reasons: '盘点时临时加入', batches: [] }) });
      return undefined;
    }); await flushPromises();

    await wrapper.setProps({ scanned: { code: '94212', at: 1 } }); await flushPromises();
    expect(wrapper.get('.count-sheet h3').text()).toBe('8+面膜 提亮');
    await wrapper.get('.count-sheet header button').trigger('click');

    await wrapper.setProps({ scanned: { code: '9400000000001', at: 2 } }); await flushPromises();
    expect(wrapper.get('.count-not-listed').text()).toContain('康维他蜂胶喷雾不在本次清单中');
    await wrapper.get('.count-not-listed button').trigger('click'); await flushPromises();
    expect(wrapper.get('.count-sheet h3').text()).toBe('康维他蜂胶喷雾');
    expect(wrapper.get('.count-why').text()).toBe('盘点时临时加入');
    expect(wrapper.findAll('.count-row')).toHaveLength(1);
  });
});
