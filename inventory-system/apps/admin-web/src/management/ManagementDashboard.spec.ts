import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ManagementDashboard from './ManagementDashboard.vue';

describe('ManagementDashboard', () => {
  afterEach(() => vi.restoreAllMocks());

  it('shows real inventory while clearly identifying unavailable POS sales', async () => {
    const overview = { data: {
      store: { id: '3', name: '汉密尔顿店' }, currency: 'NZD',
      period: { month: '2026-09', previousMonth: '2026-08' }, salesAvailable: false, lastPosSyncAt: null,
      sales: {
        current: { month: '2026-09', revenue: 0, refunds: 0, netRevenue: 0, orderCount: 0, unitsSold: 0, averageOrderValue: 0, dailySales: [], topProducts: [], topBrands: [] },
        previous: { month: '2026-08', revenue: 0, refunds: 0, netRevenue: 0, orderCount: 0, unitsSold: 0, averageOrderValue: 0, dailySales: [], topProducts: [], topBrands: [] },
        comparison: { netRevenuePercent: null, orderCountPercent: null, unitsSoldPercent: null, averageOrderValuePercent: null },
      },
      inventory: {
        productCount: 155, batchCount: 180, totalQuantity: 5615, expiryAttentionQuantity: 26,
        expiry: { expired: 1, urgent: 5, warning: 8, early: 12 },
        activity: { openReceiptCount: 2, stocktakeAdjustmentsThisMonth: 16, movementCountThisMonth: 82, latestMovement: { createdAt: '2026-09-28T01:00:00.000Z', movementType: 'RECEIPT', quantityDelta: 4 } },
      },
    } };
    const foundation = { data: {
      generatedAt: '2026-09-28T01:00:00.000Z', overallStatus: 'IN_PROGRESS', note: '真实数据',
      quality: {
        catalog: { productCount: 180, productsWithBarcode: 150, barcodeCoveragePercent: 83.33, barcodeOptional: true, productsWithBrand: 160, brandCoveragePercent: 88.89, productsWithCategory: 140, categoryCoveragePercent: 77.78, productsWithSellingPrice: 170, sellingPriceCoveragePercent: 94.44, productsWithMinimumStock: 20, minimumStockCoveragePercent: 11.11 },
        inventory: { positiveBalanceRows: 180, productCount: 155, batchCount: 180, totalQuantity: 5615, latestUpdatedAt: '2026-09-28T01:00:00.000Z' },
        sales: { orderCount: 0, orderItemCount: 0, mappedOrderItemCount: 0, mappingCoveragePercent: 0 },
      },
      domains: [
        { code: 'OVERVIEW', status: 'PARTIAL', availableMetrics: ['库存数量'], gaps: ['销售指标等待POS订单数据'] },
        { code: 'INVENTORY_OPERATIONS', status: 'PARTIAL', availableMetrics: ['库存数量'], gaps: ['低库存配置待完善'] },
        { code: 'SALES', status: 'WAITING_FOR_DATA', availableMetrics: [], gaps: ['等待POS订单'] },
      ],
    } };
    const access = { data: { administrator: true, roleCodes: ['ADMIN'], capabilities: { overviewView: true, salesView: true, inventoryView: true, posSync: true, posIssues: true, permissionsManage: true }, grantedPermissionCodes: [] } };
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      const body = url.includes('/management/access') ? access : url.includes('data-foundation') ? foundation : overview;
      return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
    });

    const wrapper = mount(ManagementDashboard, { props: { apiBaseUrl: '/api/v1', token: 'token', storeId: '3', storeName: '汉密尔顿店' } });
    await flushPromises();

    expect(wrapper.text()).toContain('POS 销售数据尚未同步');
    expect(wrapper.text()).toContain('5,615 件');
    expect(wrapper.text()).toContain('155 种商品');
    expect(wrapper.text()).toContain('不会使用演示数据');
    expect(wrapper.text()).toContain('经营关注与待办');
    expect(wrapper.text()).toContain('82 笔流水');
    expect(wrapper.text()).not.toContain('真实库存基础');
    expect(wrapper.text()).not.toContain('条码不是库存商品的必填条件');
    expect(wrapper.find('.data-freshness').text()).toContain('库存更新');
  });
});
