import { ConflictException } from '@nestjs/common';
import type { PrismaClient } from '@sunshine/database';

// How the duplicates' stock is treated when they merge into the kept record (CR-006 D2):
// KEEP_TARGET — the kept record's count already covers those units (the same goods counted twice), so they are zeroed;
// SUM — the duplicates hold other units, which move over batch by batch (same expiry date).
export type MergeStockMode = 'KEEP_TARGET' | 'SUM';

type MergeClient = Pick<PrismaClient,
  'inventoryBalance' | 'productBatch' | 'stockMovement' | 'productBarcode' | 'posProductMapping' | 'posOrderItem' |
  'stockCountTaskItem' | 'storeProduct' | 'product' | 'auditLog'>;

export interface MergeContext {
  organizationId: bigint; storeId: bigint; warehouseId: bigint; userId: bigint;
  intoProductId: bigint; fromProductId: bigint; stockMode: MergeStockMode;
  reason: string; requestId: string; action: string; extraAudit?: Record<string, unknown>;
}

// Merges one duplicate record into the kept one inside the caller's transaction. Barcodes, POS mappings and sales
// lines move over (POS mappings follow barcode ownership, so the hourly mapping refresh keeps the link), the duplicate
// is deactivated and the merge is audited. Returns what moved.
export async function mergeProductInto(tx: MergeClient, context: MergeContext) {
  const { organizationId, storeId, warehouseId, userId, intoProductId: into, fromProductId: from, stockMode } = context;
  const balances = await tx.inventoryBalance.findMany({
    where: { organizationId, warehouseId, productId: from, quantity: { not: 0 } },
    include: { batch: { select: { expiryDate: true, expiryPrecision: true } } },
  });
  const reason = `重复档案并入 ${into}：${context.reason}`.slice(0, 255);
  const write = async (productId: bigint, batchId: bigint, delta: number, kind: string) => {
    await tx.stockMovement.create({
      data: {
        movementNo: `MRG-${into}-${from}-${batchId}-${kind}`.slice(0, 40),
        organizationId, storeId, warehouseId, productId, batchId,
        movementType: delta > 0 ? 'STOCKTAKE_GAIN' : 'STOCKTAKE_LOSS', quantityDelta: delta,
        referenceType: 'PRODUCT_MERGE', reason, performedById: userId,
        idempotencyKey: `merge:${context.requestId}:${from}:${batchId}:${kind}`,
      },
    });
  };
  let moved = 0;
  for (const balance of balances) {
    const updated = await tx.inventoryBalance.updateMany({
      where: { organizationId, warehouseId, productId: from, batchId: balance.batchId, quantity: balance.quantity, version: balance.version },
      data: { quantity: 0, version: { increment: 1 } },
    });
    if (updated.count !== 1) throw new ConflictException('商品库存刚刚发生变化，请刷新后重试');
    await write(from, balance.batchId, -balance.quantity, 'out');
    if (stockMode !== 'SUM') continue;
    const target = await tx.productBatch.upsert({
      where: { organizationId_productId_expiryDate_expiryPrecision: {
        organizationId, productId: into, expiryDate: balance.batch.expiryDate, expiryPrecision: balance.batch.expiryPrecision,
      } },
      update: { status: 'ACTIVE' },
      create: { organizationId, productId: into, expiryDate: balance.batch.expiryDate, expiryPrecision: balance.batch.expiryPrecision, createdById: userId },
      select: { id: true },
    });
    const existing = await tx.inventoryBalance.findUnique({
      where: { organizationId_warehouseId_productId_batchId: { organizationId, warehouseId, productId: into, batchId: target.id } },
    });
    if (existing) {
      const added = await tx.inventoryBalance.updateMany({
        where: { organizationId, warehouseId, productId: into, batchId: target.id, quantity: existing.quantity, version: existing.version },
        data: { quantity: { increment: balance.quantity }, version: { increment: 1 } },
      });
      if (added.count !== 1) throw new ConflictException('商品库存刚刚发生变化，请刷新后重试');
    } else {
      await tx.inventoryBalance.create({ data: { organizationId, warehouseId, productId: into, batchId: target.id, quantity: balance.quantity } });
    }
    await write(into, target.id, balance.quantity, 'in');
    moved += balance.quantity;
  }
  const stock = balances.reduce((total, balance) => total + balance.quantity, 0);

  const barcodes = await tx.productBarcode.updateMany({ where: { organizationId, productId: from }, data: { productId: into, isPrimary: false } });
  const mappings = await tx.posProductMapping.updateMany({ where: { organizationId, productId: from }, data: { productId: into } });
  const salesLines = await tx.posOrderItem.updateMany({ where: { productId: from }, data: { productId: into } });
  await tx.stockCountTaskItem.updateMany({ where: { productId: from, status: 'PENDING' }, data: { status: 'IGNORED' } });
  const fromStore = await tx.storeProduct.findUnique({ where: { storeId_productId: { storeId, productId: from } }, select: { sellingPriceCents: true } });
  if (fromStore?.sellingPriceCents != null) {
    const intoStore = await tx.storeProduct.findUnique({ where: { storeId_productId: { storeId, productId: into } }, select: { sellingPriceCents: true } });
    if (intoStore?.sellingPriceCents == null) {
      await tx.storeProduct.upsert({
        where: { storeId_productId: { storeId, productId: into } },
        create: { storeId, productId: into, sellingPriceCents: fromStore.sellingPriceCents },
        update: { sellingPriceCents: fromStore.sellingPriceCents },
      });
    }
  }
  await tx.product.update({ where: { id: from }, data: { status: 'INACTIVE' } });
  const summary = {
    from: from.toString(), stockMode, stock, stockMoved: moved, stockZeroed: stockMode === 'SUM' ? 0 : stock,
    barcodesMoved: barcodes.count, mappingsMoved: mappings.count, salesLinesMoved: salesLines.count,
  };
  await tx.auditLog.create({
    data: {
      organizationId, userId, storeId, warehouseId, action: context.action, entityType: 'Product', entityId: from.toString(),
      requestId: context.requestId, beforeSummary: { stock },
      afterSummary: { mergedInto: into.toString(), reason: context.reason, ...summary, ...context.extraAudit },
    },
  });
  return summary;
}
