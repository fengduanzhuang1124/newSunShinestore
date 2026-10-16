import { randomUUID } from 'node:crypto';
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import { InventoryPermissionService } from './inventory-permission.service.js';
import { ReverseMovementDto } from './reverse-movement.dto.js';

@Injectable()
export class MovementService {
  constructor(private readonly prisma: PrismaService, private readonly permissions: InventoryPermissionService = new InventoryPermissionService(prisma)) {}

  async reverseMovement(
    organizationId: bigint,
    userId: bigint,
    rawMovementId: string,
    input: ReverseMovementDto,
  ) {
    if (!/^\d+$/.test(rawMovementId)) throw new BadRequestException('库存流水编号无效');
    const permission = await this.permissions.warehousePermission(organizationId, userId, 'canCount');
    await this.permissions.requireStoreAdmin(organizationId, userId, permission.warehouse.storeId);
    const movementId = BigInt(rawMovementId);

    try {
      return await this.prisma.client.$transaction(async (transaction) => {
        const repeated = await transaction.stockMovement.findUnique({
          where: {
            organizationId_idempotencyKey: {
              organizationId,
              idempotencyKey: input.idempotencyKey,
            },
          },
          include: { reversalOf: { include: { product: true, batch: true } } },
        });
        if (repeated?.movementType === 'REVERSAL' && repeated.reversalOf) {
          return {
            movementId: repeated.id.toString(),
            reversedMovementId: repeated.reversalOf.id.toString(),
            reversedMovementNo: repeated.reversalOf.movementNo,
            productName: repeated.reversalOf.product.name,
            quantityDelta: repeated.quantityDelta,
            currentQuantity: null,
            repeated: true,
          };
        }

        const original = await transaction.stockMovement.findFirst({
          where: {
            id: movementId,
            organizationId,
            warehouseId: permission.warehouseId,
          },
          include: {
            product: true,
            batch: true,
            reversedBy: { select: { movementNo: true } },
          },
        });
        if (!original) throw new NotFoundException('库存流水不存在');
        if (!['RECEIPT', 'MANUAL_ISSUE'].includes(original.movementType)) {
          throw new BadRequestException('当前只允许撤销入库或手工出库流水');
        }
        if (original.reversedBy) {
          throw new ConflictException(`该流水已经由 ${original.reversedBy.movementNo} 撤销`);
        }

        const reversalDelta = -original.quantityDelta;
        const updated = await transaction.inventoryBalance.updateMany({
          where: {
            organizationId,
            warehouseId: original.warehouseId,
            productId: original.productId,
            batchId: original.batchId,
            ...(reversalDelta < 0 ? { quantity: { gte: -reversalDelta } } : {}),
          },
          data: {
            quantity: reversalDelta > 0
              ? { increment: reversalDelta }
              : { decrement: -reversalDelta },
            version: { increment: 1 },
          },
        });
        if (updated.count !== 1) {
          throw new ConflictException('当前库存不足，不能撤销这笔入库；请先核对后续出库记录');
        }

        const reversal = await transaction.stockMovement.create({
          data: {
            movementNo: `REV-${Date.now()}-${randomUUID().slice(0, 6)}`,
            organizationId,
            storeId: original.storeId,
            warehouseId: original.warehouseId,
            productId: original.productId,
            batchId: original.batchId,
            movementType: 'REVERSAL',
            quantityDelta: reversalDelta,
            referenceType: 'REVERSAL',
            referenceId: original.id,
            reason: input.reason,
            reversalOfId: original.id,
            performedById: userId,
            idempotencyKey: input.idempotencyKey,
          },
        });
        const balance = await transaction.inventoryBalance.findUniqueOrThrow({
          where: {
            organizationId_warehouseId_productId_batchId: {
              organizationId,
              warehouseId: original.warehouseId,
              productId: original.productId,
              batchId: original.batchId,
            },
          },
        });
        await transaction.auditLog.create({
          data: {
            organizationId,
            userId,
            storeId: original.storeId,
            warehouseId: original.warehouseId,
            action: 'inventory.reverse_movement',
            entityType: 'StockMovement',
            entityId: original.id.toString(),
            requestId: input.idempotencyKey,
            beforeSummary: {
              movementNo: original.movementNo,
              movementType: original.movementType,
              quantityDelta: original.quantityDelta,
            },
            afterSummary: {
              reversalMovementNo: reversal.movementNo,
              reversalDelta,
              currentQuantity: balance.quantity,
              reason: input.reason,
            },
          },
        });
        return {
          movementId: reversal.id.toString(),
          reversedMovementId: original.id.toString(),
          reversedMovementNo: original.movementNo,
          productName: original.product.name,
          quantityDelta: reversalDelta,
          currentQuantity: balance.quantity,
          repeated: false,
        };
      });
    } catch (error) {
      if (typeof error === 'object' && error && 'code' in error && error.code === 'P2002') {
        throw new ConflictException('该库存流水已经撤销，请刷新流水记录');
      }
      throw error;
    }
  }
}

