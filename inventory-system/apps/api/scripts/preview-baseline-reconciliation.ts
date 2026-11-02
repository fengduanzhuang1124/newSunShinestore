// Read-only preview: rebuild targets from counted baseline entries minus later POS sales. Writes nothing to the database.
import '../src/config/environment.js';
import { writeFileSync } from 'node:fs';
import { PrismaService } from '../src/database/prisma.service.js';
import { csvCell, loadRebuildPlan, parseSourceArguments } from './lib/baseline-reconciliation-source.js';

const options = parseSourceArguments(process.argv);
const batchOutPath = options.outPath.replace(/(\.csv)?$/, '-batches.csv');
const supersededOutPath = options.outPath.replace(/(\.csv)?$/, '-superseded.csv');

const prisma = new PrismaService();
await prisma.onModuleInit();
try {
  const rebuild = await loadRebuildPlan(prisma, options);
  const writeCsv = (path: string, rows: (string | number)[][]) =>
    writeFileSync(path, `﻿${rows.map((row) => row.map(csvCell).join(',')).join('\n')}\n`);

  writeCsv(options.outPath, [
    ['商品ID', '主条码', '商品名称', '在基准内', '首次录入日', '基准数量', '扣减销量', '未扣销量(无批次)', '保留的员工操作', '目标库存', '当前库存', '调整差额', '目标按到期日', '来源单据', '标记'],
    ...rebuild.products.map(({ row, batches }) => [
      row.productId, row.barcode, row.name, row.listed ? '是' : '否', row.firstEntryDate, row.baselineQuantity,
      row.salesDeducted, row.salesSkipped, row.preservedDelta, row.targetQuantity, row.currentQuantity, row.delta,
      batches.filter((batch) => batch.targetQuantity !== 0).map((batch) => `${batch.expiryDate}: ${batch.targetQuantity}`).join('；'),
      row.sources, row.flags.join(' '),
    ]),
  ]);
  writeCsv(batchOutPath, [
    ['商品ID', '商品名称', '批次ID', '到期日', '当前库存', '目标库存', '调整差额'],
    ...rebuild.products.flatMap(({ row, batches }) => batches
      .filter((batch) => batch.delta !== 0)
      .map((batch) => [row.productId, row.name, batch.batchId, batch.expiryDate, batch.currentQuantity, batch.targetQuantity, batch.delta])),
  ]);

  writeCsv(supersededOutPath, [
    ['商品ID', '录入日', '到期日', '数量', '来源单据'],
    ...rebuild.superseded.map((entry) => [entry.productId, entry.entryDate, entry.expiryDate, entry.quantity, entry.source]),
  ]);

  const movements = rebuild.products.flatMap(({ batches }) => batches).filter((batch) => batch.delta !== 0);
  console.log(JSON.stringify({
    ok: true,
    readOnly: true,
    store: options.storeId.toString(),
    timeZone: rebuild.timeZone,
    unlistedPolicy: options.unlistedPolicy,
    to: options.to.toISOString(),
    preserveAfter: options.preserveAfter.toISOString(),
    unlistedSalesAfter: options.unlistedSalesAfter.toISOString(),
    entryLines: rebuild.entryLines,
    saleLines: rebuild.saleLines,
    lastSaleAt: rebuild.lastSaleAt.toISOString(),
    ...rebuild.plan.totals,
    plannedMovements: movements.length,
    negativeBatches: rebuild.products.flatMap(({ batches }) => batches).filter((batch) => batch.targetQuantity < 0).length,
    out: options.outPath,
    batchOut: batchOutPath,
    supersededEntries: rebuild.superseded.length,
    supersededQuantity: rebuild.superseded.reduce((sum, entry) => sum + entry.quantity, 0),
    supersededOut: supersededOutPath,
  }, null, 2));
} finally {
  await prisma.onModuleDestroy();
}
