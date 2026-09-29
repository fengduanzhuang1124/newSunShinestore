import { Injectable } from '@nestjs/common';
import { MoniAuthService } from './moni-auth.service.js';
import { MoniApiError, MoniHttpClient } from './moni-http-client.js';

const MAX_BRAND_PAGES = 1_000;

interface MoniBrandRecord {
  brand_id?: unknown;
  brand_code?: unknown;
  brand_name?: unknown;
}

interface MoniBrandListData {
  total?: unknown;
  page_total?: unknown;
  list?: unknown;
}

export interface MoniBrand {
  externalBrandId: string;
  code: string | null;
  name: string;
}

export interface MoniBrandPage {
  brands: readonly MoniBrand[];
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

@Injectable()
export class MoniBrandGateway {
  constructor(
    private readonly auth: MoniAuthService,
    private readonly http: MoniHttpClient,
  ) {}

  async listPage(pageNum = 1, keyword?: string): Promise<MoniBrandPage> {
    if (!Number.isSafeInteger(pageNum) || pageNum < 1) {
      throw new RangeError('Moni brand page number must be a positive integer');
    }

    const login = await this.auth.ensureLoggedIn();
    const normalizedKeyword = keyword?.trim();
    const data = await this.http.postReadOnly<MoniBrandListData>(
      'Webretailbrand/brandList',
      {
        shop_id: login.shopId,
        login_token: login.loginToken,
        page_num: pageNum,
        ...(normalizedKeyword ? { keyword: normalizedKeyword } : {}),
      },
    );

    if (!Array.isArray(data.list)) {
      throw new MoniApiError('Moni brand list must be an array');
    }

    const brands = data.list.map((raw) => {
      if (!raw || typeof raw !== 'object') {
        throw new MoniApiError('Moni brand record is invalid');
      }

      const record = raw as MoniBrandRecord;
      if (record.brand_id === undefined || typeof record.brand_name !== 'string') {
        throw new MoniApiError('Moni brand identity is missing');
      }

      return {
        externalBrandId: String(record.brand_id),
        code: typeof record.brand_code === 'string' ? record.brand_code : null,
        name: record.brand_name,
      };
    });

    return {
      brands,
      total: toNonNegativeInteger(data.total, 'brand total'),
      pageTotal: toNonNegativeInteger(data.page_total, 'brand page total'),
      pageNum,
    };
  }

  async listAll(keyword?: string): Promise<readonly MoniBrand[]> {
    const firstPage = await this.listPage(1, keyword);
    if (firstPage.pageTotal > MAX_BRAND_PAGES) {
      throw new MoniApiError('Moni brand pagination exceeds the safety limit');
    }

    const byId = new Map(
      firstPage.brands.map((brand) => [brand.externalBrandId, brand]),
    );
    for (let pageNum = 2; pageNum <= firstPage.pageTotal; pageNum += 1) {
      const page = await this.listPage(pageNum, keyword);
      for (const brand of page.brands) {
        byId.set(brand.externalBrandId, brand);
      }
    }

    return [...byId.values()];
  }
}
