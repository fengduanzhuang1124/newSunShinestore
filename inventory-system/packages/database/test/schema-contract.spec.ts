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
});
