import { randomUUID } from 'node:crypto';
import '../src/config/environment.js';
import { PrismaService } from '../src/database/prisma.service.js';

const username = process.argv[2] ?? 'wf66';
const prisma = new PrismaService();
await prisma.onModuleInit();

try {
  const account = await prisma.client.user.findFirstOrThrow({
    where: { username, status: 'ACTIVE' },
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
  if (!storeId) throw new Error(`${username} has no ADMIN store role`);

  const candidates = await prisma.client.posMilkProductCandidate.findMany({
    where: {
      organizationId: account.organizationId,
      storeId,
      status: 'ACTIVE',
      reviewStatus: 'PENDING',
      suggestedInventoryPolicy: { not: 'REVIEW_REQUIRED' },
    },
  });

  await prisma.client.$transaction(async (transaction) => {
    for (const candidate of candidates) {
      const requestId = randomUUID();
      await transaction.posMilkProductCandidate.update({
        where: { id: candidate.id },
        data: {
          reviewStatus: 'APPROVED',
          lastReviewRequestId: requestId,
          reviewedAt: new Date(),
        },
      });
      await transaction.auditLog.create({
        data: {
          organizationId: account.organizationId,
          userId: account.id,
          storeId,
          action: 'pos.milk_candidate_review',
          entityType: 'PosMilkProductCandidate',
          entityId: candidate.id.toString(),
          requestId,
          beforeSummary: { reviewStatus: candidate.reviewStatus },
          afterSummary: {
            reviewStatus: 'APPROVED',
            inventoryPolicy: candidate.suggestedInventoryPolicy,
            reason: '用户已完成人工核对，批量确认分类结果',
          },
        },
      });
    }
  });

  console.log(JSON.stringify({ approved: candidates.length }, null, 2));
} finally {
  await prisma.onModuleDestroy();
}
