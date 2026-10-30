import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const schema = readFileSync(
  resolve(import.meta.dirname, '../prisma/schema.prisma'),
  'utf8',
);

describe('inventory database contract', () => {
  it.each([
    'model Organization',
    'model Store',
    'model StoreProduct',
    'model Warehouse',
    'model Product',
    'model ProductBarcode',
    'model ProductBatch',
    'model StockMovement',
    'model StockReceipt',
    'model StockReceiptItem',
    'model InventoryBalance',
    'model AuditLog',
    'model PosProductMapping',
    'model PosProductCandidate',
    'model PosMilkProductCandidate',
    'model PosOrder',
    'model PosOrderItem',
    'model PosSyncCursor',
    'model PosSyncRun',
    'model PosRefundReview',
    'model PosInventorySimulation',
    'model PosInventorySimulationItem',
  ])('contains %s', (modelName) => {
    expect(schema).toContain(modelName);
  });

  it('keeps barcode unique within an organization', () => {
    expect(schema).toContain('@@unique([organizationId, barcode]');
  });

  it('keeps one internal batch per product, expiry date and precision', () => {
    expect(schema).toContain('@@unique([organizationId, productId, expiryDate, expiryPrecision]');
    expect(schema).toContain('product_batches_org_product_expiry_precision_key');
  });

  it('uses inventory movements as a separate immutable fact table', () => {
    expect(schema).toContain('model StockMovement');
    expect(schema).toContain('idempotencyKey');
    expect(schema).toContain('reversalOfId');
  });

  it('keeps POS ingestion observational and idempotent', () => {
    expect(schema).toContain('@@unique([storeId, externalOrderNo])');
    expect(schema).toContain('@@unique([orderId, lineKey])');
    expect(schema).toContain('@@unique([storeId, provider, stream])');
    expect(schema).toMatch(/inventoryStatus\s+PosInventoryStatus\s+@default\(OBSERVED\)/);
  });

  it('tracks every POS synchronization as an auditable batch', () => {
    const syncRun = schema.slice(
      schema.indexOf('model PosSyncRun'),
      schema.indexOf('model PosRefundReview'),
    );
    expect(syncRun).toMatch(/cursorId\s+BigInt\?/);
    expect(syncRun).toMatch(/requestedFrom\s+String\?/);
    expect(syncRun).toMatch(/requestedTo\s+String\?/);
    expect(syncRun).toMatch(/cursorBefore\s+DateTime\?/);
    expect(syncRun).toMatch(/cursorAfter\s+DateTime\?/);
    expect(syncRun).toMatch(/ordersSkipped\s+Int\s+@default\(0\)/);
  });

  it('keeps source quantities separate from integer stock movements', () => {
    expect(schema).toContain('quantity          Decimal');
    expect(schema).toContain('@db.Decimal(14, 4)');
    expect(schema).toContain('enum PosItemDisposition');
    expect(schema).toMatch(/status\s+RecordStatus\s+@default\(ACTIVE\)/);
    expect(schema).not.toContain('stockMovementId   BigInt');
  });

  it('keeps POS inventory simulation separate from inventory facts', () => {
    expect(schema).toContain('enum PosSimulationStatus');
    expect(schema).toMatch(/orderId\s+BigInt\s+@unique/);
    expect(schema).toMatch(/orderItemId\s+BigInt\s+@unique/);
    expect(schema).toMatch(/projectedQuantity\s+Int/);
  });

  it('requires a barcode for resolved POS product mappings', () => {
    const mapping = schema.slice(
      schema.indexOf('model PosProductMapping'),
      schema.indexOf('model PosOrder'),
    );
    expect(mapping).toContain('barcode           String');
    expect(mapping).not.toContain('barcode           String?');
  });

  it('keeps milk catalog candidates separate from approved inventory products', () => {
    expect(schema).toContain('enum PosMilkReviewStatus');
    expect(schema).toContain('enum TranslationStatus');
    expect(schema).toContain('enum PosInventoryPolicy');
    const candidate = schema.slice(
      schema.indexOf('model PosMilkProductCandidate'),
      schema.indexOf('model PosOrder'),
    );
    expect(candidate).toMatch(/suggestedPackQuantity\s+Int\?/);
    expect(candidate).toMatch(/suggestedInventoryPolicy\s+PosInventoryPolicy/);
    expect(candidate).toMatch(/reviewStatus\s+PosMilkReviewStatus/);
    expect(candidate).toMatch(/lastReviewRequestId\s+String\?\s+@unique/);
    expect(candidate).toMatch(/reviewedAt\s+DateTime\?/);
    expect(candidate).not.toContain('stockMovements');
    expect(candidate).not.toContain('inventoryBalances');
  });

  it('keeps barcode product translations in a review pool before approval', () => {
    const candidate = schema.slice(
      schema.indexOf('model PosProductCandidate'),
      schema.indexOf('model ProductBarcode'),
    );
    expect(candidate).toMatch(/barcode\s+String\s+@db\.VarChar\(128\)/);
    expect(candidate).toMatch(/englishName\s+String/);
    expect(candidate).toMatch(/chineseName\s+String\?/);
    expect(candidate).toMatch(/reviewStatus\s+PosMilkReviewStatus/);
    expect(candidate).toMatch(/translationStatus\s+TranslationStatus/);
    expect(candidate).not.toContain('stockMovements');
    expect(candidate).not.toContain('inventoryBalances');
  });

  it('stores the POS Level 4 price separately from the standard selling price', () => {
    const storeProduct = schema.slice(
      schema.indexOf('model StoreProduct'),
      schema.indexOf('model Warehouse'),
    );
    expect(storeProduct).toMatch(/sellingPriceCents\s+Int\?/);
    expect(storeProduct).toMatch(/level4PriceCents\s+Int\?/);
    expect(storeProduct).toMatch(/level4PriceId\s+String\?/);
    expect(storeProduct).toMatch(/level4PriceSyncedAt\s+DateTime\?/);
  });

  it('groups receiving movements into auditable receipt documents', () => {
    expect(schema).toContain('enum StockReceiptStatus');
    expect(schema).toContain('movementId');
    expect(schema).toContain('receiptDate');
  });

  it('uses the approved 2, 3 and 6 month expiry thresholds', () => {
    expect(schema).toContain('urgentMonths       Int          @default(2)');
    expect(schema).toContain('warningMonths      Int          @default(3)');
    expect(schema).toContain('earlyWarningMonths Int          @default(6)');
    expect(schema).toContain('urgentLabel        String       @default("紧急临期")');
    expect(schema).toContain('expiredLabel       String       @default("已过期")');
  });
});
