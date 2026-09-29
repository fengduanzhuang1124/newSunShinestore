import { Injectable } from '@nestjs/common';
import { MoniConfigService } from '../../config/moni-config.service.js';
import { MoniAuthService } from './moni-auth.service.js';
import { MoniApiError, MoniHttpClient } from './moni-http-client.js';

const MAX_PRICE_PAGES = 1_000;
const MAX_PRICE_ITEMS = 100_000;

interface PriceLevelListData {
  list?: unknown;
}

interface AppliedItemsData {
  list?: unknown;
  has_more?: unknown;
}

export interface MoniPriceLevel {
  priceId: string;
  name: string;
  status: string | null;
  createdAt: string | null;
}

export interface MoniPriceLevelItem {
  externalProductId: string;
  barcode: string | null;
  sku: string | null;
  name: string | null;
  levelPriceCents: number;
}

function optionalString(value: unknown): string | null {
  if (typeof value === 'string') return value.trim() || null;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
}

function requiredString(value: unknown, field: string): string {
  const parsed = optionalString(value);
  if (!parsed) throw new MoniApiError(`Moni ${field} is required`);
  return parsed;
}

function currencyCents(value: unknown, field: string): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) throw new MoniApiError(`Moni ${field} must be non-negative currency`);
  return Math.round(parsed * 100);
}

@Injectable()
export class MoniPriceLevelGateway {
  constructor(
    private readonly config: MoniConfigService,
    private readonly auth: MoniAuthService,
    private readonly http: MoniHttpClient,
  ) {}

  private async parameters() {
    const login = await this.auth.ensureLoggedIn();
    return {
      shop_id: login.shopId,
      store_id: this.config.requireStoreId(),
      login_token: login.loginToken,
    };
  }

  async listLevels(): Promise<readonly MoniPriceLevel[]> {
    const data = await this.http.postReadOnly<PriceLevelListData>(
      'Webretailpricelevel/retailPriceBookList',
      await this.parameters(),
    );
    if (!Array.isArray(data.list)) throw new MoniApiError('Moni price-level list must be an array');
    return data.list.map((raw) => {
      if (!raw || typeof raw !== 'object') throw new MoniApiError('Moni price-level record is invalid');
      const record = raw as Record<string, unknown>;
      return {
        priceId: requiredString(record.price_id, 'price level ID'),
        name: requiredString(record.price_name, 'price level name'),
        status: optionalString(record.status_str),
        createdAt: optionalString(record.created_at),
      };
    });
  }

  async findActiveByName(name: string): Promise<MoniPriceLevel> {
    const normalized = name.trim().toLowerCase();
    const matches = (await this.listLevels()).filter((level) => level.name.toLowerCase() === normalized);
    if (matches.length !== 1) throw new MoniApiError(`Moni ${name} price level must exist exactly once`);
    const level = matches[0]!;
    if (level.status?.toLowerCase() !== 'active') throw new MoniApiError(`Moni ${name} price level is not active`);
    return level;
  }

  async listAllAppliedItems(priceId: string): Promise<readonly MoniPriceLevelItem[]> {
    const parameters = await this.parameters();
    const items: MoniPriceLevelItem[] = [];
    for (let pageNum = 1; pageNum <= MAX_PRICE_PAGES; pageNum += 1) {
      const data = await this.http.postReadOnly<AppliedItemsData>(
        'Webretailpricelevel/retailPriceBookApplyItems',
        { ...parameters, price_id: priceId, page_num: pageNum },
      );
      if (!Array.isArray(data.list)) throw new MoniApiError('Moni price-level items must be an array');
      for (const raw of data.list) {
        if (!raw || typeof raw !== 'object') throw new MoniApiError('Moni price-level item is invalid');
        const record = raw as Record<string, unknown>;
        items.push({
          externalProductId: requiredString(record.item_id, 'price-level item ID'),
          barcode: optionalString(record.barcode),
          sku: optionalString(record.sku),
          name: optionalString(record.name),
          levelPriceCents: currencyCents(record.tier_price, 'tier price'),
        });
      }
      if (items.length > MAX_PRICE_ITEMS) throw new MoniApiError('Moni price-level item count exceeds the safety limit');
      if (String(data.has_more) !== '1') return items;
    }
    throw new MoniApiError('Moni price-level pagination exceeds the safety limit');
  }
}
