import '../src/config/environment.js';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { PrismaService } from '../src/database/prisma.service.js';

const value = (name: string) => process.argv
  .find((argument) => argument.startsWith(`--${name}=`))
  ?.slice(name.length + 3);
const storeValue = value('store');
const outputValue = value('output');
if (!storeValue || !/^\d+$/.test(storeValue)) throw new Error('--store must be a positive integer');

const storeId = BigInt(storeValue);
const prisma = new PrismaService();
await prisma.onModuleInit();
try {
  const store = await prisma.client.store.findUniqueOrThrow({ where: { id: storeId }, select: { organizationId: true, name: true } });
  const [mappings, issueItems, productCandidates, milkCandidates, observedItems] = await Promise.all([
    prisma.client.posProductMapping.findMany({
      where: { organizationId: store.organizationId, storeId, status: 'ACTIVE' },
      select: {
        externalProductId: true, barcode: true, sourceName: true, productId: true,
        product: { select: { name: true, chineseName: true, englishName: true, barcodes: { where: { status: 'ACTIVE' }, select: { barcode: true } } } },
      },
      orderBy: [{ barcode: 'asc' }, { externalProductId: 'asc' }],
    }),
    prisma.client.posOrderItem.findMany({
      where: {
        status: 'ACTIVE', barcode: { not: null }, disposition: { in: ['UNMAPPED', 'REVIEW_REQUIRED'] },
        order: { organizationId: store.organizationId, storeId },
      },
      select: { externalProductId: true, barcode: true, sourceName: true, quantity: true, disposition: true },
    }),
    prisma.client.posProductCandidate.findMany({
      where: { organizationId: store.organizationId, storeId, status: 'ACTIVE', barcode: { not: '' } },
      select: { externalProductId: true, barcode: true, sourceName: true },
    }),
    prisma.client.posMilkProductCandidate.findMany({
      where: { organizationId: store.organizationId, storeId, status: 'ACTIVE', barcode: { not: null } },
      select: { externalProductId: true, barcode: true, sourceName: true },
    }),
    prisma.client.posOrderItem.findMany({
      where: { status: 'ACTIVE', barcode: { not: null }, order: { organizationId: store.organizationId, storeId } },
      distinct: ['externalProductId'],
      select: { externalProductId: true, barcode: true, sourceName: true },
    }),
  ]);
  const mappingByExternalId = new Map(mappings.map((row) => [row.externalProductId, row]));
  const sourceProducts = new Map<string, { externalProductId: string; barcode: string; sourceName: string | null }>();
  for (const row of [...productCandidates, ...milkCandidates, ...observedItems]) if (row.barcode) sourceProducts.set(row.externalProductId, { externalProductId: row.externalProductId, barcode: row.barcode, sourceName: row.sourceName });
  for (const row of mappings) if (!sourceProducts.has(row.externalProductId)) sourceProducts.set(row.externalProductId, { externalProductId: row.externalProductId, barcode: row.barcode, sourceName: row.sourceName });
  const mappingGroups = new Map<string, { externalProductId: string; barcode: string; sourceName: string | null }[]>();
  for (const row of sourceProducts.values()) mappingGroups.set(row.barcode, [...(mappingGroups.get(row.barcode) ?? []), row]);
  const duplicateBarcodes = [...mappingGroups.entries()]
    .filter(([, rows]) => new Set(rows.map((row) => row.externalProductId)).size > 1)
    .map(([barcode, rows]) => ({
      barcode,
      nameConflict: new Set(rows.map((row) => row.sourceName?.trim().toLowerCase()).filter(Boolean)).size > 1,
      mappings: rows.map((row) => {
        const mapping = mappingByExternalId.get(row.externalProductId);
        return {
          externalProductId: row.externalProductId,
          posName: row.sourceName,
          localProductId: mapping?.productId.toString() ?? null,
          localProductName: mapping ? mapping.product.chineseName || mapping.product.name || mapping.product.englishName || '未命名商品' : null,
        };
      }),
    }));
  const localBarcodeMismatches = mappings.filter((row) => !row.product.barcodes.some((barcode) => barcode.barcode === row.barcode)).map((row) => ({
    barcode: row.barcode,
    externalProductId: row.externalProductId,
    posName: row.sourceName,
    localProductId: row.productId.toString(),
    localProductName: row.product.chineseName || row.product.name || row.product.englishName || '未命名商品',
    localBarcodes: row.product.barcodes.map((barcode) => barcode.barcode),
  }));
  const issueGroups = new Map<string, typeof issueItems>();
  for (const row of issueItems) if (row.barcode) issueGroups.set(row.barcode, [...(issueGroups.get(row.barcode) ?? []), row]);
  const unmappedBarcodes = [...issueGroups.entries()].map(([barcode, rows]) => ({
    barcode,
    occurrences: rows.length,
    units: rows.reduce((sum, row) => sum + Math.abs(Number(row.quantity)), 0),
    products: [...new Map(rows.map((row) => [row.externalProductId, { externalProductId: row.externalProductId, posName: row.sourceName, disposition: row.disposition }])).values()],
  })).sort((a, b) => b.occurrences - a.occurrences);
  const report = {
    generatedAt: new Date().toISOString(),
    store: { id: storeValue, name: store.name },
    summary: {
      duplicateBarcodes: duplicateBarcodes.length,
      duplicateNameConflicts: duplicateBarcodes.filter((row) => row.nameConflict).length,
      localBarcodeMismatches: localBarcodeMismatches.length,
      unmappedBarcodes: unmappedBarcodes.length,
    },
    duplicateBarcodes,
    localBarcodeMismatches,
    unmappedBarcodes,
  };
  const output = resolve(outputValue ?? `reports/pos-barcode-audit-store-${storeValue}.json`);
  await mkdir(resolve(output, '..'), { recursive: true });
  await writeFile(output, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({ output, summary: report.summary }, null, 2));
} finally {
  await prisma.onModuleDestroy();
}
