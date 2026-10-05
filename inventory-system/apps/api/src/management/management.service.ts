import { randomUUID } from 'node:crypto';
import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import { calendarDateStart, dateTimeInZone, nextCalendarDateStart } from '../pos/application/pos-date.js';
import { PosObservationService } from '../pos/application/pos-observation.service.js';

type SalesLine = { productName: string; brandName: string; quantity: number; revenue: number };
type SalesAnalysisInput = { from: string; to: string; dimension: 'DAY' | 'WEEK' | 'MONTH'; brand?: string; category?: string };
type ProductsBrandsInput = { from: string; to: string; query?: string; brand?: string; category?: string };
const MANAGEMENT_PERMISSIONS = {
  overview: 'management.overview.view', sales: 'management.sales.view', inventory: 'management.inventory.view',
  posSync: 'management.pos.sync', posIssues: 'management.pos.issues', permissions: 'management.permissions.manage',
} as const;
type ManagementPermission = typeof MANAGEMENT_PERMISSIONS[keyof typeof MANAGEMENT_PERMISSIONS];

@Injectable()
export class ManagementService {
  constructor(private readonly prisma: PrismaService, private readonly posObservation: PosObservationService) {}

  async access(organizationId: bigint, userId: bigint, storeId: bigint) {
    const access = await this.storeAccess(organizationId, userId, storeId);
    const granted = new Set(access.permissions);
    const can = (permission: ManagementPermission) => access.admin || granted.has(permission);
    return {
      store: { id: access.store.id.toString(), name: access.store.name }, roleCodes: access.roleCodes, administrator: access.admin,
      capabilities: {
        overviewView: can(MANAGEMENT_PERMISSIONS.overview), salesView: can(MANAGEMENT_PERMISSIONS.sales),
        inventoryView: can(MANAGEMENT_PERMISSIONS.inventory), posSync: can(MANAGEMENT_PERMISSIONS.posSync),
        posIssues: can(MANAGEMENT_PERMISSIONS.posIssues), permissionsManage: can(MANAGEMENT_PERMISSIONS.permissions),
      },
      permissionCodes: Object.values(MANAGEMENT_PERMISSIONS), grantedPermissionCodes: access.admin ? Object.values(MANAGEMENT_PERMISSIONS) : access.permissions,
    };
  }

  async posDataCheck(organizationId: bigint, userId: bigint, storeId: bigint) {
    const store = await this.requireStorePermission(organizationId, userId, storeId, MANAGEMENT_PERMISSIONS.posIssues);
    const [orderCount, itemCount, mappedItems, unmappedItems, reviewItems, inactiveItems, refundReviews, failedRuns, dateRange] = await Promise.all([
      this.prisma.client.posOrder.count({ where: { organizationId, storeId } }),
      this.prisma.client.posOrderItem.count({ where: { status: 'ACTIVE', order: { organizationId, storeId } } }),
      this.prisma.client.posOrderItem.count({ where: { status: 'ACTIVE', productId: { not: null }, order: { organizationId, storeId } } }),
      this.prisma.client.posOrderItem.count({ where: { status: 'ACTIVE', disposition: 'UNMAPPED', order: { organizationId, storeId } } }),
      this.prisma.client.posOrderItem.count({ where: { status: 'ACTIVE', disposition: 'REVIEW_REQUIRED', order: { organizationId, storeId } } }),
      this.prisma.client.posOrderItem.count({ where: { status: 'INACTIVE', order: { organizationId, storeId } } }),
      this.prisma.client.posRefundReview.count({ where: { status: 'PENDING', order: { organizationId, storeId } } }),
      this.prisma.client.posSyncRun.count({ where: { organizationId, storeId, status: 'FAILED' } }),
      this.prisma.client.posOrder.aggregate({ where: { organizationId, storeId }, _min: { orderedAt: true }, _max: { orderedAt: true } }),
    ]);
    const mappingCoveragePercent = itemCount === 0 ? 0 : Math.round((mappedItems / itemCount) * 10000) / 100;
    const issueCount = unmappedItems + reviewItems + refundReviews;
    return {
      store: { id: store.id.toString(), name: store.name },
      checkedAt: new Date().toISOString(),
      observationOnly: true,
      inventoryChanged: false,
      orders: {
        total: orderCount,
        firstOrderedAt: dateRange._min.orderedAt?.toISOString() ?? null,
        lastOrderedAt: dateRange._max.orderedAt?.toISOString() ?? null,
      },
      items: { total: itemCount, mapped: mappedItems, unmapped: unmappedItems, reviewRequired: reviewItems, inactive: inactiveItems, mappingCoveragePercent },
      issues: { total: issueCount, pendingRefundReviews: refundReviews, failedSyncRuns: failedRuns },
      readiness: orderCount === 0 ? 'WAITING_FOR_DATA' : issueCount > 0 ? 'NEEDS_REVIEW' : 'READY',
      checks: [
        { code: 'ORDERS_PRESENT', passed: orderCount > 0, message: orderCount > 0 ? `已有 ${orderCount} 张订单` : '尚未同步POS订单' },
        { code: 'ITEM_MAPPING', passed: itemCount > 0 && unmappedItems === 0, message: itemCount === 0 ? '尚无销售明细' : `商品映射覆盖率 ${mappingCoveragePercent}%` },
        { code: 'REFUND_REVIEW', passed: refundReviews === 0, message: refundReviews === 0 ? '没有待处理退款' : `${refundReviews} 笔退款需要确认商品` },
        { code: 'INVENTORY_SAFETY', passed: true, message: '当前接口只观察POS数据，不会直接扣减库存' },
      ],
    };
  }

  async posSyncStatus(organizationId: bigint, userId: bigint, storeId: bigint) {
    const store = await this.requireStorePermission(organizationId, userId, storeId, MANAGEMENT_PERMISSIONS.posSync);
    const [cursor, runs, runningCount] = await Promise.all([
      this.prisma.client.posSyncCursor.findUnique({ where: { storeId_provider_stream: { storeId, provider: 'MONI', stream: 'ORDERS' } } }),
      this.prisma.client.posSyncRun.findMany({ where: { organizationId, storeId }, orderBy: { startedAt: 'desc' }, take: 20 }),
      this.prisma.client.posSyncRun.count({ where: { organizationId, storeId, status: 'RUNNING' } }),
    ]);
    const serializeRun = (run: typeof runs[number]) => ({
      id: run.id.toString(), status: run.status, requestedFrom: run.requestedFrom, requestedTo: run.requestedTo,
      startedAt: run.startedAt.toISOString(), finishedAt: run.finishedAt?.toISOString() ?? null,
      ordersObserved: run.ordersObserved, ordersInserted: run.ordersInserted, ordersUpdated: run.ordersUpdated,
      ordersSkipped: run.ordersSkipped, itemsObserved: run.itemsObserved, exceptionsCount: run.exceptionsCount,
      errorCode: run.errorCode, errorMessage: run.errorMessage,
    });
    return {
      store: { id: store.id.toString(), name: store.name }, provider: 'MONI', stream: 'ORDERS',
      running: runningCount > 0,
      cursor: cursor ? { lastSourceTimestamp: cursor.lastSourceTimestamp?.toISOString() ?? null, updatedAt: cursor.updatedAt.toISOString() } : null,
      latestRun: runs[0] ? serializeRun(runs[0]) : null,
      history: runs.map(serializeRun),
    };
  }

  async posSyncIssues(organizationId: bigint, userId: bigint, storeId: bigint, page: number, pageSize: number) {
    const store = await this.requireStorePermission(organizationId, userId, storeId, MANAGEMENT_PERMISSIONS.posIssues);
    const itemWhere = { status: 'ACTIVE' as const, disposition: { in: ['UNMAPPED', 'REVIEW_REQUIRED'] as ('UNMAPPED' | 'REVIEW_REQUIRED')[] }, order: { organizationId, storeId } };
    const [items, itemTotal, refunds, refundTotal, failedRuns] = await Promise.all([
      this.prisma.client.posOrderItem.findMany({
        where: itemWhere, skip: (page - 1) * pageSize, take: pageSize, orderBy: { updatedAt: 'desc' },
        include: { order: { select: { externalOrderNo: true, orderedAt: true } }, product: { select: { name: true } } },
      }),
      this.prisma.client.posOrderItem.count({ where: itemWhere }),
      this.prisma.client.posRefundReview.findMany({
        where: { status: 'PENDING', order: { organizationId, storeId } }, skip: (page - 1) * pageSize, take: pageSize,
        orderBy: { updatedAt: 'desc' }, include: { order: { select: { externalOrderNo: true, orderedAt: true } } },
      }),
      this.prisma.client.posRefundReview.count({ where: { status: 'PENDING', order: { organizationId, storeId } } }),
      this.prisma.client.posSyncRun.findMany({ where: { organizationId, storeId, status: 'FAILED' }, orderBy: { startedAt: 'desc' }, take: 20 }),
    ]);
    return {
      store: { id: store.id.toString(), name: store.name },
      summary: { itemIssues: itemTotal, pendingRefunds: refundTotal, failedRuns: failedRuns.length },
      itemIssues: {
        items: items.map((item) => ({
          id: item.id.toString(), orderNo: item.order.externalOrderNo, orderedAt: item.order.orderedAt.toISOString(),
          externalProductId: item.externalProductId, productName: item.product?.name ?? item.sourceName,
          barcode: item.barcode, quantity: item.quantity.toString(), disposition: item.disposition, reason: item.exclusionReason,
        })),
        pagination: { page, pageSize, total: itemTotal, pageTotal: Math.ceil(itemTotal / pageSize) },
      },
      pendingRefunds: {
        items: refunds.map((refund) => ({
          id: refund.id.toString(), orderNo: refund.order.externalOrderNo, orderedAt: refund.order.orderedAt.toISOString(),
          amount: refund.observedRefundAmount.toString(), reason: refund.reason, createdAt: refund.createdAt.toISOString(),
        })),
        pagination: { page, pageSize, total: refundTotal, pageTotal: Math.ceil(refundTotal / pageSize) },
      },
      failedRuns: failedRuns.map((run) => ({
        id: run.id.toString(), requestedFrom: run.requestedFrom, requestedTo: run.requestedTo,
        startedAt: run.startedAt.toISOString(), finishedAt: run.finishedAt?.toISOString() ?? null,
        errorCode: run.errorCode, errorMessage: run.errorMessage,
      })),
    };
  }

