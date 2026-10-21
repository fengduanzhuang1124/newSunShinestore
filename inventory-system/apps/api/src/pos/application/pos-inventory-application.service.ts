import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';

// Why a sale line was not (fully) deducted. The rest of the order is still applied; these lines wait for review.
export type LineReviewReason = 'UNMAPPED' | 'REVIEW_REQUIRED' | 'RETURN_LINE' | 'INVALID_QUANTITY' | 'INSUFFICIENT_INVENTORY';

type ApplicationIssue = {
  orderId: string;
  orderNo: string;
  reason: LineReviewReason | 'ALREADY_APPLIED' | 'CONCURRENT_CHANGE';
  itemId?: string;
  productId?: string;
  required?: number;
  available?: number;
};

type BalanceSnapshot = {
  organizationId: bigint;
  warehouseId: bigint;
  productId: bigint;
  batchId: bigint;
  quantity: number;
  version: number;
  batch: { expiryDate: Date; status: string };
};

type OrderItemSnapshot = {
  id: bigint;
  productId: bigint | null;
  quantity: unknown;
  isMinus: boolean;
  disposition: string;
  status: string;
};

type OrderSnapshot = {
  id: bigint;
  externalOrderNo: string;
  sourceStatus: string;
  refundAmount: unknown;
  inventoryStatus: string;
  items: OrderItemSnapshot[];
};

type Allocation = {
  itemId: bigint;
  productId: bigint;
  warehouseId: bigint;
  batchId: bigint;
  quantity: number;
  expectedVersion: number;
};

type LinePlan = {
  itemId: bigint;
  productId: bigint | null;
  required: number;
  applied: number;
  reviewReason: LineReviewReason | null;
};

type OrderPlan = { allocations: Allocation[]; lines: LinePlan[] };

class InventoryApplicationConflict extends Error {
  constructor(readonly issue: ApplicationIssue) {
    super(issue.reason);
  }
}

@Injectable()
export class PosInventoryApplicationService {
  constructor(private readonly prisma: PrismaService) {}

  // Sales before this instant are already reflected in the counted stock. The store setting wins; the
  // POS_INVENTORY_BASELINE_AT environment value is only the fallback for stores not yet configured.
  async resolveBaseline(storeId: bigint): Promise<Date | null> {
    const store = await this.prisma.client.store.findUnique({
      where: { id: storeId },
      select: { posInventoryBaselineAt: true },
    });
    if (store?.posInventoryBaselineAt) return store.posInventoryBaselineAt;
    const value = process.env.POS_INVENTORY_BASELINE_AT;
    const fallback = value ? new Date(value) : null;
    return fallback && !Number.isNaN(fallback.getTime()) ? fallback : null;
  }

  async previewRange(
    organizationId: bigint,
    storeId: bigint,
    from: Date,
    to: Date,
  ) {
    const [orders, balances, reviewRequired] = await Promise.all([
      this.loadCandidateOrders(organizationId, storeId, from, to),
      this.loadBalances(organizationId, storeId),
      this.prisma.client.posOrder.count({
        where: {
          organizationId,
          storeId,
          orderedAt: { gte: from, lt: to },
          inventoryStatus: 'REVIEW_REQUIRED',
        },
      }),
    ]);
    const projected = balances.map((balance) => ({ ...balance }));
    const issues: ApplicationIssue[] = [];
    let unitsPlanned = 0;
    let shortfallUnits = 0;

    for (const order of orders) {
      const plan = this.planOrder(order, projected);
      unitsPlanned += plan.allocations.reduce((sum, row) => sum + row.quantity, 0);
      shortfallUnits += this.shortfall(plan);
      issues.push(...this.reviewIssues(order, plan));
    }

    return {
      mode: 'PREVIEW' as const,
      period: { from: from.toISOString(), toExclusive: to.toISOString() },
      summary: {
        ordersScanned: orders.length,
        eligibleOrders: orders.length,
        unitsPlanned,
        reviewRequiredOrders: reviewRequired,
        blockedOrders: 0,
        reviewLines: issues.length,
        shortfallUnits,
      },
      issues,
    };
  }

