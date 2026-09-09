import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadEnv } from 'dotenv';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createPrismaClient } from '../src/client';

loadEnv({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../../../.env') });

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const describeWithDatabase = testDatabaseUrl ? describe : describe.skip;
const prisma = testDatabaseUrl ? createPrismaClient(testDatabaseUrl) : undefined;

const tablesToReset = [
  'audit_logs',
  'pos_inventory_simulation_items',
  'pos_inventory_simulations',
  'pos_refund_reviews',
  'pos_order_items',
  'pos_orders',
  'pos_sync_cursors',
  'pos_sync_runs',
  'pos_product_mappings',
  'stock_receipt_items',
  'stock_receipts',
  'stock_transfer_items',
  'stock_transfers',
  'stock_movements',
  'inventory_balances',
  'user_warehouse_permissions',
  'user_store_roles',
  'role_permissions',
  'permissions',
  'roles',
  'store_products',
  'product_barcodes',
  'product_batches',
  'products',
  'warehouses',
  'stores',
  'expiry_alert_settings',
  'users',
  'organizations',
];

async function resetTestDatabase(): Promise<void> {
  if (!prisma || !testDatabaseUrl) {
    throw new Error('TEST_DATABASE_URL is required');
  }

  const databaseName = new URL(testDatabaseUrl).pathname.replace(/^\/+/, '');
  if (!databaseName.endsWith('_test')) {
    throw new Error('Integration tests may only reset a database ending in _test');
  }

  for (const table of tablesToReset) {
    await prisma.$executeRawUnsafe(`DELETE FROM \`${table}\``);
  }
}

async function seedTestFixture() {
  if (!prisma) {
    throw new Error('Test database client is not available');
  }

  const organization = await prisma.organization.create({
    data: {
      code: 'TEST-ORG',
      name: 'Integration Test Organization',
      expiryAlertSettings: { create: {} },
    },
  });
  const store = await prisma.store.create({
    data: { organizationId: organization.id, code: 'STORE-001', name: 'Test Store' },
  });
  const warehouse = await prisma.warehouse.create({
    data: { storeId: store.id, code: 'MAIN', name: 'Main Warehouse' },
  });
  const user = await prisma.user.create({
    data: {
      organizationId: organization.id,
      username: 'integration-user',
      passwordHash: 'not-a-real-login-hash',
      displayName: 'Integration Test User',
    },
  });
  const product = await prisma.product.create({
    data: {
      organizationId: organization.id,
      sku: 'TEST-SKU-001',
      name: 'Integration Test Product',
      barcodes: {
        create: {
          organizationId: organization.id,
          barcode: '0942000000001',
          isPrimary: true,
        },
      },
    },
  });
  const batch = await prisma.productBatch.create({
    data: {
      organizationId: organization.id,
      productId: product.id,
      expiryDate: new Date('2027-12-31T00:00:00.000Z'),
    },
  });

  return { organization, store, warehouse, user, product, batch };
}

describeWithDatabase('MySQL inventory integration', () => {
  beforeAll(async () => {
    await prisma?.$connect();
  });

  beforeEach(resetTestDatabase);

  afterAll(async () => {
    await resetTestDatabase();
    await prisma?.$disconnect();
  });

  it('connects and seeds the multi-store inventory foundation', async () => {
    await seedTestFixture();

    await expect(prisma?.organization.count()).resolves.toBe(1);
    await expect(prisma?.store.count()).resolves.toBe(1);
    await expect(prisma?.warehouse.count()).resolves.toBe(1);
    await expect(prisma?.productBarcode.count()).resolves.toBe(1);
    await expect(prisma?.productBatch.count()).resolves.toBe(1);
  });

  it('stores a POS observation without changing inventory', async () => {
    const fixture = await seedTestFixture();
    const mapping = await prisma?.posProductMapping.create({
      data: {
        organizationId: fixture.organization.id,
        storeId: fixture.store.id,
        externalProductId: '108949',
        productId: fixture.product.id,
        barcode: '0942000000001',
        sourceName: 'Observed POS product',
      },
    });
    const syncRun = await prisma?.posSyncRun.create({
      data: {
        organizationId: fixture.organization.id,
        storeId: fixture.store.id,
      },
    });
    const order = await prisma?.posOrder.create({
      data: {
        organizationId: fixture.organization.id,
        storeId: fixture.store.id,
        syncRunId: syncRun!.id,
        externalOrderNo: 'RO-OBSERVED-001',
        sourceStatus: 'Paid',
        orderAmount: '19.99',
        orderedAt: new Date('2026-08-20T10:00:00.000Z'),
        sourceFingerprint: 'a'.repeat(64),
      },
    });
    await prisma?.posOrderItem.create({
      data: {
        orderId: order!.id,
        lineKey: '108949:1',
        externalProductId: '108949',
        mappingId: mapping!.id,
        productId: fixture.product.id,
        barcode: '0942000000001',
        sourceName: 'Observed POS product',
        quantity: '1.2500',
        unitPrice: '19.99',
        disposition: 'REVIEW_REQUIRED',
        exclusionReason: 'Fractional quantity cannot enter integer stock ledger',
      },
    });

    await expect(prisma?.posOrder.count()).resolves.toBe(1);
    await expect(prisma?.posOrderItem.count()).resolves.toBe(1);
    await expect(prisma?.stockMovement.count()).resolves.toBe(0);
    await expect(prisma?.inventoryBalance.count()).resolves.toBe(0);
  });

  it('rejects duplicate POS order numbers for one store', async () => {
    const fixture = await seedTestFixture();
    const data = {
      organizationId: fixture.organization.id,
      storeId: fixture.store.id,
      externalOrderNo: 'RO-DUPLICATE-001',
      sourceStatus: 'Paid',
      orderedAt: new Date('2026-08-20T10:00:00.000Z'),
      sourceFingerprint: 'b'.repeat(64),
    };

    await prisma?.posOrder.create({ data });
    await expect(prisma?.posOrder.create({ data })).rejects.toThrow();
  });

  it('groups an immutable receipt movement into a daily receipt document', async () => {
    const fixture = await seedTestFixture();
    const receipt = await prisma?.stockReceipt.create({
      data: {
        receiptNo: 'RK-TEST-001',
        organizationId: fixture.organization.id,
        storeId: fixture.store.id,
        warehouseId: fixture.warehouse.id,
        receiptDate: new Date('2026-08-01T00:00:00.000Z'),
        openedById: fixture.user.id,
      },
    });
    const movement = await prisma?.stockMovement.create({
      data: {
        movementNo: 'RCV-TEST-001',
        organizationId: fixture.organization.id,
        storeId: fixture.store.id,
        warehouseId: fixture.warehouse.id,
        productId: fixture.product.id,
        batchId: fixture.batch.id,
        movementType: 'RECEIPT',
        quantityDelta: 9,
        performedById: fixture.user.id,
        idempotencyKey: 'receipt-test-001',
      },
    });
    await prisma?.stockReceiptItem.create({
      data: {
        receiptId: receipt!.id,
        productId: fixture.product.id,
        batchId: fixture.batch.id,
        movementId: movement!.id,
        barcode: '0942000000001',
        quantity: 9,
      },
    });

    await expect(prisma?.stockReceiptItem.aggregate({
      where: { receiptId: receipt!.id },
      _sum: { quantity: true },
    })).resolves.toMatchObject({ _sum: { quantity: 9 } });
  });

  it('rejects a duplicate barcode inside one organization', async () => {
    const fixture = await seedTestFixture();

    await expect(
      prisma?.productBarcode.create({
        data: {
          organizationId: fixture.organization.id,
          productId: fixture.product.id,
          barcode: '0942000000001',
        },
      }),
    ).rejects.toThrow();
  });

  it('rejects duplicate expiry-date rows for the same product', async () => {
    const fixture = await seedTestFixture();

    await expect(
      prisma?.productBatch.create({
        data: {
          organizationId: fixture.organization.id,
          productId: fixture.product.id,
          expiryDate: new Date('2027-12-31T00:00:00.000Z'),
        },
      }),
    ).rejects.toThrow();
  });

  it('rolls back a balance change when a movement violates a database constraint', async () => {
    const fixture = await seedTestFixture();

    await expect(
      prisma?.$transaction(async (transaction) => {
        await transaction.inventoryBalance.create({
          data: {
            organizationId: fixture.organization.id,
            warehouseId: fixture.warehouse.id,
            productId: fixture.product.id,
            batchId: fixture.batch.id,
            quantity: 10,
          },
        });
        await transaction.stockMovement.create({
          data: {
            movementNo: 'TEST-MOVEMENT-0001',
            organizationId: fixture.organization.id,
            storeId: fixture.store.id,
            warehouseId: fixture.warehouse.id,
            productId: fixture.product.id,
            batchId: fixture.batch.id,
            movementType: 'INITIAL_STOCK',
            quantityDelta: 0,
            performedById: fixture.user.id,
            idempotencyKey: 'test-idempotency-0001',
          },
        });
      }),
    ).rejects.toThrow();

    await expect(prisma?.inventoryBalance.count()).resolves.toBe(0);
    await expect(prisma?.stockMovement.count()).resolves.toBe(0);
  });

  it('rejects a negative inventory balance', async () => {
    const fixture = await seedTestFixture();

    await expect(
      prisma?.inventoryBalance.create({
        data: {
          organizationId: fixture.organization.id,
          warehouseId: fixture.warehouse.id,
          productId: fixture.product.id,
          batchId: fixture.batch.id,
          quantity: -1,
        },
      }),
    ).rejects.toThrow();
  });
});
