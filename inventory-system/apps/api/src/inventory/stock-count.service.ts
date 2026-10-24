import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { PrismaClient } from '@sunshine/database';
import { PrismaService } from '../database/prisma.service.js';
import { InventoryPermissionService } from './inventory-permission.service.js';
import { parseExpiryInput } from './expiry-date.js';
import { AddStockCountItemDto, ConfirmStockCountDto } from './stock-count.dto.js';
import { planStockCount, type CurrentBatch, type ExpiryPrecision } from './stock-count-plan.js';

const CONFIRM_ACTION = 'inventory.stock_count.confirm';
// POS lines still waiting for stock when the product is counted; the count already reflects those sales.
const COVERABLE_REVIEW_REASONS = ['INSUFFICIENT_INVENTORY'];

type CountItemRecord = {
  id: bigint; productId: bigint; priority: number; reasons: string; source: string; status: string;
  countedQuantity: number | null; confirmCount: number; confirmedAt: Date | null;
  product: { name: string; brandName: string | null; barcodes: { barcode: string }[] };
};

const itemInclude = {
  product: {
    select: {
      name: true, brandName: true,
      barcodes: { where: { status: 'ACTIVE' as const }, orderBy: [{ isPrimary: 'desc' as const }, { id: 'asc' as const }], select: { barcode: true }, take: 1 },
    },
  },
};

// Recount lists worked through product by product on the phone (REQ-012). Store admins only.
@Injectable()
export class StockCountService {
  constructor(private readonly prisma: PrismaService, private readonly permissions: InventoryPermissionService = new InventoryPermissionService(prisma)) {}

  async current(organizationId: bigint, userId: bigint) {
    const permission = await this.adminPermission(organizationId, userId);
    const task = await this.prisma.client.stockCountTask.findFirst({
      where: { organizationId, warehouseId: permission.warehouseId, status: 'OPEN' },
      orderBy: { createdAt: 'desc' },
    });
    if (!task) return { task: null, items: [] };
    const items = await this.prisma.client.stockCountTaskItem.findMany({
      where: { taskId: task.id },
      include: itemInclude,
      orderBy: [{ priority: 'asc' }, { id: 'asc' }],
    });
    const batches = await this.batchesByProduct(this.prisma.client, organizationId, permission.warehouseId, items.map((item) => item.productId));
    return {
      task: this.taskView(task, items),
      items: items.map((item) => this.itemView(item, batches.get(item.productId.toString()) ?? [])),
    };
  }

  // Progress only, for the workbench banner (the full list is large).
  async summary(organizationId: bigint, userId: bigint) {
    const permission = await this.adminPermission(organizationId, userId);
    const task = await this.prisma.client.stockCountTask.findFirst({
      where: { organizationId, warehouseId: permission.warehouseId, status: 'OPEN' },
      orderBy: { createdAt: 'desc' },
    });
    if (!task) return { task: null };
    const groups = await this.prisma.client.stockCountTaskItem.groupBy({ by: ['status'], where: { taskId: task.id }, _count: { _all: true } });
    const confirmed = groups.find((group) => group.status === 'CONFIRMED')?._count._all ?? 0;
    const pending = groups.find((group) => group.status === 'PENDING')?._count._all ?? 0;
    return { task: { id: task.id.toString(), code: task.code, title: task.title, total: confirmed + pending, confirmed, pending } };
  }

  async addItem(organizationId: bigint, userId: bigint, taskIdValue: string, input: AddStockCountItemDto) {
    const permission = await this.adminPermission(organizationId, userId);
    const taskId = this.id(taskIdValue, '盘点任务');
    const productId = BigInt(input.productId);
    return this.prisma.client.$transaction(async (tx) => {
      const task = await tx.stockCountTask.findFirst({ where: { id: taskId, organizationId, warehouseId: permission.warehouseId, status: 'OPEN' } });
      if (!task) throw new NotFoundException('盘点任务不存在或已结束');
      const product = await tx.product.findFirst({ where: { id: productId, organizationId, status: 'ACTIVE' }, select: { id: true } });
      if (!product) throw new NotFoundException('商品不存在或已停用');
      let item = await tx.stockCountTaskItem.findUnique({ where: { taskId_productId: { taskId, productId } }, include: itemInclude });
      if (!item) {
        item = await tx.stockCountTaskItem.create({
          data: { taskId, productId, priority: 1, reasons: '盘点时临时加入', source: 'ADDED' },
          include: itemInclude,
        });
        await tx.auditLog.create({
          data: {
            organizationId, userId, storeId: task.storeId, warehouseId: task.warehouseId,
            action: 'inventory.stock_count.add_item', entityType: 'StockCountTaskItem', entityId: item.id.toString(),
            requestId: `count-add:${task.id}:${productId}`, afterSummary: { taskCode: task.code, productId: productId.toString() },
          },
        });
      }
      const batches = await this.batchesByProduct(tx, organizationId, permission.warehouseId, [productId]);
      return this.itemView(item, batches.get(productId.toString()) ?? []);
    });
  }