  async runPosSync(organizationId: bigint, userId: bigint, storeId: bigint, date: string, reconcile: boolean) {
    const store = await this.requireStorePermission(organizationId, userId, storeId, MANAGEMENT_PERMISSIONS.posSync);
    const staleBefore = new Date(Date.now() - 30 * 60 * 1000);
    await this.prisma.client.posSyncRun.updateMany({
      where: { organizationId, storeId, status: 'RUNNING', startedAt: { lt: staleBefore } },
      data: { status: 'FAILED', finishedAt: new Date(), errorCode: 'STALE_RUN', errorMessage: '同步进程超过30分钟未结束，已自动标记失败' },
    });
    const running = await this.prisma.client.posSyncRun.findFirst({ where: { organizationId, storeId, status: 'RUNNING' }, select: { id: true } });
    if (running) throw new ConflictException('该门店已有POS同步正在运行，请稍后再试');

    const result = await this.posObservation.observeOrders(organizationId, storeId, date, { reconcile });
    const latestRun = await this.prisma.client.posSyncRun.findFirst({ where: { organizationId, storeId }, orderBy: { startedAt: 'desc' }, select: { id: true, finishedAt: true } });
    await this.prisma.client.auditLog.create({
      data: {
        organizationId, userId, storeId, action: 'management.pos_manual_sync', entityType: 'PosSyncRun',
        entityId: latestRun?.id.toString() ?? null, requestId: randomUUID(),
        afterSummary: { date, reconcile, ...result },
      },
    });
    return {
      store: { id: store.id.toString(), name: store.name }, date, reconcile,
      runId: latestRun?.id.toString() ?? null, finishedAt: latestRun?.finishedAt?.toISOString() ?? null,
      result, inventoryChanged: false,
      message: 'POS订单已写入观察区，未直接扣减正式库存',
    };
  }

  async salesAnalysis(organizationId: bigint, userId: bigint, storeId: bigint, input: SalesAnalysisInput) {
    const store = await this.requireStorePermission(organizationId, userId, storeId, MANAGEMENT_PERMISSIONS.sales);
    const organization = await this.prisma.client.organization.findUniqueOrThrow({
      where: { id: organizationId }, select: { timezone: true, currency: true },
    });
    const start = calendarDateStart(input.from, organization.timezone);
    const end = nextCalendarDateStart(input.to, organization.timezone);
    const duration = end.getTime() - start.getTime();
    const previousEnd = start;
    const previousStart = new Date(start.getTime() - duration);
    const [orders, previousOrders] = await Promise.all([
      this.loadAnalysisOrders(organizationId, storeId, start, end, input),
      this.loadAnalysisOrders(organizationId, storeId, previousStart, previousEnd, input),
    ]);
    const current = this.analyzeOrders(orders, organization.timezone, input);
    const previous = this.analyzeOrders(previousOrders, organization.timezone, input);
    const rate = (value: number, prior: number) => prior === 0 ? null : this.money(((value - prior) / prior) * 100);
    const channels = new Map<string, { channel: string; orders: number; revenue: number }>();
    for (const order of orders) {
      if (!order.orderType) continue;
      const entry = channels.get(order.orderType) ?? { channel: order.orderType, orders: 0, revenue: 0 };
      entry.orders += 1;
      entry.revenue += Number(order.orderAmount ?? 0) - Number(order.refundAmount ?? 0);
      channels.set(order.orderType, entry);
    }
    return {
      store: { id: store.id.toString(), name: store.name }, currency: organization.currency,
      period: { from: input.from, to: input.to, dimension: input.dimension, previousFrom: this.dateInZone(previousStart, organization.timezone), previousTo: this.dateInZone(new Date(previousEnd.getTime() - 1), organization.timezone) },
      filters: { brand: input.brand ?? null, category: input.category ?? null },
      dataAvailable: orders.length > 0,
      channelBreakdownAvailable: channels.size > 0,
      channelNotice: channels.size > 0 ? null : 'POS接口当前尚未提供已确认的订单渠道字段，销售数据按POS总订单统计。',
      refundAllocationAvailable: !input.brand && !input.category,
      refundNotice: input.brand || input.category ? 'POS退款未提供商品级归属，筛选品牌或品类时退款不分摊到单个商品。' : null,
      metrics: current.metrics,
      comparison: {
        netRevenuePercent: rate(current.metrics.netRevenue, previous.metrics.netRevenue),
        orderCountPercent: rate(current.metrics.orderCount, previous.metrics.orderCount),
        unitsSoldPercent: rate(current.metrics.unitsSold, previous.metrics.unitsSold),
        averageOrderValuePercent: rate(current.metrics.averageOrderValue, previous.metrics.averageOrderValue),
      },
      trend: current.trend,
      hourlySales: current.hourlySales,
      weekdaySales: current.weekdaySales,
      topProducts: current.topProducts,
      topBrands: current.topBrands,
      topCategories: current.topCategories,
      channels: [...channels.values()].map((item) => ({ ...item, revenue: this.money(item.revenue) })).sort((a, b) => b.revenue - a.revenue),
      sourceQuality: {
        orders: orders.length,
        activeItems: orders.reduce((sum, order) => sum + order.items.length, 0),
        mappedItems: orders.reduce((sum, order) => sum + order.items.filter((item) => item.productId !== null).length, 0),
        reviewRequiredItems: orders.reduce((sum, order) => sum + order.items.filter((item) => item.disposition === 'UNMAPPED' || item.disposition === 'REVIEW_REQUIRED').length, 0),
      },
    };
  }

