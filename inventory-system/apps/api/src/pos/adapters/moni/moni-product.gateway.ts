import { Injectable } from '@nestjs/common';
import { MoniConfigService } from '../../config/moni-config.service.js';
import { MoniAuthService } from './moni-auth.service.js';
import { MoniApiError, MoniHttpClient } from './moni-http-client.js';

const MAX_PRODUCT_PAGES = 1_000;
const MAX_PRODUCT_COUNT = 100_000;

interface MoniProductRecord {
  item_id?: unknown;
  food_id?: unknown;
  id?: unknown;
  spu_code?: unknown;
  item_name?: unknown;
  item_price?: unknown;
  cost_price?: unknown;
  status?: unknown;
  sold_time?: unknown;
  barcode?: unknown;
  item_type?: unknown;
  stock?: unknown;
}

interface MoniProductListData {
  total?: unknown;
  page_total?: unknown;
  list?: unknown;
}

export interface MoniProduct {
  externalProductId: string | null;
  sku: string | null;
  name: string | null;
  barcode: string | null;
  itemType: string | null;
  salePrice: number | null;
  costPrice: number | null;
  stock: number | null;
  status: string | null;
  soldTime: string | null;
}

export interface MoniProductPage {
  products: readonly MoniProduct[];
  total: number;
  pageTotal: number;
  pageNum: number;
}

function toNonNegativeInteger(value: unknown, field: string): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new MoniApiError(`Moni ${field} must be a non-negative integer`);
  }
  return parsed;
}

function toOptionalNumber(value: unknown, field: string): number | null {
  if (value === undefined || value === null || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) {
    throw new MoniApiError(`Moni ${field} must be numeric`);
  }
  return parsed;
}

function toOptionalString(value: unknown): string | null {
  if (typeof value === 'string') return value.trim() || null;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
}

@Injectable()
export class MoniProductGateway {
  constructor(
    private readonly config: MoniConfigService,
    private readonly auth: MoniAuthService,
    private readonly http: MoniHttpClient,
  ) {}

  async listPage(pageNum = 1): Promise<MoniProductPage> {
    if (!Number.isSafeInteger(pageNum) || pageNum < 1) {
      throw new RangeError('Moni product page number must be a positive integer');
    }

    const login = await this.auth.ensureLoggedIn();
    const data = await this.http.postReadOnly<MoniProductListData>(
      'Webretailitem/itemList',
      {
        shop_id: login.shopId,
        store_id: this.config.requireStoreId(),
        login_token: login.loginToken,
        page_num: pageNum,
      },
    );

    if (!Array.isArray(data.list)) {
      throw new MoniApiError('Moni product list must be an array');
    }

    const products = data.list.map((raw) => {
      if (!raw || typeof raw !== 'object') {
        throw new MoniApiError('Moni product record is invalid');
      }
      const record = raw as MoniProductRecord;
      const sku = toOptionalString(record.spu_code);
      const name = toOptionalString(record.item_name);
      const stock = toOptionalNumber(record.stock, 'product stock');
      return {
        externalProductId: toOptionalString(
          record.item_id ?? record.food_id ?? record.id,
        ),
        sku,
        name,
        barcode: toOptionalString(record.barcode),
        itemType: toOptionalString(record.item_type),
        salePrice: toOptionalNumber(record.item_price, 'product sale price'),
        costPrice: toOptionalNumber(record.cost_price, 'product cost price'),
        stock,
        status: toOptionalString(record.status),
        soldTime: toOptionalString(record.sold_time),
      };
    });

    return {
      products,
      total: toNonNegativeInteger(data.total, 'product total'),
      pageTotal: toNonNegativeInteger(data.page_total, 'product page total'),
      pageNum,
    };
  }

  async listAll(): Promise<readonly MoniProduct[]> {
    const firstPage = await this.listPage(1);
    if (firstPage.pageTotal > MAX_PRODUCT_PAGES) {
      throw new MoniApiError('Moni product pagination exceeds the safety limit');
    }

    const products = [...firstPage.products];
    for (let pageNum = 2; pageNum <= firstPage.pageTotal; pageNum += 1) {
      products.push(...(await this.listPage(pageNum)).products);
      if (products.length > MAX_PRODUCT_COUNT) {
        throw new MoniApiError('Moni product count exceeds the safety limit');
      }
    }
    return products;
  }
}