  async confirm(organizationId: bigint, userId: bigint, taskIdValue: string, itemIdValue: string, input: ConfirmStockCountDto) {
    const permission = await this.adminPermission(organizationId, userId);
    const taskId = this.id(taskIdValue, '盘点任务');
    const itemId = this.id(itemIdValue, '盘点商品');
    const counted = input.lines.map((line) => {
      const expiry = parseExpiryInput(line.expiry.slice(0, 7), line.expiry.length === 10 ? Number(line.expiry.slice(8)) : undefined);
      return { expiryDate: expiry.expiryDate, expiryPrecision: expiry.expiryPrecision as ExpiryPrecision, quantity: line.quantity };
    });

    return this.prisma.client.$transaction(async (tx) => {
      const replay = await tx.auditLog.findFirst({ where: { organizationId, action: CONFIRM_ACTION, requestId: input.requestId }, select: { id: true } });
      const item = await tx.stockCountTaskItem.findFirst({
        where: { id: itemId, taskId, task: { organizationId, warehouseId: permission.warehouseId } },
        include: { task: true },
      });
      if (!item) throw new NotFoundException('盘点商品不存在');
      if (replay) return this.confirmResult(tx, item.task, item.id, organizationId, permission.warehouseId);
      if (item.task.status !== 'OPEN') throw new ConflictException('该盘点任务已结束');

      const balances = await tx.inventoryBalance.findMany({
        where: { organizationId, warehouseId: permission.warehouseId, productId: item.productId },
        include: { batch: true },
      });
      const expected = new Map(input.expected.map((row) => [row.batchId, row.quantity]));
      const moved = balances.some((row) => row.quantity !== (expected.get(row.batchId.toString()) ?? 0))
        || [...expected.keys()].some((batchId) => !balances.some((row) => row.batchId.toString() === batchId));
      if (moved) throw new ConflictException('该商品库存刚刚发生变化（可能是 POS 刚扣减），请刷新后重新确认');

      const current: CurrentBatch[] = balances.map((row) => ({
        batchId: row.batchId, expiryDate: row.batch.expiryDate, expiryPrecision: row.batch.expiryPrecision, quantity: row.quantity,
      }));
      const plan = planStockCount(current, counted);
      const confirmation = item.confirmCount + 1;
      const confirmedAt = new Date();

      for (const adjustment of plan.adjustments) {
        const batchId = adjustment.batchId ?? (await tx.productBatch.upsert({
          where: { organizationId_productId_expiryDate_expiryPrecision: {
            organizationId, productId: item.productId, expiryDate: adjustment.expiryDate, expiryPrecision: adjustment.expiryPrecision,
          } },
          update: { status: 'ACTIVE' },
          create: { organizationId, productId: item.productId, expiryDate: adjustment.expiryDate, expiryPrecision: adjustment.expiryPrecision, createdById: userId },
          select: { id: true },
        })).id;
        const balance = balances.find((row) => row.batchId === batchId);
        if (balance) {
          const updated = await tx.inventoryBalance.updateMany({
            where: { organizationId, warehouseId: permission.warehouseId, productId: item.productId, batchId, quantity: balance.quantity, version: balance.version },
            data: { quantity: adjustment.after, version: { increment: 1 } },
          });
          if (updated.count !== 1) throw new ConflictException('该商品库存刚刚发生变化，请刷新后重新确认');
        } else {
          await tx.inventoryBalance.create({
            data: { organizationId, warehouseId: permission.warehouseId, productId: item.productId, batchId, quantity: adjustment.after },
          });
        }
        await tx.stockMovement.create({
          data: {
            movementNo: `CNT-${item.id}-${confirmation}-${batchId}`,
            organizationId, storeId: item.task.storeId, warehouseId: permission.warehouseId, productId: item.productId, batchId,
            movementType: adjustment.delta > 0 ? 'STOCKTAKE_GAIN' : 'STOCKTAKE_LOSS',
            quantityDelta: adjustment.delta, referenceType: 'STOCK_COUNT', referenceId: item.id,
            reason: `盘点任务 ${item.task.code}`, performedById: userId,
            idempotencyKey: `count:${item.id}:${confirmation}:${batchId}`,
          },
        });
      }

      const covered = await tx.posOrderItem.updateMany({
        where: {
          productId: item.productId, status: 'ACTIVE', inventoryReviewReason: { in: COVERABLE_REVIEW_REASONS },
          order: { organizationId, storeId: item.task.storeId, orderedAt: { lt: confirmedAt } },
        },
        data: { inventoryReviewReason: 'COVERED_BY_STOCKTAKE' },
      });
      await tx.stockCountTaskItem.update({
        where: { id: item.id },
        data: {
          status: 'CONFIRMED', systemQuantity: plan.before, countedQuantity: plan.after,
          confirmCount: confirmation, confirmedById: userId, confirmedAt,
        },
      });
      const batchSummary = (rows: { expiryDate: Date; expiryPrecision: ExpiryPrecision; quantity: number }[]) =>
        rows.map((row) => ({ expiry: this.expiryText(row.expiryDate, row.expiryPrecision), quantity: row.quantity }));
      await tx.auditLog.create({
        data: {
          organizationId, userId, storeId: item.task.storeId, warehouseId: permission.warehouseId,
          action: CONFIRM_ACTION, entityType: 'StockCountTaskItem', entityId: item.id.toString(), requestId: input.requestId,
          beforeSummary: { taskCode: item.task.code, productId: item.productId.toString(), quantity: plan.before, batches: batchSummary(current) },
          afterSummary: {
            quantity: plan.after, batches: batchSummary(counted), confirmation,
            adjustments: plan.adjustments.map((row) => ({ expiry: this.expiryText(row.expiryDate, row.expiryPrecision), before: row.before, after: row.after })),
            coveredSaleLines: covered.count,
          },
        },
      });

      const pending = await tx.stockCountTaskItem.count({ where: { taskId: item.taskId, status: 'PENDING' } });
      if (pending === 0) await tx.stockCountTask.update({ where: { id: item.taskId }, data: { status: 'COMPLETED', completedAt: confirmedAt } });
      return this.confirmResult(tx, item.task, item.id, organizationId, permission.warehouseId);
    });
  }