  async productsBrandsAnalysis(organizationId: bigint, userId: bigint, storeId: bigint, input: ProductsBrandsInput) {
    const store = await this.requireStorePermission(organizationId, userId, storeId, MANAGEMENT_PERMISSIONS.sales);
    const organization = await this.prisma.client.organization.findUniqueOrThrow({
      where: { id: organizationId }, select: { timezone: true, currency: true },
    });
    const start = calendarDateStart(input.from, organization.timezone);
    const end = nextCalendarDateStart(input.to, organization.timezone);
    const textFilter = input.query ? {
      OR: [
        { sku: { contains: input.query } }, { name: { contains: input.query } },
        { chineseName: { contains: input.query } }, { englishName: { contains: input.query } },
        { barcodes: { some: { status: 'ACTIVE' as const, barcode: { contains: input.query } } } },
      ],
    } : {};
    const productWhere = {
      organizationId, status: 'ACTIVE' as const,
      storeProducts: { some: { storeId, enabled: true } },
      ...(input.brand ? { brandName: { contains: input.brand } } : {}),
      ...(input.category ? { categoryName: { contains: input.category } } : {}),
      ...textFilter,
    };
    const [products, balances, salesItems, activeItemCount, mappedItemCount] = await Promise.all([
      this.prisma.client.product.findMany({
        where: productWhere,
        orderBy: { name: 'asc' },
        select: {
          id: true, sku: true, name: true, chineseName: true, englishName: true, brandName: true, categoryName: true,
          barcodes: { where: { status: 'ACTIVE' }, orderBy: [{ isPrimary: 'desc' }, { id: 'asc' }], select: { barcode: true }, take: 1 },
          storeProducts: { where: { storeId, enabled: true }, select: { sellingPriceCents: true, level4PriceCents: true, minimumStock: true }, take: 1 },
        },
      }),
      this.prisma.client.inventoryBalance.findMany({
        where: { organizationId, warehouse: { storeId, status: 'ACTIVE' }, product: productWhere },
        select: { productId: true, quantity: true },
      }),
      this.prisma.client.posOrderItem.findMany({
        where: { status: 'ACTIVE', product: productWhere, order: { organizationId, storeId, orderedAt: { gte: start, lt: end } } },
        select: { productId: true, quantity: true, unitPrice: true, isMinus: true },
      }),
      this.prisma.client.posOrderItem.count({ where: { status: 'ACTIVE', order: { organizationId, storeId, orderedAt: { gte: start, lt: end } } } }),
      this.prisma.client.posOrderItem.count({ where: { status: 'ACTIVE', productId: { not: null }, order: { organizationId, storeId, orderedAt: { gte: start, lt: end } } } }),
    ]);
    const inventory = new Map<string, number>();
    for (const balance of balances) inventory.set(balance.productId.toString(), (inventory.get(balance.productId.toString()) ?? 0) + balance.quantity);
    const sales = new Map<string, { units: number; revenue: number }>();
    for (const item of salesItems) {
      if (!item.productId) continue;
      const key = item.productId.toString();
      const rawQuantity = Math.abs(Number(item.quantity));
      const units = item.isMinus ? -rawQuantity : rawQuantity;
      const row = sales.get(key) ?? { units: 0, revenue: 0 };
      row.units += units;
      row.revenue += units * Number(item.unitPrice ?? 0);
      sales.set(key, row);
    }
    const productRows = products.map((product) => {
      const key = product.id.toString();
      const sold = sales.get(key) ?? { units: 0, revenue: 0 };
      const currentInventory = inventory.get(key) ?? 0;
      const minimumStock = product.storeProducts[0]?.minimumStock ?? null;
      return {
        productId: key, sku: product.sku,
        productName: product.chineseName || product.name || product.englishName || '未命名商品',
        brandName: this.displayBrand(product.brandName, product.chineseName, product.name, product.englishName), categoryName: product.categoryName || '未标注品类',
        barcode: product.barcodes[0]?.barcode ?? null,
        unitsSold: this.money(sold.units), salesRevenue: this.money(sold.revenue), currentInventory, minimumStock,
        sellingPriceCents: product.storeProducts[0]?.sellingPriceCents ?? product.storeProducts[0]?.level4PriceCents ?? null,
        stockStatus: currentInventory <= 0 ? 'OUT_OF_STOCK' : minimumStock !== null && currentInventory <= minimumStock ? 'LOW' : 'IN_STOCK',
        salesToStockRatio: currentInventory > 0 ? this.money(sold.units / currentInventory) : null,
      };
    }).sort((a, b) => b.salesRevenue - a.salesRevenue || b.unitsSold - a.unitsSold || b.currentInventory - a.currentInventory);
    const group = (field: 'brandName' | 'categoryName') => {
      const rows = new Map<string, { name: string; productCount: number; unitsSold: number; salesRevenue: number; currentInventory: number }>();
      for (const product of productRows) {
        const name = product[field];
        const row = rows.get(name) ?? { name, productCount: 0, unitsSold: 0, salesRevenue: 0, currentInventory: 0 };
        row.productCount += 1; row.unitsSold += product.unitsSold; row.salesRevenue += product.salesRevenue; row.currentInventory += product.currentInventory;
        rows.set(name, row);
      }
      return [...rows.values()].map((row) => ({ ...row, unitsSold: this.money(row.unitsSold), salesRevenue: this.money(row.salesRevenue) })).sort((a, b) => b.salesRevenue - a.salesRevenue || b.currentInventory - a.currentInventory);
    };
    const ratio = (count: number) => products.length === 0 ? 0 : this.money(count / products.length * 100);
    return {
      generatedAt: new Date().toISOString(), store: { id: store.id.toString(), name: store.name }, currency: organization.currency,
      period: { from: input.from, to: input.to }, filters: { query: input.query ?? null, brand: input.brand ?? null, category: input.category ?? null },
      summary: {
        productCount: products.length, soldProductCount: productRows.filter((row) => row.unitsSold !== 0).length,
        unitsSold: this.money(productRows.reduce((sum, row) => sum + row.unitsSold, 0)),
        salesRevenue: this.money(productRows.reduce((sum, row) => sum + row.salesRevenue, 0)),
        currentInventory: productRows.reduce((sum, row) => sum + row.currentInventory, 0),
        lowStockProducts: productRows.filter((row) => row.stockStatus !== 'IN_STOCK').length,
      },
      products: productRows, brands: group('brandName'), categories: group('categoryName'),
      catalogQuality: {
        withBrand: products.filter((product) => Boolean(product.brandName?.trim())).length,
        brandCoveragePercent: ratio(products.filter((product) => Boolean(product.brandName?.trim())).length),
        withCategory: products.filter((product) => Boolean(product.categoryName?.trim())).length,
        categoryCoveragePercent: ratio(products.filter((product) => Boolean(product.categoryName?.trim())).length),
        withBarcode: products.filter((product) => product.barcodes.length > 0).length,
        barcodeCoveragePercent: ratio(products.filter((product) => product.barcodes.length > 0).length), barcodeOptional: true,
      },
      mappingQuality: { activeItems: activeItemCount, mappedItems: mappedItemCount, unmappedOrReviewItems: activeItemCount - mappedItemCount, coveragePercent: activeItemCount ? this.money(mappedItemCount / activeItemCount * 100) : 0 },
      officialCostAvailable: false, marginAvailable: false,
      marginNotice: '正式商品资料尚无已确认成本字段，因此暂不计算商品毛利，避免将POS候选数据误当作正式成本。',
    };
  }

  async inventoryOperations(organizationId: bigint, userId: bigint, storeId: bigint, lookbackDays: number, query?: string) {
    const store = await this.requireStorePermission(organizationId, userId, storeId, MANAGEMENT_PERMISSIONS.inventory);
    const organization = await this.prisma.client.organization.findUniqueOrThrow({
      where: { id: organizationId }, select: { timezone: true },
    });
    const now = new Date();
    const start = new Date(now.getTime() - lookbackDays * 86_400_000);
    const textFilter = query ? {
      OR: [
        { sku: { contains: query } }, { name: { contains: query } },
        { chineseName: { contains: query } }, { englishName: { contains: query } },
        { brandName: { contains: query } }, { categoryName: { contains: query } },
        { barcodes: { some: { status: 'ACTIVE' as const, barcode: { contains: query } } } },
      ],
    } : {};
    const productWhere = {
      organizationId, status: 'ACTIVE' as const, storeProducts: { some: { storeId, enabled: true } }, ...textFilter,
    };
    const [products, balances, salesItems, movements] = await Promise.all([
      this.prisma.client.product.findMany({
        where: productWhere, orderBy: { name: 'asc' },
        select: {
          id: true, sku: true, name: true, chineseName: true, englishName: true, brandName: true, categoryName: true,
          storeProducts: { where: { storeId, enabled: true }, select: { minimumStock: true }, take: 1 },
        },
      }),
      this.prisma.client.inventoryBalance.findMany({
        where: { organizationId, warehouse: { storeId, status: 'ACTIVE' }, product: productWhere },
        select: { productId: true, quantity: true, updatedAt: true },
      }),
      this.prisma.client.posOrderItem.findMany({
        where: { status: 'ACTIVE', product: productWhere, order: { organizationId, storeId, orderedAt: { gte: start, lte: now } } },
        select: { productId: true, quantity: true, isMinus: true, order: { select: { orderedAt: true } } },
      }),
      this.prisma.client.stockMovement.findMany({
        where: { organizationId, storeId, product: productWhere }, orderBy: { createdAt: 'desc' },
        select: { productId: true, createdAt: true },
      }),
    ]);
    const inventory = new Map<string, { quantity: number; updatedAt: Date | null }>();
    for (const balance of balances) {
      const key = balance.productId.toString();
      const row = inventory.get(key) ?? { quantity: 0, updatedAt: null };
      row.quantity += balance.quantity;
      if (!row.updatedAt || balance.updatedAt > row.updatedAt) row.updatedAt = balance.updatedAt;
      inventory.set(key, row);
    }
    const sales = new Map<string, { units: number; lastSoldAt: Date | null }>();
    for (const item of salesItems) {
      if (!item.productId) continue;
      const key = item.productId.toString();
      const raw = Math.abs(Number(item.quantity));
      const units = item.isMinus ? -raw : raw;
      const row = sales.get(key) ?? { units: 0, lastSoldAt: null };
      row.units += units;
      if (!row.lastSoldAt || item.order.orderedAt > row.lastSoldAt) row.lastSoldAt = item.order.orderedAt;
      sales.set(key, row);
    }
    const lastMovement = new Map<string, Date>();
    for (const movement of movements) {
      const key = movement.productId.toString();
      if (!lastMovement.has(key)) lastMovement.set(key, movement.createdAt);
    }
    const rows = products.map((product) => {
      const key = product.id.toString();
      const currentInventory = inventory.get(key)?.quantity ?? 0;
      const minimumStock = product.storeProducts[0]?.minimumStock ?? null;
      const soldUnits = this.money(sales.get(key)?.units ?? 0);
      const dailyVelocity = soldUnits > 0 ? soldUnits / lookbackDays : 0;
      const coverageDays = dailyVelocity > 0 ? this.money(currentInventory / dailyVelocity) : null;
      const daysSinceLastSale = sales.get(key)?.lastSoldAt ? Math.floor((now.getTime() - sales.get(key)!.lastSoldAt!.getTime()) / 86_400_000) : null;
      const stockStatus = currentInventory <= 0 ? 'OUT_OF_STOCK' : minimumStock !== null && currentInventory <= minimumStock ? 'LOW' : 'IN_STOCK';
      const slowMoving = currentInventory > 0 && (soldUnits <= 0 || (daysSinceLastSale !== null && daysSinceLastSale >= Math.min(lookbackDays, 60)) || (coverageDays !== null && coverageDays > 180));
      return {
        productId: key, sku: product.sku, productName: product.chineseName || product.name || product.englishName || '未命名商品',
        brandName: this.displayBrand(product.brandName, product.chineseName, product.name, product.englishName), categoryName: product.categoryName || '未标注品类',
        currentInventory, minimumStock, soldUnits, dailyVelocity: this.money(dailyVelocity), coverageDays,
        lastSoldAt: sales.get(key)?.lastSoldAt?.toISOString() ?? null, daysSinceLastSale,
        lastMovementAt: lastMovement.get(key)?.toISOString() ?? null,
        inventoryUpdatedAt: inventory.get(key)?.updatedAt?.toISOString() ?? null, stockStatus, slowMoving,
      };
    });
    const stocked = rows.filter((row) => row.currentInventory > 0);
    const coverageBuckets = {
      noSales: stocked.filter((row) => row.coverageDays === null).length,
      under30: stocked.filter((row) => row.coverageDays !== null && row.coverageDays < 30).length,
      days30To90: stocked.filter((row) => row.coverageDays !== null && row.coverageDays >= 30 && row.coverageDays <= 90).length,
      over90: stocked.filter((row) => row.coverageDays !== null && row.coverageDays > 90).length,
    };
    return {
      generatedAt: now.toISOString(), store: { id: store.id.toString(), name: store.name },
      period: { lookbackDays, from: this.dateInZone(start, organization.timezone), to: this.dateInZone(now, organization.timezone) },
      summary: {
        productCount: rows.length, stockedProducts: stocked.length,
        totalInventory: rows.reduce((sum, row) => sum + row.currentInventory, 0),
        outOfStockProducts: rows.filter((row) => row.stockStatus === 'OUT_OF_STOCK').length,
        lowStockProducts: rows.filter((row) => row.stockStatus === 'LOW').length,
        slowMovingProducts: rows.filter((row) => row.slowMoving).length,
      },
      coverageBuckets,
      alerts: rows.filter((row) => row.stockStatus !== 'IN_STOCK').sort((a, b) => a.currentInventory - b.currentInventory),
      slowMoving: rows.filter((row) => row.slowMoving).sort((a, b) => b.currentInventory - a.currentInventory),
      products: rows.sort((a, b) => b.currentInventory - a.currentInventory),
      turnoverAvailable: false,
      turnoverNotice: '当前数据库没有连续历史库存快照，不能用当前库存代替平均库存，因此暂不计算标准库存周转率。',
      coverageNotice: `库存覆盖天数按最近${lookbackDays}天POS销量与当前库存估算；无销量商品不生成虚假天数。`,
    };
  }

