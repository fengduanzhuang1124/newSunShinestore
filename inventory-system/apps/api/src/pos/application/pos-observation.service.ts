import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { MoniOrderGateway } from '../adapters/moni/moni-order.gateway.js';
import { MoniProductGateway } from '../adapters/moni/moni-product.gateway.js';
import { dateTimeInZone, nextCalendarDateStart } from './pos-date.js';

export interface PosMappingImportResult {
  observed: number;
  mapped: number;
  skippedWithoutBarcode: number;
  skippedInvalid: number;
}

export interface PosOrderObservationResult {
  orders: number;
  ordersProcessed: number;
  ordersSkipped: number;
  items: number;
  inventoryItems: number;
  nonInventoryItems: number;
  reviewItems: number;
  unmappedItems: number;
}

export interface PosOrderObservationOptions {
  reconcile?: boolean;
}

function parseMoniDate(value: string | null): Date {
  const match = value?.match(
    /^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2}):(\d{2})$/,
  );
  if (!match) throw new Error('Moni order date is missing or invalid');

  const [, day, month, year, hour, minute, second] = match;
  const parsed = dateTimeInZone(
    Number(year),
    Number(month),
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
    'Pacific/Auckland',
  );
  if (Number.isNaN(parsed.getTime())) throw new Error('Moni order date is invalid');
  return parsed;
}

