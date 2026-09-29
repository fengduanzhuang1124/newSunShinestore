import '../src/config/environment.js';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { PrismaService } from '../src/database/prisma.service.js';
import { MoniConfigService } from '../src/pos/config/moni-config.service.js';
import { MoniSignatureService } from '../src/pos/adapters/moni/moni-signature.service.js';
import { MoniHttpClient } from '../src/pos/adapters/moni/moni-http-client.js';
import { MoniAuthService } from '../src/pos/adapters/moni/moni-auth.service.js';
import { MoniProductGateway } from '../src/pos/adapters/moni/moni-product.gateway.js';
import { PosProductCatalogService } from '../src/pos/application/pos-product-catalog.service.js';

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

function parseRows(value: unknown): TranslationRow[] {
  if (!Array.isArray(value) || value.length === 0) throw new Error('审核文件没有可用数据');
  return value as TranslationRow[];
}

const args = process.argv.slice(2);
const inputPath = args.find((argument) => !argument.startsWith('--'));
const apply = args.includes('--apply');
const username = args.find((argument) => argument.startsWith('--username='))?.slice(11) || 'wf66';
if (!inputPath) {
  throw new Error('用法: tsx scripts/approve-pos-product-translations.ts <translations.json> [--apply] [--username=wf66]');
}

const rows = parseRows(JSON.parse(await readFile(resolve(inputPath), 'utf8')));
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
  const candidateIds = rows.map(({ candidateId }) => BigInt(candidateId));
  const candidates = await prisma.client.posProductCandidate.findMany({
    where: { id: { in: candidateIds }, organizationId: account.organizationId, storeId },
    select: {
      id: true,
      externalProductId: true,
      barcode: true,
      sourceName: true,
      englishName: true,
      chineseName: true,
      translationStatus: true,
    },
  });
  const byId = new Map(candidates.map((candidate) => [candidate.id.toString(), candidate]));
  const problems: string[] = [];
  const barcodeOwners = new Map<string, string>();

  for (const row of rows) {
    const candidate = byId.get(row.candidateId);
    if (!candidate) {
      problems.push(`第 ${row.sourceRow} 行本地记录不存在`);
      continue;
    }
    const barcode = row.barcode.replace(/^'/, '');
    if (candidate.externalProductId !== row.externalProductId || candidate.barcode !== barcode || candidate.sourceName !== row.sourceName) {
      problems.push(`第 ${row.sourceRow} 行与本地候选记录不一致`);
    }
    if (candidate.chineseName !== row.chineseName.trim() || candidate.translationStatus !== 'DRAFT') {
      problems.push(`第 ${row.sourceRow} 行中文初稿尚未正确导入`);
    }
    const previousOwner = barcodeOwners.get(barcode);
    if (previousOwner && previousOwner !== row.candidateId) problems.push(`条码 ${barcode} 对应多个候选商品`);
    barcodeOwners.set(barcode, row.candidateId);
  }

  const ignoredCount = await prisma.client.posProductCandidate.count({
    where: {
      organizationId: account.organizationId,
      storeId,
      status: 'ACTIVE',
      reviewStatus: 'PENDING',
      id: { notIn: candidateIds },
    },
  });

  if (problems.length > 0 || candidates.length !== rows.length) {
    console.error(JSON.stringify({ ok: false, approvedRows: rows.length, matched: candidates.length, problems: problems.slice(0, 50) }, null, 2));
    process.exitCode = 1;
  } else if (!apply) {
    console.log(JSON.stringify({
      ok: true,
      mode: 'dry-run',
      willApprove: rows.length,
      willIgnore: ignoredCount,
      note: '未写入数据库，未访问POS',
    }, null, 2));
  } else {
    const config = new MoniConfigService();
    const signature = new MoniSignatureService(config);
    const http = new MoniHttpClient(config, signature);
    const auth = new MoniAuthService(config, http);
    const products = new MoniProductGateway(config, auth, http);
    const catalog = new PosProductCatalogService(prisma, products);

    let approved = 0;
    for (const row of rows) {
      await catalog.reviewCandidate(
        account.organizationId,
        account.id,
        storeId.toString(),
        row.candidateId,
        {
          reviewStatus: 'APPROVED',
          englishName: row.englishName,
          chineseName: row.chineseName,
          brandName: row.brandName,
          categoryName: row.categoryName,
          reason: 'Excel人工核对后批量批准，仅更新外挂系统本地商品主档',
          idempotencyKey: randomUUID(),
        },
      );
      approved += 1;
      if (approved % 200 === 0) console.log(`已批准 ${approved}/${rows.length}`);
    }

    const ignoreRequestId = randomUUID();
    const ignored = await prisma.client.$transaction(async (transaction) => {
      const result = await transaction.posProductCandidate.updateMany({
        where: {
          organizationId: account.organizationId,
          storeId,
          status: 'ACTIVE',
          reviewStatus: 'PENDING',
          id: { notIn: candidateIds },
        },
        data: { reviewStatus: 'IGNORED', reviewedAt: new Date() },
      });
      await transaction.auditLog.create({
        data: {
          organizationId: account.organizationId,
          userId: account.id,
          storeId,
          action: 'pos.product_candidates_bulk_ignore',
          entityType: 'PosProductCandidate',
          entityId: 'unlisted-excel-products',
          requestId: ignoreRequestId,
          beforeSummary: { reviewStatus: 'PENDING', count: result.count },
          afterSummary: { reviewStatus: 'IGNORED', count: result.count, reason: '用户从Excel核对清单删除，不进入外挂商品主档' },
        },
      });
      return result.count;
    });

    const [approvedVerified, mappingsVerified] = await Promise.all([
      prisma.client.posProductCandidate.count({
        where: { id: { in: candidateIds }, organizationId: account.organizationId, reviewStatus: 'APPROVED', translationStatus: 'APPROVED' },
      }),
      prisma.client.posProductMapping.count({
        where: { organizationId: account.organizationId, storeId, externalProductId: { in: rows.map(({ externalProductId }) => externalProductId) } },
      }),
    ]);
    console.log(JSON.stringify({
      ok: approvedVerified === rows.length && mappingsVerified === rows.length && ignored === ignoredCount,
      mode: 'apply',
      approved,
      approvedVerified,
      mappingsVerified,
      ignored,
      note: '已生成外挂系统本地商品主档与POS只读映射；未访问或修改POS',
    }, null, 2));
  }
} finally {
  await prisma.onModuleDestroy();
}
