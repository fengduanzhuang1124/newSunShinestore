import type { PrismaClient } from '@sunshine/database';
import { classifyMilkProduct } from '../pos/application/milk-product-classifier.js';

// Reason written when a product is marked "不再销售" during a stock count; that ignore never expires on its own.
export const DISCONTINUED_IGNORE_REASON = '盘点时标记不再销售';
const MANUAL_IGNORE_DAYS = 30;

// Direct-ship products are sold through the POS but shipped from elsewhere (CR-005): milk powder whose name carries
// a pack or warehouse marker (*6, *3, SF, tin(s), bag(s), stage), plus anything flagged on the store product.
const DIRECT_SHIP_MARKER = /\*\s*\d+|\bsf\b|\btins?\b|\d\s*tins?\b|\bbags?\b|\d\s*bags?\b|\bstag(?:e)?\b/i;
const MILK_NAME = /奶粉|milk\s*pow(?:der|er)|\bformula\b/i;
export function isDirectShip(flag: boolean | undefined, productName: string) {
  if (flag) return true;
  if (!DIRECT_SHIP_MARKER.test(productName)) return false;
  return MILK_NAME.test(productName) || classifyMilkProduct(productName, null) !== null;
}

// All names of a product joined, so the name rule sees Chinese, POS and English names alike.
export function productNames(product: { name: string; chineseName?: string | null; englishName?: string | null }) {
  return [product.chineseName, product.name, product.englishName].filter(Boolean).join(' ');
}

// Brands ordered straight from the brand owner get their own purchase list instead of the general one (CR-007 E1).
// Spellings seen in the catalogue: parrs/parra/prres and 帕氏/帕式; coco brownie/browinie/browine.
export const PURCHASE_BRAND_GROUPS = [
  { key: 'PARRS', label: '帕氏', pattern: /parrs|\bparr?a\b|\bprres\b|帕氏|帕式/i },
  { key: 'COCO_BROWNIE', label: 'coco brownie', pattern: /coco\s*brow/i },
  { key: 'METODAY', label: 'Metoday', pattern: /metoday/i },
  { key: 'HAAB', label: 'Haab', pattern: /\bhaab\b/i },
] as const;
export type PurchaseBrandGroup = (typeof PURCHASE_BRAND_GROUPS)[number]['key'];
export function purchaseBrandGroup(text: string): PurchaseBrandGroup | null {
  return PURCHASE_BRAND_GROUPS.find((group) => group.pattern.test(text))?.key ?? null;
}

// Records whose display names match once case, spaces and punctuation are ignored are one product for purchasing:
// the same goods under several barcodes or packagings (REQ-013 follow-up). "swiss" is the common misspelling of Swisse.
export function productGroupKey(name: string) {
  return name.toLowerCase().replace(/swiss(?!e)/g, 'swisse').replace(/[\s\p{P}\p{S}_]+/gu, '');
}

// Whether a purchase-suggestion ignore still applies (CR-005 C3): "下周显示" until its date; "不再销售" from a stock
// count until restored; any other ignore for 30 days (most ignores are made on out-of-stock products, so stock
// level must not end them).
export function ignoreIsActive(row: { reason: string | null; ignoredAt: Date; restoredAt: Date | null }, now = new Date()) {
  if (row.restoredAt) return row.restoredAt > now;
  if (row.reason === DISCONTINUED_IGNORE_REASON) return true;
  return now.getTime() - row.ignoredAt.getTime() < MANUAL_IGNORE_DAYS * 86_400_000;
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
