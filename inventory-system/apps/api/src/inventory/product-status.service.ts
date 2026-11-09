// CR-020 F5–F8: an admin discontinues a product that is no longer sold, restores it, or renames it. Discontinuing uses
// the existing INACTIVE status, which the ledger, stocktake, purchase suggestions and expiry alerts already leave out.
import { randomUUID } from 'node:crypto';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { PrismaClient } from '@sunshine/database';
import { PrismaService } from '../database/prisma.service.js';
import { InventoryPermissionService } from './inventory-permission.service.js';

const DISCONTINUE_ACTION = 'product.discontinue';
const RESTORE_ACTION = 'product.restore';
const RENAME_ACTION = 'product.rename';
const STATUS_ACTIONS = [DISCONTINUE_ACTION, RESTORE_ACTION];

type AuditClient = Pick<PrismaClient, 'auditLog'>;
type AuditContext = { organizationId: bigint; userId: bigint; storeId: bigint; warehouseId: bigint };

function productAudit(client: AuditClient, context: AuditContext, action: string, productId: bigint, beforeSummary: object, afterSummary: object) {
  return client.auditLog.create({ data: { ...context, action, entityType: 'Product', entityId: productId.toString(), requestId: randomUUID(), beforeSummary, afterSummary } });
}

// Merged duplicates are INACTIVE too, so only a product whose latest status change is a discontinue counts as discontinued.
async function isDiscontinued(client: AuditClient, organizationId: bigint, productId: bigint) {
  const latest = await client.auditLog.findFirst({
    where: { organizationId, entityType: 'Product', entityId: productId.toString(), action: { in: STATUS_ACTIONS } },
    orderBy: { id: 'desc' }, select: { action: true },
  });
  return latest?.action === DISCONTINUE_ACTION;
}

// CR-020 F6: receiving a discontinued product again puts it back on sale. Runs inside the receiving transaction.
export async function restoreIfDiscontinued(client: AuditClient & Pick<PrismaClient, 'product'>, context: AuditContext, productId: bigint) {
  if (!(await isDiscontinued(client, context.organizationId, productId))) return false;
  await client.product.update({ where: { id: productId }, data: { status: 'ACTIVE' } });
  await productAudit(client, context, RESTORE_ACTION, productId, { status: 'INACTIVE' }, { status: 'ACTIVE', source: '扫码入库' });
  return true;
}

@Injectable()
export class ProductStatusService {
  constructor(private readonly prisma: PrismaService, private readonly permissions: InventoryPermissionService) {}

  async discontinue(organizationId: bigint, userId: bigint, productIdValue: string, reason: string) {
    const context = await this.adminContext(organizationId, userId);
    const productId = this.id(productIdValue);
    const product = await this.prisma.client.product.findFirst({ where: { id: productId, organizationId, status: 'ACTIVE' }, select: { name: true } });
    if (!product) throw new NotFoundException('没有找到这个商品，或已经停售');
    const stock = await this.prisma.client.inventoryBalance.findMany({ where: { organizationId, productId, quantity: { not: 0 } }, select: { quantity: true } });
    if (stock.length) {
      const total = stock.reduce((sum, row) => sum + row.quantity, 0);
      throw new BadRequestException(`该商品还有库存记录（合计 ${total} 件），请先盘点或出库到 0 再停售`);
    }
    await this.prisma.client.$transaction(async (tx) => {
      await tx.product.update({ where: { id: productId }, data: { status: 'INACTIVE' } });
      await productAudit(tx, context, DISCONTINUE_ACTION, productId, { status: 'ACTIVE', name: product.name }, { status: 'INACTIVE', reason });
    });
    return { productId: productId.toString(), productName: product.name };
  }

  async restore(organizationId: bigint, userId: bigint, productIdValue: string) {
    const context = await this.adminContext(organizationId, userId);
    const productId = this.id(productIdValue);
    const product = await this.prisma.client.product.findFirst({ where: { id: productId, organizationId, status: 'INACTIVE' }, select: { name: true } });
    if (!product || !(await isDiscontinued(this.prisma.client, organizationId, productId))) throw new NotFoundException('没有找到这个停售商品');
    await this.prisma.client.$transaction(async (tx) => {
      await tx.product.update({ where: { id: productId }, data: { status: 'ACTIVE' } });
      await productAudit(tx, context, RESTORE_ACTION, productId, { status: 'INACTIVE' }, { status: 'ACTIVE', source: '手动恢复' });
    });
    return { productId: productId.toString(), productName: product.name };
  }

