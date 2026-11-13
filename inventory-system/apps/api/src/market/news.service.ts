import { randomUUID } from 'node:crypto';
import { ConflictException, ForbiddenException, Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import { classificationNames, productCategory, productFunctionDetails } from '../shared/product-taxonomy.js';
import type { CreateNewsSourceDto, NewsRegionCode, UpdateNewsSourceDto } from './news.dto.js';
import { FeedFetchError, fetchFeedText } from './news-fetch.js';
import { looksLikeFeed, NEWS_MAX_AGE_DAYS, NEWS_TOPICS, newsTopics, parseFeed } from './news-feed.js';

// Viewing news needs the same permission as the rest of market analysis; sources and manual refresh are for
// administrators (REQ-016 C1–C5).
const SALES_VIEW = 'management.sales.view';
const CHECK_EVERY_MS = 60 * 60 * 1000;
const FIRST_CHECK_DELAY_MS = 2 * 60 * 1000;
const RETRY_AFTER_FAILURE_MS = 60 * 60 * 1000;
const LIST_LIMIT = 200;
const SCAN_LIMIT = 1000;

type SourceRow = { id: bigint; organizationId: bigint; name: string; url: string; region: NewsRegionCode; enabled: boolean; lastSuccessAt: Date | null; lastFailureAt: Date | null; lastError: string | null };
export type NewsQuery = { days: number; region?: NewsRegionCode; topic?: string; sourceId?: bigint };

@Injectable()
export class NewsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NewsService.name);
  private timer?: NodeJS.Timeout;
  private firstCheck?: NodeJS.Timeout;
  private checking = false;
  // Replaced in tests; reads one feed and returns its text.
  fetchFeed: (url: string) => Promise<string> = fetchFeedText;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    const hours = this.refreshHours();
    if (!hours || process.env.NODE_ENV === 'test') return;
    this.firstCheck = setTimeout(() => void this.refreshDue(), FIRST_CHECK_DELAY_MS);
    this.timer = setInterval(() => void this.refreshDue(), CHECK_EVERY_MS);
    this.firstCheck.unref?.();
    this.timer.unref?.();
    this.logger.log(`Industry news refresh every ${hours} hour(s)`);
  }

  onModuleDestroy() {
    clearTimeout(this.firstCheck);
    clearInterval(this.timer);
  }

  async list(organizationId: bigint, userId: bigint, storeId: bigint, query: NewsQuery) {
    const admin = await this.requireViewer(organizationId, userId, storeId);
    const since = new Date(Date.now() - query.days * 86_400_000);
    const [rows, sources, inStock] = await Promise.all([
      this.prisma.client.newsItem.findMany({
        where: {
          organizationId,
          source: { enabled: true, ...(query.region ? { region: query.region } : {}) },
          ...(query.sourceId ? { sourceId: query.sourceId } : {}),
          OR: [{ publishedAt: { gte: since } }, { publishedAt: null, createdAt: { gte: since } }],
        },
        orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }],
        take: SCAN_LIMIT,
        select: { id: true, title: true, summary: true, link: true, publishedAt: true, createdAt: true, source: { select: { id: true, name: true, region: true } } },
      }),
      this.sourceRows(organizationId),
      this.inStockByTopic(organizationId, storeId),
    ]);
    const tagged = rows
      .map((row) => {
        const topics = newsTopics(`${row.title} ${row.summary ?? ''}`).map((item) => ({
          key: item.key, group: item.group, label: item.label, kind: item.kind, inStock: item.kind === 'other' ? null : inStock.get(item.key) ?? 0,
        }));
        return {
          id: row.id.toString(), title: row.title, summary: row.summary, link: row.link,
          publishedAt: row.publishedAt?.toISOString() ?? null, fetchedAt: row.createdAt.toISOString(),
          source: { id: row.source.id.toString(), name: row.source.name, region: row.source.region },
          topics, related: topics.some((item) => (item.inStock ?? 0) > 0),
        };
      })
      .sort((a, b) => (b.publishedAt ?? b.fetchedAt).localeCompare(a.publishedAt ?? a.fetchedAt));
    const topicCounts = NEWS_TOPICS.map((item) => ({
      key: item.key, group: item.group, label: item.label, kind: item.kind,
      count: tagged.filter((row) => row.topics.some((tag) => tag.key === item.key)).length,
      inStock: item.kind === 'other' ? null : inStock.get(item.key) ?? 0,
    })).filter((item) => item.count > 0).sort((a, b) => b.count - a.count);
    const shown = query.topic ? tagged.filter((row) => row.topics.some((tag) => tag.key === query.topic)) : tagged;
    return {
      days: query.days, canManage: admin,
      summary: { total: tagged.length, related: tagged.filter((row) => row.related).length },
      items: shown.slice(0, LIST_LIMIT), topics: topicCounts,
      sources: sources.map((source) => this.sourceView(source)),
    };
  }

  async sources(organizationId: bigint, userId: bigint, storeId: bigint) {
    await this.requireViewer(organizationId, userId, storeId);
    return (await this.sourceRows(organizationId)).map((source) => this.sourceView(source));
  }

  async createSource(organizationId: bigint, userId: bigint, storeId: bigint, body: CreateNewsSourceDto) {
    await this.requireAdmin(organizationId, userId, storeId);
    const url = new URL(body.url.trim()).toString();
    const exists = await this.prisma.client.newsSource.findFirst({ where: { organizationId, url }, select: { id: true } });
    if (exists) throw new ConflictException('这个 RSS 地址已经添加过');
    const saved = await this.prisma.client.$transaction(async (tx) => {
      const source = await tx.newsSource.create({ data: { organizationId, name: body.name.trim(), url, region: body.region } });
      await tx.auditLog.create({ data: { organizationId, userId, storeId, action: 'news.source.create', entityType: 'NewsSource', entityId: source.id.toString(), requestId: randomUUID(), afterSummary: { name: source.name, url: source.url, region: source.region } } });
      return source;
    });
    // Read the new feed straight away so the administrator sees whether the address works.
    await this.refreshSource(saved);
    const fresh = await this.prisma.client.newsSource.findUniqueOrThrow({ where: { id: saved.id } });
    return this.sourceView(fresh);
  }

  async updateSource(organizationId: bigint, userId: bigint, storeId: bigint, id: bigint, body: UpdateNewsSourceDto) {
    await this.requireAdmin(organizationId, userId, storeId);
    const before = await this.prisma.client.newsSource.findFirst({ where: { id, organizationId } });
    if (!before) throw new NotFoundException('新闻来源不存在');
    const data = {
      ...(body.name !== undefined ? { name: body.name.trim() } : {}),
      ...(body.region !== undefined ? { region: body.region } : {}),
      ...(body.enabled !== undefined ? { enabled: body.enabled } : {}),
    };
    const saved = await this.prisma.client.$transaction(async (tx) => {
      const source = await tx.newsSource.update({ where: { id }, data });
      await tx.auditLog.create({ data: { organizationId, userId, storeId, action: 'news.source.update', entityType: 'NewsSource', entityId: id.toString(), requestId: randomUUID(), beforeSummary: { name: before.name, region: before.region, enabled: before.enabled }, afterSummary: { name: source.name, region: source.region, enabled: source.enabled } } });
      return source;
    });
    return this.sourceView(saved);
  }

  // Manual "立即更新": reads every enabled source of the organization now, whatever its schedule.
  async refreshNow(organizationId: bigint, userId: bigint, storeId: bigint) {
    await this.requireAdmin(organizationId, userId, storeId);
    const sources = await this.prisma.client.newsSource.findMany({ where: { organizationId, enabled: true }, orderBy: { id: 'asc' } });
    const results = [];
    for (const source of sources) results.push({ sourceId: source.id.toString(), name: source.name, ...(await this.refreshSource(source)) });
    await this.prisma.client.auditLog.create({ data: { organizationId, userId, storeId, action: 'news.refresh', entityType: 'NewsSource', requestId: randomUUID(), afterSummary: { sources: results.length, added: results.reduce((sum, row) => sum + row.added, 0), failed: results.filter((row) => row.error).length } } });
    return { results };
  }

  // Scheduled run: each enabled source is read once a day; after a failure it is retried an hour later.
  async refreshDue(now = new Date()) {
    if (this.checking) return;
    this.checking = true;
    try {
      const staleBefore = new Date(now.getTime() - this.refreshHours() * 3_600_000);
      const retryBefore = new Date(now.getTime() - RETRY_AFTER_FAILURE_MS);
      const due = await this.prisma.client.newsSource.findMany({
        where: {
          enabled: true,
          AND: [
            { OR: [{ lastSuccessAt: null }, { lastSuccessAt: { lt: staleBefore } }] },
            { OR: [{ lastFailureAt: null }, { lastFailureAt: { lt: retryBefore } }] },
          ],
        },
        orderBy: { id: 'asc' },
      });
      for (const source of due) await this.refreshSource(source, now);
    } catch (error) {
      this.logger.error(`Industry news refresh failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      this.checking = false;
    }
  }

  // One source failing never stops the others; the reason is kept on the source for the settings list.
  async refreshSource(source: Pick<SourceRow, 'id' | 'organizationId' | 'url' | 'name'>, now = new Date()) {
    try {
      const text = await this.fetchFeed(source.url);
      if (!looksLikeFeed(text)) throw new FeedFetchError('不是 RSS 内容');
      const entries = parseFeed(text, now);
      const created = entries.length ? await this.prisma.client.newsItem.createMany({
        data: entries.map((entry) => ({ organizationId: source.organizationId, sourceId: source.id, ...entry })),
        skipDuplicates: true,
      }) : { count: 0 };
      await this.prisma.client.newsSource.update({ where: { id: source.id }, data: { lastSuccessAt: now, lastError: null } });
      return { read: entries.length, added: created.count, error: null };
    } catch (error) {
      const reason = error instanceof FeedFetchError ? error.message : '读取失败';
      if (!(error instanceof FeedFetchError)) this.logger.warn(`News source ${source.id} (${source.name}) failed: ${error instanceof Error ? error.message : String(error)}`);
      await this.prisma.client.newsSource.update({ where: { id: source.id }, data: { lastFailureAt: now, lastError: reason } });
      return { read: 0, added: 0, error: reason };
    }
  }

  // How many products in stock at the store each topic refers to: function topics by the product's functions,
  // category topics by its category (same rules as market analysis, worked out from names when read).
  private async inStockByTopic(organizationId: bigint, storeId: bigint) {
    const balances = await this.prisma.client.inventoryBalance.groupBy({
      by: ['productId'], where: { organizationId, warehouse: { storeId, status: 'ACTIVE' } }, _sum: { quantity: true },
    });
    const ids = balances.filter((row) => (row._sum.quantity ?? 0) > 0).map((row) => row.productId);
    const counts = new Map<string, number>();
    if (!ids.length) return counts;
    const products = await this.prisma.client.product.findMany({
      where: { organizationId, id: { in: ids }, status: 'ACTIVE' }, select: { name: true, chineseName: true, englishName: true, categoryName: true, storeLabel: true },
    });
    const categoryTopics = NEWS_TOPICS.filter((item) => item.kind === 'category');
    for (const product of products) {
      const names = classificationNames(product);
      const category = productCategory(names, product.categoryName);
      const keys = new Set(productFunctionDetails(names, category).map((detail) => `${detail.group}/${detail.label}`));
      for (const item of categoryTopics) if (category.level1 === item.label || category.level2 === item.label) keys.add(item.key);
      for (const key of keys) counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
  }

  private sourceRows(organizationId: bigint) {
    return this.prisma.client.newsSource.findMany({ where: { organizationId }, orderBy: { id: 'asc' } });
  }

  private sourceView(source: SourceRow) {
    return {
      id: source.id.toString(), name: source.name, url: source.url, region: source.region, enabled: source.enabled,
      lastSuccessAt: source.lastSuccessAt?.toISOString() ?? null, lastFailureAt: source.lastFailureAt?.toISOString() ?? null,
      // Only the latest outcome matters: an old error is not shown once a later read succeeded.
      lastError: source.lastFailureAt && (!source.lastSuccessAt || source.lastFailureAt > source.lastSuccessAt) ? source.lastError : null,
    };
  }

  private refreshHours() {
    const hours = Number(process.env.NEWS_FEED_REFRESH_HOURS ?? 24);
    return Number.isInteger(hours) && hours > 0 ? hours : 0;
  }

  private async requireAdmin(organizationId: bigint, userId: bigint, storeId: bigint) {
    if (!(await this.requireViewer(organizationId, userId, storeId))) throw new ForbiddenException('只有管理员可以维护新闻来源');
  }

  // Returns whether the user is an administrator of the store.
  private async requireViewer(organizationId: bigint, userId: bigint, storeId: bigint) {
    const roles = await this.prisma.client.userStoreRole.findMany({
      where: { userId, storeId, role: { organizationId }, store: { organizationId, status: 'ACTIVE' } },
      select: { role: { select: { code: true, permissions: { select: { permission: { select: { code: true } } } } } } },
    });
    if (!roles.length) throw new ForbiddenException('没有该门店的访问权限');
    const admin = roles.some((item) => item.role.code === 'ADMIN');
    if (!admin && !roles.some((item) => item.role.permissions.some(({ permission }) => permission.code === SALES_VIEW))) {
      throw new ForbiddenException(`缺少经营管理权限：${SALES_VIEW}`);
    }
    return admin;
  }
}


