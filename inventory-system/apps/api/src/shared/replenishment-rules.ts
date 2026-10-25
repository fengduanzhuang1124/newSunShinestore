import type { PrismaClient } from '@sunshine/database';

// Reason written when a product is marked "不再销售" during a stock count; that ignore never expires on its own.
export const DISCONTINUED_IGNORE_REASON = '盘点时标记不再销售';
const MANUAL_IGNORE_DAYS = 30;

// Direct-ship products are sold through the POS but shipped from elsewhere (CR-005). Besides the store flag, formula
// tins and bags named by stage were already treated as direct-ship.
export function isDirectShip(flag: boolean | undefined, productName: string) {
  return Boolean(flag) || /\bstag(?:e)?\s*\d*\b/i.test(productName) || /\b\d+\s*(?:tins?|bags?)\b/i.test(productName);
}

// Whether a purchase-suggestion ignore still applies (CR-005 C3): "下周显示" until its date; "不再销售" from a stock
// count until restored; any other ignore for 30 days, and no longer once the product is out of stock.
export function ignoreIsActive(row: { reason: string | null; ignoredAt: Date; restoredAt: Date | null }, currentInventory: number, now = new Date()) {
  if (row.restoredAt) return row.restoredAt > now;
  if (row.reason === DISCONTINUED_IGNORE_REASON) return true;
  return currentInventory > 0 && now.getTime() - row.ignoredAt.getTime() < MANUAL_IGNORE_DAYS * 86_400_000;
}

// Marks or clears a store product as direct-ship, with an audit row. Runs inside the caller's transaction.
export async function setDirectShip(
  tx: Pick<PrismaClient, 'storeProduct' | 'auditLog'>,
  input: { organizationId: bigint; userId: bigint; storeId: bigint; productId: bigint; directShip: boolean; source: string },
) {
  const record = await tx.storeProduct.upsert({
    where: { storeId_productId: { storeId: input.storeId, productId: input.productId } },
    create: { storeId: input.storeId, productId: input.productId, enabled: true, directShip: input.directShip },
    update: { directShip: input.directShip },
    select: { productId: true, directShip: true },
  });
  await tx.auditLog.create({
    data: {
      organizationId: input.organizationId, userId: input.userId, storeId: input.storeId,
      action: 'store_product.direct_ship', entityType: 'StoreProduct', entityId: `${input.storeId}:${input.productId}`,
      requestId: `direct-ship:${input.storeId}:${input.productId}:${Date.now()}`,
      afterSummary: { directShip: input.directShip, source: input.source },
    },
  });
  return { productId: record.productId.toString(), directShip: record.directShip };
}
