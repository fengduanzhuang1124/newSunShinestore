import { MoniStoreGateway } from './moni-store.gateway.js';
import type { MoniConfigService } from '../../config/moni-config.service.js';
import type { MoniHttpClient } from './moni-http-client.js';
import type { MoniAuthService } from './moni-auth.service.js';

describe('MoniStoreGateway', () => {
  const auth = {
    ensureLoggedIn: async () => ({ loginToken: 'synthetic-token' }),
  } as unknown as MoniAuthService;

  it('returns only non-sensitive store summary fields', async () => {
    const config = {
      requireShopId: () => 'synthetic-shop',
    } as MoniConfigService;
    const http = {
      postReadOnly: async () => ({
        total: '1',
        page_total: 1,
        store_list: [
          {
            store_id: 42,
            store_name: 'Synthetic Store',
            status: '1',
            address: 'must not leave adapter',
            email: 'must-not-leave@example.test',
          },
        ],
      }),
    } as unknown as MoniHttpClient;

    await expect(
      new MoniStoreGateway(config, http, auth).listStores(),
    ).resolves.toEqual({
      total: 1,
      pageTotal: 1,
      stores: [
        {
          externalStoreId: '42',
          name: 'Synthetic Store',
          status: 1,
        },
      ],
    });
  });

  it('removes contact and financial fields from store information', async () => {
    const config = {
      requireStoreId: () => 'synthetic-store',
    } as MoniConfigService;
    const http = {
      postReadOnly: async () => ({
        store_info: {
          store_id: 42,
          store_name: 'Synthetic Store',
          address: 'must not leave adapter',
          email: 'must-not-leave@example.test',
          bank_account: 'must not leave adapter',
        },
      }),
    } as unknown as MoniHttpClient;

    await expect(
      new MoniStoreGateway(config, http, auth).getConfiguredStore(),
    ).resolves.toEqual({
      externalStoreId: '42',
      name: 'Synthetic Store',
    });
  });
});
