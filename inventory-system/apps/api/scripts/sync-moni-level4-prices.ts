import '../src/config/environment.js';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { PrismaService } from '../src/database/prisma.service.js';
import { MoniConfigService } from '../src/pos/config/moni-config.service.js';
import { MoniSignatureService } from '../src/pos/adapters/moni/moni-signature.service.js';
import { MoniHttpClient } from '../src/pos/adapters/moni/moni-http-client.js';
import { MoniAuthService } from '../src/pos/adapters/moni/moni-auth.service.js';
import { MoniPriceLevelGateway } from '../src/pos/adapters/moni/moni-price-level.gateway.js';

const apply = process.argv.includes('--apply');
const username = process.argv.find((argument) => argument.startsWith('--username='))?.slice(11) || 'wf66';
const prisma = new PrismaService();
await prisma.onModuleInit();

try {
  const account = await prisma.client.user.findFirstOrThrow({
    where: { username },
    select: {
      id: true,
      organizationId: true,
      storeRoles: {
        where: { role: { code: 'ADMIN' } },
        select: { storeId: true },
        take: 1,
      },
    },
  });
  const storeId = account.storeRoles[0]?.storeId;
  if (!storeId) throw new Error(`${username} 没有门店管理员权限`);

  const config = new MoniConfigService();
  const signature = new MoniSignatureService(config);
  const http = new MoniHttpClient(config, signature);
  const auth = new MoniAuthService(config, http);
  const prices = new MoniPriceLevelGateway(config, auth, http);
  const level = await prices.findActiveByName('Level 4');
  const sourceItems = await prices.listAllAppliedItems(level.priceId);
  const itemByExternalId = new Map<string, (typeof sourceItems)[number]>();
  const conflicts: string[] = [];
  for (const item of sourceItems) {
    const previous = itemByExternalId.get(item.externalProductId);
    if (previous && previous.levelPriceCents !== item.levelPriceCents) {
      conflicts.push(item.externalProductId);
    } else {
      itemByExternalId.set(item.externalProductId, item);
    }
  }
  if (conflicts.length) throw new Error(`Level 4存在价格冲突的商品: ${conflicts.slice(0, 20).join(', ')}`);

  const mappings = await prisma.client.posProductMapping.findMany({
    where: {
      organizationId: account.organizationId,
      storeId,
      status: 'ACTIVE',
    },
    select: {
      externalProductId: true,
      productId: true,
      product: { select: { name: true } },
    },
  });
  const matched = mappings.flatMap((mapping) => {
    const item = itemByExternalId.get(mapping.externalProductId);
    return item ? [{ mapping, item }] : [];
  });
  const missing = mappings.filter((mapping) => !itemByExternalId.has(mapping.externalProductId));
  const summary = {
    level4: { priceId: level.priceId, name: level.name, status: level.status },
    sourceItems: sourceItems.length,
    uniqueSourceItems: itemByExternalId.size,
    activeMappings: mappings.length,
    matched: matched.length,
    missing: missing.length,
    missingSample: missing.slice(0, 20).map((mapping) => ({
      externalProductId: mapping.externalProductId,
      productName: mapping.product.name,
    })),
  };

  if (!apply) {
    console.log(JSON.stringify({ ok: true, mode: 'dry-run', ...summary, note: '未写入本地数据库，未修改POS' }, null, 2));
  } else {
    const current = await prisma.client.storeProduct.findMany({
      where: { storeId, productId: { in: matched.map(({ mapping }) => mapping.productId) } },
    });
    const outputDir = resolve(import.meta.dirname, '../../../outputs/20260916-level4-price-sync');
    await mkdir(outputDir, { recursive: true });
    const backupPath = resolve(outputDir, `store-products-before-${Date.now()}.json`);
    await writeFile(
      backupPath,
      JSON.stringify(current, (_, value) => typeof value === 'bigint' ? value.toString() : value, 2),
      'utf8',
    );
    const syncedAt = new Date();
    await prisma.client.$transaction(async (transaction) => {
      for (const { mapping, item } of matched) {
        await transaction.storeProduct.upsert({
          where: { storeId_productId: { storeId, productId: mapping.productId } },
          create: {
            storeId,
            productId: mapping.productId,
            level4PriceCents: item.levelPriceCents,
            level4PriceId: level.priceId,
            level4PriceSyncedAt: syncedAt,
          },
          update: {
            level4PriceCents: item.levelPriceCents,
            level4PriceId: level.priceId,
            level4PriceSyncedAt: syncedAt,
          },
        });
      }
      await transaction.auditLog.create({
        data: {
          organizationId: account.organizationId,
          userId: account.id,
          storeId,
          action: 'pos.level4_prices_sync',
          entityType: 'StoreProduct',
          entityId: `price-level-${level.priceId}`,
          requestId: randomUUID(),
          beforeSummary: { backedUpRows: current.length },
          afterSummary: { syncedRows: matched.length, missingRows: missing.length, priceLevelId: level.priceId },
        },
      });
    }, { maxWait: 10_000, timeout: 120_000 });

    const verified = await prisma.client.storeProduct.count({
      where: {
        storeId,
        productId: { in: matched.map(({ mapping }) => mapping.productId) },
        level4PriceId: level.priceId,
        level4PriceSyncedAt: syncedAt,
      },
    });
    console.log(JSON.stringify({
      ok: verified === matched.length,
      mode: 'apply',
      ...summary,
      verified,
      backupPath,
      note: 'Level 4价格已同步到外挂系统本地数据库；未修改POS',
    }, null, 2));
  }
} finally {
  await prisma.onModuleDestroy();
}