  async storeComparison(organizationId: bigint, userId: bigint, selectedStoreId: bigint, from: string, to: string) {
    await this.requireStorePermission(organizationId, userId, selectedStoreId, MANAGEMENT_PERMISSIONS.overview);
    const organization = await this.prisma.client.organization.findUniqueOrThrow({
      where: { id: organizationId }, select: { timezone: true, currency: true },
    });
    const start = calendarDateStart(from, organization.timezone);
    const end = nextCalendarDateStart(to, organization.timezone);
    const stores = await this.prisma.client.store.findMany({
      where: { organizationId, status: 'ACTIVE' }, orderBy: { name: 'asc' }, select: { id: true, code: true, name: true },
    });
    const storeIds = stores.map((store) => store.id);
    const [orders, balances, storeProducts] = await Promise.all([
      this.prisma.client.posOrder.findMany({
        where: { organizationId, storeId: { in: storeIds }, orderedAt: { gte: start, lt: end } },
        select: {
          id: true, storeId: true, orderAmount: true, refundAmount: true,
          items: { where: { status: 'ACTIVE' }, select: { quantity: true, isMinus: true } },
        },
      }),
      this.prisma.client.inventoryBalance.findMany({
        where: { organizationId, warehouse: { storeId: { in: storeIds }, status: 'ACTIVE' } },
        select: { productId: true, quantity: true, warehouse: { select: { storeId: true } } },
      }),
      this.prisma.client.storeProduct.findMany({
        where: { storeId: { in: storeIds }, enabled: true, product: { organizationId, status: 'ACTIVE' } },
        select: { storeId: true, productId: true, minimumStock: true },
      }),
    ]);
    const storeRows = stores.map((store) => {
      const storeOrders = orders.filter((order) => order.storeId === store.id);
      const grossRevenue = storeOrders.reduce((sum, order) => sum + Number(order.orderAmount ?? 0), 0);
      const refunds = storeOrders.reduce((sum, order) => sum + Number(order.refundAmount ?? 0), 0);
      const netRevenue = grossRevenue - refunds;
      const unitsSold = storeOrders.reduce((sum, order) => sum + order.items.reduce((itemSum, item) => {
        const quantity = Math.abs(Number(item.quantity));
        return itemSum + (item.isMinus ? -quantity : quantity);
      }, 0), 0);
      const storeBalances = balances.filter((balance) => balance.warehouse.storeId === store.id);
      const inventoryByProduct = new Map<string, number>();
      for (const balance of storeBalances) inventoryByProduct.set(balance.productId.toString(), (inventoryByProduct.get(balance.productId.toString()) ?? 0) + balance.quantity);
      const configuredProducts = storeProducts.filter((product) => product.storeId === store.id);
      const lowStockProducts = configuredProducts.filter((product) => {
        const quantity = inventoryByProduct.get(product.productId.toString()) ?? 0;
        return product.minimumStock !== null && quantity > 0 && quantity <= product.minimumStock;
      }).length;
      const outOfStockProducts = configuredProducts.filter((product) => (inventoryByProduct.get(product.productId.toString()) ?? 0) <= 0).length;
      return {
        store: { id: store.id.toString(), code: store.code, name: store.name }, selected: store.id === selectedStoreId,
        sales: {
          grossRevenue: this.money(grossRevenue), refunds: this.money(refunds), netRevenue: this.money(netRevenue),
          orderCount: storeOrders.length, unitsSold: this.money(unitsSold), averageOrderValue: storeOrders.length ? this.money(netRevenue / storeOrders.length) : 0,
        },
        inventory: {
          totalQuantity: storeBalances.reduce((sum, balance) => sum + balance.quantity, 0),
          productCount: [...inventoryByProduct.values()].filter((quantity) => quantity > 0).length,
          lowStockProducts, outOfStockProducts,
        },
      };
    }).sort((a, b) => b.sales.netRevenue - a.sales.netRevenue || b.sales.orderCount - a.sales.orderCount);
    return {
      generatedAt: new Date().toISOString(), currency: organization.currency, period: { from, to },
      storeCount: storeRows.length, comparisonAvailable: storeRows.length > 1,
      comparisonNotice: storeRows.length > 1 ? null : '当前正式数据库只有一家启用门店，暂无其他门店可比较；页面展示本店经营基线。',
      stores: storeRows,
      ranking: {
        byRevenue: storeRows.map((row) => ({ storeId: row.store.id, storeName: row.store.name, value: row.sales.netRevenue })),
        byOrders: [...storeRows].sort((a, b) => b.sales.orderCount - a.sales.orderCount).map((row) => ({ storeId: row.store.id, storeName: row.store.name, value: row.sales.orderCount })),
        byInventory: [...storeRows].sort((a, b) => b.inventory.totalQuantity - a.inventory.totalQuantity).map((row) => ({ storeId: row.store.id, storeName: row.store.name, value: row.inventory.totalQuantity })),
      },
    };
  }

