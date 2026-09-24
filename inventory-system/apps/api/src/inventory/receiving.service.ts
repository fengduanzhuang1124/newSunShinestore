import { randomUUID } from 'node:crypto';
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import { InventoryPermissionService } from './inventory-permission.service.js';
import { ScanReceiveDto } from './scan-receive.dto.js';
import { parseExpiryInput } from './expiry-date.js';

@Injectable()
export class ReceivingService {
  constructor(private readonly prisma: PrismaService, private readonly permissions: InventoryPermissionService) {}

  private localDate(timeZone: string, now = new Date()) {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(now);
  }

  private dateValue(date: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new BadRequestException('日期格式必须为 YYYY-MM-DD');
    }
    const value = new Date(`${date}T00:00:00.000Z`);
    if (Number.isNaN(value.getTime()) || value.toISOString().slice(0, 10) !== date) {
      throw new BadRequestException('日期不是有效的日历日期');
    }
    return value;
  }

  private groupReceiptItems(items: Array<{
    id: bigint;
    productId: bigint;
    batchId: bigint;
    barcode: string;
    quantity: number;
    createdAt: Date;
    product: { name: string };
    batch: { expiryDate: Date; expiryPrecision: 'MONTH' | 'DATE' };
    movement: { reversedBy: { id: bigint } | null };
  }>) {
    const grouped = new Map<string, {
      itemId: string;
      barcodes: string[];
      productName: string;
      expiryDate: string;
      quantity: number;
      reversed: boolean;
      createdAt: string;
      entryCount: number;
    }>();
    for (const item of items) {
      const reversed = Boolean(item.movement.reversedBy);
      const key = reversed
        ? `reversed:${item.id.toString()}`
        : `effective:${item.productId.toString()}:${item.batchId.toString()}`;
      const existing = grouped.get(key);
      if (existing) {
        existing.quantity += item.quantity;
        existing.entryCount += 1;
        if (!existing.barcodes.includes(item.barcode)) existing.barcodes.push(item.barcode);
        continue;
      }
      grouped.set(key, {
        itemId: item.id.toString(),
        barcodes: [item.barcode],
        productName: item.product.name,
        expiryDate: item.batch.expiryPrecision === 'MONTH'
          ? item.batch.expiryDate.toISOString().slice(0, 7)
          : item.batch.expiryDate.toISOString().slice(0, 10),
        quantity: item.quantity,
        reversed,
        createdAt: item.createdAt.toISOString(),
        entryCount: 1,
      });
    }
    return [...grouped.values()].map(({ barcodes, ...item }) => ({
      ...item,
      barcode: barcodes.join('、'),
    }));
  }

  async receive(
    organizationId: bigint,
    userId: bigint,
    input: ScanReceiveDto,
  ) {
    const permission = await this.permissions.warehousePermission(
      organizationId,
      userId,
      'canReceive',
      input.warehouseId,
    );

    const { expiryDate, expiryDisplay, expiryPrecision } = parseExpiryInput(
      input.expiryMonth,
      input.expiryDay,
    );
    return this.prisma.client.$transaction(async (transaction) => {
      const previousMovement = await transaction.stockMovement.findUnique({
        where: {
          organizationId_idempotencyKey: {
            organizationId,
            idempotencyKey: input.idempotencyKey,
          },
        },
        include: {
          product: true,
          batch: true,
          receiptItem: { include: { receipt: true } },
        },
      });
      if (previousMovement) {
        const previousReceiptItem = previousMovement.receiptItem;
        if (
          previousMovement.movementType !== 'RECEIPT'
          || previousMovement.warehouseId !== permission.warehouseId
          || previousMovement.quantityDelta !== input.quantity
          || !previousReceiptItem
          || (input.barcode && previousReceiptItem.barcode !== input.barcode)
          || previousMovement.batch.expiryDate.getTime() !== expiryDate.getTime()
          || previousMovement.batch.expiryPrecision !== expiryPrecision
        ) {
          throw new ConflictException('该入库请求编号已被其他操作使用');
        }
        const currentBalance = await transaction.inventoryBalance.findUniqueOrThrow({
          where: {
            organizationId_warehouseId_productId_batchId: {
              organizationId,
              warehouseId: permission.warehouseId,
              productId: previousMovement.productId,
              batchId: previousMovement.batchId,
            },
          },
          select: { quantity: true },
        });
        return {
          barcode: previousReceiptItem.barcode,
          productId: previousMovement.productId.toString(),
          productName: previousMovement.product.name,
          expiryDate: previousMovement.batch.expiryPrecision === 'MONTH'
            ? previousMovement.batch.expiryDate.toISOString().slice(0, 7)
            : previousMovement.batch.expiryDate.toISOString().slice(0, 10),
          expiryPrecision: previousMovement.batch.expiryPrecision,
          quantityAdded: previousMovement.quantityDelta,
          currentQuantity: currentBalance.quantity,
          receivedAt: previousMovement.createdAt.toISOString(),
          receiptId: previousReceiptItem.receipt.id.toString(),
          receiptNo: previousReceiptItem.receipt.receiptNo,
          warehouseName: permission.warehouse.name,
          repeatedRequest: true,
        };
      }
      const organization = await transaction.organization.findUniqueOrThrow({
        where: { id: organizationId },
        select: { timezone: true },
      });
      const receiptDateText = this.localDate(organization.timezone);
      const receiptDate = this.dateValue(receiptDateText);
      let receipt = await transaction.stockReceipt.findFirst({
        where: {
          organizationId,
          warehouseId: permission.warehouseId,
          openedById: userId,
          receiptDate,
          status: 'OPEN',
        },
        orderBy: { createdAt: 'desc' },
      });
      if (!receipt) {
        receipt = await transaction.stockReceipt.create({
          data: {
            receiptNo: `RK-${receiptDateText.replaceAll('-', '')}-${randomUUID().slice(0, 6).toUpperCase()}`,
            organizationId,
            storeId: permission.warehouse.storeId,
            warehouseId: permission.warehouseId,
            receiptDate,
            openedById: userId,
          },
        });
      }
      const requestedBarcode = input.barcode?.trim() || null;
      let productBarcode = requestedBarcode
        ? await transaction.productBarcode.findUnique({
          where: {
            organizationId_barcode: {
              organizationId,
              barcode: requestedBarcode,
            },
          },
          include: { product: true },
        })
        : null;
      let createdProduct = false;

      if (!productBarcode) {
        const requestedProductId = input.productId ? BigInt(input.productId) : null;
        let product = requestedProductId
          ? await transaction.product.findFirst({
            where: { id: requestedProductId, organizationId, status: 'ACTIVE' },
          })
          : await transaction.product.findFirst({
            where: { organizationId, status: 'ACTIVE', name: input.productName.trim() },
            orderBy: { id: 'asc' },
          });

        if (requestedProductId && !product) {
          throw new NotFoundException('所选商品不存在或已停用');
        }
        if (!product) {
          const internalSku = `LOCAL-${randomUUID().slice(0, 12).toUpperCase()}`;
          product = await transaction.product.create({
            data: {
              organizationId,
              sku: internalSku,
              name: input.productName.trim(),
              createdById: userId,
            },
          });
          createdProduct = true;
        }

        productBarcode = requestedBarcode
          ? null
          : await transaction.productBarcode.findFirst({
            where: { organizationId, productId: product.id, barcodeType: 'INTERNAL', status: 'ACTIVE' },
            orderBy: { id: 'asc' },
            include: { product: true },
          });
        if (!productBarcode) {
          const effectiveBarcode = requestedBarcode ?? `LOCAL-${product.id.toString()}`;
          productBarcode = await transaction.productBarcode.create({
            data: {
              organizationId,
              productId: product.id,
              barcode: effectiveBarcode,
              barcodeType: requestedBarcode ? 'SUPPLIER' : 'INTERNAL',
              isPrimary: true,
            },
            include: { product: true },
          });
        }
        await transaction.storeProduct.upsert({
          where: { storeId_productId: { storeId: permission.warehouse.storeId, productId: product.id } },
          create: { storeId: permission.warehouse.storeId, productId: product.id },
          update: { enabled: true },
        });
      }

      const batch = await transaction.productBatch.upsert({
        where: {
          organizationId_productId_expiryDate_expiryPrecision: {
            organizationId,
            productId: productBarcode.productId,
            expiryDate,
            expiryPrecision,
          },
        },
        update: {},
        create: {
          organizationId,
          productId: productBarcode.productId,
          expiryDate,
          expiryPrecision,
          createdById: userId,
        },
      });

      const balance = await transaction.inventoryBalance.upsert({
        where: {
          organizationId_warehouseId_productId_batchId: {
            organizationId,
            warehouseId: permission.warehouseId,
            productId: productBarcode.productId,
            batchId: batch.id,
          },
        },
        update: {
          quantity: { increment: input.quantity },
          version: { increment: 1 },
        },
        create: {
          organizationId,
          warehouseId: permission.warehouseId,
          productId: productBarcode.productId,
          batchId: batch.id,
          quantity: input.quantity,
        },
      });

      const requestId = input.idempotencyKey;
      const movement = await transaction.stockMovement.create({
        data: {
          movementNo: `RCV-${Date.now()}-${randomUUID().slice(0, 6)}`,
          organizationId,
          storeId: permission.warehouse.storeId,
          warehouseId: permission.warehouseId,
          productId: productBarcode.productId,
          batchId: batch.id,
          movementType: 'RECEIPT',
          quantityDelta: input.quantity,
          referenceType: 'STOCK_RECEIPT',
          referenceId: receipt.id,
          performedById: userId,
          idempotencyKey: requestId,
        },
      });
      await transaction.stockReceiptItem.create({
        data: {
          receiptId: receipt.id,
          productId: productBarcode.productId,
          batchId: batch.id,
          movementId: movement.id,
          barcode: productBarcode.barcode,
          quantity: input.quantity,
        },
      });
      await transaction.auditLog.create({
        data: {
          organizationId,
          userId,
          storeId: permission.warehouse.storeId,
          warehouseId: permission.warehouseId,
          action: 'inventory.receive',
          entityType: 'ProductBatch',
          entityId: batch.id.toString(),
          requestId,
          afterSummary: {
            barcode: productBarcode.barcode,
            entryMode: requestedBarcode ? 'BARCODE' : 'NO_BARCODE',
            createdProduct,
            expiryDate: expiryDisplay,
            expiryPrecision,
            quantityAdded: input.quantity,
            balance: balance.quantity,
          },
        },
      });

      return {
        barcode: productBarcode.barcode,
        generatedInternalBarcode: !requestedBarcode,
        createdProduct,
        productId: productBarcode.productId.toString(),
        productName: productBarcode.product.name,
        expiryDate: expiryDisplay,
        expiryPrecision,
        quantityAdded: input.quantity,
        currentQuantity: balance.quantity,
        receivedAt: movement.createdAt.toISOString(),
        receiptId: receipt.id.toString(),
        receiptNo: receipt.receiptNo,
        warehouseName: permission.warehouse.name,
      };
    });
  }

  async listReceipts(
    organizationId: bigint,
    userId: bigint,
    requestedDate?: string,
  ) {
    const permission = await this.permissions.warehousePermission(organizationId, userId, 'canView');
    const organization = await this.prisma.client.organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: { timezone: true },
    });
    const date = requestedDate || this.localDate(organization.timezone);
    const receipts = await this.prisma.client.stockReceipt.findMany({
      where: {
        organizationId,
        warehouseId: permission.warehouseId,
        receiptDate: this.dateValue(date),
        status: { not: 'CANCELLED' },
      },
      orderBy: { createdAt: 'desc' },
      include: {
        openedBy: { select: { displayName: true } },
        items: {
          orderBy: { createdAt: 'asc' },
          include: {
            product: { select: { name: true } },
            batch: { select: { expiryDate: true, expiryPrecision: true } },
            movement: { select: { reversedBy: { select: { id: true } } } },
          },
        },
      },
    });
    const allItems = receipts.flatMap((receipt) => receipt.items);
    const effectiveItems = allItems.filter((item) => !item.movement.reversedBy);
    return {
      date,
      warehouseName: permission.warehouse.name,
      summary: {
        receiptCount: receipts.length,
        productCount: new Set(effectiveItems.map((item) => item.productId.toString())).size,
        totalQuantity: effectiveItems.reduce((sum, item) => sum + item.quantity, 0),
      },
      receipts: receipts.map((receipt) => ({
        receiptId: receipt.id.toString(),
        receiptNo: receipt.receiptNo,
        status: receipt.status,
        employeeName: receipt.openedBy.displayName,
        createdAt: receipt.createdAt.toISOString(),
        completedAt: receipt.completedAt?.toISOString() ?? null,
        productCount: new Set(receipt.items.filter((item) => !item.movement.reversedBy).map((item) => item.productId.toString())).size,
        totalQuantity: receipt.items.reduce((sum, item) => sum + (item.movement.reversedBy ? 0 : item.quantity), 0),
        items: this.groupReceiptItems(receipt.items),
      })),
    };
  }

  async completeCurrentReceipt(organizationId: bigint, userId: bigint) {
    const permission = await this.permissions.warehousePermission(organizationId, userId, 'canReceive');
    const receipt = await this.prisma.client.stockReceipt.findFirst({
      where: {
        organizationId,
        warehouseId: permission.warehouseId,
        openedById: userId,
        status: 'OPEN',
      },
      orderBy: { createdAt: 'desc' },
      include: { items: true },
    });
    if (!receipt || receipt.items.length === 0) {
      throw new NotFoundException('当前没有可完成的入库单');
    }
    const completed = await this.prisma.client.stockReceipt.update({
      where: { id: receipt.id },
      data: { status: 'COMPLETED', completedById: userId, completedAt: new Date() },
    });
    return {
      receiptId: completed.id.toString(),
      receiptNo: completed.receiptNo,
      status: completed.status,
      totalQuantity: receipt.items.reduce((sum, item) => sum + item.quantity, 0),
    };
  }
}