@Injectable()
export class PosObservationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly products: MoniProductGateway,
    private readonly orders: MoniOrderGateway,
  ) {}

  async importProductMappings(
    organizationId: bigint,
    storeId: bigint,
  ): Promise<PosMappingImportResult> {
    const sourceProducts = await this.products.listAll();
    let mapped = 0;
    let skippedWithoutBarcode = 0;
    let skippedInvalid = 0;

    for (const source of sourceProducts) {
      if (!source.barcode) {
        skippedWithoutBarcode += 1;
        continue;
      }
      if (!source.externalProductId || !source.name) {
        skippedInvalid += 1;
        continue;
      }
      const barcode = source.barcode;
      const externalProductId = source.externalProductId;
      const sourceName = source.name;

      await this.prisma.client.$transaction(async (transaction) => {
        const existingBarcode = await transaction.productBarcode.findUnique({
          where: {
            organizationId_barcode: {
              organizationId,
              barcode,
            },
          },
        });

        let productId = existingBarcode?.productId;
        if (!productId) {
          let sku = source.sku || `MONI-${externalProductId}`;
          const skuOwner = await transaction.product.findUnique({
            where: { organizationId_sku: { organizationId, sku } },
          });
          if (skuOwner) sku = `MONI-${externalProductId}`;

          const product = await transaction.product.create({
            data: {
              organizationId,
              sku,
              name: sourceName,
              barcodes: {
                create: {
                  organizationId,
                  barcode,
                  isPrimary: true,
                },
              },
            },
          });
          productId = product.id;
        }

        await transaction.storeProduct.upsert({
          where: { storeId_productId: { storeId, productId } },
          create: {
            storeId,
            productId,
            sellingPriceCents:
              source.salePrice === null ? null : Math.round(source.salePrice * 100),
          },
          update: {
            enabled: true,
            sellingPriceCents:
              source.salePrice === null ? null : Math.round(source.salePrice * 100),
          },
        });

        await transaction.posProductMapping.upsert({
          where: {
            storeId_externalProductId: {
              storeId,
              externalProductId,
            },
          },
          create: {
            organizationId,
            storeId,
            externalProductId,
            productId,
            barcode,
            sourceName,
          },
          update: {
            productId,
            barcode,
            sourceName,
            status: 'ACTIVE',
            lastSeenAt: new Date(),
          },
        });
      });
      mapped += 1;
    }

    return {
      observed: sourceProducts.length,
      mapped,
      skippedWithoutBarcode,
      skippedInvalid,
    };
  }

  async observeOrders(
    organizationId: bigint,
    storeId: bigint,
    date: string,
    options: PosOrderObservationOptions = {},
  ): Promise<PosOrderObservationResult> {
    const cursor = await this.prisma.client.posSyncCursor.upsert({
      where: {
        storeId_provider_stream: { storeId, provider: 'MONI', stream: 'ORDERS' },
      },
      create: { organizationId, storeId },
      update: {},
    });
    const syncRun = await this.prisma.client.posSyncRun.create({
      data: {
        organizationId,
        storeId,
        cursorId: cursor.id,
        requestedFrom: date,
        requestedTo: date,
        cursorBefore: cursor.lastSourceTimestamp,
      },
    });

    try {
      const orderList = await this.orders.listAll(date, date);
      let itemCount = 0;
      let inventoryItems = 0;
      let nonInventoryItems = 0;
      let reviewItems = 0;
      let unmappedItems = 0;
      let ordersInserted = 0;
      let ordersUpdated = 0;
      let ordersSkipped = 0;

      const existingOrders = await this.prisma.client.posOrder.findMany({
        where: {
          storeId,
          externalOrderNo: { in: orderList.map(({ orderNo }) => orderNo) },
        },
        select: {
          id: true,
          externalOrderNo: true,
          sourceStatus: true,
          refundAmount: true,
          inventoryStatus: true,
        },
      });
      const existingByOrderNo = new Map(
        existingOrders.map((order) => [order.externalOrderNo, order]),
      );

      for (const summary of orderList) {
        const existingOrder = existingByOrderNo.get(summary.orderNo);
        const summaryStatus = summary.status ?? 'Unknown';
        const summaryRefundAmount = summary.refundAmount ?? 0;
        const isUnchanged =
          existingOrder?.sourceStatus === summaryStatus &&
          Number(existingOrder.refundAmount) === summaryRefundAmount;

        if (!options.reconcile && isUnchanged) {
          ordersSkipped += 1;
          continue;
        }

        const detail = await this.orders.getDetail(summary.orderNo);
        if (existingOrder) ordersUpdated += 1;
        else ordersInserted += 1;
        const mappings = await this.prisma.client.posProductMapping.findMany({
          where: {
            storeId,
            externalProductId: {
              in: detail.items.map(({ externalProductId }) => externalProductId),
            },
            status: 'ACTIVE',
          },
        });
        const mappingByExternalId = new Map(
          mappings.map((mapping) => [mapping.externalProductId, mapping]),
        );
        const items = detail.items.map((item, index) => {
          const mapping = mappingByExternalId.get(item.externalProductId);
          const lowerName = item.name?.toLowerCase() ?? '';
          const isNonInventory =
            item.externalProductId === '0' ||
            lowerName.includes('shipping fee') ||
            lowerName.includes('international fee');

          let disposition: 'INVENTORY' | 'NON_INVENTORY' | 'UNMAPPED' | 'REVIEW_REQUIRED';
          let exclusionReason: string | null = null;
          if (isNonInventory) {
            disposition = 'NON_INVENTORY';
            exclusionReason = 'MISC, shipping, or fee item';
            nonInventoryItems += 1;
          } else if (!mapping) {
            disposition = 'UNMAPPED';
            exclusionReason = 'No active local product mapping';
            unmappedItems += 1;
          } else if (!Number.isInteger(item.quantity) || item.isMinus) {
            disposition = 'REVIEW_REQUIRED';
            exclusionReason = item.isMinus
              ? 'Negative source line requires review'
              : 'Fractional quantity cannot enter integer stock ledger';
            reviewItems += 1;
          } else {
            disposition = 'INVENTORY';
            inventoryItems += 1;
          }

          return {
            lineKey: `${item.externalProductId}:${index + 1}`,
            externalProductId: item.externalProductId,
            mappingId: mapping?.id ?? null,
            productId: mapping?.productId ?? null,
            barcode: mapping?.barcode ?? null,
            sourceName: item.name,
            quantity: item.quantity.toFixed(4),
            unitPrice: item.price === null ? null : item.price.toFixed(2),
            isMinus: item.isMinus,
            disposition,
            status: 'ACTIVE' as const,
            exclusionReason,
          };
        });
        itemCount += items.length;

        const orderedAt = parseMoniDate(detail.date ?? summary.date);
        const refundAmount = detail.refundAmount ?? summary.refundAmount ?? 0;
        const sourceStatus = detail.status ?? summary.status ?? 'Unknown';
        const requiresReview =
          refundAmount > 0 ||
          sourceStatus.toLowerCase() !== 'paid' ||
          items.some(({ disposition }) =>
            disposition === 'UNMAPPED' || disposition === 'REVIEW_REQUIRED',
          );
        const inventoryStatus = requiresReview
          ? 'REVIEW_REQUIRED' as const
          : existingOrder?.inventoryStatus === 'APPLIED' ||
              existingOrder?.inventoryStatus === 'REVERSED'
            ? existingOrder.inventoryStatus
            : 'OBSERVED' as const;
        const fingerprint = createHash('sha256')
          .update(JSON.stringify({
            orderNo: detail.orderNo,
            sourceStatus,
            refundAmount,
            items: detail.items,
          }))
          .digest('hex');

        await this.prisma.client.$transaction(async (transaction) => {
          const order = await transaction.posOrder.upsert({
            where: {
              storeId_externalOrderNo: {
                storeId,
                externalOrderNo: detail.orderNo,
              },
            },
            create: {
              organizationId,
              storeId,
              syncRunId: syncRun.id,
              externalOrderNo: detail.orderNo,
              sourceStatus,
              orderAmount:
                detail.orderAmount === null ? null : detail.orderAmount.toFixed(2),
              refundAmount: refundAmount.toFixed(2),
              orderedAt,
              inventoryStatus,
              sourceFingerprint: fingerprint,
            },
            update: {
              syncRunId: syncRun.id,
              sourceStatus,
              orderAmount:
                detail.orderAmount === null ? null : detail.orderAmount.toFixed(2),
              refundAmount: refundAmount.toFixed(2),
              orderedAt,
              inventoryStatus,
              sourceFingerprint: fingerprint,
              lastSeenAt: new Date(),
            },
          });

          const currentLineKeys = items.map(({ lineKey }) => lineKey);
          await transaction.posOrderItem.updateMany({
            where: {
              orderId: order.id,
              ...(currentLineKeys.length > 0
                ? { lineKey: { notIn: currentLineKeys } }
                : {}),
            },
            data: { status: 'INACTIVE' },
          });

          for (const item of items) {
            await transaction.posOrderItem.upsert({
              where: {
                orderId_lineKey: { orderId: order.id, lineKey: item.lineKey },
              },
              create: { orderId: order.id, ...item },
              update: item,
            });
          }

          if (refundAmount > 0) {
            await transaction.posRefundReview.upsert({
              where: { orderId: order.id },
              create: {
                orderId: order.id,
                observedRefundAmount: refundAmount.toFixed(2),
                originalItemsAvailable: items.length > 0,
                reason: 'Moni refund does not reliably identify returned items',
              },
              update: {
                observedRefundAmount: refundAmount.toFixed(2),
                originalItemsAvailable: items.length > 0,
                status: 'PENDING',
                reason: 'Moni refund does not reliably identify returned items',
              },
            });
          }
        });
      }

      const cursorAfter = new Date(
        nextCalendarDateStart(date, 'Pacific/Auckland').getTime() - 1,
      );
      await this.prisma.client.posSyncCursor.update({
        where: { id: cursor.id },
        data: { lastSourceTimestamp: cursorAfter },
      });
      await this.prisma.client.posSyncRun.update({
        where: { id: syncRun.id },
        data: {
          status: 'SUCCEEDED',
          finishedAt: new Date(),
          ordersObserved: orderList.length,
          ordersInserted,
          ordersUpdated,
          ordersSkipped,
          itemsObserved: itemCount,
          exceptionsCount: reviewItems + unmappedItems,
          cursorAfter,
        },
      });

      return {
        orders: orderList.length,
        ordersProcessed: ordersInserted + ordersUpdated,
        ordersSkipped,
        items: itemCount,
        inventoryItems,
        nonInventoryItems,
        reviewItems,
        unmappedItems,
      };
    } catch (error) {
      await this.prisma.client.posSyncRun.update({
        where: { id: syncRun.id },
        data: {
          status: 'FAILED',
          finishedAt: new Date(),
          errorCode: 'POS_OBSERVATION_FAILED',
          errorMessage: error instanceof Error ? error.message.slice(0, 255) : 'Unknown error',
        },
      });
      throw error;
    }
  }
}