  async productInsightTags(organizationId: bigint, userId: bigint, storeId: bigint, query?: string) {
    const store = await this.requireStorePermission(organizationId, userId, storeId, MANAGEMENT_PERMISSIONS.sales);
    const textFilter = query ? {
      OR: [{ sku: { contains: query } }, { name: { contains: query } }, { chineseName: { contains: query } }, { englishName: { contains: query } }, { brandName: { contains: query } }],
    } : {};
    const [tags, products] = await Promise.all([
      this.prisma.client.productInsightTag.findMany({
        where: { organizationId }, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        select: { id: true, code: true, name: true, dimension: true, description: true, parentId: true, source: true, externalId: true, sortOrder: true, status: true },
      }),
      this.prisma.client.product.findMany({
        where: { organizationId, status: 'ACTIVE', storeProducts: { some: { storeId, enabled: true } }, ...textFilter },
        orderBy: { name: 'asc' }, take: 200,
        select: {
          id: true, sku: true, name: true, chineseName: true, englishName: true, brandName: true, categoryName: true,
          insightAssignments: {
            where: { reviewStatus: { in: ['PENDING', 'APPROVED'] }, tag: { status: 'ACTIVE' } },
            orderBy: { updatedAt: 'desc' },
            select: { id: true, confidence: true, evidence: true, source: true, reviewStatus: true, updatedAt: true, tag: { select: { code: true, name: true, dimension: true } } },
          },
        },
      }),
    ]);
    const withApproved = products.filter((product) => product.insightAssignments.some((assignment) => assignment.reviewStatus === 'APPROVED')).length;
    const withPending = products.filter((product) => product.insightAssignments.some((assignment) => assignment.reviewStatus === 'PENDING')).length;
    return {
      generatedAt: new Date().toISOString(), store: { id: store.id.toString(), name: store.name },
      disclaimer: '标签描述商品的消费需求与人群倾向，不代表购买者真实年龄、性别或身份。',
      dimensions: [
        { code: 'BUSINESS_CATEGORY', name: '商品分类' }, { code: 'HEALTH_NEED', name: '健康需求' },
        { code: 'AUDIENCE', name: '人群倾向' }, { code: 'USE_CASE', name: '使用场景' },
        { code: 'OPERATION', name: '运营标签' }, { code: 'MARKETING', name: '营销标签' },
      ],
      tags: tags.map((tag) => ({ ...tag, id: tag.id.toString(), parentId: tag.parentId?.toString() ?? null })),
      tagTree: tags.filter((tag) => !tag.parentId).map((tag) => ({
        ...tag, id: tag.id.toString(), parentId: null,
        children: tags.filter((child) => child.parentId === tag.id).map((child) => ({ ...child, id: child.id.toString(), parentId: tag.id.toString() })),
      })),
      coverage: { productCount: products.length, approvedProducts: withApproved, pendingProducts: withPending, untaggedProducts: products.length - withApproved - withPending, approvedCoveragePercent: products.length ? this.money(withApproved / products.length * 100) : 0 },
      products: products.map((product) => ({
        productId: product.id.toString(), sku: product.sku,
        productName: product.chineseName || product.name || product.englishName || '未命名商品',
        brandName: this.displayBrand(product.brandName, product.chineseName, product.name, product.englishName), categoryName: product.categoryName || '未标注品类',
        assignments: product.insightAssignments.map((assignment) => ({ ...assignment, id: assignment.id.toString(), updatedAt: assignment.updatedAt.toISOString() })),
      })),
    };
  }

  async assignProductInsightTag(
    organizationId: bigint, userId: bigint, storeId: bigint,
    input: { productId: bigint; tagCode: string; tagName: string; dimension: 'BUSINESS_CATEGORY' | 'AUDIENCE' | 'HEALTH_NEED' | 'USE_CASE' | 'OPERATION' | 'MARKETING'; confidence: 'LOW' | 'MEDIUM' | 'HIGH'; evidence?: string },
  ) {
    await this.requireStorePermission(organizationId, userId, storeId, MANAGEMENT_PERMISSIONS.permissions);
    const product = await this.prisma.client.product.findFirst({
      where: { id: input.productId, organizationId, status: 'ACTIVE', storeProducts: { some: { storeId, enabled: true } } }, select: { id: true, name: true },
    });
    if (!product) throw new NotFoundException('商品不存在或未在当前门店启用');
    const result = await this.prisma.client.$transaction(async (transaction) => {
      const tag = await transaction.productInsightTag.findFirst({ where: { organizationId, code: input.tagCode, status: 'ACTIVE' } });
      if (!tag) throw new NotFoundException('标签不存在或已停用');
      const assignment = await transaction.productInsightTagAssignment.upsert({
        where: { productId_tagId: { productId: input.productId, tagId: tag.id } },
        update: { confidence: input.confidence, evidence: input.evidence ?? null, source: 'MANUAL', reviewStatus: 'APPROVED', assignedById: userId },
        create: { organizationId, productId: input.productId, tagId: tag.id, confidence: input.confidence, evidence: input.evidence, source: 'MANUAL', reviewStatus: 'APPROVED', assignedById: userId },
      });
      await transaction.auditLog.create({
        data: { organizationId, userId, storeId, action: 'management.product_insight_tag.assign', entityType: 'ProductInsightTagAssignment', entityId: assignment.id.toString(), requestId: randomUUID(), afterSummary: { productId: input.productId.toString(), tagCode: input.tagCode, dimension: input.dimension, confidence: input.confidence, evidence: input.evidence ?? null } },
      });
      return { assignment, tag };
    });
    return { assignmentId: result.assignment.id.toString(), productId: product.id.toString(), productName: product.name, tag: { code: result.tag.code, name: result.tag.name, dimension: result.tag.dimension }, confidence: result.assignment.confidence, reviewStatus: result.assignment.reviewStatus };
  }

  async saveProductInsightTagDefinition(
    organizationId: bigint, userId: bigint, storeId: bigint,
    input: { id?: bigint; name: string; dimension: 'BUSINESS_CATEGORY' | 'AUDIENCE' | 'HEALTH_NEED' | 'USE_CASE' | 'OPERATION' | 'MARKETING'; parentId: bigint | null; description?: string; sortOrder: number; status: 'ACTIVE' | 'INACTIVE' },
  ) {
    await this.requireStorePermission(organizationId, userId, storeId, MANAGEMENT_PERMISSIONS.permissions);
    if (input.parentId) {
      const parent = await this.prisma.client.productInsightTag.findFirst({ where: { id: input.parentId, organizationId }, select: { id: true, parentId: true } });
      if (!parent) throw new NotFoundException('上级标签不存在');
      if (parent.parentId) throw new BadRequestException('当前只支持两级标签，上级必须是一级标签');
      if (input.id && input.parentId === input.id) throw new BadRequestException('标签不能选择自己作为上级');
    }
    const tag = input.id
      ? await this.prisma.client.productInsightTag.update({
          where: { id: input.id, organizationId },
          data: { name: input.name, dimension: input.dimension, parentId: input.parentId, description: input.description ?? null, sortOrder: input.sortOrder, status: input.status },
        })
      : await this.prisma.client.productInsightTag.create({
          data: { organizationId, code: `manual.${randomUUID()}`, name: input.name, dimension: input.dimension, parentId: input.parentId, description: input.description, sortOrder: input.sortOrder, status: input.status, source: 'MANUAL' },
        });
    await this.prisma.client.auditLog.create({
      data: { organizationId, userId, storeId, action: input.id ? 'management.product_insight_tag.update' : 'management.product_insight_tag.create', entityType: 'ProductInsightTag', entityId: tag.id.toString(), requestId: randomUUID(), afterSummary: { name: tag.name, dimension: tag.dimension, parentId: tag.parentId?.toString() ?? null, source: tag.source, status: tag.status } },
    });
    return { ...tag, id: tag.id.toString(), organizationId: tag.organizationId.toString(), parentId: tag.parentId?.toString() ?? null };
  }

  async importProductInsightTags(
    organizationId: bigint, userId: bigint, storeId: bigint,
    categories: { externalId: string; name: string; dimension: 'BUSINESS_CATEGORY' | 'AUDIENCE' | 'HEALTH_NEED' | 'USE_CASE' | 'OPERATION' | 'MARKETING'; parentExternalId: string | null; description?: string; sortOrder: number; status: 'ACTIVE' | 'INACTIVE' }[],
  ) {
    await this.requireStorePermission(organizationId, userId, storeId, MANAGEMENT_PERMISSIONS.permissions);
    const imported = await this.prisma.client.$transaction(async (transaction) => {
      const ids = new Map<string, bigint>();
      for (const item of categories.filter((category) => !category.parentExternalId)) {
        const tag = await transaction.productInsightTag.upsert({
          where: { organizationId_source_externalId: { organizationId, source: 'MINIPROGRAM', externalId: item.externalId } },
          update: { name: item.name, dimension: item.dimension, description: item.description ?? null, parentId: null, sortOrder: item.sortOrder, status: item.status },
          create: { organizationId, code: `miniprogram.${item.externalId}`, name: item.name, dimension: item.dimension, description: item.description, source: 'MINIPROGRAM', externalId: item.externalId, sortOrder: item.sortOrder, status: item.status },
        });
        ids.set(item.externalId, tag.id);
      }
      for (const item of categories.filter((category) => category.parentExternalId)) {
        const parentId = ids.get(item.parentExternalId!);
        if (!parentId) throw new BadRequestException(`找不到上级分类：${item.parentExternalId}`);
        const tag = await transaction.productInsightTag.upsert({
          where: { organizationId_source_externalId: { organizationId, source: 'MINIPROGRAM', externalId: item.externalId } },
          update: { name: item.name, dimension: item.dimension, description: item.description ?? null, parentId, sortOrder: item.sortOrder, status: item.status },
          create: { organizationId, code: `miniprogram.${item.externalId}`, name: item.name, dimension: item.dimension, description: item.description, parentId, source: 'MINIPROGRAM', externalId: item.externalId, sortOrder: item.sortOrder, status: item.status },
        });
        ids.set(item.externalId, tag.id);
      }
      await transaction.auditLog.create({
        data: { organizationId, userId, storeId, action: 'management.product_insight_tag.import', entityType: 'ProductInsightTag', requestId: randomUUID(), afterSummary: { source: 'MINIPROGRAM', count: categories.length, externalIds: categories.map((item) => item.externalId) } },
      });
      return ids;
    });
    return { source: 'MINIPROGRAM', importedCount: imported.size };
  }

