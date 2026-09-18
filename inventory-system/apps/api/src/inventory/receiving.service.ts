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
        if (
          previousMovement.movementType !== 'RECEIPT'
          || previousMovement.warehouseId !== permission.warehouseId
          || previousMovement.quantityDelta !== input.quantity
          || previousMovement.receiptItem?.barcode !== input.barcode
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
          barcode: previousMovement.receiptItem.barcode,
          productId: previousMovement.productId.toString(),
          productName: previousMovement.product.name,
          expiryDate: previousMovement.batch.expiryPrecision === 'MONTH'
            ? previousMovement.batch.expiryDate.toISOString().slice(0, 7)
            : previousMovement.batch.expiryDate.toISOString().slice(0, 10),
          expiryPrecision: previousMovement.batch.expiryPrecision,
          quantityAdded: previousMovement.quantityDelta,
          currentQuantity: currentBalance.quantity,
          receivedAt: previousMovement.createdAt.toISOString(),
          receiptId: previousMovement.receiptItem.receipt.id.toString(),
          receiptNo: previousMovement.receiptItem.receipt.receiptNo,
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
      const productBarcode = await transaction.productBarcode.findUnique({
        where: {
          organizationId_barcode: {
            organizationId,
            barcode: input.barcode,
          },
        },
        include: { product: true },
      });

      if (!productBarcode) {
        throw new NotFoundException('该条码尚未建立商品映射，请交由管理员审核后再入库');
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
          barcode: input.barcode,
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
            barcode: input.barcode,
            expiryDate: expiryDisplay,
            expiryPrecision,
            quantityAdded: input.quantity,
            balance: balance.quantity,
          },
        },
      });

      return {
        barcode: input.barcode,
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
        items: receipt.items.map((item) => ({
          itemId: item.id.toString(),
          barcode: item.barcode,
          productName: item.product.name,
          expiryDate: item.batch.expiryPrecision === 'MONTH'
            ? item.batch.expiryDate.toISOString().slice(0, 7)
            : item.batch.expiryDate.toISOString().slice(0, 10),
          quantity: item.quantity,
          reversed: Boolean(item.movement.reversedBy),
          createdAt: item.createdAt.toISOString(),
        })),
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

