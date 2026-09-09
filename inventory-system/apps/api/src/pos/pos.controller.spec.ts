import { jest } from '@jest/globals';
import { PosController } from './pos.controller.js';

describe('PosController', () => {
  it('wraps POS order results in the shared API response format', async () => {
    const pos = {
      orders: jest.fn().mockResolvedValue({
        items: [],
        pagination: { page: 1, pageSize: 20, total: 0, pageTotal: 0 },
      } as never),
    };
    const controller = new PosController(pos as never, {} as never);
    const request = {
      inventoryUser: { id: 1n, organizationId: 2n, username: 'admin' },
    };
    const query = { storeId: '3', page: 1, pageSize: 20 };

    await expect(controller.orders(request as never, query)).resolves.toEqual({
      code: 200,
      message: 'POS订单查询成功',
      data: {
        items: [],
        pagination: { page: 1, pageSize: 20, total: 0, pageTotal: 0 },
      },
    });
    expect(pos.orders).toHaveBeenCalledWith(2n, 1n, query);
  });

  it('imports milk candidates through the isolated catalog service', async () => {
    const milkCatalog = {
      importCandidates: jest.fn().mockResolvedValue({ milkCandidates: 12 } as never),
    };
    const controller = new PosController({} as never, milkCatalog as never);
    const request = {
      inventoryUser: { id: 1n, organizationId: 2n, username: 'admin' },
    };

    await expect(
      controller.importMilkProducts(request as never, { storeId: '3' }),
    ).resolves.toEqual({
      code: 200,
      message: 'POS奶粉候选商品导入成功',
      data: { milkCandidates: 12 },
    });
    expect(milkCatalog.importCandidates).toHaveBeenCalledWith(2n, 1n, '3');
  });

  it('reviews a milk candidate through the isolated catalog service', async () => {
    const input = {
      reviewStatus: 'APPROVED' as const,
      inventoryPolicy: 'EXTERNAL_WAREHOUSE' as const,
      packQuantity: 6,
      reason: '确认整箱外仓发货',
      idempotencyKey: '11111111-1111-4111-8111-111111111111',
    };
    const milkCatalog = {
      reviewCandidate: jest.fn().mockResolvedValue({ id: '9', reviewStatus: 'APPROVED' } as never),
    };
    const controller = new PosController({} as never, milkCatalog as never);
    const request = { inventoryUser: { id: 1n, organizationId: 2n, username: 'admin' } };

    await expect(
      controller.reviewMilkProduct(request as never, '9', { storeId: '3' }, input),
    ).resolves.toEqual({
      code: 200,
      message: '奶粉商品审核通过',
      data: { id: '9', reviewStatus: 'APPROVED' },
    });
    expect(milkCatalog.reviewCandidate).toHaveBeenCalledWith(2n, 1n, '3', '9', input);
  });
});
