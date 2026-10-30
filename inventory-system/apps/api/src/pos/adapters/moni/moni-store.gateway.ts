import { Injectable } from '@nestjs/common';
import { MoniConfigService } from '../../config/moni-config.service.js';
import { MoniApiError, MoniHttpClient } from './moni-http-client.js';
import { MoniAuthService } from './moni-auth.service.js';

interface MoniStoreListData {
  store_list?: unknown;
  page_total?: unknown;
  total?: unknown;
}

interface MoniStoreRecord {
  store_id?: unknown;
  store_name?: unknown;
  status?: unknown;
}

interface MoniStoreInfoData {
  store_info?: unknown;
}

export interface MoniStoreSummary {
  externalStoreId: string;
  name: string;
  status: number | null;
}

export interface MoniStoreListResult {
  stores: readonly MoniStoreSummary[];
  total: number;
  pageTotal: number;
}

export interface MoniStoreIdentity {
  externalStoreId: string;
  name: string;
}

function toNonNegativeInteger(value: unknown, field: string): number {
  const number = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(number) || number < 0) {
    throw new MoniApiError(`Moni ${field} must be a non-negative integer`);
  }
  return number;
}

@Injectable()
export class MoniStoreGateway {
  constructor(
    private readonly config: MoniConfigService,
    private readonly http: MoniHttpClient,
    private readonly auth: MoniAuthService,
  ) {}

  async listStores(): Promise<MoniStoreListResult> {
    const login = await this.auth.ensureLoggedIn();
    const data = await this.http.postReadOnly<MoniStoreListData>(
      'Webstore/getStoreList',
      {
        shop_id: this.config.requireShopId(),
        login_token: login.loginToken,
        page_size: 1,
        page_num: 1,
      },
    );

    if (!Array.isArray(data.store_list)) {
      throw new MoniApiError('Moni store_list must be an array');
    }

    const stores = data.store_list.map((raw) => {
      if (!raw || typeof raw !== 'object') {
        throw new MoniApiError('Moni store record is invalid');
      }

      const record = raw as MoniStoreRecord;
      if (record.store_id === undefined || typeof record.store_name !== 'string') {
        throw new MoniApiError('Moni store identity is missing');
      }

      const status =
        record.status === undefined || record.status === ''
          ? null
          : toNonNegativeInteger(record.status, 'store status');

      return {
        externalStoreId: String(record.store_id),
        name: record.store_name,
        status,
      };
    });

    return {
      stores,
      total: toNonNegativeInteger(data.total, 'store total'),
      pageTotal: toNonNegativeInteger(data.page_total, 'store page total'),
    };
  }

  async getConfiguredStore(): Promise<MoniStoreIdentity> {
    const login = await this.auth.ensureLoggedIn();
    const data = await this.http.postReadOnly<MoniStoreInfoData>(
      'Webstore/getStoreInfo',
      {
        store_id: this.config.requireStoreId(),
        shop_id: login.shopId,
        login_token: login.loginToken,
      },
    );

    if (!data.store_info || typeof data.store_info !== 'object') {
      throw new MoniApiError('Moni store_info must be an object');
    }

    const record = data.store_info as MoniStoreRecord;
    if (record.store_id === undefined || typeof record.store_name !== 'string') {
      throw new MoniApiError('Moni store identity is missing');
    }

    return {
      externalStoreId: String(record.store_id),
      name: record.store_name,
    };
  }
}
