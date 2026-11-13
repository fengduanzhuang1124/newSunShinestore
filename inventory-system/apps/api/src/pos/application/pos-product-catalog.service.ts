import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { MoniProductGateway } from '../adapters/moni/moni-product.gateway.js';
import type { PosProductCatalogQueryDto } from './pos-query.dto.js';
import type { ReviewPosProductDto } from './review-pos-product.dto.js';

@Injectable()
export class PosProductCatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly products: MoniProductGateway,
  ) {}

  private async storeAccess(organizationId: bigint, userId: bigint, storeIdValue: string) {
    const storeId = BigInt(storeIdValue);
    const access = await this.prisma.client.userStoreRole.findFirst({
      where: { userId, storeId, store: { organizationId, status: 'ACTIVE' } },
      select: { store: { select: { id: true, name: true } } },
    });
    if (!access) throw new ForbiddenException('没有该门店的POS商品查看权限');
    return access.store;
  }

  private async requireStoreAdmin(organizationId: bigint, userId: bigint, storeId: bigint) {
    const role = await this.prisma.client.userStoreRole.findFirst({
      where: { userId, storeId, store: { organizationId }, role: { code: 'ADMIN' } },
      select: { userId: true },
    });
    if (!role) throw new ForbiddenException('只有门店管理员可以审核POS商品');
  }

  private serialize(item: Awaited<ReturnType<PrismaService['client']['posProductCandidate']['findFirstOrThrow']>>) {
    return {
      id: item.id.toString(),
      externalProductId: item.externalProductId,
      sourceSku: item.sourceSku,
      barcode: item.barcode,
      sourceName: item.sourceName,
      englishName: item.englishName,
      chineseName: item.chineseName,
      brandName: item.brandName,
      categoryName: item.categoryName,
      itemType: item.itemType,
      salePrice: item.salePrice?.toString() ?? null,
      costPrice: item.costPrice?.toString() ?? null,
      sourceStock: item.sourceStock?.toString() ?? null,
      sourceStatus: item.sourceStatus,
      reviewStatus: item.reviewStatus,
      translationStatus: item.translationStatus,
      reviewedAt: item.reviewedAt?.toISOString() ?? null,
      firstSeenAt: item.firstSeenAt.toISOString(),
      lastSeenAt: item.lastSeenAt.toISOString(),
    };
  }

  async importCandidates(organizationId: bigint, userId: bigint, storeIdValue: string) {
    const store = await this.storeAccess(organizationId, userId, storeIdValue);
    const [sourceProducts, milkProducts] = await Promise.all([
      this.products.listAll(),
      this.prisma.client.posMilkProductCandidate.findMany({
        where: { organizationId, storeId: store.id, status: 'ACTIVE' },
        select: { externalProductId: true },
      }),
    ]);
    const milkIds = new Set(milkProducts.map(({ externalProductId }) => externalProductId));
    const candidates = sourceProducts.filter(
      (source) => source.externalProductId && source.name && source.barcode && !milkIds.has(source.externalProductId),
    );

    for (const source of candidates) {
      const externalProductId = source.externalProductId!;
      const sourceName = source.name!;
      const barcode = source.barcode!;
      const saved = await this.prisma.client.posProductCandidate.upsert({
        where: { storeId_externalProductId: { storeId: store.id, externalProductId } },
        create: {
          organizationId,
          storeId: store.id,
          externalProductId,
          sourceSku: source.sku,
          barcode,
          sourceName,
          englishName: sourceName,
          itemType: source.itemType,
          salePrice: source.salePrice?.toFixed(2),
          costPrice: source.costPrice?.toFixed(2),
          sourceStock: source.stock?.toFixed(4),
          sourceStatus: source.status,
        },
        update: {
          sourceSku: source.sku,
          barcode,
          sourceName,
          itemType: source.itemType,
          salePrice: source.salePrice?.toFixed(2),
          costPrice: source.costPrice?.toFixed(2),
          sourceStock: source.stock?.toFixed(4),
          sourceStatus: source.status,
          status: 'ACTIVE',
          lastSeenAt: new Date(),
        },
        select: { id: true, reviewStatus: true },
      });
      if (saved.reviewStatus === 'PENDING') {
        await this.prisma.client.posProductCandidate.update({
          where: { id: saved.id },
          data: { englishName: sourceName },
        });
      }
    }

    if (candidates.length > 0) {
      await this.prisma.client.posProductCandidate.updateMany({
        where: {
          organizationId,
          storeId: store.id,
          externalProductId: { notIn: candidates.map(({ externalProductId }) => externalProductId!) },
        },
        data: { status: 'INACTIVE' },
      });
    }

    return {
      store: { id: store.id.toString(), name: store.name },
      sourceProducts: sourceProducts.length,
      withBarcode: sourceProducts.filter(({ barcode }) => Boolean(barcode)).length,
      excludedMilkProducts: sourceProducts.filter(({ externalProductId }) => externalProductId && milkIds.has(externalProductId)).length,
      reviewCandidates: candidates.length,
      note: '只读获取POS商品并保存到本地审核池，未修改POS和正式库存',
    };
  }

  async candidates(organizationId: bigint, userId: bigint, query: PosProductCatalogQueryDto) {
    const store = await this.storeAccess(organizationId, userId, query.storeId);
    const keyword = query.q?.trim();
    const where = {
      organizationId,
      storeId: store.id,
      status: 'ACTIVE' as const,
      ...(query.reviewStatus ? { reviewStatus: query.reviewStatus } : {}),
      ...(query.translationStatus ? { translationStatus: query.translationStatus } : {}),
      ...(keyword ? {
        OR: [
          { sourceName: { contains: keyword } },
          { englishName: { contains: keyword } },
          { chineseName: { contains: keyword } },
          { sourceSku: { contains: keyword } },
          { barcode: { contains: keyword } },
          { brandName: { contains: keyword } },
        ],
      } : {}),
    };
    const skip = (query.page - 1) * query.pageSize;
    const [items, total] = await Promise.all([
      this.prisma.client.posProductCandidate.findMany({
        where,
        skip,
        take: query.pageSize,
        orderBy: [{ sourceName: 'asc' }],
      }),
      this.prisma.client.posProductCandidate.count({ where }),
    ]);
    return {
      items: items.map((item) => this.serialize(item)),
      pagination: { page: query.page, pageSize: query.pageSize, total, pageTotal: Math.ceil(total / query.pageSize) },
    };
  }

  async reviewCandidate(
    organizationId: bigint,
    userId: bigint,
    storeIdValue: string,
    candidateIdValue: string,
    input: ReviewPosProductDto,
  ) {
    if (!/^\d+$/.test(candidateIdValue)) throw new BadRequestException('candidateId必须是正整数');
    const store = await this.storeAccess(organizationId, userId, storeIdValue);
    await this.requireStoreAdmin(organizationId, userId, store.id);
    const candidateId = BigInt(candidateIdValue);
    const previousRequest = await this.prisma.client.posProductCandidate.findUnique({
      where: { lastReviewRequestId: input.idempotencyKey },
    });
    if (previousRequest) {
      if (previousRequest.id !== candidateId || previousRequest.organizationId !== organizationId) {
        throw new ConflictException('该幂等键已用于其他商品审核');
      }
      return this.serialize(previousRequest);
    }
    const candidate = await this.prisma.client.posProductCandidate.findFirst({
      where: { id: candidateId, organizationId, storeId: store.id },
    });
    if (!candidate) throw new NotFoundException('POS商品候选不存在');
    const englishName = input.englishName.trim();
    const chineseName = input.chineseName?.trim() || null;
    if (input.reviewStatus === 'APPROVED' && !chineseName) {
      throw new BadRequestException('审核通过前必须填写中文名称');
    }

    const saved = await this.prisma.client.$transaction(async (transaction) => {
      let productId: bigint | null = null;
      if (input.reviewStatus === 'APPROVED') {
        const mapping = await transaction.posProductMapping.findUnique({
          where: { storeId_externalProductId: { storeId: store.id, externalProductId: candidate.externalProductId } },
        });
        const barcodeRecord = await transaction.productBarcode.findUnique({
          where: { organizationId_barcode: { organizationId, barcode: candidate.barcode } },
        });
        productId = mapping?.productId ?? barcodeRecord?.productId ?? null;
        if (productId) {
          await transaction.product.update({
            where: { id: productId },
            data: {
              name: chineseName || englishName,
              englishName,
              chineseName,
              brandName: input.brandName?.trim() || null,
              categoryName: input.categoryName?.trim() || null,
            },
          });
        } else {
          let sku = candidate.sourceSku || `MONI-${candidate.externalProductId}`;
          const skuOwner = await transaction.product.findUnique({
            where: { organizationId_sku: { organizationId, sku } },
          });
          if (skuOwner) sku = `MONI-${candidate.externalProductId}`;
          const product = await transaction.product.create({
            data: {
              organizationId,
              sku,
              name: chineseName || englishName,
              englishName,
              chineseName,
              brandName: input.brandName?.trim() || null,
              categoryName: input.categoryName?.trim() || null,
              barcodes: { create: { organizationId, barcode: candidate.barcode, isPrimary: true } },
            },
          });
          productId = product.id;
        }
        await transaction.storeProduct.upsert({
          where: { storeId_productId: { storeId: store.id, productId } },
          create: { storeId: store.id, productId, sellingPriceCents: candidate.salePrice ? Math.round(Number(candidate.salePrice) * 100) : null },
          update: { enabled: true, sellingPriceCents: candidate.salePrice ? Math.round(Number(candidate.salePrice) * 100) : null },
        });
        await transaction.posProductMapping.upsert({
          where: { storeId_externalProductId: { storeId: store.id, externalProductId: candidate.externalProductId } },
          create: { organizationId, storeId: store.id, externalProductId: candidate.externalProductId, productId, barcode: candidate.barcode, sourceName: candidate.sourceName },
          update: { productId, barcode: candidate.barcode, sourceName: candidate.sourceName, status: 'ACTIVE', lastSeenAt: new Date() },
        });
      }
      const updated = await transaction.posProductCandidate.update({
        where: { id: candidate.id },
        data: {
          reviewStatus: input.reviewStatus,
          englishName,
          chineseName,
          brandName: input.brandName?.trim() || null,
          categoryName: input.categoryName?.trim() || null,
          translationStatus: input.reviewStatus === 'APPROVED' ? 'APPROVED' : chineseName ? 'DRAFT' : 'UNTRANSLATED',
          lastReviewRequestId: input.idempotencyKey,
          reviewedAt: new Date(),
        },
      });
      await transaction.auditLog.create({
        data: {
          organizationId,
          userId,
          storeId: store.id,
          action: 'pos.product_candidate_review',
          entityType: 'PosProductCandidate',
          entityId: candidate.id.toString(),
          requestId: input.idempotencyKey,
          beforeSummary: { reviewStatus: candidate.reviewStatus, englishName: candidate.englishName, chineseName: candidate.chineseName },
          afterSummary: { reviewStatus: updated.reviewStatus, englishName, chineseName, reason: input.reason },
        },
      });
      return updated;
    });
    return this.serialize(saved);
  }
}