  async applyRange(
    organizationId: bigint,
    userId: bigint,
    storeId: bigint,
    from: Date,
    to: Date,
  ) {
    const orders = await this.loadCandidateOrders(organizationId, storeId, from, to);
    const issues: ApplicationIssue[] = [];
    let appliedOrders = 0;
    let unitsApplied = 0;
    let blockedOrders = 0;
    let reviewLines = 0;
    let shortfallUnits = 0;

    for (const candidate of orders) {
      try {
        const result = await this.applyOrder(
          organizationId,
          userId,
          storeId,
          candidate.id,
        );
        appliedOrders += 1;
        unitsApplied += result.unitsApplied;
        reviewLines += result.reviewIssues.length;
        shortfallUnits += result.shortfallUnits;
        issues.push(...result.reviewIssues);
      } catch (error) {
        if (!(error instanceof InventoryApplicationConflict)) throw error;
        blockedOrders += 1;
        issues.push(error.issue);
      }
    }

    return {
      mode: 'APPLIED' as const,
      period: { from: from.toISOString(), toExclusive: to.toISOString() },
      summary: {
        ordersScanned: orders.length,
        appliedOrders,
        unitsApplied,
        blockedOrders,
        reviewLines,
        shortfallUnits,
      },
      issues,
    };
  }

  private loadCandidateOrders(
    organizationId: bigint,
    storeId: bigint,
    from: Date,
    to: Date,
  ) {
    return this.prisma.client.posOrder.findMany({
      where: {
        organizationId,
        storeId,
        sourceStatus: 'Paid',
        refundAmount: 0,
        inventoryStatus: { in: ['OBSERVED', 'SIMULATED'] },
        orderedAt: { gte: from, lt: to },
      },
      orderBy: [{ orderedAt: 'asc' }, { id: 'asc' }],
      include: { items: { where: { status: 'ACTIVE' }, orderBy: { id: 'asc' } } },
    });
  }

  private loadBalances(organizationId: bigint, storeId: bigint) {
    return this.prisma.client.inventoryBalance.findMany({
      where: {
        organizationId,
        quantity: { gt: 0 },
        warehouse: { storeId, status: 'ACTIVE' },
        batch: { status: 'ACTIVE' },
      },
      orderBy: [
        { batch: { expiryDate: 'asc' } },
        { warehouseId: 'asc' },
        { batchId: 'asc' },
      ],
      select: {
        organizationId: true,
        warehouseId: true,
        productId: true,
        batchId: true,
        quantity: true,
        version: true,
        batch: { select: { expiryDate: true, status: true } },
      },
    });
  }

  // Each inventory line is deducted on its own, first-expiry-first. A line that cannot be (fully) deducted is
  // recorded with a review reason instead of blocking the whole order; stock is never driven below zero.
  private planOrder(order: OrderSnapshot, balances: BalanceSnapshot[]): OrderPlan {
    const allocations: Allocation[] = [];
    const lines: LinePlan[] = [];
    for (const item of order.items) {
      if (item.status !== 'ACTIVE' || item.disposition === 'NON_INVENTORY') continue;
      const required = Number(item.quantity);
      const line: LinePlan = { itemId: item.id, productId: item.productId, required, applied: 0, reviewReason: null };
      lines.push(line);
      if (item.disposition === 'REVIEW_REQUIRED') line.reviewReason = 'REVIEW_REQUIRED';
      else if (item.disposition !== 'INVENTORY' || item.productId === null) line.reviewReason = 'UNMAPPED';
      else if (item.isMinus) line.reviewReason = 'RETURN_LINE';
      else if (!Number.isInteger(required) || required <= 0) line.reviewReason = 'INVALID_QUANTITY';
      if (line.reviewReason) continue;

      let remaining = required;
      for (const balance of balances) {
        if (remaining === 0) break;
        if (balance.productId !== item.productId || balance.quantity <= 0) continue;
        const quantity = Math.min(balance.quantity, remaining);
        allocations.push({
          itemId: item.id,
          productId: item.productId,
          warehouseId: balance.warehouseId,
          batchId: balance.batchId,
          quantity,
          expectedVersion: balance.version,
        });
        balance.quantity -= quantity;
        balance.version += 1;
        remaining -= quantity;
      }
      line.applied = required - remaining;
      if (remaining > 0) line.reviewReason = 'INSUFFICIENT_INVENTORY';
    }
    return { allocations, lines };
  }

  private shortfall(plan: OrderPlan) {
    return plan.lines
      .filter((line) => line.reviewReason === 'INSUFFICIENT_INVENTORY')
      .reduce((sum, line) => sum + line.required - line.applied, 0);
  }

  private reviewIssues(order: OrderSnapshot, plan: OrderPlan): ApplicationIssue[] {
    return plan.lines
      .filter((line) => line.reviewReason !== null)
      .map((line) => ({
        orderId: order.id.toString(),
        orderNo: order.externalOrderNo,
        reason: line.reviewReason!,
        itemId: line.itemId.toString(),
        productId: line.productId?.toString(),
        required: line.required,
        available: line.applied,
      }));
  }

