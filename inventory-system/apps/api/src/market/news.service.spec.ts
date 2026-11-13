import { jest } from '@jest/globals';
import { ConflictException, ForbiddenException } from '@nestjs/common';
import { NewsService } from './news.service.js';
import { FeedFetchError } from './news-fetch.js';

const RSS = `<rss><channel>
  <item><title>Probiotic gut health trial</title><link>https://n.com/1</link><pubDate>Mon, 10 Nov 2026 09:00:00 GMT</pubDate></item>
  <item><title>Agency wins award</title><link>https://n.com/2</link><pubDate>Sun, 09 Nov 2026 09:00:00 GMT</pubDate></item>
</channel></rss>`;

function role(code: string, permissions: string[] = []) {
  return { role: { code, permissions: permissions.map((permission) => ({ permission: { code: permission } })) } };
}

function setup(roles = [role('ADMIN')]) {
  const prisma = {
    userStoreRole: { findMany: jest.fn().mockResolvedValue(roles as never) },
    newsSource: {
      findMany: jest.fn().mockResolvedValue([] as never),
      findFirst: jest.fn().mockResolvedValue(null as never),
      findUniqueOrThrow: jest.fn(),
      update: jest.fn().mockResolvedValue({} as never),
    },
    newsItem: { findMany: jest.fn().mockResolvedValue([] as never), createMany: jest.fn().mockResolvedValue({ count: 2 } as never) },
    inventoryBalance: { groupBy: jest.fn().mockResolvedValue([] as never) },
    product: { findMany: jest.fn().mockResolvedValue([] as never) },
    auditLog: { create: jest.fn().mockResolvedValue({} as never) },
    $transaction: jest.fn(),
  };
  prisma.$transaction.mockImplementation(((callback: (tx: unknown) => unknown) => callback(prisma)) as never);
  const service = new NewsService({ client: prisma } as never);
  return { prisma, service };
}

