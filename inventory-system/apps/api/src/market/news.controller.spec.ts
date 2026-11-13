import { jest } from '@jest/globals';
import { BadRequestException } from '@nestjs/common';
import { NewsController } from './news.controller.js';

describe('NewsController (REQ-016 part 3)', () => {
  const request = { inventoryUser: { id: 1n, organizationId: 2n, username: 'admin' } };

  it('passes the store, period, region and topic to the service', async () => {
    const news = { list: jest.fn().mockResolvedValue({ items: [] } as never) };
    const controller = new NewsController(news as never);
    await expect(controller.list(request as never, '3', '7', 'ANZ', '器官养护/益生菌', '5')).resolves.toEqual({ code: 200, message: '行业新闻查询成功', data: { items: [] } });
    expect(news.list).toHaveBeenCalledWith(2n, 1n, 3n, { days: 7, region: 'ANZ', topic: '器官养护/益生菌', sourceId: 5n });
  });

  it('rejects bad parameters before reaching the service', async () => {
    const news = { list: jest.fn(), updateSource: jest.fn() };
    const controller = new NewsController(news as never);
    await expect(controller.list(request as never, '3', '365')).rejects.toBeInstanceOf(BadRequestException);
    await expect(controller.list(request as never, '3', '30', 'MARS')).rejects.toBeInstanceOf(BadRequestException);
    await expect(controller.list(request as never, '3', '30', undefined, '不存在')).rejects.toBeInstanceOf(BadRequestException);
    await expect(controller.list(request as never, undefined)).rejects.toBeInstanceOf(BadRequestException);
    await expect(controller.updateSource(request as never, 'x', '3', {})).rejects.toBeInstanceOf(BadRequestException);
    expect(news.list).not.toHaveBeenCalled();
    expect(news.updateSource).not.toHaveBeenCalled();
  });
});