  private applyOrder(
    organizationId: bigint,
    userId: bigint,
    storeId: bigint,
    orderId: bigint,
  ) {
    return this.prisma.client.$transaction(async (tx) => {
      const claimed = await tx.posOrder.updateMany({
        where: {
          id: orderId,
          organizationId,
          storeId,
          sourceStatus: 'Paid',
          refundAmount: 0,
          inventoryStatus: { in: ['OBSERVED', 'SIMULATED'] },
        },
        data: { inventoryStatus: 'SIMULATED' },
      });
      if (claimed.count !== 1) {
        throw new InventoryApplicationConflict({
          orderId: orderId.toString(),
          orderNo: orderId.toString(),
          reason: 'ALREADY_APPLIED',
        });
      }

      const order = await tx.posOrder.findUniqueOrThrow({
        where: { id: orderId },
        include: { items: { where: { status: 'ACTIVE' }, orderBy: { id: 'asc' } } },
      });
      const balances = await tx.inventoryBalance.findMany({
        where: {
          organizationId,
          quantity: { gt: 0 },
          warehouse: { storeId, status: 'ACTIVE' },
          batch: { status: 'ACTIVE' },
        },
        orderBy: [
          { batch: { expiryDate: 'asc' } },
          { warehouseId: 'asc' },
          { batchId: 'asc' },
        ],
        select: {
          organizationId: true,
          warehouseId: true,
          productId: true,
          batchId: true,
          quantity: true,
          version: true,
          batch: { select: { expiryDate: true, status: true } },
        },
      });
      const plan = this.planOrder(order, balances);
      const requestId = randomUUID();

      for (const allocation of plan.allocations) {
        const idempotencyKey = `pos:${order.id}:${allocation.itemId}:${allocation.warehouseId}:${allocation.batchId}`;
        await tx.stockMovement.create({
          data: {
            movementNo: `POS-${order.id}-${allocation.itemId}-${allocation.warehouseId}-${allocation.batchId}`,
            organizationId,
            storeId,
            warehouseId: allocation.warehouseId,
            productId: allocation.productId,
            batchId: allocation.batchId,
            movementType: 'SALE_OUT',
            quantityDelta: -allocation.quantity,
            referenceType: 'POS_SALE_ITEM',
            referenceId: allocation.itemId,
            reason: `POS订单 ${order.externalOrderNo}`,
            performedById: userId,
            idempotencyKey,
          },
        });
        const updated = await tx.inventoryBalance.updateMany({
          where: {
            organizationId,
            warehouseId: allocation.warehouseId,
            productId: allocation.productId,
            batchId: allocation.batchId,
            version: allocation.expectedVersion,
            quantity: { gte: allocation.quantity },
          },
          data: {
            quantity: { decrement: allocation.quantity },
            version: { increment: 1 },
          },
        });
        if (updated.count !== 1) {
          // Someone changed this batch mid-transaction; roll the whole order back so the next run retries it.
          throw new InventoryApplicationConflict({
            orderId: order.id.toString(),
            orderNo: order.externalOrderNo,
            reason: 'CONCURRENT_CHANGE',
            productId: allocation.productId.toString(),
          });
        }
      }

      for (const line of plan.lines) {
        await tx.posOrderItem.update({
          where: { id: line.itemId },
          data: { inventoryAppliedQuantity: line.applied, inventoryReviewReason: line.reviewReason },
        });
      }

      const unitsApplied = plan.allocations.reduce((sum, row) => sum + row.quantity, 0);
      const reviewIssues = this.reviewIssues(order, plan);
      const shortfallUnits = this.shortfall(plan);
      await tx.posOrder.update({
        where: { id: order.id },
        data: {
          inventoryStatus: 'APPLIED',
          inventoryAppliedAt: new Date(),
          inventoryAppliedById: userId,
        },
      });
      await tx.auditLog.create({
        data: {
          organizationId,
          userId,
          storeId,
          action: 'pos.inventory.apply',
          entityType: 'PosOrder',
          entityId: order.id.toString(),
          requestId,
          afterSummary: {
            externalOrderNo: order.externalOrderNo,
            unitsApplied,
            movementCount: plan.allocations.length,
            reviewLines: reviewIssues.map((issue) => ({ itemId: issue.itemId, reason: issue.reason, required: issue.required, applied: issue.available })),
            shortfallUnits,
          },
        },
      });

      return {
        orderId: order.id.toString(),
        unitsApplied,
        reviewIssues,
        shortfallUnits,
      };
    });
  }
}
