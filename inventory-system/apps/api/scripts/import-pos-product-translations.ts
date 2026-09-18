import '../src/config/environment.js';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { PrismaService } from '../src/database/prisma.service.js';

interface TranslationRow {
  candidateId: string;
  externalProductId: string;
  barcode: string;
  sourceName: string;
  englishName: string;
  chineseName: string;
  brandName?: string;
  categoryName?: string;
  sourceRow: number;
}

function requiredText(value: unknown, field: string, sourceRow: number): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`第 ${sourceRow} 行缺少 ${field}`);
  }
  return value.trim();
}

function validateRows(input: unknown): TranslationRow[] {
  if (!Array.isArray(input) || input.length === 0) {
    throw new Error('导入文件没有可用数据');
  }

  const candidateIds = new Set<string>();
  const externalProductIds = new Set<string>();
  return input.map((value) => {
    if (!value || typeof value !== 'object') throw new Error('导入行格式错误');
    const row = value as Record<string, unknown>;
    const sourceRow = Number(row.sourceRow);
    if (!Number.isSafeInteger(sourceRow) || sourceRow < 1) throw new Error('sourceRow 必须是正整数');
    const candidateId = requiredText(row.candidateId, '本地记录ID', sourceRow);
    const externalProductId = requiredText(row.externalProductId, 'POS商品ID', sourceRow);
    if (!/^\d+$/.test(candidateId)) throw new Error(`第 ${sourceRow} 行本地记录ID格式错误`);
    if (candidateIds.has(candidateId)) throw new Error(`本地记录ID ${candidateId} 重复`);
    if (externalProductIds.has(externalProductId)) throw new Error(`POS商品ID ${externalProductId} 重复`);
    candidateIds.add(candidateId);
    externalProductIds.add(externalProductId);

    return {
      candidateId,
      externalProductId,
      barcode: requiredText(row.barcode, '条码', sourceRow).replace(/^'/, ''),
      sourceName: requiredText(row.sourceName, 'POS原始名称', sourceRow),
      englishName: requiredText(row.englishName, '核对后英文名称', sourceRow),
      chineseName: requiredText(row.chineseName, '中文名称', sourceRow),
      brandName: typeof row.brandName === 'string' ? row.brandName.trim() || undefined : undefined,
      categoryName: typeof row.categoryName === 'string' ? row.categoryName.trim() || undefined : undefined,
      sourceRow,
    };
  });
}

const args = process.argv.slice(2);
const inputPath = args.find((argument) => !argument.startsWith('--'));
const apply = args.includes('--apply');
const usernameArg = args.find((argument) => argument.startsWith('--username='));
const username = usernameArg?.slice('--username='.length) || 'wf66';
if (!inputPath) {
  throw new Error('用法: tsx scripts/import-pos-product-translations.ts <translations.json> [--apply] [--username=wf66]');
}

const rows = validateRows(JSON.parse(await readFile(resolve(inputPath), 'utf8')));
const prisma = new PrismaService();
await prisma.onModuleInit();

try {
  const account = await prisma.client.user.findFirstOrThrow({
    where: { username },
    select: { id: true, organizationId: true },
  });
  const ids = rows.map(({ candidateId }) => BigInt(candidateId));
  const candidates = await prisma.client.posProductCandidate.findMany({
    where: { id: { in: ids }, organizationId: account.organizationId },
  });
  const byId = new Map(candidates.map((candidate) => [candidate.id.toString(), candidate]));
  const problems: string[] = [];

  for (const row of rows) {
    const candidate = byId.get(row.candidateId);
    if (!candidate) {
      problems.push(`第 ${row.sourceRow} 行：本地记录 ${row.candidateId} 不存在`);
      continue;
    }
    if (candidate.externalProductId !== row.externalProductId) {
      problems.push(`第 ${row.sourceRow} 行：POS商品ID与本地记录不一致`);
    }
    if (candidate.barcode !== row.barcode) {
      problems.push(`第 ${row.sourceRow} 行：条码与本地记录不一致`);
    }
    if (candidate.sourceName !== row.sourceName) {
      problems.push(`第 ${row.sourceRow} 行：POS原始名称与本地记录不一致`);
    }
  }

  if (problems.length > 0 || candidates.length !== rows.length) {
    console.error(JSON.stringify({ ok: false, rows: rows.length, matched: candidates.length, problems: problems.slice(0, 50) }, null, 2));
    process.exitCode = 1;
  } else if (!apply) {
    console.log(JSON.stringify({ ok: true, mode: 'dry-run', rows: rows.length, matched: candidates.length, note: '未写入数据库，未访问POS' }, null, 2));
  } else {
    const outputDir = resolve(import.meta.dirname, '../../../outputs/20260916-product-translation-import');
    const backupPath = resolve(outputDir, `pos-product-candidates-before-${Date.now()}.json`);
    await mkdir(dirname(backupPath), { recursive: true });
    await writeFile(
      backupPath,
      JSON.stringify(candidates, (_, value) => typeof value === 'bigint' ? value.toString() : value, 2),
      'utf8',
    );

    await prisma.client.$transaction(async (transaction) => {
      for (const row of rows) {
        const candidate = byId.get(row.candidateId)!;
        const requestId = randomUUID();
        await transaction.posProductCandidate.update({
          where: { id: candidate.id },
          data: {
            englishName: row.englishName,
            chineseName: row.chineseName,
            brandName: row.brandName ?? null,
            categoryName: row.categoryName ?? null,
            translationStatus: 'DRAFT',
          },
        });
        await transaction.auditLog.create({
          data: {
            organizationId: account.organizationId,
            userId: account.id,
            storeId: candidate.storeId,
            action: 'pos.product_candidate_translation_import',
            entityType: 'PosProductCandidate',
            entityId: candidate.id.toString(),
            requestId,
            beforeSummary: {
              englishName: candidate.englishName,
              chineseName: candidate.chineseName,
              translationStatus: candidate.translationStatus,
            },
            afterSummary: {
              englishName: row.englishName,
              chineseName: row.chineseName,
              translationStatus: 'DRAFT',
              sourceRow: row.sourceRow,
            },
          },
        });
      }
    }, { maxWait: 10_000, timeout: 120_000 });

    const updated = await prisma.client.posProductCandidate.count({
      where: {
        id: { in: ids },
        organizationId: account.organizationId,
        translationStatus: 'DRAFT',
        chineseName: { not: null },
      },
    });
    console.log(JSON.stringify({ ok: updated === rows.length, mode: 'apply', imported: rows.length, verified: updated, backupPath, note: '仅更新本地候选商品中文初稿；未审批、未建立库存、未访问POS' }, null, 2));
  }
} finally {
  await prisma.onModuleDestroy();
}
