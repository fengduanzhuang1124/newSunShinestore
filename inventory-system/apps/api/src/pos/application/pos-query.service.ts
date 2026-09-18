import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { calendarDateStart, nextCalendarDateStart } from './pos-date.js';
import type {
  PosMappingQueryDto,
  PosOrderQueryDto,
  PosPageQueryDto,
  PosReviewQueryDto,
  PosSimulationQueryDto,
} from './pos-query.dto.js';

@Injectable()
export class PosQueryService {
  constructor(private readonly prisma: PrismaService) {}

  private async storeAccess(
    organizationId: bigint,
    userId: bigint,
    storeIdValue: string,
  ) {
    const storeId = BigInt(storeIdValue);
    const access = await this.prisma.client.userStoreRole.findFirst({
      where: { userId, storeId, store: { organizationId, status: 'ACTIVE' } },
      select: { store: { select: { id: true, name: true } } },
    });
    if (!access) throw new ForbiddenException('没有该门店的POS查看权限');
    return access.store;
  }

  private page(query: PosPageQueryDto) {
    return { skip: (query.page - 1) * query.pageSize, take: query.pageSize };
  }

  private pageResult<T>(items: T[], total: number, query: PosPageQueryDto) {
    return {
      items,
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        pageTotal: Math.ceil(total / query.pageSize),
      },
    };
  }

  async syncStatus(
    organizationId: bigint,
    userId: bigint,
    storeIdValue: string,
  ) {
    const store = await this.storeAccess(organizationId, userId, storeIdValue);
    const [latestRun, cursor, pendingReviews, unmappedItems, inactiveItems] =
      await Promise.all([
        this.prisma.client.posSyncRun.findFirst({
          where: { organizationId, storeId: store.id },
          orderBy: { startedAt: 'desc' },
        }),
        this.prisma.client.posSyncCursor.findUnique({
          where: {
            storeId_provider_stream: {
              storeId: store.id,
              provider: 'MONI',
              stream: 'ORDERS',
            },
          },
        }),
        this.prisma.client.posRefundReview.count({
          where: { status: 'PENDING', order: { organizationId, storeId: store.id } },
        }),
        this.prisma.client.posOrderItem.count({
          where: {
            status: 'ACTIVE',
            disposition: { in: ['UNMAPPED', 'REVIEW_REQUIRED'] },
            order: { organizationId, storeId: store.id },
          },
        }),
        this.prisma.client.posOrderItem.count({
          where: { status: 'INACTIVE', order: { organizationId, storeId: store.id } },
        }),
      ]);

    return {
      store: { id: store.id.toString(), name: store.name },
      provider: 'MONI',
      latestRun: latestRun ? {
        id: latestRun.id.toString(),
        status: latestRun.status,
        startedAt: latestRun.startedAt.toISOString(),
        finishedAt: latestRun.finishedAt?.toISOString() ?? null,
        ordersObserved: latestRun.ordersObserved,
        ordersInserted: latestRun.ordersInserted,
        ordersUpdated: latestRun.ordersUpdated,
        itemsObserved: latestRun.itemsObserved,
        exceptionsCount: latestRun.exceptionsCount,
        errorCode: latestRun.errorCode,
        errorMessage: latestRun.errorMessage,
      } : null,
      cursor: cursor ? {
        lastSourceTimestamp: cursor.lastSourceTimestamp?.toISOString() ?? null,
        updatedAt: cursor.updatedAt.toISOString(),
      } : null,
      exceptions: { pendingReviews, unmappedItems, inactiveItems },
    };
  }

  async orders(
    organizationId: bigint,
    userId: bigint,
    query: PosOrderQueryDto,
  ) {
    const store = await this.storeAccess(organizationId, userId, query.storeId);
    const organization = await this.prisma.client.organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: { timezone: true },
    });
    const orderedAt = query.from || query.to ? {
      ...(query.from ? { gte: calendarDateStart(query.from, organization.timezone) } : {}),
      ...(query.to ? { lt: nextCalendarDateStart(query.to, organization.timezone) } : {}),
    } : undefined;
    const where = {
      organizationId,
      storeId: store.id,
      ...(orderedAt ? { orderedAt } : {}),
      ...(query.inventoryStatus ? { inventoryStatus: query.inventoryStatus } : {}),
    };
    const [orders, total] = await Promise.all([
      this.prisma.client.posOrder.findMany({
        where,
        ...this.page(query),
        orderBy: [{ orderedAt: 'desc' }, { id: 'desc' }],
        include: {
          _count: { select: { items: { where: { status: 'ACTIVE' } } } },
          inventorySimulation: { select: { status: true } },
          refundReview: { select: { status: true } },
        },
      }),
      this.prisma.client.posOrder.count({ where }),
    ]);
    return this.pageResult(orders.map((order) => ({
      id: order.id.toString(),
      externalOrderNo: order.externalOrderNo,
      sourceStatus: order.sourceStatus,
      inventoryStatus: order.inventoryStatus,
      orderAmount: order.orderAmount?.toString() ?? null,
      refundAmount: order.refundAmount.toString(),
      orderedAt: order.orderedAt.toISOString(),
      activeItemCount: order._count.items,
      simulationStatus: order.inventorySimulation?.status ?? null,
      refundReviewStatus: order.refundReview?.status ?? null,
    })), total, query);
  }

  async orderDetail(
    organizationId: bigint,
    userId: bigint,
    storeIdValue: string,
    orderIdValue: string,
  ) {
    const store = await this.storeAccess(organizationId, userId, storeIdValue);
    if (!/^\d+$/.test(orderIdValue)) throw new NotFoundException('POS订单不存在');
    const order = await this.prisma.client.posOrder.findFirst({
      where: { id: BigInt(orderIdValue), organizationId, storeId: store.id },
      include: {
        items: {
          orderBy: { id: 'asc' },
          include: { product: { select: { name: true, sku: true } } },
        },
        inventorySimulation: { select: { id: true, status: true } },
        refundReview: { select: { id: true, status: true, reason: true } },
      },
    });
    if (!order) throw new NotFoundException('POS订单不存在');
    return {
      id: order.id.toString(),
      externalOrderNo: order.externalOrderNo,
      sourceStatus: order.sourceStatus,
      inventoryStatus: order.inventoryStatus,
      orderAmount: order.orderAmount?.toString() ?? null,
      refundAmount: order.refundAmount.toString(),
      orderedAt: order.orderedAt.toISOString(),
      simulation: order.inventorySimulation ? {
        id: order.inventorySimulation.id.toString(),
        status: order.inventorySimulation.status,
      } : null,
      refundReview: order.refundReview ? {
        id: order.refundReview.id.toString(),
        status: order.refundReview.status,
        reason: order.refundReview.reason,
      } : null,
      items: order.items.map((item) => ({
        id: item.id.toString(),
        externalProductId: item.externalProductId,
        productId: item.productId?.toString() ?? null,
        sku: item.product?.sku ?? null,
        productName: item.product?.name ?? item.sourceName,
        barcode: item.barcode,
        quantity: item.quantity.toString(),
        unitPrice: item.unitPrice?.toString() ?? null,
        disposition: item.disposition,
        status: item.status,
        exclusionReason: item.exclusionReason,
      })),
    };
  }

  async mappings(
    organizationId: bigint,
    userId: bigint,
    query: PosMappingQueryDto,
  ) {
    const store = await this.storeAccess(organizationId, userId, query.storeId);
    const keyword = query.q?.trim();
    const where = {
      organizationId,
      storeId: store.id,
      ...(query.status ? { status: query.status } : {}),
      ...(keyword ? {
        OR: [
          { barcode: { contains: keyword } },
          { sourceName: { contains: keyword } },
          { externalProductId: { contains: keyword } },
          { product: { name: { contains: keyword } } },
        ],
      } : {}),
    };
    const [mappings, total] = await Promise.all([
      this.prisma.client.posProductMapping.findMany({
        where,
        ...this.page(query),
        orderBy: { lastSeenAt: 'desc' },
        include: {
          product: {
            select: {
              sku: true,
              name: true,
              storeProducts: {
                where: { storeId: store.id },
                select: { sellingPriceCents: true, enabled: true },
              },
            },
          },
        },
      }),
      this.prisma.client.posProductMapping.count({ where }),
    ]);
    return this.pageResult(mappings.map((mapping) => ({
      id: mapping.id.toString(),
      externalProductId: mapping.externalProductId,
      productId: mapping.productId.toString(),
      sku: mapping.product.sku,
      productName: mapping.product.name,
      sourceName: mapping.sourceName,
      barcode: mapping.barcode,
      status: mapping.status,
      enabled: mapping.product.storeProducts[0]?.enabled ?? false,
      sellingPriceCents: mapping.product.storeProducts[0]?.sellingPriceCents ?? null,
      lastSeenAt: mapping.lastSeenAt.toISOString(),
    })), total, query);
  }

  async simulations(
    organizationId: bigint,
    userId: bigint,
    query: PosSimulationQueryDto,
  ) {
    const store = await this.storeAccess(organizationId, userId, query.storeId);
    const where = {
      organizationId,
      storeId: store.id,
      ...(query.status ? { status: query.status } : {}),
    };
    const [simulations, total] = await Promise.all([
      this.prisma.client.posInventorySimulation.findMany({
        where,
        ...this.page(query),
        orderBy: { updatedAt: 'desc' },
        include: {
          order: { select: { externalOrderNo: true, orderedAt: true } },
          _count: { select: { items: true } },
        },
      }),
      this.prisma.client.posInventorySimulation.count({ where }),
    ]);
    return this.pageResult(simulations.map((simulation) => ({
      id: simulation.id.toString(),
      orderId: simulation.orderId.toString(),
      externalOrderNo: simulation.order.externalOrderNo,
      orderedAt: simulation.order.orderedAt.toISOString(),
      status: simulation.status,
      itemCount: simulation._count.items,
      inventorySnapshot: simulation.inventorySnapshot.toISOString(),
      updatedAt: simulation.updatedAt.toISOString(),
    })), total, query);
  }

  async simulationDetail(
    organizationId: bigint,
    userId: bigint,
    storeIdValue: string,
    simulationIdValue: string,
  ) {
    const store = await this.storeAccess(organizationId, userId, storeIdValue);
    if (!/^\d+$/.test(simulationIdValue)) throw new NotFoundException('模拟记录不存在');
    const simulation = await this.prisma.client.posInventorySimulation.findFirst({
      where: { id: BigInt(simulationIdValue), organizationId, storeId: store.id },
      include: {
        order: { select: { externalOrderNo: true, orderedAt: true } },
        items: {
          orderBy: { id: 'asc' },
          include: { product: { select: { sku: true, name: true } } },
        },
      },
    });
    if (!simulation) throw new NotFoundException('模拟记录不存在');
    return {
      id: simulation.id.toString(),
      externalOrderNo: simulation.order.externalOrderNo,
      orderedAt: simulation.order.orderedAt.toISOString(),
      status: simulation.status,
      inventorySnapshot: simulation.inventorySnapshot.toISOString(),
      items: simulation.items.map((item) => ({
        id: item.id.toString(),
        productId: item.productId.toString(),
        sku: item.product.sku,
        productName: item.product.name,
        soldQuantity: item.soldQuantity,
        quantityBefore: item.quantityBefore,
        projectedQuantity: item.projectedQuantity,
        status: item.status,
        reason: item.reason,
      })),
    };
  }

  async reviews(
    organizationId: bigint,
    userId: bigint,
    query: PosReviewQueryDto,
  ) {
    const store = await this.storeAccess(organizationId, userId, query.storeId);
    const where = {
      order: { organizationId, storeId: store.id },
      ...(query.status ? { status: query.status } : {}),
    };
    const [reviews, total] = await Promise.all([
      this.prisma.client.posRefundReview.findMany({
        where,
        ...this.page(query),
        orderBy: { updatedAt: 'desc' },
        include: { order: { select: { externalOrderNo: true, orderedAt: true } } },
      }),
      this.prisma.client.posRefundReview.count({ where }),
    ]);
    return this.pageResult(reviews.map((review) => ({
      id: review.id.toString(),
      orderId: review.orderId.toString(),
      externalOrderNo: review.order.externalOrderNo,
      orderedAt: review.order.orderedAt.toISOString(),
      status: review.status,
      observedRefundAmount: review.observedRefundAmount.toString(),
      originalItemsAvailable: review.originalItemsAvailable,
      reason: review.reason,
      resolutionNotes: review.resolutionNotes,
      resolvedAt: review.resolvedAt?.toISOString() ?? null,
      updatedAt: review.updatedAt.toISOString(),
    })), total, query);
  }
}
