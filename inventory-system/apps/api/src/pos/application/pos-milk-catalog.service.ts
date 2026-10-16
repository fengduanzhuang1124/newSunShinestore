import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { MoniProductGateway } from '../adapters/moni/moni-product.gateway.js';
import { classifyMilkProduct } from './milk-product-classifier.js';
import type { PosMilkCatalogQueryDto } from './pos-query.dto.js';
import type { ReviewMilkProductDto } from './review-milk-product.dto.js';

@Injectable()
export class PosMilkCatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly products: MoniProductGateway,
  ) {}

  private async storeAccess(
    organizationId: bigint,
    userId: bigint,
    storeIdValue: string,
  ) {
    const storeId = BigInt(storeIdValue);
    const access = await this.prisma.client.userStoreRole.findFirst({
      where: { userId, storeId, store: { organizationId, status: 'ACTIVE' } },
      select: { store: { select: { id: true, name: true } } },
    });
    if (!access) throw new ForbiddenException('没有该门店的奶粉商品查看权限');
    return access.store;
  }

  private async requireStoreAdmin(
    organizationId: bigint,
    userId: bigint,
    storeId: bigint,
  ) {
    const role = await this.prisma.client.userStoreRole.findFirst({
      where: { userId, storeId, store: { organizationId }, role: { code: 'ADMIN' } },
      select: { userId: true },
    });
    if (!role) throw new ForbiddenException('只有门店管理员可以审核奶粉商品');
  }

  async reviewCandidate(
    organizationId: bigint,
    userId: bigint,
    storeIdValue: string,
    candidateIdValue: string,
    input: ReviewMilkProductDto,
  ) {
    if (!/^\d+$/.test(candidateIdValue)) throw new BadRequestException('candidateId必须是正整数');
    const store = await this.storeAccess(organizationId, userId, storeIdValue);
    await this.requireStoreAdmin(organizationId, userId, store.id);
    const candidateId = BigInt(candidateIdValue);
    const existingRequest = await this.prisma.client.posMilkProductCandidate.findUnique({
      where: { lastReviewRequestId: input.idempotencyKey },
    });
    if (existingRequest) {
      if (
        existingRequest.id !== candidateId ||
        existingRequest.organizationId !== organizationId ||
        existingRequest.storeId !== store.id
      ) throw new ConflictException('该幂等键已用于其他审核');
      return this.serializeCandidate(existingRequest);
    }

    const candidate = await this.prisma.client.posMilkProductCandidate.findFirst({
      where: { id: candidateId, organizationId, storeId: store.id },
    });
    if (!candidate) throw new NotFoundException('奶粉候选商品不存在');
    if (input.reviewStatus === 'APPROVED' && !input.inventoryPolicy) {
      throw new BadRequestException('审核通过时必须确认库存策略');
    }
    if (input.reviewStatus === 'APPROVED' && input.inventoryPolicy === 'REVIEW_REQUIRED') {
      throw new BadRequestException('待确认库存策略不能审核通过');
    }
    const updated = await this.prisma.client.$transaction(async (transaction) => {
      const saved = await transaction.posMilkProductCandidate.update({
        where: { id: candidate.id },
        data: {
          reviewStatus: input.reviewStatus,
          suggestedBrand: input.brand?.trim() ?? candidate.suggestedBrand,
          suggestedEnglishName: input.englishName?.trim() ?? candidate.suggestedEnglishName,
          suggestedChineseName: input.chineseName?.trim() ?? candidate.suggestedChineseName,
          translationStatus: input.chineseName ? 'DRAFT' : candidate.translationStatus,
          suggestedPackQuantity: input.inventoryPolicy === 'LOCAL_STOCK'
            ? null
            : input.packQuantity ?? candidate.suggestedPackQuantity,
          suggestedInventoryPolicy: input.inventoryPolicy ?? candidate.suggestedInventoryPolicy,
          lastReviewRequestId: input.idempotencyKey,
          reviewedAt: new Date(),
        },
      });
      await transaction.auditLog.create({
        data: {
          organizationId,
          userId,
          storeId: store.id,
          action: 'pos.milk_candidate_review',
          entityType: 'PosMilkProductCandidate',
          entityId: candidate.id.toString(),
          requestId: input.idempotencyKey,
          beforeSummary: {
            reviewStatus: candidate.reviewStatus,
            brand: candidate.suggestedBrand,
            packQuantity: candidate.suggestedPackQuantity,
            inventoryPolicy: candidate.suggestedInventoryPolicy,
          },
          afterSummary: {
            reviewStatus: saved.reviewStatus,
            brand: saved.suggestedBrand,
            packQuantity: saved.suggestedPackQuantity,
            inventoryPolicy: saved.suggestedInventoryPolicy,
            reason: input.reason,
          },
        },
      });
      return saved;
    });
    return this.serializeCandidate(updated);
  }

  private serializeCandidate(item: Awaited<ReturnType<PrismaService['client']['posMilkProductCandidate']['findFirstOrThrow']>>) {
    return {
      id: item.id.toString(),
      externalProductId: item.externalProductId,
      sourceSku: item.sourceSku,
      barcode: item.barcode,
      sourceName: item.sourceName,
      suggestedEnglishName: item.suggestedEnglishName,
      suggestedChineseName: item.suggestedChineseName,
      suggestedBrand: item.suggestedBrand,
      suggestedPackQuantity: item.suggestedPackQuantity,
      suggestedInventoryPolicy: item.suggestedInventoryPolicy,
      cartonPriceMatched: item.cartonPriceMatched,
      salePrice: item.salePrice?.toString() ?? null,
      recognitionReason: item.recognitionReason,
      reviewStatus: item.reviewStatus,
      translationStatus: item.translationStatus,
      reviewedAt: item.reviewedAt?.toISOString() ?? null,
    };
  }

  async candidate(
    organizationId: bigint,
    userId: bigint,
    storeIdValue: string,
    candidateIdValue: string,
  ) {
    if (!/^\d+$/.test(candidateIdValue)) throw new BadRequestException('candidateId必须是正整数');
    const store = await this.storeAccess(organizationId, userId, storeIdValue);
    const candidate = await this.prisma.client.posMilkProductCandidate.findFirst({
      where: { id: BigInt(candidateIdValue), organizationId, storeId: store.id },
    });
    if (!candidate) throw new NotFoundException('奶粉候选商品不存在');
    return this.serializeCandidate(candidate);
  }

  async importCandidates(
    organizationId: bigint,
    userId: bigint,
    storeIdValue: string,
  ) {
    const store = await this.storeAccess(organizationId, userId, storeIdValue);
    const sourceProducts = await this.products.listAll();
    const candidates = sourceProducts.flatMap((source) => {
      const classification = classifyMilkProduct(source.name, source.salePrice);
      if (!classification || !source.externalProductId || !source.name) return [];
      return [{ source, classification }];
    });

    for (const { source, classification } of candidates) {
      const saved = await this.prisma.client.posMilkProductCandidate.upsert({
        where: {
          storeId_externalProductId: {
            storeId: store.id,
            externalProductId: source.externalProductId!,
          },
        },
        create: {
          organizationId,
          storeId: store.id,
          externalProductId: source.externalProductId!,
          sourceSku: source.sku,
          barcode: source.barcode,
          sourceName: source.name!,
          suggestedEnglishName: source.name!,
          suggestedBrand: classification.brand,
          suggestedPackQuantity: classification.packQuantity,
          suggestedInventoryPolicy: classification.inventoryPolicy,
          cartonPriceMatched: classification.cartonPriceMatched,
          salePrice: source.salePrice?.toFixed(2),
          sourceStatus: source.status,
          recognitionReason: classification.recognitionReason,
        },
        update: {
          sourceSku: source.sku,
          barcode: source.barcode,
          sourceName: source.name!,
          cartonPriceMatched: classification.cartonPriceMatched,
          salePrice: source.salePrice?.toFixed(2),
          sourceStatus: source.status,
          recognitionReason: classification.recognitionReason,
          status: 'ACTIVE',
          lastSeenAt: new Date(),
        },
        select: { id: true, reviewStatus: true },
      });
      if (saved.reviewStatus === 'PENDING') {
        await this.prisma.client.posMilkProductCandidate.update({
          where: { id: saved.id },
          data: {
            suggestedEnglishName: source.name!,
            suggestedBrand: classification.brand,
            suggestedPackQuantity: classification.packQuantity,
            suggestedInventoryPolicy: classification.inventoryPolicy,
          },
        });
      }
    }

    if (candidates.length > 0) {
      await this.prisma.client.posMilkProductCandidate.updateMany({
        where: {
          organizationId,
          storeId: store.id,
          externalProductId: {
            notIn: candidates.map(({ source }) => source.externalProductId!),
          },
        },
        data: { status: 'INACTIVE' },
      });
    }

    return {
      store: { id: store.id.toString(), name: store.name },
      sourceProducts: sourceProducts.length,
      milkCandidates: candidates.length,
      missingBarcode: candidates.filter(({ source }) => !source.barcode).length,
      packQuantityPending: candidates.filter(
        ({ classification }) => classification.packQuantity === null,
      ).length,
      note: '候选数据仅供审核，未修改POS、正式商品或库存',
    };
  }

  async candidates(
    organizationId: bigint,
    userId: bigint,
    query: PosMilkCatalogQueryDto,
  ) {
    const store = await this.storeAccess(organizationId, userId, query.storeId);
    const keyword = query.q?.trim();
    const where = {
      organizationId,
      storeId: store.id,
      status: 'ACTIVE' as const,
      ...(query.brand ? { suggestedBrand: query.brand.trim() } : {}),
      ...(query.reviewStatus ? { reviewStatus: query.reviewStatus } : {}),
      ...(keyword ? {
        OR: [
          { sourceName: { contains: keyword } },
          { sourceSku: { contains: keyword } },
          { barcode: { contains: keyword } },
          { suggestedBrand: { contains: keyword } },
        ],
      } : {}),
    };
    const skip = (query.page - 1) * query.pageSize;
    const [items, total] = await Promise.all([
      this.prisma.client.posMilkProductCandidate.findMany({
        where,
        skip,
        take: query.pageSize,
        orderBy: [{ suggestedBrand: 'asc' }, { sourceName: 'asc' }],
      }),
      this.prisma.client.posMilkProductCandidate.count({ where }),
    ]);

    return {
      items: items.map((item) => this.serializeCandidate(item)),
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        pageTotal: Math.ceil(total / query.pageSize),
      },
    };
  }
}
