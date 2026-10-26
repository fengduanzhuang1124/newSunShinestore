import { randomUUID } from 'node:crypto';
import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import { calendarDateInZone, calendarDateStart, hourInZone, nextCalendarDateStart } from '../shared/calendar-date.js';
import { PosObservationService } from '../pos/application/pos-observation.service.js';
import { PosInventoryApplicationService } from '../pos/application/pos-inventory-application.service.js';
import { PosRealtimeSyncService } from '../pos/application/pos-realtime-sync.service.js';
import { isCoreReplenishmentProduct } from './core-replenishment.js';
import { purchaseCoverage } from './purchase-coverage.js';
import { ignoreIsActive, isDirectShip, productGroupKey, productNames, setDirectShip } from '../shared/replenishment-rules.js';

// Shipping and international fee lines are charged per kilogram: money received, but not goods sold, so they never
// count as units or appear among products (same names the POS sync treats as non-inventory).
export function isShippingFeeLine(name: string | null | undefined) {
  return /shipping fee|international fee|运费/i.test(name ?? '');
}

type SalesLine = { productId: string | null; productName: string; brandName: string; quantity: number; revenue: number };
type SalesAnalysisInput = { from: string; to: string; dimension: 'DAY' | 'WEEK' | 'MONTH'; brand?: string; category?: string };
type ProductsBrandsInput = { from: string; to: string; query?: string; brand?: string; category?: string };
const DEFAULT_MINIMUM_STOCK = 20;
// Zero-stock products count as out of stock only if they sold within this window (store owner, 2026-10-21).
const SHORTAGE_SALES_WINDOW_DAYS = 180;
// Products received within this many days are listed as arrived instead of being suggested again.
const ARRIVED_WINDOW_DAYS = 7;
const LONG_SALES_WINDOW_DAYS = 90;
// Shelf quantity kept for slow sellers without a configured minimum stock (CR-006 D3).
const DEFAULT_DISPLAY_STOCK = 2;
// Products that will sell out within this many weeks are bought this week (CR-006 D4).
const THIS_WEEK_COVERAGE_WEEKS = 2;
const MANAGEMENT_PERMISSIONS = {
  overview: 'management.overview.view', sales: 'management.sales.view', inventory: 'management.inventory.view',
  posSync: 'management.pos.sync', posIssues: 'management.pos.issues', permissions: 'management.permissions.manage',
} as const;
type ManagementPermission = typeof MANAGEMENT_PERMISSIONS[keyof typeof MANAGEMENT_PERMISSIONS];

