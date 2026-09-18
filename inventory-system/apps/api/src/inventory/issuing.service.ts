import { randomUUID } from 'node:crypto';
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import { InventoryPermissionService } from './inventory-permission.service.js';
import { ManualIssueDto } from './manual-issue.dto.js';

@Injectable()
export class IssuingService {
  constructor(private readonly prisma: PrismaService, private readonly permissions: InventoryPermissionService = new InventoryPermissionService(prisma)) {}

  async issueToShelf(
    organizationId: bigint,
    userId: bigint,
    input: ManualIssueDto,
  ) {
    const permission = await this.permissions.warehousePermission(
      organizationId,
      userId,
      'canIssue',
    );
    const batchId = BigInt(input.batchId);

    return this.prisma.client.$transaction(async (transaction) => {
      const batch = await transaction.productBatch.findFirst({
        where: { id: batchId, organizationId },
        include: { product: true },
      });
      if (!batch) {
        throw new NotFoundException('商品日期不存在');
      }
      const expiryDisplay = batch.expiryPrecision === 'MONTH'
        ? batch.expiryDate.toISOString().slice(0, 7)
        : batch.expiryDate.toISOString().slice(0, 10);

      const updated = await transaction.inventoryBalance.updateMany({
        where: {
          organizationId,
          warehouseId: permission.warehouseId,
          productId: batch.productId,
          batchId,
          quantity: { gte: input.quantity },
        },
        data: {
          quantity: { decrement: input.quantity },
          version: { increment: 1 },
        },
      });
      if (updated.count !== 1) {
        throw new ConflictException('该日期库存不足');
      }

      const requestId = randomUUID();
      await transaction.stockMovement.create({
        data: {
          movementNo: `ISS-${Date.now()}-${randomUUID().slice(0, 6)}`,
          organizationId,
          storeId: permission.warehouse.storeId,
          warehouseId: permission.warehouseId,
          productId: batch.productId,
          batchId,
          movementType: 'MANUAL_ISSUE',
          quantityDelta: -input.quantity,
          referenceType: 'SHELF_REPLENISHMENT',
          reason: input.reason,
          performedById: userId,
          idempotencyKey: requestId,
        },
      });
      await transaction.auditLog.create({
        data: {
          organizationId,
          userId,
          storeId: permission.warehouse.storeId,
          warehouseId: permission.warehouseId,
          action: 'inventory.issue_to_shelf',
          entityType: 'ProductBatch',
          entityId: batchId.toString(),
          requestId,
          afterSummary: {
            productName: batch.product.name,
            expiryDate: expiryDisplay,
            expiryPrecision: batch.expiryPrecision,
            quantityIssued: input.quantity,
            reason: input.reason,
          },
        },
      });
      const balance = await transaction.inventoryBalance.findUniqueOrThrow({
        where: {
          organizationId_warehouseId_productId_batchId: {
            organizationId,
            warehouseId: permission.warehouseId,
            productId: batch.productId,
            batchId,
          },
        },
      });
      return {
        productId: batch.productId.toString(),
        productName: batch.product.name,
        batchId: batchId.toString(),
        expiryDate: expiryDisplay,
        expiryPrecision: batch.expiryPrecision,
        quantityIssued: input.quantity,
        currentQuantity: balance.quantity,
        reason: input.reason,
      };
    });
  }
}

