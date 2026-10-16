import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { calendarDateStart, nextCalendarDateStart } from './pos-date.js';

export interface PosInventorySimulationResult {
  ordersObserved: number;
  ordersReady: number;
  ordersInsufficient: number;
  ordersReviewRequired: number;
  itemsSimulated: number;
  unitsSimulated: number;
}

@Injectable()
export class PosInventorySimulationService {
  constructor(private readonly prisma: PrismaService) {}

  async simulateDate(
    organizationId: bigint,
    storeId: bigint,
    targetDate: string,
    baselineDate = targetDate,
  ): Promise<PosInventorySimulationResult> {
    const organization = await this.prisma.client.organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: { timezone: true },
    });
    const start = calendarDateStart(baselineDate, organization.timezone);
    const end = nextCalendarDateStart(targetDate, organization.timezone);
    if (start >= end) throw new Error('POS simulation baseline date is after target date');
    const inventorySnapshot = new Date();
    const [orders, balances] = await Promise.all([
      this.prisma.client.posOrder.findMany({
        where: { organizationId, storeId, orderedAt: { gte: start, lt: end } },
        orderBy: [{ orderedAt: 'asc' }, { id: 'asc' }],
        include: {
          items: {
            where: { disposition: 'INVENTORY', status: 'ACTIVE' },
            orderBy: { id: 'asc' },
          },
        },
      }),
      this.prisma.client.inventoryBalance.findMany({
        where: { organizationId, warehouse: { storeId } },
        select: { productId: true, quantity: true },
      }),
    ]);

    const projectedByProduct = new Map<bigint, number>();
    for (const balance of balances) {
      projectedByProduct.set(
        balance.productId,
        (projectedByProduct.get(balance.productId) ?? 0) + balance.quantity,
      );
    }

    let ordersReady = 0;
    let ordersInsufficient = 0;
    let ordersReviewRequired = 0;
    let itemsSimulated = 0;
    let unitsSimulated = 0;

    for (const order of orders) {
      const orderRequiresReview =
        order.sourceStatus.toLowerCase() !== 'paid' ||
        Number(order.refundAmount) > 0 ||
        order.inventoryStatus === 'REVIEW_REQUIRED';
      const simulatedItems = order.items.map((item) => {
        if (item.productId === null) {
          throw new Error(`POS inventory item ${item.id} has no local product mapping`);
        }

        const soldQuantity = Number(item.quantity);
        if (!Number.isInteger(soldQuantity) || soldQuantity <= 0) {
          throw new Error(`POS inventory item ${item.id} has an invalid quantity`);
        }

        const quantityBefore = projectedByProduct.get(item.productId) ?? 0;
        if (orderRequiresReview) {
          return {
            orderItemId: item.id,
            productId: item.productId,
            soldQuantity,
            quantityBefore,
            projectedQuantity: quantityBefore,
            status: 'REVIEW_REQUIRED' as const,
            reason: 'Refunded, cancelled, void, or non-paid order requires review',
          };
        }

        const projectedQuantity = quantityBefore - soldQuantity;
        projectedByProduct.set(item.productId, projectedQuantity);
        return {
          orderItemId: item.id,
          productId: item.productId,
          soldQuantity,
          quantityBefore,
          projectedQuantity,
          status: projectedQuantity < 0 ? 'INSUFFICIENT' as const : 'READY' as const,
          reason: projectedQuantity < 0 ? 'Projected inventory is below zero' : null,
        };
      });

      const status = orderRequiresReview
        ? 'REVIEW_REQUIRED' as const
        : simulatedItems.some((item) => item.status === 'INSUFFICIENT')
          ? 'INSUFFICIENT' as const
          : 'READY' as const;
      if (status === 'READY') ordersReady += 1;
      if (status === 'INSUFFICIENT') ordersInsufficient += 1;
      if (status === 'REVIEW_REQUIRED') ordersReviewRequired += 1;
      itemsSimulated += simulatedItems.length;
      unitsSimulated += simulatedItems.reduce((sum, item) => sum + item.soldQuantity, 0);

      const sourceFingerprint = createHash('sha256')
        .update(JSON.stringify({
          orderFingerprint: order.sourceFingerprint,
          items: simulatedItems.map((item) => ({
            orderItemId: item.orderItemId.toString(),
            quantityBefore: item.quantityBefore,
            projectedQuantity: item.projectedQuantity,
            status: item.status,
          })),
        }))
        .digest('hex');

      await this.prisma.client.$transaction(async (transaction) => {
        const simulation = await transaction.posInventorySimulation.upsert({
          where: { orderId: order.id },
          create: {
            organizationId,
            storeId,
            orderId: order.id,
            status,
            inventorySnapshot,
            sourceFingerprint,
          },
          update: { status, inventorySnapshot, sourceFingerprint },
        });

        const currentItemIds = simulatedItems.map(({ orderItemId }) => orderItemId);
        await transaction.posInventorySimulationItem.deleteMany({
          where: {
            simulationId: simulation.id,
            ...(currentItemIds.length > 0
              ? { orderItemId: { notIn: currentItemIds } }
              : {}),
          },
        });
        for (const item of simulatedItems) {
          await transaction.posInventorySimulationItem.upsert({
            where: { orderItemId: item.orderItemId },
            create: { simulationId: simulation.id, ...item },
            update: item,
          });
        }
        await transaction.posOrder.update({
          where: { id: order.id },
          data: {
            inventoryStatus:
              status === 'REVIEW_REQUIRED' ? 'REVIEW_REQUIRED' : 'SIMULATED',
          },
        });
      });
    }

    return {
      ordersObserved: orders.length,
      ordersReady,
      ordersInsufficient,
      ordersReviewRequired,
      itemsSimulated,
      unitsSimulated,
    };
  }
}
