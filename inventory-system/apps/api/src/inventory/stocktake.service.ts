import { randomUUID } from 'node:crypto';
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import { InventoryPermissionService } from './inventory-permission.service.js';
import { StocktakeAdjustmentDto } from './stocktake-adjustment.dto.js';

@Injectable()
export class StocktakeService {
  constructor(private readonly prisma: PrismaService, private readonly permissions: InventoryPermissionService = new InventoryPermissionService(prisma)) {}

  async stocktakeAdjustment(
    organizationId: bigint,
    userId: bigint,
    input: StocktakeAdjustmentDto,
  ) {
    const permission = await this.permissions.warehousePermission(organizationId, userId, 'canCount');
    const batchId = BigInt(input.batchId);
    return this.prisma.client.$transaction(async (transaction) => {
      const batch = await transaction.productBatch.findFirst({
        where: { id: batchId, organizationId },
        select: { productId: true },
      });
      if (!batch) throw new NotFoundException('商品日期不存在');
      const balance = await transaction.inventoryBalance.findUnique({
        where: {
          organizationId_warehouseId_productId_batchId: {
            organizationId,
            warehouseId: permission.warehouseId,
            productId: batch.productId,
            batchId,
          },
        },
        include: { product: true, batch: true },
      });
      if (!balance) throw new NotFoundException('该商品日期没有库存记录');
      const difference = input.actualQuantity - balance.quantity;
      if (difference === 0) throw new BadRequestException('实际数量与系统数量相同，无需调整');
      const updated = await transaction.inventoryBalance.updateMany({
        where: {
          organizationId,
          warehouseId: permission.warehouseId,
          productId: balance.productId,
          batchId,
          quantity: balance.quantity,
          version: balance.version,
        },
        data: { quantity: input.actualQuantity, version: { increment: 1 } },
      });
      if (updated.count !== 1) throw new ConflictException('库存刚刚发生变化，请重新查询后盘点');
      const requestId = randomUUID();
      const movement = await transaction.stockMovement.create({
        data: {
          movementNo: `STK-${Date.now()}-${randomUUID().slice(0, 6)}`,
          organizationId,
          storeId: permission.warehouse.storeId,
          warehouseId: permission.warehouseId,
          productId: balance.productId,
          batchId,
          movementType: difference > 0 ? 'STOCKTAKE_GAIN' : 'STOCKTAKE_LOSS',
          quantityDelta: difference,
          referenceType: 'STOCKTAKE',
          reason: input.reason,
          performedById: userId,
          idempotencyKey: requestId,
        },
      });
      await transaction.auditLog.create({
        data: {
          organizationId, userId, storeId: permission.warehouse.storeId, warehouseId: permission.warehouseId,
          action: 'inventory.stocktake_adjustment', entityType: 'StockMovement', entityId: movement.id.toString(), requestId,
          beforeSummary: { quantity: balance.quantity },
          afterSummary: { quantity: input.actualQuantity, difference, reason: input.reason },
        },
      });
      return {
        movementId: movement.id.toString(), productName: balance.product.name,
        expiryDate: balance.batch.expiryPrecision === 'MONTH' ? balance.batch.expiryDate.toISOString().slice(0, 7) : balance.batch.expiryDate.toISOString().slice(0, 10),
        previousQuantity: balance.quantity, actualQuantity: input.actualQuantity, difference,
      };
    });
  }
}