  async dataFoundation(organizationId: bigint, userId: bigint, storeId: bigint) {
    await this.requireStorePermission(organizationId, userId, storeId, MANAGEMENT_PERMISSIONS.overview);
    const store = await this.prisma.client.store.findFirstOrThrow({
      where: { id: storeId, organizationId, status: 'ACTIVE' }, select: { id: true, name: true, code: true },
    });

    const [
      products,
      positiveBalances,
      batchCount,
      orderCount,
      orderItemCount,
      mappedOrderItemCount,
      lastSync,
      activeStoreCount,
      activeUserCount,
      auditLogCount,
    ] = await Promise.all([
      this.prisma.client.product.findMany({
        where: { organizationId, status: 'ACTIVE', storeProducts: { some: { storeId, enabled: true } } },
        select: {
          id: true,
          brandName: true,
          categoryName: true,
          barcodes: { where: { status: 'ACTIVE' }, select: { id: true }, take: 1 },
          storeProducts: { where: { storeId }, select: { minimumStock: true, sellingPriceCents: true, level4PriceCents: true }, take: 1 },
        },
      }),
      this.prisma.client.inventoryBalance.findMany({
        where: { organizationId, quantity: { gt: 0 }, warehouse: { storeId, status: 'ACTIVE' } },
        select: { productId: true, batchId: true, quantity: true, updatedAt: true },
      }),
      this.prisma.client.productBatch.count({ where: { organizationId, inventoryBalances: { some: { quantity: { gt: 0 }, warehouse: { storeId } } } } }),
      this.prisma.client.posOrder.count({ where: { organizationId, storeId } }),
      this.prisma.client.posOrderItem.count({ where: { order: { organizationId, storeId }, status: 'ACTIVE' } }),
      this.prisma.client.posOrderItem.count({ where: { order: { organizationId, storeId }, status: 'ACTIVE', productId: { not: null } } }),
      this.prisma.client.posSyncRun.findFirst({
        where: { organizationId, storeId },
        orderBy: { startedAt: 'desc' },
        select: { status: true, startedAt: true, finishedAt: true, errorCode: true, errorMessage: true },
      }),
      this.prisma.client.store.count({ where: { organizationId, status: 'ACTIVE' } }),
      this.prisma.client.userStoreRole.count({ where: { store: { organizationId, status: 'ACTIVE' } } }),
      this.prisma.client.auditLog.count({ where: { organizationId, OR: [{ storeId }, { storeId: null }] } }),
    ]);

    const productCount = products.length;
    const productsWithBarcode = products.filter((product) => product.barcodes.length > 0).length;
    const productsWithBrand = products.filter((product) => Boolean(product.brandName?.trim())).length;
    const productsWithCategory = products.filter((product) => Boolean(product.categoryName?.trim())).length;
    const productsWithMinimumStock = products.filter((product) => product.storeProducts[0]?.minimumStock != null).length;
    const productsWithSellingPrice = products.filter((product) => {
      const storeProduct = product.storeProducts[0];
      return storeProduct?.sellingPriceCents != null || storeProduct?.level4PriceCents != null;
    }).length;
    const inventoryProductCount = new Set(positiveBalances.map((item) => item.productId.toString())).size;
    const latestInventoryUpdate = positiveBalances.reduce<Date | null>((latest, item) => {
      if (!latest || item.updatedAt > latest) return item.updatedAt;
      return latest;
    }, null);
    const ratio = (value: number, total: number) => total === 0 ? 0 : Math.round((value / total) * 10000) / 100;
    const mappingRate = ratio(mappedOrderItemCount, orderItemCount);
    const salesReady = orderCount > 0 && orderItemCount > 0;
    const inventoryReady = positiveBalances.length > 0;

    return {
      generatedAt: new Date().toISOString(),
      store: { id: store.id.toString(), code: store.code, name: store.name },
      overallStatus: inventoryReady && salesReady ? 'PARTIALLY_READY' : 'IN_PROGRESS',
      note: '仅报告正式数据库中的真实数据；缺失模块不会使用演示数据。',
      quality: {
        catalog: {
          productCount,
          productsWithBarcode,
          barcodeCoveragePercent: ratio(productsWithBarcode, productCount),
          productsWithBrand,
          brandCoveragePercent: ratio(productsWithBrand, productCount),
          productsWithCategory,
          categoryCoveragePercent: ratio(productsWithCategory, productCount),
          productsWithSellingPrice,
          sellingPriceCoveragePercent: ratio(productsWithSellingPrice, productCount),
          productsWithMinimumStock,
          minimumStockCoveragePercent: ratio(productsWithMinimumStock, productCount),
          barcodeOptional: true,
        },
        inventory: {
          positiveBalanceRows: positiveBalances.length,
          productCount: inventoryProductCount,
          batchCount,
          totalQuantity: positiveBalances.reduce((sum, item) => sum + item.quantity, 0),
          latestUpdatedAt: latestInventoryUpdate?.toISOString() ?? null,
        },
        sales: {
          orderCount,
          orderItemCount,
          mappedOrderItemCount,
          mappingCoveragePercent: mappingRate,
          lastSync: lastSync ? {
            status: lastSync.status,
            startedAt: lastSync.startedAt.toISOString(),
            finishedAt: lastSync.finishedAt?.toISOString() ?? null,
            errorCode: lastSync.errorCode,
            errorMessage: lastSync.errorMessage,
          } : null,
        },
        governance: { activeStoreCount, storeRoleAssignmentCount: activeUserCount, auditLogCount },
      },
      domains: [
        this.domain('OVERVIEW', inventoryReady ? 'PARTIAL' : 'WAITING_FOR_DATA', ['库存数量', '商品数', '批次数', '临期预警', 'POS同步状态'], salesReady ? [] : ['销售指标等待POS订单数据']),
        this.domain('SALES', salesReady ? (mappingRate === 100 ? 'READY' : 'PARTIAL') : 'WAITING_FOR_DATA', ['销售额', '订单数', '销售件数', '客单价', '月度趋势'], salesReady && mappingRate < 100 ? ['部分销售明细尚未映射到库存商品'] : []),
        this.domain('PRODUCTS_BRANDS', salesReady && productsWithBrand > 0 ? 'PARTIAL' : 'WAITING_FOR_DATA', ['商品销售排行', '品牌销售排行', '品类占比'], ['毛利分析缺少正式采购成本']),
        this.domain('INVENTORY_OPERATIONS', inventoryReady ? 'PARTIAL' : 'WAITING_FOR_DATA', ['库存数量', '临期预警', '出入库流水'], ['周转率和滞销判断需要连续销售数据', '低库存预警需要完善最低库存配置']),
        this.domain('CUSTOMERS', 'BLOCKED', [], ['当前数据库没有可持续识别顾客的顾客编号或会员模型']),
        this.domain('STORES', activeStoreCount > 1 ? 'PARTIAL' : 'WAITING_FOR_DATA', ['门店基础资料'], activeStoreCount > 1 ? ['门店对比等待各门店销售与库存数据完整'] : ['当前只有一家有效门店']),
        this.domain('DATA_PERMISSIONS', 'PARTIAL', ['角色权限', '仓库权限', '操作日志', 'POS同步记录'], ['自动同步调度与备份状态接口尚待接入']),
      ],
      apiCapabilities: {
        overview: { endpoint: '/management/overview', status: 'AVAILABLE' },
        dataFoundation: { endpoint: '/management/data-foundation', status: 'AVAILABLE' },
        salesAnalysis: { endpoint: '/management/sales-analysis', status: 'PLANNED' },
        productsBrands: { endpoint: '/management/products-brands', status: 'PLANNED' },
        inventoryOperations: { endpoint: '/management/inventory-operations', status: 'PLANNED' },
        customerAnalysis: { endpoint: '/management/customer-analysis', status: 'BLOCKED_BY_CUSTOMER_IDENTITY' },
        storeComparison: { endpoint: '/management/store-comparison', status: activeStoreCount > 1 ? 'PLANNED' : 'WAITING_FOR_SECOND_STORE' },
        dataPermissions: { endpoint: '/management/data-permissions', status: 'PLANNED' },
      },
    };
  }

