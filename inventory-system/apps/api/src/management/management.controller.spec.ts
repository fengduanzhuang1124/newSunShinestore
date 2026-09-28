import { jest } from '@jest/globals';
import { BadRequestException } from '@nestjs/common';
import { ManagementController } from './management.controller.js';

describe('ManagementController POS sync', () => {
  const request = { inventoryUser: { id: 1n, organizationId: 2n, username: 'admin' } };

  it('returns management capabilities for the selected store', async () => {
    const management = { access: jest.fn().mockResolvedValue({ administrator: true } as never) };
    const controller = new ManagementController(management as never);
    await expect(controller.access(request as never, '3')).resolves.toEqual({
      code: 200, message: '经营管理权限查询成功', data: { administrator: true },
    });
    expect(management.access).toHaveBeenCalledWith(2n, 1n, 3n);
  });

  it('runs an observation-only manual sync for the selected store and date', async () => {
    const management = { runPosSync: jest.fn().mockResolvedValue({ inventoryChanged: false } as never) };
    const controller = new ManagementController(management as never);

    await expect(controller.runPosSync(request as never, '3', { date: '2026-09-28', reconcile: true })).resolves.toEqual({
      code: 200,
      message: 'POS手动同步完成',
      data: { inventoryChanged: false },
    });
    expect(management.runPosSync).toHaveBeenCalledWith(2n, 1n, 3n, '2026-09-28', true);
  });

  it('rejects an invalid manual sync date before calling the service', async () => {
    const management = { runPosSync: jest.fn() };
    const controller = new ManagementController(management as never);

    await expect(controller.runPosSync(request as never, '3', { date: '28-09-2026' })).rejects.toBeInstanceOf(BadRequestException);
    expect(management.runPosSync).not.toHaveBeenCalled();
  });

  it('normalizes issue pagination and enforces the maximum page size', async () => {
    const management = { posSyncIssues: jest.fn().mockResolvedValue({ itemIssues: [] } as never) };
    const controller = new ManagementController(management as never);

    await controller.posSyncIssues(request as never, '3', undefined, undefined);
    expect(management.posSyncIssues).toHaveBeenCalledWith(2n, 1n, 3n, 1, 20);
    await expect(controller.posSyncIssues(request as never, '3', '1', '101')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('passes validated sales filters to the sales analysis service', async () => {
    const management = { salesAnalysis: jest.fn().mockResolvedValue({ dataAvailable: true } as never) };
    const controller = new ManagementController(management as never);

    await expect(controller.salesAnalysis(request as never, '3', '2026-09-01', '2026-09-28', 'WEEK', 'Comvita', '蜂蜜')).resolves.toEqual({
      code: 200,
      message: '销售分析查询成功',
      data: { dataAvailable: true },
    });
    expect(management.salesAnalysis).toHaveBeenCalledWith(2n, 1n, 3n, {
      from: '2026-09-01', to: '2026-09-28', dimension: 'WEEK', brand: 'Comvita', category: '蜂蜜',
    });
  });

  it('rejects invalid sales date ranges and dimensions', async () => {
    const controller = new ManagementController({ salesAnalysis: jest.fn() } as never);
    await expect(controller.salesAnalysis(request as never, '3', '2026-09-29', '2026-09-28')).rejects.toBeInstanceOf(BadRequestException);
    await expect(controller.salesAnalysis(request as never, '3', '2026-09-01', '2026-09-28', 'YEAR')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('passes validated product and brand filters to the analysis service', async () => {
    const management = { productsBrandsAnalysis: jest.fn().mockResolvedValue({ productCount: 1 } as never) };
    const controller = new ManagementController(management as never);

    await expect(controller.productsBrands(request as never, '3', '2026-09-01', '2026-09-28', 'mgo 40', 'Manuka Doctor', '蜂蜜')).resolves.toEqual({
      code: 200,
      message: '商品与品牌分析查询成功',
      data: { productCount: 1 },
    });
    expect(management.productsBrandsAnalysis).toHaveBeenCalledWith(2n, 1n, 3n, {
      from: '2026-09-01', to: '2026-09-28', query: 'mgo 40', brand: 'Manuka Doctor', category: '蜂蜜',
    });
  });

  it('validates and passes inventory operation filters', async () => {
    const management = { inventoryOperations: jest.fn().mockResolvedValue({ productCount: 2 } as never) };
    const controller = new ManagementController(management as never);
    await expect(controller.inventoryOperations(request as never, '3', '90', '蜂蜜')).resolves.toEqual({
      code: 200, message: '库存经营分析查询成功', data: { productCount: 2 },
    });
    expect(management.inventoryOperations).toHaveBeenCalledWith(2n, 1n, 3n, 90, '蜂蜜');
    await expect(controller.inventoryOperations(request as never, '3', '20')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('passes a validated period to store comparison', async () => {
    const management = { storeComparison: jest.fn().mockResolvedValue({ storeCount: 1 } as never) };
    const controller = new ManagementController(management as never);
    await expect(controller.storeComparison(request as never, '3', '2026-09-01', '2026-09-28')).resolves.toEqual({
      code: 200, message: '门店经营对比查询成功', data: { storeCount: 1 },
    });
    expect(management.storeComparison).toHaveBeenCalledWith(2n, 1n, 3n, '2026-09-01', '2026-09-28');
  });

  it('validates and saves a manual product insight tag', async () => {
    const management = { assignProductInsightTag: jest.fn().mockResolvedValue({ assignmentId: '8' } as never) };
    const controller = new ManagementController(management as never);
    await expect(controller.assignProductInsightTag(request as never, '3', {
      productId: '9', tagCode: 'health.cardiovascular', tagName: '心血管健康', dimension: 'HEALTH_NEED', confidence: 'HIGH', evidence: '鱼油产品明确对应心血管需求',
    })).resolves.toEqual({ code: 200, message: '商品消费倾向标签保存成功', data: { assignmentId: '8' } });
    expect(management.assignProductInsightTag).toHaveBeenCalledWith(2n, 1n, 3n, {
      productId: 9n, tagCode: 'health.cardiovascular', tagName: '心血管健康', dimension: 'HEALTH_NEED', confidence: 'HIGH', evidence: '鱼油产品明确对应心血管需求',
    });
  });
});