  // The confirmed item with its batches as they are now (so the phone can recount it) and the task progress.
  private async confirmResult(tx: Pick<PrismaClient, 'stockCountTaskItem' | 'inventoryBalance'>, task: { id: bigint; code: string }, itemId: bigint, organizationId: bigint, warehouseId: bigint) {
    const [item, groups] = await Promise.all([
      tx.stockCountTaskItem.findUniqueOrThrow({ where: { id: itemId }, include: itemInclude }),
      tx.stockCountTaskItem.groupBy({ by: ['status'], where: { taskId: task.id }, _count: { _all: true } }),
    ]);
    const batches = await this.batchesByProduct(tx, organizationId, warehouseId, [item.productId]);
    const confirmed = groups.find((group) => group.status === 'CONFIRMED')?._count._all ?? 0;
    const pending = groups.find((group) => group.status === 'PENDING')?._count._all ?? 0;
    return {
      item: this.itemView(item, batches.get(item.productId.toString()) ?? []),
      task: { id: task.id.toString(), code: task.code, total: confirmed + pending, confirmed, pending },
    };
  }

  private async adminPermission(organizationId: bigint, userId: bigint) {
    const permission = await this.permissions.warehousePermission(organizationId, userId, 'canCount');
    await this.permissions.requireStoreAdmin(organizationId, userId, permission.warehouse.storeId);
    return permission;
  }

  private id(value: string, label: string) {
    if (!/^\d+$/.test(value)) throw new BadRequestException(`${label}编号无效`);
    return BigInt(value);
  }

  private async batchesByProduct(client: Pick<PrismaClient, 'inventoryBalance'>, organizationId: bigint, warehouseId: bigint, productIds: bigint[]) {
    const rows = productIds.length ? await client.inventoryBalance.findMany({
      where: { organizationId, warehouseId, productId: { in: productIds }, quantity: { not: 0 } },
      include: { batch: { select: { expiryDate: true, expiryPrecision: true } } },
      orderBy: { batch: { expiryDate: 'asc' } },
    }) : [];
    const byProduct = new Map<string, { batchId: string; expiry: string; quantity: number }[]>();
    for (const row of rows) {
      const key = row.productId.toString();
      byProduct.set(key, [...(byProduct.get(key) ?? []), { batchId: row.batchId.toString(), expiry: this.expiryText(row.batch.expiryDate, row.batch.expiryPrecision), quantity: row.quantity }]);
    }
    return byProduct;
  }

  private taskView(task: { id: bigint; code: string; title: string; status: string; createdAt: Date }, items: { status: string }[]) {
    const confirmed = items.filter((item) => item.status === 'CONFIRMED').length;
    return { id: task.id.toString(), code: task.code, title: task.title, status: task.status, createdAt: task.createdAt.toISOString(), total: items.length, confirmed, pending: items.length - confirmed };
  }

  private itemView(
    item: CountItemRecord,
    batches: { batchId: string; expiry: string; quantity: number }[],
  ) {
    return {
      id: item.id.toString(), productId: item.productId.toString(), productName: item.product.name, brandName: item.product.brandName,
      barcode: item.product.barcodes[0]?.barcode ?? null, priority: item.priority, reasons: item.reasons, source: item.source, status: item.status,
      systemQuantity: batches.reduce((sum, batch) => sum + batch.quantity, 0), batches,
      countedQuantity: item.countedQuantity, confirmCount: item.confirmCount, confirmedAt: item.confirmedAt?.toISOString() ?? null,
    };
  }

  private expiryText(expiryDate: Date, precision: ExpiryPrecision) {
    return expiryDate.toISOString().slice(0, precision === 'MONTH' ? 7 : 10);
  }
}