describe('NewsService (REQ-016 part 3)', () => {
  const now = new Date('2026-11-11T00:00:00Z');
  const source = { id: 5n, organizationId: 2n, url: 'https://n.com/feed', name: 'N' };

  it('stores new articles once and records the successful read', async () => {
    const { prisma, service } = setup();
    service.fetchFeed = jest.fn().mockResolvedValue(RSS as never) as never;
    await expect(service.refreshSource(source, now)).resolves.toEqual({ read: 2, added: 2, error: null });
    expect(prisma.newsItem.createMany).toHaveBeenCalledWith({
      data: [
        { organizationId: 2n, sourceId: 5n, title: 'Probiotic gut health trial', summary: null, link: 'https://n.com/1', publishedAt: new Date('2026-11-10T09:00:00Z') },
        { organizationId: 2n, sourceId: 5n, title: 'Agency wins award', summary: null, link: 'https://n.com/2', publishedAt: new Date('2026-11-09T09:00:00Z') },
      ],
      skipDuplicates: true,
    });
    expect(prisma.newsSource.update).toHaveBeenCalledWith({ where: { id: 5n }, data: { lastSuccessAt: now, lastError: null } });
  });

  it('keeps a failed source to itself and remembers why', async () => {
    const { prisma, service } = setup();
    service.fetchFeed = jest.fn().mockRejectedValue(new FeedFetchError('网站返回 HTTP 404') as never) as never;
    await expect(service.refreshSource(source, now)).resolves.toEqual({ read: 0, added: 0, error: '网站返回 HTTP 404' });
    service.fetchFeed = jest.fn().mockResolvedValue('<html>not a feed</html>' as never) as never;
    await expect(service.refreshSource(source, now)).resolves.toMatchObject({ error: '不是 RSS 内容' });
    service.fetchFeed = jest.fn().mockRejectedValue(new Error('socket hang up at 10.0.0.1') as never) as never;
    await expect(service.refreshSource(source, now)).resolves.toMatchObject({ error: '读取失败' });
    expect(prisma.newsItem.createMany).not.toHaveBeenCalled();
    expect(prisma.newsSource.update).toHaveBeenLastCalledWith({ where: { id: 5n }, data: { lastFailureAt: now, lastError: '读取失败' } });
  });

  it('reads only sources that are due: daily, and an hour after a failure', async () => {
    const { prisma, service } = setup();
    prisma.newsSource.findMany.mockResolvedValue([source] as never);
    service.fetchFeed = jest.fn().mockResolvedValue(RSS as never) as never;
    await service.refreshDue(now);
    const where = (prisma.newsSource.findMany.mock.calls[0][0] as { where: unknown }).where;
    expect(where).toEqual({
      enabled: true,
      AND: [
        { OR: [{ lastSuccessAt: null }, { lastSuccessAt: { lt: new Date('2026-11-10T00:00:00Z') } }] },
        { OR: [{ lastFailureAt: null }, { lastFailureAt: { lt: new Date('2026-11-10T23:00:00Z') } }] },
      ],
    });
    expect(service.fetchFeed).toHaveBeenCalledWith('https://n.com/feed');
  });

  it('lists recent news with topics and how many products in stock each topic covers', async () => {
    const { prisma, service } = setup();
    prisma.newsItem.findMany.mockResolvedValue([
      { id: 1n, title: 'Probiotic gut health trial', summary: null, link: 'https://n.com/1', publishedAt: new Date('2026-11-10T09:00:00Z'), createdAt: now, source: { id: 5n, name: 'N', region: 'GLOBAL' } },
      { id: 2n, title: 'Agency wins award', summary: null, link: 'https://n.com/2', publishedAt: null, createdAt: now, source: { id: 6n, name: 'S', region: 'ANZ' } },
    ] as never);
    prisma.inventoryBalance.groupBy.mockResolvedValue([{ productId: 9n, _sum: { quantity: 4 } }, { productId: 10n, _sum: { quantity: 0 } }] as never);
    prisma.product.findMany.mockResolvedValue([{ name: 'Life Space 益生菌', chineseName: null, englishName: 'Life Space Probiotic', categoryName: null }] as never);
    const result = await service.list(2n, 1n, 3n, { days: 30 });
    expect(prisma.product.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { organizationId: 2n, id: { in: [9n] }, status: 'ACTIVE' } }));
    expect(result.summary).toEqual({ total: 2, related: 1 });
    expect(result.items[0]).toMatchObject({ id: '2', related: false, topics: [] });
    expect(result.items[1]).toMatchObject({ id: '1', related: true, topics: [{ key: '器官养护/益生菌', inStock: 1 }] });
    expect(result.topics).toEqual([{ key: '器官养护/益生菌', group: '器官养护', label: '益生菌', kind: 'function', count: 1, inStock: 1 }]);
    const filtered = await service.list(2n, 1n, 3n, { days: 30, topic: '器官养护/益生菌' });
    expect(filtered.items.map((item) => item.id)).toEqual(['1']);
    expect(filtered.summary.total).toBe(2);
  });

  it('lets sales viewers read news but only administrators change sources', async () => {
    const viewer = setup([role('STAFF', ['management.sales.view'])]);
    await expect(viewer.service.list(2n, 1n, 3n, { days: 7 })).resolves.toMatchObject({ canManage: false });
    await expect(viewer.service.refreshNow(2n, 1n, 3n)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(viewer.service.updateSource(2n, 1n, 3n, 5n, { enabled: false })).rejects.toBeInstanceOf(ForbiddenException);
    const stranger = setup([role('STAFF', ['inventory.receive'])]);
    await expect(stranger.service.list(2n, 1n, 3n, { days: 7 })).rejects.toBeInstanceOf(ForbiddenException);
    const outsider = setup([]);
    await expect(outsider.service.sources(2n, 1n, 3n)).rejects.toThrow('没有该门店的访问权限');
  });

  it('adds a source with an audit record, reads it at once and refuses duplicates', async () => {
    const { prisma, service } = setup();
    const created = { id: 7n, organizationId: 2n, name: 'TGA', url: 'https://tga.example/rss', region: 'ANZ', enabled: true, lastSuccessAt: null, lastFailureAt: null, lastError: null };
    (prisma.newsSource as Record<string, unknown>).create = jest.fn().mockResolvedValue(created as never);
    prisma.newsSource.findUniqueOrThrow.mockResolvedValue({ ...created, lastSuccessAt: now } as never);
    service.fetchFeed = jest.fn().mockResolvedValue(RSS as never) as never;
    await expect(service.createSource(2n, 1n, 3n, { name: ' TGA ', url: 'https://tga.example/rss', region: 'ANZ' })).resolves.toMatchObject({ id: '7', lastSuccessAt: now.toISOString(), lastError: null });
    expect(prisma.auditLog.create).toHaveBeenCalledWith({ data: expect.objectContaining({ action: 'news.source.create', entityId: '7' }) });
    prisma.newsSource.findFirst.mockResolvedValue({ id: 7n } as never);
    await expect(service.createSource(2n, 1n, 3n, { name: 'TGA', url: 'https://tga.example/rss', region: 'ANZ' })).rejects.toBeInstanceOf(ConflictException);
  });
});