@Injectable()
export class ManagementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly posObservation: PosObservationService,
    private readonly posInventoryApplication: PosInventoryApplicationService,
    private readonly posRealtimeSync: PosRealtimeSyncService,
  ) {}

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
    const miscSince = new Date(Date.now() - 7 * 86_400_000);
    const [orderCount, itemCount, nonInventoryItems, mappedItems, unmappedItems, reviewItems, inactiveItems, refundReviews, failedRuns, dateRange, miscSales] = await Promise.all([
      this.prisma.client.posOrder.count({ where: { organizationId, storeId } }),
      this.prisma.client.posOrderItem.count({ where: { status: 'ACTIVE', order: { organizationId, storeId } } }),
      this.prisma.client.posOrderItem.count({ where: { status: 'ACTIVE', disposition: 'NON_INVENTORY', order: { organizationId, storeId } } }),
      this.prisma.client.posOrderItem.count({ where: { status: 'ACTIVE', productId: { not: null }, order: { organizationId, storeId } } }),
      this.prisma.client.posOrderItem.count({ where: { status: 'ACTIVE', disposition: 'UNMAPPED', order: { organizationId, storeId } } }),
      this.prisma.client.posOrderItem.count({ where: { status: 'ACTIVE', disposition: 'REVIEW_REQUIRED', order: { organizationId, storeId } } }),
      this.prisma.client.posOrderItem.count({ where: { status: 'INACTIVE', order: { organizationId, storeId } } }),
      this.prisma.client.posRefundReview.count({ where: { status: 'PENDING', order: { organizationId, storeId } } }),
      this.prisma.client.posSyncRun.count({ where: { organizationId, storeId, status: 'FAILED' } }),
      this.prisma.client.posOrder.aggregate({ where: { organizationId, storeId }, _min: { orderedAt: true }, _max: { orderedAt: true } }),
      // MISC lines hide which product left the shelf (store rule since 2026-10-21: scan the real product and change the price).
      this.prisma.client.posOrderItem.aggregate({
        where: { status: 'ACTIVE', sourceName: { startsWith: 'MISC' }, order: { organizationId, storeId, sourceStatus: 'Paid', orderedAt: { gte: miscSince } } },
        _count: { _all: true }, _sum: { quantity: true },
      }),
    ]);
    const miscLines = miscSales._count._all;
    const mappableItemCount = Math.max(0, itemCount - nonInventoryItems);
    const mappingCoveragePercent = mappableItemCount === 0 ? 0 : Math.round((mappedItems / mappableItemCount) * 10000) / 100;
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
      items: { total: itemCount, mappable: mappableItemCount, nonInventory: nonInventoryItems, mapped: mappedItems, unmapped: unmappedItems, reviewRequired: reviewItems, inactive: inactiveItems, mappingCoveragePercent },
      issues: { total: issueCount, pendingRefundReviews: refundReviews, failedSyncRuns: failedRuns },
      miscSales: { since: miscSince.toISOString(), lines: miscLines, units: Number(miscSales._sum.quantity ?? 0) },
      readiness: orderCount === 0 ? 'WAITING_FOR_DATA' : issueCount > 0 ? 'NEEDS_REVIEW' : 'READY',
      checks: [
        { code: 'NO_MISC_SALES', passed: miscLines === 0, message: miscLines === 0 ? '近7天没有MISC杂项销售' : `近7天有 ${miscLines} 行MISC杂项销售，无法扣减库存；清货请在POS扫实际商品再改价` },
        { code: 'ORDERS_PRESENT', passed: orderCount > 0, message: orderCount > 0 ? `已有 ${orderCount} 张订单` : '尚未同步POS订单' },
        { code: 'ITEM_MAPPING', passed: mappableItemCount > 0 && unmappedItems === 0 && reviewItems === 0, message: mappableItemCount === 0 ? '尚无需要映射的商品销售明细' : `商品映射覆盖率 ${mappingCoveragePercent}%` },
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
      realtime: this.posRealtimeSync.status(),
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

  async barcodeAudit(organizationId: bigint, userId: bigint, storeId: bigint) {
    const store = await this.requireStorePermission(organizationId, userId, storeId, MANAGEMENT_PERMISSIONS.posIssues);
    const [mappings, issueItems, productCandidates, milkCandidates, observedItems] = await Promise.all([
      this.prisma.client.posProductMapping.findMany({
        where: { organizationId, storeId, status: 'ACTIVE' },
        orderBy: [{ barcode: 'asc' }, { externalProductId: 'asc' }],
        select: {
          externalProductId: true, barcode: true, sourceName: true, productId: true,
          product: {
            select: {
              name: true, chineseName: true, englishName: true,
              barcodes: { where: { status: 'ACTIVE' }, select: { barcode: true } },
            },
          },
        },
      }),
      this.prisma.client.posOrderItem.findMany({
        where: {
          status: 'ACTIVE', barcode: { not: null },
          disposition: { in: ['UNMAPPED', 'REVIEW_REQUIRED'] },
          order: { organizationId, storeId },
        },
        select: { externalProductId: true, barcode: true, sourceName: true, quantity: true, disposition: true },
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.client.posProductCandidate.findMany({
        where: { organizationId, storeId, status: 'ACTIVE', barcode: { not: '' } },
        select: { externalProductId: true, barcode: true, sourceName: true },
      }),
      this.prisma.client.posMilkProductCandidate.findMany({
        where: { organizationId, storeId, status: 'ACTIVE', barcode: { not: null } },
        select: { externalProductId: true, barcode: true, sourceName: true },
      }),
      this.prisma.client.posOrderItem.findMany({
        where: { status: 'ACTIVE', barcode: { not: null }, order: { organizationId, storeId } },
        distinct: ['externalProductId'],
        select: { externalProductId: true, barcode: true, sourceName: true },
      }),
    ]);

    const mappingByExternalId = new Map(mappings.map((mapping) => [mapping.externalProductId, mapping]));
    const sourceProducts = new Map<string, { externalProductId: string; barcode: string; sourceName: string | null }>();
    for (const candidate of [...productCandidates, ...milkCandidates, ...observedItems]) {
      if (!candidate.barcode) continue;
      sourceProducts.set(candidate.externalProductId, { externalProductId: candidate.externalProductId, barcode: candidate.barcode, sourceName: candidate.sourceName });
    }
    for (const mapping of mappings) if (!sourceProducts.has(mapping.externalProductId)) sourceProducts.set(mapping.externalProductId, { externalProductId: mapping.externalProductId, barcode: mapping.barcode, sourceName: mapping.sourceName });
    const mappingGroups = new Map<string, { externalProductId: string; barcode: string; sourceName: string | null }[]>();
    for (const mapping of sourceProducts.values()) mappingGroups.set(mapping.barcode, [...(mappingGroups.get(mapping.barcode) ?? []), mapping]);
    const displayProductName = (mapping: typeof mappings[number]) =>
      mapping.product.chineseName || mapping.product.name || mapping.product.englishName || '未命名商品';
    const duplicateBarcodes = [...mappingGroups.entries()]
      .filter(([, rows]) => new Set(rows.map((row) => row.externalProductId)).size > 1)
      .map(([barcode, rows]) => ({
        barcode,
        externalProductCount: new Set(rows.map((row) => row.externalProductId)).size,
        localProductCount: new Set(rows.map((row) => mappingByExternalId.get(row.externalProductId)?.productId.toString()).filter(Boolean)).size,
        nameConflict: new Set(rows.map((row) => row.sourceName?.trim().toLocaleLowerCase()).filter(Boolean)).size > 1,
        mappings: rows.map((row) => {
          const mapping = mappingByExternalId.get(row.externalProductId);
          return {
            externalProductId: row.externalProductId,
            sourceName: row.sourceName,
            productId: mapping?.productId.toString() ?? null,
            productName: mapping ? displayProductName(mapping) : '待人工定义',
          };
        }),
      }))
      .sort((a, b) => Number(b.nameConflict) - Number(a.nameConflict) || b.externalProductCount - a.externalProductCount);
    const localBarcodeMismatches = mappings
      .filter((mapping) => !mapping.product.barcodes.some((barcode) => barcode.barcode === mapping.barcode))
      .map((mapping) => ({
        barcode: mapping.barcode,
        externalProductId: mapping.externalProductId,
        sourceName: mapping.sourceName,
        productId: mapping.productId.toString(),
        productName: displayProductName(mapping),
        productBarcodes: mapping.product.barcodes.map((barcode) => barcode.barcode),
      }));

    const issueGroups = new Map<string, typeof issueItems>();
    for (const item of issueItems) {
      if (!item.barcode) continue;
      const rows = issueGroups.get(item.barcode) ?? [];
      rows.push(item);
      issueGroups.set(item.barcode, rows);
    }
    const unmappedBarcodes = [...issueGroups.entries()].map(([barcode, rows]) => ({
      barcode,
      occurrences: rows.length,
      units: rows.reduce((sum, row) => sum + Math.abs(Number(row.quantity)), 0),
      dispositions: [...new Set(rows.map((row) => row.disposition))],
      products: [...new Map(rows.map((row) => [row.externalProductId, {
        externalProductId: row.externalProductId,
        sourceName: row.sourceName,
      }])).values()],
    })).sort((a, b) => b.occurrences - a.occurrences || a.barcode.localeCompare(b.barcode));

    return {
      store: { id: store.id.toString(), name: store.name },
      generatedAt: new Date().toISOString(),
      summary: {
        duplicateBarcodes: duplicateBarcodes.length,
        duplicateNameConflicts: duplicateBarcodes.filter((row) => row.nameConflict).length,
        localBarcodeMismatches: localBarcodeMismatches.length,
        unmappedBarcodes: unmappedBarcodes.length,
      },
      duplicateBarcodes,
      localBarcodeMismatches,
      unmappedBarcodes,
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
    this.posRealtimeSync.refreshMappingsInBackground(organizationId, storeId);
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

  async previewPosInventoryApplication(
    organizationId: bigint,
    userId: bigint,
    storeId: bigint,
    fromDate: string,
    toDate: string,
  ) {
    await this.requireStorePermission(organizationId, userId, storeId, MANAGEMENT_PERMISSIONS.posSync);
    const organization = await this.prisma.client.organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: { timezone: true },
    });
    const from = calendarDateStart(fromDate, organization.timezone);
    const to = nextCalendarDateStart(toDate, organization.timezone);
    const baseline = await this.posInventoryBaseline(storeId);
    if (to <= baseline) throw new ConflictException('所选日期早于正式库存基准，不能重复扣减历史销量');
    return this.posInventoryApplication.previewRange(
      organizationId, storeId, from < baseline ? baseline : from, to,
    );
  }

  async applyPosInventory(
    organizationId: bigint,
    userId: bigint,
    storeId: bigint,
    fromDate: string,
    toDate: string,
  ) {
    await this.requireStorePermission(organizationId, userId, storeId, MANAGEMENT_PERMISSIONS.posSync);
    const organization = await this.prisma.client.organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: { timezone: true },
    });
    const from = calendarDateStart(fromDate, organization.timezone);
    const to = nextCalendarDateStart(toDate, organization.timezone);
    const baseline = await this.posInventoryBaseline(storeId);
    if (to <= baseline) throw new ConflictException('所选日期早于正式库存基准，不能重复扣减历史销量');
    return this.posInventoryApplication.applyRange(
      organizationId, userId, storeId, from < baseline ? baseline : from, to,
    );
  }

  // Stocked products the POS does not know yet: their sales cannot reduce stock until the POS lists them with the
  // same barcode, after which the hourly mapping refresh links them automatically.
  async posUnlistedStock(organizationId: bigint, userId: bigint, storeId: bigint) {
    await this.requireStorePermission(organizationId, userId, storeId, MANAGEMENT_PERMISSIONS.posSync);
    const productWhere = {
      organizationId, status: 'ACTIVE' as const,
      posProductMappings: { none: { storeId, status: 'ACTIVE' as const } },
    };
    const [stock, products] = await Promise.all([
      this.prisma.client.inventoryBalance.groupBy({
        by: ['productId'], where: { organizationId, warehouse: { storeId, status: 'ACTIVE' }, product: productWhere },
        _sum: { quantity: true },
      }),
      this.prisma.client.product.findMany({
        where: productWhere,
        select: {
          id: true, sku: true, name: true, englishName: true, createdAt: true,
          barcodes: { where: { status: 'ACTIVE' }, orderBy: [{ isPrimary: 'desc' }, { id: 'asc' }], select: { barcode: true } },
        },
      }),
    ]);
    const quantity = new Map(stock.map((row) => [row.productId.toString(), row._sum.quantity ?? 0]));
    const rows = products
      .map((product) => ({
        productId: product.id.toString(), sku: product.sku, productName: product.name, englishName: product.englishName,
        barcodes: product.barcodes.map((row) => row.barcode).filter((barcode) => !barcode.startsWith('LOCAL-')),
        stock: quantity.get(product.id.toString()) ?? 0, createdAt: product.createdAt.toISOString(),
      }))
      .filter((row) => row.stock > 0)
      .sort((a, b) => b.stock - a.stock);
    return { products: rows, totalUnits: rows.reduce((sum, row) => sum + row.stock, 0) };
  }

  async posInventoryReviewLines(organizationId: bigint, userId: bigint, storeId: bigint) {
    await this.requireStorePermission(organizationId, userId, storeId, MANAGEMENT_PERMISSIONS.posSync);
    return { lines: await this.posInventoryApplication.listReviewLines(organizationId, storeId) };
  }

  async reapplyPosInventoryReviewLines(organizationId: bigint, userId: bigint, storeId: bigint, itemIds: bigint[]) {
    await this.requireStorePermission(organizationId, userId, storeId, MANAGEMENT_PERMISSIONS.posSync);
    return this.posInventoryApplication.reapplyLines(organizationId, userId, storeId, itemIds);
  }

  private async posInventoryBaseline(storeId: bigint) {
    const baseline = await this.posInventoryApplication.resolveBaseline(storeId);
    if (!baseline) throw new ConflictException('尚未配置POS正式扣库基准时间');
    return baseline;
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
      period: { from: input.from, to: input.to, dimension: input.dimension, previousFrom: calendarDateInZone(previousStart, organization.timezone), previousTo: calendarDateInZone(new Date(previousEnd.getTime() - 1), organization.timezone) },
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
    const recentSalesStart = new Date(Date.now() - SHORTAGE_SALES_WINDOW_DAYS * 86_400_000);
    const [products, balances, salesItems, activeItemCount, mappedItemCount, recentlySold] = await Promise.all([
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
        where: { status: 'ACTIVE', product: productWhere, order: { organizationId, storeId, sourceStatus: 'Paid', refundAmount: 0, orderedAt: { gte: start, lt: end } } },
        select: { productId: true, quantity: true, unitPrice: true, isMinus: true },
      }),
      this.prisma.client.posOrderItem.count({ where: { status: 'ACTIVE', disposition: { not: 'NON_INVENTORY' }, order: { organizationId, storeId, orderedAt: { gte: start, lt: end } } } }),
      this.prisma.client.posOrderItem.count({ where: { status: 'ACTIVE', productId: { not: null }, order: { organizationId, storeId, orderedAt: { gte: start, lt: end } } } }),
      this.prisma.client.posOrderItem.groupBy({
        by: ['productId'],
        where: {
          status: 'ACTIVE', disposition: 'INVENTORY', isMinus: false, product: productWhere,
          order: { organizationId, storeId, sourceStatus: 'Paid', refundAmount: 0, orderedAt: { gte: recentSalesStart } },
        },
      }),
    ]);
    const soldRecently = new Set(recentlySold.map((row) => row.productId?.toString()));
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
      const coreProduct = isCoreReplenishmentProduct(product.brandName, product.chineseName, product.name, product.englishName, product.categoryName);
      const minimumStock = product.storeProducts[0]?.minimumStock ?? (coreProduct ? DEFAULT_MINIMUM_STOCK : null);
      return {
        productId: key, sku: product.sku,
        productName: product.chineseName || product.name || product.englishName || '未命名商品',
        brandName: this.displayBrand(product.brandName, product.chineseName, product.name, product.englishName), categoryName: product.categoryName || '未标注品类',
        barcode: product.barcodes[0]?.barcode ?? null,
        unitsSold: this.money(sold.units), salesRevenue: this.money(sold.revenue), currentInventory, minimumStock,
        sellingPriceCents: product.storeProducts[0]?.sellingPriceCents ?? product.storeProducts[0]?.level4PriceCents ?? null,
        stockStatus: currentInventory <= 0 ? 'OUT_OF_STOCK' : minimumStock !== null && currentInventory < minimumStock ? 'LOW' : 'IN_STOCK',
        shortageVisible: currentInventory > 0 || soldRecently.has(key),
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
        inStockProducts: productRows.filter((row) => row.currentInventory > 0).length,
        outOfStockProducts: productRows.filter((row) => row.stockStatus === 'OUT_OF_STOCK' && row.shortageVisible).length,
        lowStockProducts: productRows.filter((row) => row.stockStatus === 'LOW').length,
        minimumStockConfiguredProducts: productRows.filter((row) => row.minimumStock !== null).length,
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
    const shortageHistoryStart = new Date(now.getTime() - SHORTAGE_SALES_WINDOW_DAYS * 86_400_000);
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
    const [products, balances, salesItems, movements, salesRange, hiddenRows, expiredStock] = await Promise.all([
      this.prisma.client.product.findMany({
        where: productWhere, orderBy: { name: 'asc' },
        select: {
          id: true, sku: true, name: true, chineseName: true, englishName: true, brandName: true, categoryName: true,
          storeProducts: { where: { storeId, enabled: true }, select: { minimumStock: true, directShip: true }, take: 1 },
          posProductMappings: { where: { storeId, status: 'ACTIVE' }, select: { id: true }, take: 1 },
        },
      }),
      this.prisma.client.inventoryBalance.findMany({
        where: { organizationId, warehouse: { storeId, status: 'ACTIVE' }, product: productWhere },
        select: { productId: true, quantity: true, updatedAt: true },
      }),
      this.prisma.client.posOrderItem.findMany({
        where: {
          status: 'ACTIVE', disposition: 'INVENTORY', product: productWhere,
          order: { organizationId, storeId, sourceStatus: 'Paid', refundAmount: 0, orderedAt: { gte: shortageHistoryStart, lte: now } },
        },
        select: { productId: true, quantity: true, isMinus: true, order: { select: { orderedAt: true } } },
      }),
      this.prisma.client.stockMovement.findMany({
        where: { organizationId, storeId, product: productWhere }, orderBy: { createdAt: 'desc' },
        select: { productId: true, createdAt: true },
      }),
      this.prisma.client.posOrder.aggregate({
        where: { organizationId, storeId, orderedAt: { gte: start, lte: now } },
        _min: { orderedAt: true }, _max: { orderedAt: true },
      }),
      this.prisma.client.purchaseSuggestionIgnore.findMany({
        where: { organizationId, storeId, OR: [{ restoredAt: null }, { restoredAt: { gt: now } }] },
        select: { productId: true, reason: true, ignoredAt: true, restoredAt: true },
      }),
      this.prisma.client.inventoryBalance.aggregate({
        where: {
          organizationId, quantity: { gt: 0 }, warehouse: { storeId, status: 'ACTIVE' },
          batch: { expiryDate: { lt: calendarDateStart(calendarDateInZone(now, organization.timezone), 'UTC') } },
        },
        _count: { _all: true }, _sum: { quantity: true },
      }),
    ]);
    const firstObservedSaleAt = salesRange._min.orderedAt;
    const lastObservedSaleAt = salesRange._max.orderedAt;
    const observedDays = firstObservedSaleAt
      ? Math.max(1, Math.min(lookbackDays, Math.ceil((now.getTime() - firstObservedSaleAt.getTime()) / 86_400_000) + 1))
      : 0;
    const minimumReliableDays = Math.min(30, lookbackDays);
    const salesCoverageReliable = observedDays >= minimumReliableDays;
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
      if (item.order.orderedAt >= start) row.units += units;
      if (!row.lastSoldAt || item.order.orderedAt > row.lastSoldAt) row.lastSoldAt = item.order.orderedAt;
      sales.set(key, row);
    }
    const lastMovement = new Map<string, Date>();
    for (const movement of movements) {
      const key = movement.productId.toString();
      if (!lastMovement.has(key)) lastMovement.set(key, movement.createdAt);
    }
    const hidden = new Map(hiddenRows.map((row) => [row.productId.toString(), row]));
    const rows = products.map((product) => {
      const key = product.id.toString();
      const productName = product.chineseName || product.name || product.englishName || '未命名商品';
      const directShipExcluded = isDirectShip(product.storeProducts[0]?.directShip, productNames(product));
      const currentInventory = inventory.get(key)?.quantity ?? 0;
      const ignoreRow = hidden.get(key);
      const hiddenRow = ignoreRow && ignoreIsActive(ignoreRow, now) ? ignoreRow : undefined;
      const configuredMinimumStock = product.storeProducts[0]?.minimumStock ?? null;
      // Low-stock alerts only for steadily selling core brands and lanolin unless a minimum is set by hand.
      const coreProduct = isCoreReplenishmentProduct(product.brandName, product.chineseName, product.name, product.englishName, product.categoryName);
      const minimumStock = configuredMinimumStock ?? (coreProduct ? DEFAULT_MINIMUM_STOCK : null);
      const posMapped = product.posProductMappings.length > 0;
      const soldUnits = this.money(sales.get(key)?.units ?? 0);
      const dailyVelocity = soldUnits > 0 && observedDays > 0 ? soldUnits / observedDays : 0;
      const coverageDays = salesCoverageReliable && dailyVelocity > 0 ? this.money(currentInventory / dailyVelocity) : null;
      const daysSinceLastSale = sales.get(key)?.lastSoldAt ? Math.floor((now.getTime() - sales.get(key)!.lastSoldAt!.getTime()) / 86_400_000) : null;
      const shortageVisible = currentInventory > 0 || (daysSinceLastSale !== null && daysSinceLastSale <= SHORTAGE_SALES_WINDOW_DAYS);
      const stockStatus = currentInventory <= 0 ? 'OUT_OF_STOCK' : minimumStock !== null && currentInventory < minimumStock ? 'LOW' : 'IN_STOCK';
      // Without a POS mapping no sale can be recorded, so "no sales" says nothing about demand.
      const slowMoving = posMapped && salesCoverageReliable && currentInventory > 0 && (soldUnits <= 0 || (daysSinceLastSale !== null && daysSinceLastSale >= Math.min(observedDays, 60)) || (coverageDays !== null && coverageDays > 180));
      return {
        productId: key, sku: product.sku, productName,
        brandName: this.displayBrand(product.brandName, product.chineseName, product.name, product.englishName), categoryName: product.categoryName || '未标注品类',
        currentInventory, minimumStock, configuredMinimumStock,
        minimumStockSource: configuredMinimumStock !== null ? 'MANUAL' : minimumStock !== null ? 'DEFAULT' : 'NONE',
        coreProduct, posMapped,
        soldUnits, dailyVelocity: this.money(dailyVelocity), coverageDays, shortageVisible,
        lastSoldAt: sales.get(key)?.lastSoldAt?.toISOString() ?? null, daysSinceLastSale,
        lastMovementAt: lastMovement.get(key)?.toISOString() ?? null,
        inventoryUpdatedAt: inventory.get(key)?.updatedAt?.toISOString() ?? null, stockStatus, slowMoving,
        replenishmentHidden: Boolean(hiddenRow),
        replenishmentHiddenUntil: hiddenRow?.restoredAt?.toISOString() ?? null,
        directShipExcluded, directShip: Boolean(product.storeProducts[0]?.directShip),
      };
    });
    const stocked = rows.filter((row) => row.currentInventory > 0);
    const actionableRows = rows.filter((row) => !row.replenishmentHidden && !row.directShipExcluded);
    const coverageBuckets = {
      noSales: stocked.filter((row) => row.coverageDays === null).length,
      under30: stocked.filter((row) => row.coverageDays !== null && row.coverageDays < 30).length,
      days30To90: stocked.filter((row) => row.coverageDays !== null && row.coverageDays >= 30 && row.coverageDays <= 90).length,
      over90: stocked.filter((row) => row.coverageDays !== null && row.coverageDays > 90).length,
    };
    return {
      generatedAt: now.toISOString(), store: { id: store.id.toString(), name: store.name },
      period: { lookbackDays, from: calendarDateInZone(start, organization.timezone), to: calendarDateInZone(now, organization.timezone) },
      salesCoverage: {
        observedDays, reliable: salesCoverageReliable,
        firstObservedSaleAt: firstObservedSaleAt?.toISOString() ?? null,
        lastObservedSaleAt: lastObservedSaleAt?.toISOString() ?? null,
        minimumReliableDays,
      },
      summary: {
        productCount: rows.length, stockedProducts: stocked.length,
        totalInventory: rows.reduce((sum, row) => sum + row.currentInventory, 0),
        outOfStockProducts: actionableRows.filter((row) => row.stockStatus === 'OUT_OF_STOCK' && row.shortageVisible).length,
        lowStockProducts: actionableRows.filter((row) => row.stockStatus === 'LOW').length,
        slowMovingProducts: actionableRows.filter((row) => row.slowMoving).length,
        expiredBatches: expiredStock._count._all,
        expiredUnits: expiredStock._sum.quantity ?? 0,
      },
      coverageBuckets,
      // Catalogue-only rows (no stock, no sale in 180 days, no minimum) never raise an alert; leaving them out keeps the
      // phone payload small. A search still returns them.
      products: rows
        .filter((row) => query || row.currentInventory !== 0 || row.shortageVisible || row.configuredMinimumStock !== null || row.replenishmentHidden)
        .sort((a, b) => b.currentInventory - a.currentInventory),
      turnoverAvailable: false,
      turnoverNotice: '当前数据库没有连续历史库存快照，不能用当前库存代替平均库存，因此暂不计算标准库存周转率。',
      defaultMinimumStock: DEFAULT_MINIMUM_STOCK,
      shortageNotice: '缺货仅显示最近180天有销售记录的零库存商品；低库存只提醒核心品牌与绵羊油（默认20件）及单独设置了最低库存的商品。',
      coverageNotice: salesCoverageReliable
        ? `库存覆盖天数按实际已有的${observedDays}天POS销售跨度与当前库存估算；无销量商品不生成虚假天数。`
        : `当前只有${observedDays}天POS销售跨度，少于${minimumReliableDays}天；暂不生成库存覆盖天数或滞销结论。`,
    };
  }

  async purchaseSuggestions(organizationId: bigint, userId: bigint, storeId: bigint) {
    const store = await this.requireStorePermission(organizationId, userId, storeId, MANAGEMENT_PERMISSIONS.inventory);
    const organization = await this.prisma.client.organization.findUniqueOrThrow({ where: { id: organizationId }, select: { timezone: true } });
    const today = calendarDateInZone(new Date(), organization.timezone);
    const end = nextCalendarDateStart(today, organization.timezone);
    const start = new Date(calendarDateStart(today, organization.timezone).getTime() - 27 * 86_400_000);
    const productWhere = { organizationId, status: 'ACTIVE' as const, storeProducts: { some: { storeId, enabled: true } } };
    const receivedSince = new Date(Date.now() - ARRIVED_WINDOW_DAYS * 86_400_000);
    const [products, balances, salesItems, currentOrder, ignoredRows, recentReceipts] = await Promise.all([
      this.prisma.client.product.findMany({
        where: productWhere, orderBy: { name: 'asc' },
        select: {
          id: true, sku: true, name: true, chineseName: true, englishName: true, brandName: true, categoryName: true,
          barcodes: { where: { status: 'ACTIVE' }, orderBy: [{ isPrimary: 'desc' }, { id: 'asc' }], select: { barcode: true }, take: 1 },
          storeProducts: { where: { storeId, enabled: true }, select: { minimumStock: true, directShip: true }, take: 1 },
        },
      }),
      this.prisma.client.inventoryBalance.findMany({ where: { organizationId, warehouse: { storeId, status: 'ACTIVE' }, product: productWhere }, select: { productId: true, quantity: true, updatedAt: true } }),
      this.prisma.client.posOrderItem.findMany({
        where: {
          status: 'ACTIVE', disposition: 'INVENTORY', isMinus: false,
          productId: { not: null }, product: productWhere,
          order: { organizationId, storeId, sourceStatus: 'Paid', refundAmount: 0, orderedAt: { gte: start, lt: end } },
        },
        select: { productId: true, quantity: true, isMinus: true },
      }),
      this.findCurrentPurchaseOrder(organizationId, storeId, organization.timezone),
      this.prisma.client.purchaseSuggestionIgnore.findMany({
        where: { organizationId, storeId, OR: [{ restoredAt: null }, { restoredAt: { gt: new Date() } }] },
        select: { productId: true, reason: true, ignoredAt: true, restoredAt: true },
      }),
      this.prisma.client.stockMovement.groupBy({
        by: ['productId'],
        where: { organizationId, storeId, movementType: 'RECEIPT', createdAt: { gte: receivedSince }, reversedBy: { is: null } },
        _sum: { quantityDelta: true }, _max: { createdAt: true },
      }),
    ]);
    // Out-of-stock products sold nothing lately because there was nothing to sell; look back 90 days for them (CR-005 C2).
    const longStart = new Date(calendarDateStart(today, organization.timezone).getTime() - (LONG_SALES_WINDOW_DAYS - 1) * 86_400_000);
    const longSalesItems = await this.prisma.client.posOrderItem.groupBy({
      by: ['productId'],
      where: {
        status: 'ACTIVE', disposition: 'INVENTORY', isMinus: false, productId: { not: null }, product: productWhere,
        order: { organizationId, storeId, sourceStatus: 'Paid', refundAmount: 0, orderedAt: { gte: longStart, lt: end } },
      },
      _sum: { quantity: true },
    });
    const longSales = new Map(longSalesItems.map((row) => [row.productId!.toString(), Number(row._sum.quantity ?? 0)]));
    const received = new Map(recentReceipts.map((row) => [row.productId.toString(), row]));
    const inventory = new Map<string, number>();
    for (const row of balances) inventory.set(row.productId.toString(), (inventory.get(row.productId.toString()) ?? 0) + row.quantity);
    const latestInventoryUpdatedAt = balances.reduce<Date | null>((latest, row) => !latest || row.updatedAt > latest ? row.updatedAt : latest, null);
    const sales = new Map<string, number>();
    for (const row of salesItems) {
      if (!row.productId) continue;
      const key = row.productId.toString();
      const quantity = Math.abs(Number(row.quantity)) * (row.isMinus ? -1 : 1);
      sales.set(key, (sales.get(key) ?? 0) + quantity);
    }
    const included = new Set(currentOrder?.items.map((item) => item.productId.toString()) ?? []);
    const ignored = new Map(ignoredRows.map((row) => [row.productId.toString(), row]));
    // Same-name records are summed into one suggestion; the record selling most stands for the group (it is what the
    // POS sells and what goes onto the purchase order).
    const displayName = (product: (typeof products)[number]) => product.chineseName || product.name || product.englishName || '未命名商品';
    const groups = new Map<string, (typeof products)[number][]>();
    for (const product of products) {
      if (isDirectShip(product.storeProducts[0]?.directShip, productNames(product))) continue;
      const key = productGroupKey(displayName(product)) || product.id.toString();
      groups.set(key, [...(groups.get(key) ?? []), product]);
    }
    const sum = (members: (typeof products)[number][], values: Map<string, number>) => members.reduce((total, member) => total + (values.get(member.id.toString()) ?? 0), 0);
    const rows = [...groups.values()].map((members) => {
      const ranked = [...members].sort((a, b) => (sales.get(b.id.toString()) ?? 0) - (sales.get(a.id.toString()) ?? 0)
        || (inventory.get(b.id.toString()) ?? 0) - (inventory.get(a.id.toString()) ?? 0) || Number(a.id - b.id));
      const product = ranked[0];
      const productId = product.id.toString();
      const currentInventory = sum(members, inventory);
      const actual28DayQty = Math.max(0, Math.round(sum(members, sales)));
      const longTerm28DayQty = currentInventory <= 0 ? Math.round((sum(members, longSales) * 28) / LONG_SALES_WINDOW_DAYS) : 0;
      const recent28DayQty = Math.max(actual28DayQty, longTerm28DayQty);
      const salesBasis = longTerm28DayQty > actual28DayQty ? '90_DAYS' as const : '28_DAYS' as const;
      const coverage = purchaseCoverage(recent28DayQty, currentInventory);
      const { weeklyVelocity, targetWeeks } = coverage;
      let { targetInventory, gap: suggestedQuantity } = coverage;
      const minimumStock = product.storeProducts[0]?.minimumStock ?? null;
      // Slow sellers (under one a week) that sold in the last 90 days keep a shelf display quantity (CR-006 D3).
      const displayStock = targetWeeks === null && sum(members, longSales) > 0;
      if (displayStock) {
        targetInventory = minimumStock ?? DEFAULT_DISPLAY_STOCK;
        suggestedQuantity = Math.max(0, targetInventory - currentInventory);
      }
      const coverageWeeks = weeklyVelocity > 0 ? Math.round((currentInventory / weeklyVelocity) * 10) / 10 : null;
      const source = currentInventory <= 0 ? 'OUT_OF_STOCK' : 'WEEKLY_FORECAST';
      // Display top-ups of slow sellers are follow-up work, so they do not crowd out this week's buying.
      const priority = !displayStock && (currentInventory <= 0 || (coverageWeeks !== null && coverageWeeks < THIS_WEEK_COVERAGE_WEEKS) || (minimumStock !== null && currentInventory <= minimumStock))
        ? 'THIS_WEEK' as const
        : 'FOLLOW_UP' as const;
      const ignoredRow = members.map((member) => ignored.get(member.id.toString())).filter((row) => row && ignoreIsActive(row))
        .sort((a, b) => b!.ignoredAt.getTime() - a!.ignoredAt.getTime())[0];
      const receivedRows = members.map((member) => received.get(member.id.toString())).filter(Boolean);
      return {
        productId, sku: product.sku, barcode: product.barcodes[0]?.barcode ?? null,
        productName: displayName(product),
        brandName: this.displayBrand(product.brandName, product.chineseName, product.name, product.englishName),
        categoryName: product.categoryName || '未标注品类', currentInventory, minimumStock,
        recent28DayQty, salesBasis, weeklyVelocity, coverageWeeks, targetWeeks, targetInventory,
        suggestedQuantity, displayStock, source, priority, alreadyIncluded: members.some((member) => included.has(member.id.toString())),
        ignored: Boolean(ignoredRow), ignoredReason: ignoredRow?.reason ?? null,
        ignoredAt: ignoredRow?.ignoredAt.toISOString() ?? null,
        recentReceivedQty: receivedRows.reduce((total, row) => total + (row!._sum.quantityDelta ?? 0), 0),
        lastReceivedAt: receivedRows.map((row) => row!._max.createdAt).filter(Boolean).sort((a, b) => b!.getTime() - a!.getTime())[0]?.toISOString() ?? null,
        mergedProducts: members.length > 1 ? ranked.map((member) => ({
          productId: member.id.toString(), productName: displayName(member), barcode: member.barcodes[0]?.barcode ?? null,
          currentInventory: inventory.get(member.id.toString()) ?? 0, recent28DayQty: Math.max(0, Math.round(sales.get(member.id.toString()) ?? 0)),
        })) : [],
      };
    }).filter((row) => row.suggestedQuantity > 0);
    // Goods received in the last 7 days that are still short stay suggested, flagged with what arrived (CR-005 C4).
    const arrivedSuggestions: typeof rows = [];
    const suggestions = rows.filter((row) => !row.ignored)
      .sort((a, b) => Number(b.priority === 'THIS_WEEK') - Number(a.priority === 'THIS_WEEK') || b.suggestedQuantity - a.suggestedQuantity || a.currentInventory - b.currentInventory);
    const ignoredSuggestions = rows.filter((row) => row.ignored)
      .sort((a, b) => (b.ignoredAt ?? '').localeCompare(a.ignoredAt ?? ''));
    return {
      generatedAt: new Date().toISOString(),
      inventoryLatestUpdatedAt: latestInventoryUpdatedAt?.toISOString() ?? null,
      store: { id: store.id.toString(), name: store.name }, period: { from: calendarDateInZone(start, organization.timezone), to: today },
      calculation: '这是备货4–6周的候选清单，不是一周必须买完。按最近28天销量折算周均（断货商品取近90天折算值与近28天的较大者）：低于1件/周但近90天有销售的保持陈列量（最低库存，未设置为2件，列入后续跟进）；1–9件/周覆盖6周，10–29件/周覆盖5周，30件及以上/周覆盖4周。可卖不足2周、缺货或低于最低库存的列为本周优先；近7天已入库但仍不足的商品照常建议并标注；直邮商品不建议；名称相同的多个档案（不同条码或包装）合并计算库存与销量。',
      summary: {
        products: suggestions.length,
        suggestedUnits: suggestions.reduce((sum, row) => sum + row.suggestedQuantity, 0),
        thisWeekProducts: suggestions.filter((row) => row.priority === 'THIS_WEEK').length,
        followUpProducts: suggestions.filter((row) => row.priority === 'FOLLOW_UP').length,
        alreadyIncluded: suggestions.filter((row) => row.alreadyIncluded).length,
        ignored: ignoredSuggestions.length,
        arrived: arrivedSuggestions.length,
      },
      suggestions, ignoredSuggestions, arrivedSuggestions,
    };
  }

  async setMinimumStock(organizationId: bigint, userId: bigint, storeId: bigint, input: { productId?: bigint; minimumStock: number }) {
    await this.requireStorePermission(organizationId, userId, storeId, MANAGEMENT_PERMISSIONS.inventory);
    if (!Number.isInteger(input.minimumStock) || input.minimumStock < 0 || input.minimumStock > 100000) throw new BadRequestException('最低库存必须是0至100000之间的整数');
    if (input.productId) {
      const storeProduct = await this.prisma.client.storeProduct.findFirst({ where: { storeId, productId: input.productId, enabled: true, product: { organizationId, status: 'ACTIVE' } }, select: { productId: true, minimumStock: true } });
      if (!storeProduct) throw new NotFoundException('商品不存在或未在当前门店启用');
      await this.prisma.client.$transaction([
        this.prisma.client.storeProduct.update({ where: { storeId_productId: { storeId, productId: input.productId } }, data: { minimumStock: input.minimumStock } }),
        this.prisma.client.auditLog.create({ data: { organizationId, userId, storeId, action: 'management.minimum_stock.update', entityType: 'Product', entityId: input.productId.toString(), requestId: randomUUID(), beforeSummary: { minimumStock: storeProduct.minimumStock }, afterSummary: { minimumStock: input.minimumStock } } }),
      ]);
      return { scope: 'PRODUCT', updated: 1, minimumStock: input.minimumStock };
    }
    const result = await this.prisma.client.$transaction(async (tx) => {
      const updated = await tx.storeProduct.updateMany({ where: { storeId, enabled: true, product: { organizationId, status: 'ACTIVE' } }, data: { minimumStock: input.minimumStock } });
      await tx.auditLog.create({ data: { organizationId, userId, storeId, action: 'management.minimum_stock.bulk_update', entityType: 'Store', entityId: storeId.toString(), requestId: randomUUID(), afterSummary: { minimumStock: input.minimumStock, updated: updated.count } } });
      return updated;
    });
    return { scope: 'STORE', updated: result.count, minimumStock: input.minimumStock };
  }

  async setPurchaseSuggestionIgnored(organizationId: bigint, userId: bigint, storeId: bigint, productId: bigint, ignored: boolean, reason?: string, hiddenUntil?: Date) {
    await this.requireStorePermission(organizationId, userId, storeId, MANAGEMENT_PERMISSIONS.inventory);
    const product = await this.prisma.client.product.findFirst({ where: { id: productId, organizationId, status: 'ACTIVE', storeProducts: { some: { storeId, enabled: true } } }, select: { id: true } });
    if (!product) throw new NotFoundException('商品不存在或未在当前门店启用');
    const now = new Date();
    const record = await this.prisma.client.$transaction(async (tx) => {
      const updated = await tx.purchaseSuggestionIgnore.upsert({
        where: { organizationId_storeId_productId: { organizationId, storeId, productId } },
        create: { organizationId, storeId, productId, reason: reason?.trim() || null, ignoredById: userId, ignoredAt: now, restoredById: ignored ? null : userId, restoredAt: ignored ? hiddenUntil ?? null : now },
        update: ignored
          ? { reason: reason?.trim() || null, ignoredById: userId, ignoredAt: now, restoredById: null, restoredAt: hiddenUntil ?? null }
          : { restoredById: userId, restoredAt: now },
      });
      await tx.auditLog.create({ data: { organizationId, userId, storeId, action: ignored ? (hiddenUntil ? 'management.purchase_suggestion.snooze' : 'management.purchase_suggestion.ignore') : 'management.purchase_suggestion.restore', entityType: 'Product', entityId: productId.toString(), requestId: randomUUID(), afterSummary: { ignored, reason: reason?.trim() || null, hiddenUntil: hiddenUntil?.toISOString() ?? null } } });
      return updated;
    });
    return { productId: productId.toString(), ignored, reason: record.reason, ignoredAt: record.ignoredAt.toISOString(), hiddenUntil: hiddenUntil?.toISOString() ?? null, restoredAt: ignored ? null : record.restoredAt?.toISOString() ?? null };
  }

  async setProductDirectShip(organizationId: bigint, userId: bigint, storeId: bigint, productId: bigint, directShip: boolean) {
    await this.requireStorePermission(organizationId, userId, storeId, MANAGEMENT_PERMISSIONS.inventory);
    const product = await this.prisma.client.product.findFirst({ where: { id: productId, organizationId, status: 'ACTIVE' }, select: { id: true } });
    if (!product) throw new NotFoundException('商品不存在或已停用');
    return this.prisma.client.$transaction((tx) => setDirectShip(tx, { organizationId, userId, storeId, productId, directShip, source: 'management' }));
  }

  async currentPurchaseOrder(organizationId: bigint, userId: bigint, storeId: bigint) {
    const store = await this.requireStorePermission(organizationId, userId, storeId, MANAGEMENT_PERMISSIONS.inventory);
    const organization = await this.prisma.client.organization.findUniqueOrThrow({ where: { id: organizationId }, select: { timezone: true, currency: true } });
    const order = await this.findCurrentPurchaseOrder(organizationId, storeId, organization.timezone);
    const balances = await this.prisma.client.inventoryBalance.findMany({
      where: { organizationId, warehouse: { storeId, status: 'ACTIVE' } },
      select: { productId: true, quantity: true, updatedAt: true },
    });
    const inventory = new Map<string, number>();
    for (const row of balances) inventory.set(row.productId.toString(), (inventory.get(row.productId.toString()) ?? 0) + row.quantity);
    const latestInventoryUpdatedAt = balances.reduce<Date | null>((latest, row) => !latest || row.updatedAt > latest ? row.updatedAt : latest, null);
    const serializedOrder = order ? this.serializePurchaseOrder(order) : null;
    return {
      generatedAt: new Date().toISOString(),
      inventoryLatestUpdatedAt: latestInventoryUpdatedAt?.toISOString() ?? null,
      store: { id: store.id.toString(), name: store.name },
      currency: organization.currency,
      order: serializedOrder ? {
        ...serializedOrder,
        items: serializedOrder.items.map((item) => ({ ...item, currentInventory: inventory.get(item.productId) ?? 0 })),
      } : null,
    };
  }

  async addPurchaseOrderItem(organizationId: bigint, userId: bigint, storeId: bigint, input: { productId: bigint; quantity?: number; source: 'MANUAL' | 'OUT_OF_STOCK' | 'LOW_STOCK' | 'HOT_SALES' | 'WEEKLY_FORECAST' }) {
    await this.requireStorePermission(organizationId, userId, storeId, MANAGEMENT_PERMISSIONS.inventory);
    const organization = await this.prisma.client.organization.findUniqueOrThrow({ where: { id: organizationId }, select: { timezone: true } });
    const product = await this.prisma.client.product.findFirst({ where: { id: input.productId, organizationId, status: 'ACTIVE', storeProducts: { some: { storeId, enabled: true } } }, select: { id: true } });
    if (!product) throw new NotFoundException('商品不存在或未在当前门店启用');
    const suggestion = await this.purchaseProductSnapshot(organizationId, storeId, input.productId, organization.timezone);
    const orderedQuantity = input.quantity ?? suggestion.suggestedQuantity;
    if (!Number.isInteger(orderedQuantity) || orderedQuantity <= 0) throw new BadRequestException('进货数量必须是正整数');
    const weekStart = this.purchaseWeekStart(organization.timezone);
    const order = await this.prisma.client.$transaction(async (tx) => {
      const purchaseOrder = await tx.purchaseOrder.upsert({
        where: { organizationId_storeId_weekStart: { organizationId, storeId, weekStart } },
        create: { orderNo: `PO-${calendarDateInZone(weekStart, organization.timezone).replaceAll('-', '')}-${storeId}`, organizationId, storeId, weekStart, createdById: userId },
        update: {}, include: { items: true },
      });
      if (purchaseOrder.status !== 'DRAFT') throw new ConflictException('本周进货单已确认，不能再添加商品');
      const item = await tx.purchaseOrderItem.upsert({
        where: { purchaseOrderId_productId: { purchaseOrderId: purchaseOrder.id, productId: input.productId } },
        create: { purchaseOrderId: purchaseOrder.id, productId: input.productId, source: input.source, currentInventory: suggestion.currentInventory, recentSevenDayQty: suggestion.recentSevenDayQty, suggestedQuantity: suggestion.suggestedQuantity, orderedQuantity },
        update: { source: input.source, currentInventory: suggestion.currentInventory, recentSevenDayQty: suggestion.recentSevenDayQty, suggestedQuantity: suggestion.suggestedQuantity, orderedQuantity },
      });
      await tx.auditLog.create({ data: { organizationId, userId, storeId, action: 'management.purchase_order.item.upsert', entityType: 'PurchaseOrderItem', entityId: item.id.toString(), requestId: randomUUID(), afterSummary: { purchaseOrderId: purchaseOrder.id.toString(), productId: input.productId.toString(), source: input.source, orderedQuantity } } });
      return tx.purchaseOrder.findUniqueOrThrow({ where: { id: purchaseOrder.id }, include: this.purchaseOrderInclude() });
    });
    return this.serializePurchaseOrder(order);
  }

  async updatePurchaseOrderItem(organizationId: bigint, userId: bigint, storeId: bigint, itemId: bigint, input: { orderedQuantity: number; supplierName?: string; unitCostCents?: number | null; caseSize?: number | null; notes?: string }) {
    await this.requireStorePermission(organizationId, userId, storeId, MANAGEMENT_PERMISSIONS.inventory);
    if (!Number.isInteger(input.orderedQuantity) || input.orderedQuantity <= 0) throw new BadRequestException('进货数量必须是正整数');
    if (input.unitCostCents !== undefined && input.unitCostCents !== null && (!Number.isInteger(input.unitCostCents) || input.unitCostCents < 0)) throw new BadRequestException('进价不能小于0');
    if (input.caseSize !== undefined && input.caseSize !== null && (!Number.isInteger(input.caseSize) || input.caseSize <= 0)) throw new BadRequestException('整箱规格必须是正整数');
    const order = await this.prisma.client.$transaction(async (tx) => {
      const existing = await tx.purchaseOrderItem.findFirst({ where: { id: itemId, purchaseOrder: { organizationId, storeId } }, include: { purchaseOrder: true } });
      if (!existing) throw new NotFoundException('进货单商品不存在');
      if (existing.purchaseOrder.status !== 'DRAFT') throw new ConflictException('只有草稿进货单可以修改');
      const item = await tx.purchaseOrderItem.update({ where: { id: itemId }, data: { orderedQuantity: input.orderedQuantity, supplierName: input.supplierName?.trim() || null, unitCostCents: input.unitCostCents ?? null, caseSize: input.caseSize ?? null, notes: input.notes?.trim() || null } });
      await tx.auditLog.create({ data: { organizationId, userId, storeId, action: 'management.purchase_order.item.update', entityType: 'PurchaseOrderItem', entityId: item.id.toString(), requestId: randomUUID(), beforeSummary: { orderedQuantity: existing.orderedQuantity }, afterSummary: { orderedQuantity: item.orderedQuantity, supplierName: item.supplierName, unitCostCents: item.unitCostCents, caseSize: item.caseSize } } });
      return tx.purchaseOrder.findUniqueOrThrow({ where: { id: existing.purchaseOrderId }, include: this.purchaseOrderInclude() });
    });
    return this.serializePurchaseOrder(order);
  }

  async removePurchaseOrderItem(organizationId: bigint, userId: bigint, storeId: bigint, itemId: bigint) {
    await this.requireStorePermission(organizationId, userId, storeId, MANAGEMENT_PERMISSIONS.inventory);
    const order = await this.prisma.client.$transaction(async (tx) => {
      const existing = await tx.purchaseOrderItem.findFirst({ where: { id: itemId, purchaseOrder: { organizationId, storeId } }, include: { purchaseOrder: true } });
      if (!existing) throw new NotFoundException('进货单商品不存在');
      if (existing.purchaseOrder.status !== 'DRAFT') throw new ConflictException('只有草稿进货单可以移除商品');
      await tx.purchaseOrderItem.delete({ where: { id: itemId } });
      await tx.auditLog.create({ data: { organizationId, userId, storeId, action: 'management.purchase_order.item.remove', entityType: 'PurchaseOrderItem', entityId: itemId.toString(), requestId: randomUUID(), beforeSummary: { productId: existing.productId.toString(), orderedQuantity: existing.orderedQuantity } } });
      return tx.purchaseOrder.findUniqueOrThrow({ where: { id: existing.purchaseOrderId }, include: this.purchaseOrderInclude() });
    });
    return this.serializePurchaseOrder(order);
  }

  async transitionPurchaseOrder(organizationId: bigint, userId: bigint, storeId: bigint, status: 'DRAFT' | 'CONFIRMED' | 'ORDERED' | 'CANCELLED') {
    await this.requireStorePermission(organizationId, userId, storeId, MANAGEMENT_PERMISSIONS.inventory);
    const organization = await this.prisma.client.organization.findUniqueOrThrow({ where: { id: organizationId }, select: { timezone: true } });
    const existing = await this.findCurrentPurchaseOrder(organizationId, storeId, organization.timezone);
    if (!existing) throw new NotFoundException('本周还没有进货单');
    const transitions: Record<string, string[]> = { DRAFT: ['CONFIRMED', 'CANCELLED'], CONFIRMED: ['DRAFT', 'ORDERED', 'CANCELLED'], ORDERED: ['CANCELLED'], PARTIALLY_RECEIVED: [], RECEIVED: [], CANCELLED: ['DRAFT'] };
    if (!transitions[existing.status]?.includes(status)) throw new ConflictException(`不能从${existing.status}变更为${status}`);
    if (status === 'CONFIRMED' && existing.items.length === 0) throw new BadRequestException('空进货单不能确认');
    const now = new Date();
    const data = status === 'CONFIRMED' ? { status, confirmedById: userId, confirmedAt: now }
      : status === 'ORDERED' ? { status, orderedById: userId, orderedAt: now }
        : status === 'CANCELLED' ? { status, cancelledById: userId, cancelledAt: now }
          : { status, confirmedById: null, confirmedAt: null, orderedById: null, orderedAt: null, cancelledById: null, cancelledAt: null };
    const order = await this.prisma.client.$transaction(async (tx) => {
      const updated = await tx.purchaseOrder.update({ where: { id: existing.id }, data, include: this.purchaseOrderInclude() });
      await tx.auditLog.create({ data: { organizationId, userId, storeId, action: 'management.purchase_order.status.update', entityType: 'PurchaseOrder', entityId: existing.id.toString(), requestId: randomUUID(), beforeSummary: { status: existing.status }, afterSummary: { status } } });
      return updated;
    });
    return this.serializePurchaseOrder(order);
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
          items: { where: { status: 'ACTIVE' }, select: { quantity: true, isMinus: true, sourceName: true } },
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
        if (isShippingFeeLine(item.sourceName)) return itemSum;
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
        orderBy: { name: 'asc' },
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
    const withPending = products.filter((product) => !product.insightAssignments.some((assignment) => assignment.reviewStatus === 'APPROVED')
      && product.insightAssignments.some((assignment) => assignment.reviewStatus === 'PENDING')).length;
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
        salesAnalysis: { endpoint: '/management/sales-analysis', status: 'AVAILABLE' },
        productsBrands: { endpoint: '/management/products-brands', status: 'AVAILABLE' },
        inventoryOperations: { endpoint: '/management/inventory-operations', status: 'AVAILABLE' },
        customerAnalysis: { endpoint: '/management/customer-analysis', status: 'BLOCKED_BY_CUSTOMER_IDENTITY' },
        storeComparison: { endpoint: '/management/store-comparison', status: activeStoreCount > 1 ? 'AVAILABLE' : 'WAITING_FOR_SECOND_STORE' },
        dataPermissions: { endpoint: '/management/data-permissions', status: 'PLANNED' },
      },
    };
  }

  async overview(organizationId: bigint, userId: bigint, storeId: bigint, requestedDate?: string) {
    await this.requireStorePermission(organizationId, userId, storeId, MANAGEMENT_PERMISSIONS.overview);
    const [store, organization] = await Promise.all([
      this.prisma.client.store.findFirst({ where: { id: storeId, organizationId, status: 'ACTIVE' }, select: { id: true, name: true } }),
      this.prisma.client.organization.findUnique({
        where: { id: organizationId },
        select: { timezone: true, currency: true },
      }),
    ]);
    if (!store || !organization) throw new NotFoundException('门店不存在');

    const currentDate = requestedDate ?? calendarDateInZone(new Date(), organization.timezone);
    const currentRange = {
      start: calendarDateStart(currentDate, organization.timezone),
      end: nextCalendarDateStart(currentDate, organization.timezone),
    };
    const previousDate = calendarDateInZone(new Date(currentRange.start.getTime() - 1), organization.timezone);
    const previousRange = {
      start: calendarDateStart(previousDate, organization.timezone),
      end: currentRange.start,
    };

    const [currentOrders, previousOrders, balances, expiryPolicy, lastSync, openReceipts, stocktakeAdjustments, movementCount, latestMovement] = await Promise.all([
      this.loadOrders(organizationId, storeId, currentRange.start, currentRange.end),
      this.loadOrders(organizationId, storeId, previousRange.start, previousRange.end),
      this.prisma.client.inventoryBalance.findMany({
        where: { organizationId, quantity: { not: 0 }, warehouse: { storeId, status: 'ACTIVE' } },
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

    const current = this.summarizeSales(currentOrders, organization.timezone, currentDate);
    const previous = this.summarizeSales(previousOrders, organization.timezone, previousDate);
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
      if (balance.quantity <= 0) continue;
      const date = balance.batch.expiryDate;
      if (date < now) expiry.expired += balance.quantity;
      else if (date <= addMonths(policy.urgentMonths)) expiry.urgent += balance.quantity;
      else if (date <= addMonths(policy.warningMonths)) expiry.warning += balance.quantity;
      else if (date <= addMonths(policy.earlyWarningMonths)) expiry.early += balance.quantity;
    }

    return {
      store: { id: store.id.toString(), name: store.name },
      currency: organization.currency,
      period: { date: currentDate, previousDate },
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
          stocktakeAdjustmentsToday: stocktakeAdjustments,
          movementCountToday: movementCount,
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
          select: { productId: true, quantity: true, unitPrice: true, isMinus: true, sourceName: true, product: { select: { name: true, chineseName: true, brandName: true } } },
        },
      },
      orderBy: { orderedAt: 'asc' },
    });
  }

  private summarizeSales(orders: Awaited<ReturnType<ManagementService['loadOrders']>>, timeZone: string, period: string) {
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
        if (isShippingFeeLine(item.sourceName)) continue;
        const rawQuantity = Math.abs(Number(item.quantity));
        const quantity = item.isMinus ? -rawQuantity : rawQuantity;
        const itemRevenue = quantity * Number(item.unitPrice ?? 0);
        unitsSold += quantity;
        const name = item.product?.chineseName || item.product?.name || item.sourceName || '未命名商品';
        const brandName = this.displayBrand(item.product?.brandName, item.sourceName, item.product?.chineseName, item.product?.name);
        const productKey = item.productId ? `product:${item.productId.toString()}` : `name:${name}`;
        const product = products.get(productKey) ?? { productId: item.productId?.toString() ?? null, productName: name, brandName, quantity: 0, revenue: 0 };
        product.quantity += quantity;
        product.revenue += itemRevenue;
        products.set(productKey, product);
        const brand = brands.get(brandName) ?? { brandName, quantity: 0, revenue: 0 };
        brand.quantity += quantity;
        brand.revenue += itemRevenue;
        brands.set(brandName, brand);
      }
    }
    const netRevenue = revenue - refunds;
    return {
      period,
      revenue: this.money(revenue),
      refunds: this.money(refunds),
      netRevenue: this.money(netRevenue),
      orderCount: orders.length,
      unitsSold: this.money(unitsSold),
      averageOrderValue: orders.length ? this.money(netRevenue / orders.length) : 0,
      dailySales: [...daily.entries()].map(([date, value]) => ({ date, revenue: this.money(value.revenue), orders: value.orders })),
      topProducts: [...products.values()].sort((a, b) => b.revenue - a.revenue || b.quantity - a.quantity).slice(0, 8).map((item) => ({ ...item, quantity: this.money(item.quantity), revenue: this.money(item.revenue) })),
      // Every product behind the units figure, most sold first, so the overview can show what the units were.
      soldProducts: [...products.values()].filter((item) => item.quantity !== 0).sort((a, b) => b.quantity - a.quantity || b.revenue - a.revenue).map((item) => ({ ...item, quantity: this.money(item.quantity), revenue: this.money(item.revenue) })),
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
            productId: true, externalProductId: true, sourceName: true, quantity: true, unitPrice: true, isMinus: true, disposition: true,
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
    const products = new Map<string, { productId: string | null; productName: string; brandName: string; categoryName: string; quantity: number; revenue: number }>();
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
        if (isShippingFeeLine(item.sourceName)) continue;
        orderUnits += quantity;
        const productName = item.product?.chineseName || item.product?.name || item.sourceName || '未命名商品';
        const brandName = this.displayBrand(item.product?.brandName, item.sourceName, item.product?.chineseName, item.product?.name);
        const categoryName = item.product?.categoryName || '未标注品类';
        const productKey = item.productId ? `product:${item.productId.toString()}` : `pos:${item.externalProductId}`;
        const product = products.get(productKey) ?? { productId: item.productId?.toString() ?? null, productName, brandName, categoryName, quantity: 0, revenue: 0 };
        product.quantity += quantity; product.revenue += revenue; products.set(productKey, product);
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
      const date = calendarDateInZone(order.orderedAt, timeZone);
      const period = this.periodKey(date, input.dimension);
      const trendEntry = trend.get(period) ?? { period, revenue: 0, orders: new Set<string>(), units: 0 };
      trendEntry.revenue += orderNet; trendEntry.orders.add(orderKey); trendEntry.units += orderUnits; trend.set(period, trendEntry);
      const hour = hourInZone(order.orderedAt, timeZone);
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

  private purchaseOrderInclude() {
    return {
      items: {
        orderBy: { createdAt: 'desc' as const },
        include: {
          product: {
            select: {
              sku: true, name: true, chineseName: true, englishName: true, brandName: true, categoryName: true,
              barcodes: { where: { status: 'ACTIVE' as const }, orderBy: [{ isPrimary: 'desc' as const }, { id: 'asc' as const }], select: { barcode: true }, take: 1 },
            },
          },
        },
      },
    };
  }

  private async findCurrentPurchaseOrder(organizationId: bigint, storeId: bigint, timezone: string) {
    const weekStart = this.purchaseWeekStart(timezone);
    return this.prisma.client.purchaseOrder.findUnique({
      where: { organizationId_storeId_weekStart: { organizationId, storeId, weekStart } }, include: this.purchaseOrderInclude(),
    });
  }

  private purchaseWeekStart(timezone: string) {
    const today = calendarDateInZone(new Date(), timezone);
    const noon = new Date(`${today}T12:00:00Z`);
    const weekday = noon.getUTCDay();
    noon.setUTCDate(noon.getUTCDate() - (weekday === 0 ? 6 : weekday - 1));
    return calendarDateStart(noon.toISOString().slice(0, 10), timezone);
  }

  private async purchaseProductSnapshot(organizationId: bigint, storeId: bigint, productId: bigint, timezone: string) {
    const today = calendarDateInZone(new Date(), timezone);
    const end = nextCalendarDateStart(today, timezone);
    const start = new Date(calendarDateStart(today, timezone).getTime() - 27 * 86_400_000);
    const [balances, salesItems] = await Promise.all([
      this.prisma.client.inventoryBalance.findMany({ where: { organizationId, productId, warehouse: { storeId, status: 'ACTIVE' } }, select: { quantity: true } }),
      this.prisma.client.posOrderItem.findMany({
        where: {
          status: 'ACTIVE', disposition: 'INVENTORY', isMinus: false, productId,
          order: { organizationId, storeId, sourceStatus: 'Paid', refundAmount: 0, orderedAt: { gte: start, lt: end } },
        },
        select: { quantity: true, isMinus: true },
      }),
    ]);
    const currentInventory = balances.reduce((sum, row) => sum + row.quantity, 0);
    const recent28DayQty = Math.max(0, Math.round(salesItems.reduce((sum, row) => sum + Math.abs(Number(row.quantity)) * (row.isMinus ? -1 : 1), 0)));
    const { weeklyVelocity, gap } = purchaseCoverage(recent28DayQty, currentInventory);
    return { currentInventory, recentSevenDayQty: Math.round(weeklyVelocity), suggestedQuantity: Math.max(1, gap) };
  }

  private serializePurchaseOrder(order: NonNullable<Awaited<ReturnType<ManagementService['findCurrentPurchaseOrder']>>>) {
    const totalCostCents = order.items.reduce((sum, item) => sum + (item.unitCostCents ?? 0) * item.orderedQuantity, 0);
    return {
      id: order.id.toString(), orderNo: order.orderNo, weekStart: order.weekStart.toISOString().slice(0, 10), status: order.status,
      notes: order.notes, createdAt: order.createdAt.toISOString(), updatedAt: order.updatedAt.toISOString(),
      confirmedAt: order.confirmedAt?.toISOString() ?? null, orderedAt: order.orderedAt?.toISOString() ?? null,
      summary: { productCount: order.items.length, suggestedUnits: order.items.reduce((sum, item) => sum + item.suggestedQuantity, 0), orderedUnits: order.items.reduce((sum, item) => sum + item.orderedQuantity, 0), receivedUnits: order.items.reduce((sum, item) => sum + item.receivedQuantity, 0), totalCostCents },
      items: order.items.map((item) => ({
        id: item.id.toString(), productId: item.productId.toString(), sku: item.product.sku,
        barcode: item.product.barcodes[0]?.barcode ?? null,
        productName: item.product.chineseName || item.product.name || item.product.englishName || '未命名商品',
        brandName: this.displayBrand(item.product.brandName, item.product.chineseName, item.product.name, item.product.englishName),
        categoryName: item.product.categoryName || '未标注品类', source: item.source,
        currentInventory: item.currentInventory, recentSevenDayQty: item.recentSevenDayQty, suggestedQuantity: item.suggestedQuantity,
        orderedQuantity: item.orderedQuantity, receivedQuantity: item.receivedQuantity, supplierName: item.supplierName,
        unitCostCents: item.unitCostCents, caseSize: item.caseSize, notes: item.notes,
      })),
    };
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
