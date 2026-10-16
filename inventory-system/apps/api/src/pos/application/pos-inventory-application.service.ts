import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';

type ApplicationIssue = {
  orderId: string;
  orderNo: string;
  reason: 'INVALID_ITEMS' | 'INSUFFICIENT_INVENTORY' | 'ALREADY_APPLIED';
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

class InventoryApplicationConflict extends Error {
  constructor(readonly issue: ApplicationIssue) {
    super(issue.reason);
  }
}

@Injectable()
export class PosInventoryApplicationService {
  constructor(private readonly prisma: PrismaService) {}

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
    let eligibleOrders = 0;
    let unitsPlanned = 0;

    for (const order of orders) {
      try {
        const allocations = this.planOrder(order, projected);
        eligibleOrders += 1;
        unitsPlanned += allocations.reduce((sum, row) => sum + row.quantity, 0);
      } catch (error) {
        if (!(error instanceof InventoryApplicationConflict)) throw error;
        issues.push(error.issue);
      }
    }

    return {
      mode: 'PREVIEW' as const,
      period: { from: from.toISOString(), toExclusive: to.toISOString() },
      summary: {
        ordersScanned: orders.length,
        eligibleOrders,
        unitsPlanned,
        reviewRequiredOrders: reviewRequired,
        blockedOrders: issues.length,
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
      } catch (error) {
        if (!(error instanceof InventoryApplicationConflict)) throw error;
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
        blockedOrders: issues.length,
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

  private planOrder(order: OrderSnapshot, balances: BalanceSnapshot[]): Allocation[] {
    const inventoryItems = order.items.filter((item) => item.disposition === 'INVENTORY');
    const invalid = order.items.some((item) =>
      item.status !== 'ACTIVE' ||
      (item.disposition !== 'INVENTORY' && item.disposition !== 'NON_INVENTORY') ||
      (item.disposition === 'INVENTORY' && (
        item.productId === null ||
        item.isMinus ||
        !Number.isInteger(Number(item.quantity)) ||
        Number(item.quantity) <= 0
      )),
    );
    if (invalid) {
      throw new InventoryApplicationConflict({
        orderId: order.id.toString(),
        orderNo: order.externalOrderNo,
        reason: 'INVALID_ITEMS',
      });
    }

    const requiredByProduct = new Map<bigint, number>();
    for (const item of inventoryItems) {
      const productId = item.productId!;
      requiredByProduct.set(
        productId,
        (requiredByProduct.get(productId) ?? 0) + Number(item.quantity),
      );
    }
    for (const [productId, required] of requiredByProduct) {
      const available = balances
        .filter((balance) => balance.productId === productId && balance.quantity > 0)
        .reduce((sum, balance) => sum + balance.quantity, 0);
      if (available < required) {
        throw new InventoryApplicationConflict({
          orderId: order.id.toString(),
          orderNo: order.externalOrderNo,
          reason: 'INSUFFICIENT_INVENTORY',
          productId: productId.toString(),
          required,
          available,
        });
      }
    }

    const allocations: Allocation[] = [];
    for (const item of inventoryItems) {
      const productId = item.productId!;
      const required = Number(item.quantity);
      const candidates = balances.filter((balance) =>
        balance.productId === productId && balance.quantity > 0,
      );
      let remaining = required;
      for (const balance of candidates) {
        if (remaining === 0) break;
        const quantity = Math.min(balance.quantity, remaining);
        allocations.push({
          itemId: item.id,
          productId,
          warehouseId: balance.warehouseId,
          batchId: balance.batchId,
          quantity,
          expectedVersion: balance.version,
        });
        balance.quantity -= quantity;
        balance.version += 1;
        remaining -= quantity;
      }
    }
    return allocations;
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
      const allocations = this.planOrder(order, balances);
      const requestId = randomUUID();

      for (const allocation of allocations) {
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
          throw new InventoryApplicationConflict({
            orderId: order.id.toString(),
            orderNo: order.externalOrderNo,
            reason: 'INSUFFICIENT_INVENTORY',
            productId: allocation.productId.toString(),
            required: allocation.quantity,
            available: 0,
          });
        }
      }

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
            unitsApplied: allocations.reduce((sum, row) => sum + row.quantity, 0),
            movementCount: allocations.length,
          },
        },
      });

      return {
        orderId: order.id.toString(),
        unitsApplied: allocations.reduce((sum, row) => sum + row.quantity, 0),
      };
    });
  }
}
