import { jest } from '@jest/globals';
import { MoniAuthService } from './moni-auth.service.js';
import type { MoniConfigService } from '../../config/moni-config.service.js';
import type { MoniHttpClient } from './moni-http-client.js';

describe('MoniAuthService', () => {
  it('logs in once and keeps the token in memory', async () => {
    const config = {
      account: 'synthetic-account',
      password: 'synthetic-password',
    } as MoniConfigService;
    const loginData = {
      login_token: 'synthetic-token',
      shop: {
        shop_id: 7,
        shop_name: 'Synthetic Shop',
        store_list: [{ store_id: 42, store_name: 'Synthetic Store' }],
      },
    };
    const post = jest.fn(async () => loginData);
    const http = { post } as unknown as MoniHttpClient;
    const auth = new MoniAuthService(config, http);

    await expect(auth.ensureLoggedIn()).resolves.toEqual({
      loginToken: 'synthetic-token',
      shopId: '7',
      shopName: 'Synthetic Shop',
      stores: [{ storeId: '42', storeName: 'Synthetic Store' }],
    });
    await auth.ensureLoggedIn();

    expect(post).toHaveBeenCalledTimes(2);
    expect(post).toHaveBeenCalledWith('Weblogin/accountLogin', {
      account: 'synthetic-account',
      password: 'synthetic-password',
    });
    expect(post).toHaveBeenCalledWith('Weblogin/tokenLogin', {
      login_token: 'synthetic-token',
    });
  });
});
