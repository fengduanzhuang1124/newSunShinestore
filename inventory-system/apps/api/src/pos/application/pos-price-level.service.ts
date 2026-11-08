import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { MoniPriceLevelGateway } from '../adapters/moni/moni-price-level.gateway.js';

const RETAIL_LEVEL = 'Level 4';

export interface PosLevelPriceImportResult {
  priceId: string;
  sourceItems: number;
  updated: number;
  cleared: number;
  // Products priced twice with different amounts, by one POS item or by several POS items mapped to it.
  skippedConflicts: number;
}

// Copies the POS Level 4 price book (the retail price, CR-014) onto store products. Read-only towards POS; only rows
// whose price changed are written, and products no longer in the book are cleared.
@Injectable()
export class PosPriceLevelService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly priceLevels: MoniPriceLevelGateway,
  ) {}

  async importRetailPrices(storeId: bigint): Promise<PosLevelPriceImportResult> {
    const level = await this.priceLevels.findActiveByName(RETAIL_LEVEL);
    const items = await this.priceLevels.listAllAppliedItems(level.priceId);
    const priceByItem = new Map<string, number | null>();
    for (const item of items) {
      const previous = priceByItem.get(item.externalProductId);
      priceByItem.set(item.externalProductId, previous === undefined || previous === item.levelPriceCents ? item.levelPriceCents : null);
    }

    const mappings = await this.prisma.client.posProductMapping.findMany({
      where: { storeId, status: 'ACTIVE' },
      select: { externalProductId: true, productId: true },
    });
    const priceByProduct = new Map<bigint, number | null>();
    for (const mapping of mappings) {
      const price = priceByItem.get(mapping.externalProductId);
      if (price === undefined) continue;
      const previous = priceByProduct.get(mapping.productId);
      priceByProduct.set(mapping.productId, previous === undefined || previous === price ? price : null);
    }

    const current = await this.prisma.client.storeProduct.findMany({
      where: { storeId },
      select: { productId: true, level4PriceCents: true },
    });
    const syncedAt = new Date();
    let updated = 0;
    let cleared = 0;
    let skippedConflicts = 0;
    for (const row of current) {
      const price = priceByProduct.get(row.productId);
      if (price === null) {
        skippedConflicts += 1;
        continue;
      }
      if (price === undefined && row.level4PriceCents === null) continue;
      if (price !== undefined && price === row.level4PriceCents) continue;
      await this.prisma.client.storeProduct.update({
        where: { storeId_productId: { storeId, productId: row.productId } },
        data: price === undefined
          ? { level4PriceCents: null, level4PriceId: null, level4PriceSyncedAt: syncedAt }
          : { level4PriceCents: price, level4PriceId: level.priceId, level4PriceSyncedAt: syncedAt },
      });
      if (price === undefined) cleared += 1;
      else updated += 1;
    }
    return { priceId: level.priceId, sourceItems: items.length, updated, cleared, skippedConflicts };
  }
}
