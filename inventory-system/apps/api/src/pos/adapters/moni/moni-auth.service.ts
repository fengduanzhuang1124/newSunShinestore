import { Injectable } from '@nestjs/common';
import { MoniConfigService } from '../../config/moni-config.service.js';
import { MoniApiError, MoniHttpClient } from './moni-http-client.js';

interface MoniLoginStore {
  store_id?: unknown;
  store_name?: unknown;
}

interface MoniLoginShop {
  shop_id?: unknown;
  shop_name?: unknown;
  store_list?: unknown;
}

interface MoniLoginData {
  login_token?: unknown;
  shop?: unknown;
}

export interface MoniLoginResult {
  loginToken: string;
  shopId: string;
  shopName: string | null;
  stores: readonly {
    storeId: string;
    storeName: string | null;
  }[];
}

@Injectable()
export class MoniAuthService {
  private currentLogin?: MoniLoginResult;

  constructor(
    private readonly config: MoniConfigService,
    private readonly http: MoniHttpClient,
  ) {}

  async login(): Promise<MoniLoginResult> {
    const accountLogin = await this.http.post<MoniLoginData>(
      'Weblogin/accountLogin',
      {
        account: this.config.account,
        password: this.config.password,
      },
    );

    if (
      typeof accountLogin.login_token !== 'string' ||
      !accountLogin.login_token.trim()
    ) {
      throw new MoniApiError('Moni login token is missing');
    }

    const data = await this.http.post<MoniLoginData>('Weblogin/tokenLogin', {
      login_token: accountLogin.login_token,
    });

    if (typeof data.login_token !== 'string' || !data.login_token.trim()) {
      throw new MoniApiError('Moni token login token is missing');
    }

    if (!data.shop || typeof data.shop !== 'object') {
      throw new MoniApiError('Moni login shop is missing');
    }

    const shop = data.shop as MoniLoginShop;
    if (shop.shop_id === undefined) {
      throw new MoniApiError('Moni login shop ID is missing');
    }

    const rawStores = Array.isArray(shop.store_list) ? shop.store_list : [];
    const stores = rawStores.map((raw) => {
      if (!raw || typeof raw !== 'object') {
        throw new MoniApiError('Moni login store record is invalid');
      }

      const store = raw as MoniLoginStore;
      if (store.store_id === undefined) {
        throw new MoniApiError('Moni login store ID is missing');
      }

      return {
        storeId: String(store.store_id),
        storeName:
          typeof store.store_name === 'string' ? store.store_name : null,
      };
    });

    const result: MoniLoginResult = {
      loginToken: data.login_token,
      shopId: String(shop.shop_id),
      shopName: typeof shop.shop_name === 'string' ? shop.shop_name : null,
      stores,
    };
    this.currentLogin = result;

    return result;
  }

  async ensureLoggedIn(): Promise<MoniLoginResult> {
    return this.currentLogin ?? this.login();
  }
}
