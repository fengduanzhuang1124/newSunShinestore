import { randomUUID } from 'node:crypto';
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import { InventoryPermissionService } from './inventory-permission.service.js';
import { parseExpiryInput } from './expiry-date.js';
import type { CorrectBatchExpiryDto, DeleteExpiryAlertDto, ExpiryAlertActionDto, ExpiryAlertActionStatusDto } from './inventory-maintenance.dto.js';

@Injectable()
export class InventoryMaintenanceService {
  constructor(private readonly prisma: PrismaService, private readonly permissions: InventoryPermissionService) {}

  async correctBatchExpiry(organizationId: bigint, userId: bigint, batchIdValue: string, input: CorrectBatchExpiryDto) {
    const permission = await this.permissions.warehousePermission(organizationId, userId, 'canCount');
    const batchId = this.batchId(batchIdValue);
    const expiry = parseExpiryInput(input.expiryMonth, input.expiryDay);
    return this.prisma.client.$transaction(async (tx) => {
      const batch = await tx.productBatch.findFirst({
        where: { id: batchId, organizationId, inventoryBalances: { some: { warehouseId: permission.warehouseId } } },
        include: { product: { select: { name: true } } },
      });
      if (!batch) throw new NotFoundException('当前仓库没有这个商品批次');
      if (batch.expiryDate.getTime() === expiry.expiryDate.getTime() && batch.expiryPrecision === expiry.expiryPrecision) {
        throw new BadRequestException('新到期日期与原日期相同');
      }
      const duplicate = await tx.productBatch.findFirst({
        where: {
          organizationId,
          productId: batch.productId,
          expiryDate: expiry.expiryDate,
          expiryPrecision: expiry.expiryPrecision,
          id: { not: batchId },
        },
        select: { id: true },
      });
      if (duplicate) throw new ConflictException('该商品已经存在相同到期日期，请先核对批次，不能自动合并');
      const previousDisplay = this.expiryDisplay(batch.expiryDate, batch.expiryPrecision);
      await tx.productBatch.update({
        where: { id: batchId },
        data: { expiryDate: expiry.expiryDate, expiryPrecision: expiry.expiryPrecision },
      });
      await tx.expiryAlertAction.updateMany({
        where: { organizationId, warehouseId: permission.warehouseId, batchId, alertHiddenAt: { not: null } },
        data: { alertHiddenAt: null, alertHiddenById: null, alertHiddenReason: null, updatedById: userId },
      });
      await tx.auditLog.create({ data: {
        organizationId, userId, storeId: permission.warehouse.storeId, warehouseId: permission.warehouseId,
        action: 'inventory.batch_expiry.correct', entityType: 'ProductBatch', entityId: batchId.toString(), requestId: randomUUID(),
        beforeSummary: { expiryDate: previousDisplay, expiryPrecision: batch.expiryPrecision },
        afterSummary: { expiryDate: expiry.expiryDisplay, expiryPrecision: expiry.expiryPrecision, reason: input.reason },
      } });
      return { batchId: batchId.toString(), productName: batch.product.name, previousExpiryDate: previousDisplay, expiryDate: expiry.expiryDisplay, reason: input.reason };
    });
  }

  async saveExpiryAction(organizationId: bigint, userId: bigint, batchIdValue: string, input: ExpiryAlertActionDto) {
    const permission = await this.permissions.warehousePermission(organizationId, userId, 'canView');
    await this.permissions.requireStoreAdmin(organizationId, userId, permission.warehouse.storeId);
    const batchId = this.batchId(batchIdValue);
    return this.prisma.client.$transaction(async (tx) => {
      const balance = await tx.inventoryBalance.findFirst({
        where: { organizationId, warehouseId: permission.warehouseId, batchId },
        select: { productId: true },
      });
      if (!balance) throw new NotFoundException('当前仓库没有这个临期批次');
      const action = await tx.expiryAlertAction.upsert({
        where: { organizationId_warehouseId_batchId: { organizationId, warehouseId: permission.warehouseId, batchId } },
        create: {
          organizationId, storeId: permission.warehouse.storeId, warehouseId: permission.warehouseId,
          productId: balance.productId, batchId, handlingMethod: input.handlingMethod.trim(), status: 'OPEN',
          createdById: userId, updatedById: userId,
        },
        update: {
          handlingMethod: input.handlingMethod.trim(), status: 'OPEN', updatedById: userId,
          completedById: null, completedAt: null, ignoredAt: null, deletedById: null, deletedAt: null,
        },
      });
      await this.audit(tx, organizationId, userId, permission.warehouse.storeId, permission.warehouseId, action.id, 'inventory.expiry_action.save', { handlingMethod: action.handlingMethod, status: action.status });
      return this.serializeAction(action);
    });
  }

