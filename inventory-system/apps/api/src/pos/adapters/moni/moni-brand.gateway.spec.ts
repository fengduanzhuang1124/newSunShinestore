import { MoniBrandGateway } from './moni-brand.gateway.js';
import type { MoniAuthService } from './moni-auth.service.js';
import type { MoniHttpClient } from './moni-http-client.js';

describe('MoniBrandGateway', () => {
  it('logs in, requests a brand page, and exposes normalized fields', async () => {
    const auth = {
      ensureLoggedIn: async () => ({
        loginToken: 'synthetic-token',
        shopId: 'synthetic-shop',
      }),
    } as unknown as MoniAuthService;
    const calls: unknown[] = [];
    const http = {
      postReadOnly: async (...args: unknown[]) => {
        calls.push(args);
        return {
          total: '1',
          page_total: '1',
          list: [
            {
              brand_id: 4,
              brand_code: 'SYNTHETIC',
              brand_name: 'Synthetic Brand',
              private_field: 'must not leave adapter',
            },
          ],
        };
      },
    } as unknown as MoniHttpClient;

    await expect(new MoniBrandGateway(auth, http).listPage()).resolves.toEqual({
      brands: [
        {
          externalBrandId: '4',
          code: 'SYNTHETIC',
          name: 'Synthetic Brand',
        },
      ],
      total: 1,
      pageTotal: 1,
      pageNum: 1,
    });
    expect(calls).toEqual([
      [
        'Webretailbrand/brandList',
        {
          shop_id: 'synthetic-shop',
          login_token: 'synthetic-token',
          page_num: 1,
        },
      ],
    ]);
  });
});
