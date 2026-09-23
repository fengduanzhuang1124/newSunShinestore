import { randomUUID } from 'node:crypto';
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import { InventoryPermissionService } from './inventory-permission.service.js';
import { StockIncreaseDto, StocktakeAdjustmentDto } from './stocktake-adjustment.dto.js';
import { parseExpiryInput } from './expiry-date.js';

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

  async increaseStock(organizationId: bigint, userId: bigint, input: StockIncreaseDto) {
    const permission = await this.permissions.warehousePermission(
      organizationId, userId, 'canReceive', input.warehouseId,
    );
    const productId = BigInt(input.productId);
    return this.prisma.client.$transaction(async (transaction) => {
      const repeated = await transaction.stockMovement.findUnique({
        where: { organizationId_idempotencyKey: { organizationId, idempotencyKey: input.idempotencyKey } },
        include: { product: true, batch: true },
      });
      if (repeated) {
        if (repeated.referenceType !== 'MANUAL_INCREASE' || repeated.productId !== productId || repeated.quantityDelta !== input.quantity) {
          throw new ConflictException('该库存增加请求编号已被其他操作使用');
        }
        const current = await transaction.inventoryBalance.findUniqueOrThrow({
          where: { organizationId_warehouseId_productId_batchId: {
            organizationId, warehouseId: permission.warehouseId, productId, batchId: repeated.batchId,
          } },
        });
        return {
          movementId: repeated.id.toString(), productName: repeated.product.name,
          expiryDate: repeated.batch.expiryPrecision === 'MONTH'
            ? repeated.batch.expiryDate.toISOString().slice(0, 7)
            : repeated.batch.expiryDate.toISOString().slice(0, 10),
          quantityAdded: repeated.quantityDelta, currentQuantity: current.quantity, repeated: true,
        };
      }
      const product = await transaction.product.findFirst({
        where: { id: productId, organizationId, status: 'ACTIVE' },
      });
      if (!product) throw new NotFoundException('商品不存在或已停用');

      let batch;
      if (input.batchId) {
        batch = await transaction.productBatch.findFirst({
          where: { id: BigInt(input.batchId), productId, organizationId, status: 'ACTIVE' },
        });
        if (!batch) throw new NotFoundException('所选到期批次不属于该商品');
      } else {
        if (!input.expiryMonth) throw new BadRequestException('新增批次时必须填写到期年月');
        const expiry = parseExpiryInput(input.expiryMonth, input.expiryDay);
        batch = await transaction.productBatch.upsert({
          where: { organizationId_productId_expiryDate_expiryPrecision: {
            organizationId, productId, expiryDate: expiry.expiryDate, expiryPrecision: expiry.expiryPrecision,
          } },
          update: { status: 'ACTIVE' },
          create: {
            organizationId, productId, expiryDate: expiry.expiryDate,
            expiryPrecision: expiry.expiryPrecision, createdById: userId,
          },
        });
      }
      const previous = await transaction.inventoryBalance.findUnique({
        where: { organizationId_warehouseId_productId_batchId: {
          organizationId, warehouseId: permission.warehouseId, productId, batchId: batch.id,
        } },
      });
      const balance = await transaction.inventoryBalance.upsert({
        where: { organizationId_warehouseId_productId_batchId: {
          organizationId, warehouseId: permission.warehouseId, productId, batchId: batch.id,
        } },
        update: { quantity: { increment: input.quantity }, version: { increment: 1 } },
        create: {
          organizationId, warehouseId: permission.warehouseId, productId, batchId: batch.id,
          quantity: input.quantity,
        },
      });
      const movement = await transaction.stockMovement.create({
        data: {
          movementNo: `INC-${Date.now()}-${randomUUID().slice(0, 6)}`,
          organizationId, storeId: permission.warehouse.storeId, warehouseId: permission.warehouseId,
          productId, batchId: batch.id, movementType: 'STOCKTAKE_GAIN', quantityDelta: input.quantity,
          referenceType: 'MANUAL_INCREASE', reason: input.reason, performedById: userId,
          idempotencyKey: input.idempotencyKey,
        },
      });
      await transaction.auditLog.create({
        data: {
          organizationId, userId, storeId: permission.warehouse.storeId, warehouseId: permission.warehouseId,
          action: 'inventory.manual_increase', entityType: 'StockMovement', entityId: movement.id.toString(),
          requestId: input.idempotencyKey, beforeSummary: { quantity: previous?.quantity ?? 0 },
          afterSummary: { quantity: balance.quantity, increasedBy: input.quantity, reason: input.reason },
        },
      });
      return {
        movementId: movement.id.toString(), productName: product.name,
        expiryDate: batch.expiryPrecision === 'MONTH'
          ? batch.expiryDate.toISOString().slice(0, 7)
          : batch.expiryDate.toISOString().slice(0, 10),
        quantityAdded: input.quantity, previousQuantity: previous?.quantity ?? 0,
        currentQuantity: balance.quantity, repeated: false,
      };
    });
  }
}