  async changeExpiryActionStatus(organizationId: bigint, userId: bigint, batchIdValue: string, input: ExpiryAlertActionStatusDto) {
    const permission = await this.permissions.warehousePermission(organizationId, userId, 'canView');
    if (input.status !== 'COMPLETED') {
      await this.permissions.requireStoreAdmin(organizationId, userId, permission.warehouse.storeId);
    }
    const batchId = this.batchId(batchIdValue);
    return this.prisma.client.$transaction(async (tx) => {
      const existing = await tx.expiryAlertAction.findFirst({ where: { organizationId, warehouseId: permission.warehouseId, batchId, deletedAt: null } });
      if (!existing) throw new NotFoundException('该临期批次还没有处理任务');
      const now = new Date();
      const action = await tx.expiryAlertAction.update({
        where: { id: existing.id },
        data: {
          status: input.status, updatedById: userId,
          completedById: input.status === 'COMPLETED' ? userId : null,
          completedAt: input.status === 'COMPLETED' ? now : null,
          ignoredAt: input.status === 'IGNORED' ? now : null,
        },
      });
      await this.audit(tx, organizationId, userId, permission.warehouse.storeId, permission.warehouseId, action.id, 'inventory.expiry_action.status', { status: action.status });
      return this.serializeAction(action);
    });
  }

  async deleteExpiryAction(organizationId: bigint, userId: bigint, batchIdValue: string) {
    const permission = await this.permissions.warehousePermission(organizationId, userId, 'canView');
    await this.permissions.requireStoreAdmin(organizationId, userId, permission.warehouse.storeId);
    const batchId = this.batchId(batchIdValue);
    return this.prisma.client.$transaction(async (tx) => {
      const existing = await tx.expiryAlertAction.findFirst({ where: { organizationId, warehouseId: permission.warehouseId, batchId, deletedAt: null } });
      if (!existing) throw new NotFoundException('该临期批次还没有处理任务');
      const action = await tx.expiryAlertAction.update({ where: { id: existing.id }, data: { deletedAt: new Date(), deletedById: userId, updatedById: userId } });
      await this.audit(tx, organizationId, userId, permission.warehouse.storeId, permission.warehouseId, action.id, 'inventory.expiry_action.delete', { softDeleted: true });
      return { batchId: batchId.toString(), deleted: true };
    });
  }

  async hideExpiryAlert(organizationId: bigint, userId: bigint, batchIdValue: string, input: DeleteExpiryAlertDto) {
    const permission = await this.permissions.warehousePermission(organizationId, userId, 'canView');
    await this.permissions.requireStoreAdmin(organizationId, userId, permission.warehouse.storeId);
    const batchId = this.batchId(batchIdValue);
    const reason = input.reason.trim();
    return this.prisma.client.$transaction(async (tx) => {
      const balance = await tx.inventoryBalance.findFirst({
        where: { organizationId, warehouseId: permission.warehouseId, batchId, quantity: { gt: 0 } },
        select: { productId: true },
      });
      if (!balance) throw new NotFoundException('当前仓库没有这个临期批次');
      const now = new Date();
      const action = await tx.expiryAlertAction.upsert({
        where: { organizationId_warehouseId_batchId: { organizationId, warehouseId: permission.warehouseId, batchId } },
        create: {
          organizationId, storeId: permission.warehouse.storeId, warehouseId: permission.warehouseId,
          productId: balance.productId, batchId, handlingMethod: '预警记录已删除', status: 'IGNORED',
          createdById: userId, updatedById: userId, ignoredAt: now,
          alertHiddenReason: reason, alertHiddenById: userId, alertHiddenAt: now,
        },
        update: {
          updatedById: userId, alertHiddenReason: reason, alertHiddenById: userId, alertHiddenAt: now,
        },
      });
      await this.audit(tx, organizationId, userId, permission.warehouse.storeId, permission.warehouseId, action.id, 'inventory.expiry_alert.hide', {
        batchId: batchId.toString(), reason, inventoryChanged: false,
      });
      return { batchId: batchId.toString(), hidden: true, reason, inventoryChanged: false };
    });
  }

  private batchId(value: string) {
    if (!/^\d+$/.test(value)) throw new BadRequestException('batchId必须是正整数');
    return BigInt(value);
  }

  private expiryDisplay(value: Date, precision: 'MONTH' | 'DATE') {
    return precision === 'MONTH' ? value.toISOString().slice(0, 7) : value.toISOString().slice(0, 10);
  }

  private serializeAction(action: { id: bigint; handlingMethod: string; status: string; completedAt: Date | null; updatedAt: Date }) {
    return { actionId: action.id.toString(), handlingMethod: action.handlingMethod, status: action.status, completedAt: action.completedAt?.toISOString() ?? null, updatedAt: action.updatedAt.toISOString() };
  }

  private async audit(tx: any, organizationId: bigint, userId: bigint, storeId: bigint, warehouseId: bigint, actionId: bigint, action: string, afterSummary: object) {
    await tx.auditLog.create({ data: { organizationId, userId, storeId, warehouseId, action, entityType: 'ExpiryAlertAction', entityId: actionId.toString(), requestId: randomUUID(), afterSummary } });
  }
}