  async listDiscontinued(organizationId: bigint, userId: bigint) {
    await this.adminContext(organizationId, userId);
    const logs = await this.prisma.client.auditLog.findMany({
      where: { organizationId, entityType: 'Product', action: { in: STATUS_ACTIONS } },
      orderBy: { id: 'desc' },
      select: { action: true, entityId: true, createdAt: true, afterSummary: true, user: { select: { displayName: true } } },
    });
    const latest = new Map<string, (typeof logs)[number]>();
    for (const log of logs) if (log.entityId && !latest.has(log.entityId)) latest.set(log.entityId, log);
    const discontinued = [...latest.values()].filter((log) => log.action === DISCONTINUE_ACTION);
    if (!discontinued.length) return [];
    const products = await this.prisma.client.product.findMany({
      where: { organizationId, status: 'INACTIVE', id: { in: discontinued.map((log) => BigInt(log.entityId!)) } },
      select: { id: true, name: true, barcodes: { where: { status: 'ACTIVE' }, orderBy: [{ isPrimary: 'desc' }, { id: 'asc' }], select: { barcode: true } } },
    });
    const byId = new Map(products.map((product) => [product.id.toString(), product]));
    return discontinued.flatMap((log) => {
      const product = byId.get(log.entityId!);
      if (!product) return [];
      const summary = (log.afterSummary ?? {}) as { reason?: string };
      return [{
        productId: log.entityId!, productName: product.name, barcodes: product.barcodes.map(({ barcode }) => barcode),
        discontinuedAt: log.createdAt.toISOString(), reason: summary.reason ?? null, performedBy: log.user.displayName,
      }];
    });
  }

  // Names shown side by side so the admin can compare with what the POS calls the product.
  async names(organizationId: bigint, userId: bigint, productIdValue: string) {
    const context = await this.adminContext(organizationId, userId);
    const productId = this.id(productIdValue);
    const product = await this.prisma.client.product.findFirst({
      where: { id: productId, organizationId, status: 'ACTIVE' },
      select: { name: true, chineseName: true, englishName: true, posProductMappings: { where: { storeId: context.storeId, status: 'ACTIVE' }, select: { sourceName: true } } },
    });
    if (!product) throw new NotFoundException('没有找到这个商品');
    return {
      productId: productId.toString(), name: product.name, chineseName: product.chineseName, englishName: product.englishName,
      posNames: [...new Set(product.posProductMappings.map((mapping) => mapping.sourceName).filter((name): name is string => Boolean(name)))],
    };
  }

  // Pages show the Chinese name first, so the standard name replaces both; the English name is kept for matching.
  async rename(organizationId: bigint, userId: bigint, productIdValue: string, nameValue: string) {
    const context = await this.adminContext(organizationId, userId);
    const productId = this.id(productIdValue);
    const name = nameValue.trim();
    if (!name) throw new BadRequestException('商品名称不能为空');
    const product = await this.prisma.client.product.findFirst({ where: { id: productId, organizationId, status: 'ACTIVE' }, select: { name: true, chineseName: true } });
    if (!product) throw new NotFoundException('没有找到这个商品');
    if (product.name !== name || product.chineseName !== name) {
      await this.prisma.client.$transaction(async (tx) => {
        await tx.product.update({ where: { id: productId }, data: { name, chineseName: name } });
        await productAudit(tx, context, RENAME_ACTION, productId, { name: product.name, chineseName: product.chineseName }, { name, chineseName: name });
      });
    }
    return { productId: productId.toString(), name };
  }

  private async adminContext(organizationId: bigint, userId: bigint): Promise<AuditContext> {
    const permission = await this.permissions.warehousePermission(organizationId, userId, 'canView');
    await this.permissions.requireStoreAdmin(organizationId, userId, permission.warehouse.storeId);
    return { organizationId, userId, storeId: permission.warehouse.storeId, warehouseId: permission.warehouseId };
  }

  private id(value: string) {
    if (!/^\d{1,19}$/.test(value)) throw new BadRequestException('商品编号无效');
    return BigInt(value);
  }
}
