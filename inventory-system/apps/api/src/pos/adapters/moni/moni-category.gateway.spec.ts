import { MoniCategoryGateway } from './moni-category.gateway.js';
import type { MoniAuthService } from './moni-auth.service.js';
import type { MoniHttpClient } from './moni-http-client.js';

describe('MoniCategoryGateway', () => {
  const auth = {
    ensureLoggedIn: async () => ({
      loginToken: 'synthetic-token',
      shopId: 'synthetic-shop',
    }),
  } as unknown as MoniAuthService;

  it('normalizes a documented category response', async () => {
    const calls: unknown[] = [];
    const http = {
      postReadOnly: async (...args: unknown[]) => {
        calls.push(args);
        return {
          list: [
            {
              cate_id: 4,
              cate_name: 'Beverages',
              parent_id: 0,
              level_id: 1,
              bg_color: '#cccccc',
              img: '',
              sort_num: 4,
              rate_id: 0,
            },
          ],
        };
      },
    } as unknown as MoniHttpClient;

    await expect(
      new MoniCategoryGateway(auth, http).listChildren(),
    ).resolves.toEqual([
      {
        externalCategoryId: '4',
        name: 'Beverages',
        parentId: '0',
        level: 1,
        backgroundColor: '#cccccc',
        imageUrl: null,
        sortNumber: 4,
        taxRateId: '0',
      },
    ]);
    expect(calls).toEqual([
      [
        'Webretailcate/cateList',
        {
          shop_id: 'synthetic-shop',
          login_token: 'synthetic-token',
          parent_id: '0',
        },
      ],
    ]);
  });

  it('walks child categories without following cycles forever', async () => {
    const http = {
      postReadOnly: async (_path: string, parameters: { parent_id: string }) => ({
        list:
          parameters.parent_id === '0'
            ? [{ cate_id: 10, cate_name: 'Parent', parent_id: 0, level_id: 1 }]
            : [{ cate_id: 10, cate_name: 'Parent', parent_id: 10, level_id: 1 }],
      }),
    } as unknown as MoniHttpClient;

    await expect(new MoniCategoryGateway(auth, http).listAll()).resolves.toEqual([
      {
        externalCategoryId: '10',
        name: 'Parent',
        parentId: '10',
        level: 1,
        backgroundColor: null,
        imageUrl: null,
        sortNumber: null,
        taxRateId: null,
      },
    ]);
  });
});