  async overview(organizationId: bigint, userId: bigint, storeId: bigint, requestedMonth?: string) {
    await this.requireStorePermission(organizationId, userId, storeId, MANAGEMENT_PERMISSIONS.overview);
    const [store, organization] = await Promise.all([
      this.prisma.client.store.findFirst({ where: { id: storeId, organizationId, status: 'ACTIVE' }, select: { id: true, name: true } }),
      this.prisma.client.organization.findUnique({
        where: { id: organizationId },
        select: { timezone: true, currency: true },
      }),
    ]);
    if (!store || !organization) throw new NotFoundException('门店不存在');

    const currentMonth = requestedMonth ?? this.monthInZone(new Date(), organization.timezone);
    const previousMonth = this.shiftMonth(currentMonth, -1);
    const currentRange = this.monthRange(currentMonth, organization.timezone);
    const previousRange = this.monthRange(previousMonth, organization.timezone);

    const [currentOrders, previousOrders, balances, expiryPolicy, lastSync, openReceipts, stocktakeAdjustments, movementCount, latestMovement] = await Promise.all([
      this.loadOrders(organizationId, storeId, currentRange.start, currentRange.end),
      this.loadOrders(organizationId, storeId, previousRange.start, previousRange.end),
      this.prisma.client.inventoryBalance.findMany({
        where: { organizationId, quantity: { gt: 0 }, warehouse: { storeId, status: 'ACTIVE' } },
        select: { quantity: true, productId: true, batchId: true, batch: { select: { expiryDate: true } } },
      }),
      this.prisma.client.expiryAlertSetting.findUnique({ where: { organizationId } }),
      this.prisma.client.posSyncRun.findFirst({
        where: { organizationId, storeId, status: 'SUCCEEDED' },
        orderBy: { finishedAt: 'desc' },
        select: { finishedAt: true },
      }),
      this.prisma.client.stockReceipt.count({
        where: { organizationId, storeId, status: 'OPEN' },
      }),
      this.prisma.client.stockMovement.count({
        where: { organizationId, storeId, referenceType: 'STOCKTAKE', createdAt: { gte: currentRange.start, lt: currentRange.end } },
      }),
      this.prisma.client.stockMovement.count({
        where: { organizationId, storeId, createdAt: { gte: currentRange.start, lt: currentRange.end } },
      }),
      this.prisma.client.stockMovement.findFirst({
        where: { organizationId, storeId },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true, movementType: true, quantityDelta: true },
      }),
    ]);

    const current = this.summarizeSales(currentOrders, organization.timezone, currentMonth);
    const previous = this.summarizeSales(previousOrders, organization.timezone, previousMonth);
    const now = new Date();
    const policy = {
      urgentMonths: expiryPolicy?.urgentMonths ?? 2,
      warningMonths: expiryPolicy?.warningMonths ?? 3,
      earlyWarningMonths: expiryPolicy?.earlyWarningMonths ?? 6,
    };
    const expiry = { expired: 0, urgent: 0, warning: 0, early: 0 };
    const addMonths = (months: number) => {
      const date = new Date(now);
      date.setMonth(date.getMonth() + months);
      return date;
    };
    for (const balance of balances) {
      const date = balance.batch.expiryDate;
      if (date < now) expiry.expired += balance.quantity;
      else if (date <= addMonths(policy.urgentMonths)) expiry.urgent += balance.quantity;
      else if (date <= addMonths(policy.warningMonths)) expiry.warning += balance.quantity;
      else if (date <= addMonths(policy.earlyWarningMonths)) expiry.early += balance.quantity;
    }

