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