    return {
      store: { id: store.id.toString(), name: store.name },
      currency: organization.currency,
      period: { month: currentMonth, previousMonth },
      salesAvailable: currentOrders.length > 0 || previousOrders.length > 0,
      lastPosSyncAt: lastSync?.finishedAt?.toISOString() ?? null,
      sales: { current, previous, comparison: this.comparison(current, previous) },
      inventory: {
        productCount: new Set(balances.map((item) => item.productId.toString())).size,
        batchCount: new Set(balances.map((item) => item.batchId.toString())).size,
        totalQuantity: balances.reduce((sum, item) => sum + item.quantity, 0),
        expiry,
        expiryAttentionQuantity: Object.values(expiry).reduce((sum, quantity) => sum + quantity, 0),
        activity: {
          openReceiptCount: openReceipts,
          stocktakeAdjustmentsThisMonth: stocktakeAdjustments,
          movementCountThisMonth: movementCount,
          latestMovement: latestMovement ? {
            createdAt: latestMovement.createdAt.toISOString(),
            movementType: latestMovement.movementType,
            quantityDelta: latestMovement.quantityDelta,
          } : null,
        },
      },
    };
  }

  private loadOrders(organizationId: bigint, storeId: bigint, start: Date, end: Date) {
    return this.prisma.client.posOrder.findMany({
      where: { organizationId, storeId, orderedAt: { gte: start, lt: end } },
      select: {
        orderAmount: true,
        refundAmount: true,
        orderedAt: true,
        items: {
          where: { status: 'ACTIVE' },
          select: { quantity: true, unitPrice: true, isMinus: true, sourceName: true, product: { select: { name: true, chineseName: true, brandName: true } } },
        },
      },
      orderBy: { orderedAt: 'asc' },
    });
  }

  private summarizeSales(orders: Awaited<ReturnType<ManagementService['loadOrders']>>, timeZone: string, month: string) {
    const daily = new Map<string, { revenue: number; orders: number }>();
    const products = new Map<string, SalesLine>();
    const brands = new Map<string, { brandName: string; quantity: number; revenue: number }>();
    let revenue = 0;
    let refunds = 0;
    let unitsSold = 0;
    for (const order of orders) {
      const orderRevenue = Number(order.orderAmount ?? 0);
      revenue += orderRevenue;
      refunds += Number(order.refundAmount ?? 0);
      const date = new Intl.DateTimeFormat('en-CA', { timeZone, month: '2-digit', day: '2-digit' }).format(order.orderedAt);
      const day = daily.get(date) ?? { revenue: 0, orders: 0 };
      day.revenue += orderRevenue;
      day.orders += 1;
      daily.set(date, day);
      for (const item of order.items) {
        const rawQuantity = Math.abs(Number(item.quantity));
        const quantity = item.isMinus ? -rawQuantity : rawQuantity;
        const itemRevenue = quantity * Number(item.unitPrice ?? 0);
        unitsSold += quantity;
        const name = item.product?.chineseName || item.product?.name || item.sourceName || '未命名商品';
        const brandName = this.displayBrand(item.product?.brandName, item.sourceName, item.product?.chineseName, item.product?.name);
        const product = products.get(name) ?? { productName: name, brandName, quantity: 0, revenue: 0 };
        product.quantity += quantity;
        product.revenue += itemRevenue;
        products.set(name, product);
        const brand = brands.get(brandName) ?? { brandName, quantity: 0, revenue: 0 };
        brand.quantity += quantity;
        brand.revenue += itemRevenue;
        brands.set(brandName, brand);
      }
    }
    const netRevenue = revenue - refunds;
    return {
      month,
      revenue: this.money(revenue),
      refunds: this.money(refunds),
      netRevenue: this.money(netRevenue),
      orderCount: orders.length,
      unitsSold: this.money(unitsSold),
      averageOrderValue: orders.length ? this.money(netRevenue / orders.length) : 0,
      dailySales: [...daily.entries()].map(([date, value]) => ({ date, revenue: this.money(value.revenue), orders: value.orders })),
      topProducts: [...products.values()].sort((a, b) => b.revenue - a.revenue || b.quantity - a.quantity).slice(0, 8).map((item) => ({ ...item, quantity: this.money(item.quantity), revenue: this.money(item.revenue) })),
      topBrands: [...brands.values()].sort((a, b) => b.revenue - a.revenue || b.quantity - a.quantity).slice(0, 8).map((item) => ({ ...item, quantity: this.money(item.quantity), revenue: this.money(item.revenue) })),
    };
  }

  private comparison(current: ReturnType<ManagementService['summarizeSales']>, previous: ReturnType<ManagementService['summarizeSales']>) {
    const rate = (value: number, prior: number) => prior === 0 ? null : this.money(((value - prior) / prior) * 100);
    return {
      netRevenuePercent: rate(current.netRevenue, previous.netRevenue),
      orderCountPercent: rate(current.orderCount, previous.orderCount),
      unitsSoldPercent: rate(current.unitsSold, previous.unitsSold),
      averageOrderValuePercent: rate(current.averageOrderValue, previous.averageOrderValue),
    };
  }

  private monthRange(month: string, timeZone: string) {
    const [year, monthValue] = month.split('-').map(Number);
    const next = monthValue === 12 ? { year: year + 1, month: 1 } : { year, month: monthValue + 1 };
    return {
      start: dateTimeInZone(year, monthValue, 1, 0, 0, 0, timeZone),
      end: dateTimeInZone(next.year, next.month, 1, 0, 0, 0, timeZone),
    };
  }

  private monthInZone(date: Date, timeZone: string) {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit' }).formatToParts(date);
    return `${parts.find((part) => part.type === 'year')?.value}-${parts.find((part) => part.type === 'month')?.value}`;
  }

  private shiftMonth(month: string, delta: number) {
    const [year, value] = month.split('-').map(Number);
    const date = new Date(Date.UTC(year, value - 1 + delta, 1));
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
  }

  private loadAnalysisOrders(organizationId: bigint, storeId: bigint, start: Date, end: Date, input: SalesAnalysisInput) {
    const productFilter = {
      ...(input.brand ? { brandName: input.brand } : {}),
      ...(input.category ? { categoryName: input.category } : {}),
    };
    const hasProductFilter = Boolean(input.brand || input.category);
    const itemWhere = {
      status: 'ACTIVE' as const,
      ...(hasProductFilter ? { product: productFilter } : {}),
    };
    return this.prisma.client.posOrder.findMany({
      where: {
        organizationId, storeId, orderedAt: { gte: start, lt: end },
        ...(hasProductFilter ? { items: { some: itemWhere } } : {}),
      },
      orderBy: { orderedAt: 'asc' },
      select: {
        id: true, orderAmount: true, refundAmount: true, orderedAt: true, orderType: true, paymentType: true,
        items: {
          where: itemWhere,
          select: {
            productId: true, sourceName: true, quantity: true, unitPrice: true, isMinus: true, disposition: true,
            product: { select: { name: true, chineseName: true, brandName: true, categoryName: true } },
          },
        },
      },
    });
  }

  private analyzeOrders(orders: Awaited<ReturnType<ManagementService['loadAnalysisOrders']>>, timeZone: string, input: SalesAnalysisInput) {
    const filtered = Boolean(input.brand || input.category);
    const trend = new Map<string, { period: string; revenue: number; orders: Set<string>; units: number }>();
    const hourly = new Map<number, { hour: number; revenue: number; orders: Set<string> }>();
    const weekdays = new Map<number, { weekday: number; revenue: number; orders: Set<string> }>();
    const products = new Map<string, { productName: string; brandName: string; categoryName: string; quantity: number; revenue: number }>();
    const brands = new Map<string, { brandName: string; quantity: number; revenue: number }>();
    const categories = new Map<string, { categoryName: string; quantity: number; revenue: number }>();
    let grossRevenue = 0;
    let refunds = 0;
    let unitsSold = 0;

    for (const order of orders) {
      let lineRevenue = 0;
      let orderUnits = 0;
      for (const item of order.items) {
        const quantity = (item.isMinus ? -1 : 1) * Math.abs(Number(item.quantity));
        const revenue = quantity * Number(item.unitPrice ?? 0);
        lineRevenue += revenue;
        orderUnits += quantity;
        const productName = item.product?.chineseName || item.product?.name || item.sourceName || '未命名商品';
        const brandName = this.displayBrand(item.product?.brandName, item.sourceName, item.product?.chineseName, item.product?.name);
        const categoryName = item.product?.categoryName || '未标注品类';
        const product = products.get(productName) ?? { productName, brandName, categoryName, quantity: 0, revenue: 0 };
        product.quantity += quantity; product.revenue += revenue; products.set(productName, product);
        const brand = brands.get(brandName) ?? { brandName, quantity: 0, revenue: 0 };
        brand.quantity += quantity; brand.revenue += revenue; brands.set(brandName, brand);
        const category = categories.get(categoryName) ?? { categoryName, quantity: 0, revenue: 0 };
        category.quantity += quantity; category.revenue += revenue; categories.set(categoryName, category);
      }
      const orderGross = filtered ? lineRevenue : Number(order.orderAmount ?? lineRevenue);
      const orderRefund = filtered ? 0 : Number(order.refundAmount ?? 0);
      const orderNet = orderGross - orderRefund;
      grossRevenue += orderGross;
      refunds += orderRefund;
      unitsSold += orderUnits;
      const orderKey = order.id.toString();
      const date = this.dateInZone(order.orderedAt, timeZone);
      const period = this.periodKey(date, input.dimension);
      const trendEntry = trend.get(period) ?? { period, revenue: 0, orders: new Set<string>(), units: 0 };
      trendEntry.revenue += orderNet; trendEntry.orders.add(orderKey); trendEntry.units += orderUnits; trend.set(period, trendEntry);
      const hour = Number(new Intl.DateTimeFormat('en-NZ', { timeZone, hour: '2-digit', hourCycle: 'h23' }).format(order.orderedAt));
      const hourEntry = hourly.get(hour) ?? { hour, revenue: 0, orders: new Set<string>() };
      hourEntry.revenue += orderNet; hourEntry.orders.add(orderKey); hourly.set(hour, hourEntry);
      const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
      const weekdayEntry = weekdays.get(weekday) ?? { weekday, revenue: 0, orders: new Set<string>() };
      weekdayEntry.revenue += orderNet; weekdayEntry.orders.add(orderKey); weekdays.set(weekday, weekdayEntry);
    }
    const netRevenue = grossRevenue - refunds;
    const orderCount = orders.length;
    const rank = <T extends { revenue: number; quantity: number }>(values: T[]) => values
      .sort((a, b) => b.revenue - a.revenue || b.quantity - a.quantity).slice(0, 20)
      .map((item) => ({ ...item, revenue: this.money(item.revenue), quantity: this.money(item.quantity) }));
    return {
      metrics: { grossRevenue: this.money(grossRevenue), refunds: this.money(refunds), netRevenue: this.money(netRevenue), orderCount, unitsSold: this.money(unitsSold), averageOrderValue: orderCount ? this.money(netRevenue / orderCount) : 0 },
      trend: [...trend.values()].map((item) => ({ period: item.period, revenue: this.money(item.revenue), orders: item.orders.size, units: this.money(item.units) })),
      hourlySales: Array.from({ length: 24 }, (_, hour) => { const item = hourly.get(hour); return { hour, revenue: this.money(item?.revenue ?? 0), orders: item?.orders.size ?? 0 }; }),
      weekdaySales: Array.from({ length: 7 }, (_, weekday) => { const item = weekdays.get(weekday); return { weekday, revenue: this.money(item?.revenue ?? 0), orders: item?.orders.size ?? 0 }; }),
      topProducts: rank([...products.values()]), topBrands: rank([...brands.values()]), topCategories: rank([...categories.values()]),
    };
  }

  private dateInZone(date: Date, timeZone: string) {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
    const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value;
    return `${value('year')}-${value('month')}-${value('day')}`;
  }

  private periodKey(date: string, dimension: SalesAnalysisInput['dimension']) {
    if (dimension === 'DAY') return date;
    if (dimension === 'MONTH') return date.slice(0, 7);
    const value = new Date(`${date}T00:00:00Z`);
    const weekday = value.getUTCDay() || 7;
    value.setUTCDate(value.getUTCDate() - weekday + 1);
    return value.toISOString().slice(0, 10);
  }

  private money(value: number) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  private displayBrand(explicitBrand: string | null | undefined, ...names: (string | null | undefined)[]) {
    if (explicitBrand?.trim()) return explicitBrand.trim();
    const sourceName = names.find((name) => name?.trim())?.trim() ?? '';
    const normalized = sourceName.toLowerCase().replace(/[\s_-]+/g, '');
    const knownBrands: [RegExp, string][] = [
      [/comvita|康维他/, '康维他 Comvita'],
      [/gohealthy|高之源/, '高之源 GO Healthy'],
      [/vidaglow/, 'Vida Glow'],
      [/mitoq/, 'MitoQ'],
      [/bioisland/, 'Bio Island'],
      [/blackmores|澳佳宝/, '澳佳宝 Blackmores'],
      [/goodhealth|好健康/, '好健康 Good Health'],
      [/bepure/, 'BePure'],
    ];
    const known = knownBrands.find(([pattern]) => pattern.test(normalized));
    if (known) return known[1];
    const leadingName = sourceName.match(/^([A-Za-z][A-Za-z&'-]*(?:\s+[A-Za-z][A-Za-z&'-]*)?)/)?.[1]?.trim();
    return leadingName || '待识别品牌';
  }

  private async requireStorePermission(organizationId: bigint, userId: bigint, storeId: bigint, permission: ManagementPermission) {
    const access = await this.storeAccess(organizationId, userId, storeId);
    if (!access.admin && !access.permissions.includes(permission)) throw new ForbiddenException(`缺少经营管理权限：${permission}`);
    return access.store;
  }

  private async storeAccess(organizationId: bigint, userId: bigint, storeId: bigint) {
    const roles = await this.prisma.client.userStoreRole.findMany({
      where: { userId, storeId, role: { organizationId }, store: { organizationId, status: 'ACTIVE' } },
      select: {
        store: { select: { id: true, name: true } },
        role: { select: { code: true, permissions: { select: { permission: { select: { code: true } } } } } },
      },
    });
    if (!roles.length) throw new ForbiddenException('没有该门店的访问权限');
    return {
      store: roles[0].store, roleCodes: roles.map((item) => item.role.code), admin: roles.some((item) => item.role.code === 'ADMIN'),
      permissions: [...new Set(roles.flatMap((item) => item.role.permissions.map(({ permission }) => permission.code)))],
    };
  }

  private domain(code: string, status: 'READY' | 'PARTIAL' | 'WAITING_FOR_DATA' | 'BLOCKED', availableMetrics: string[], gaps: string[]) {
    return { code, status, availableMetrics, gaps };
  }
}
