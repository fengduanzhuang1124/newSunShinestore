import { jest } from '@jest/globals';
import { MoniPriceLevelGateway } from './moni-price-level.gateway.js';
import type { MoniConfigService } from '../../config/moni-config.service.js';
import type { MoniAuthService } from './moni-auth.service.js';
import type { MoniHttpClient } from './moni-http-client.js';

describe('MoniPriceLevelGateway', () => {
  it('finds Level 4 and converts tier prices to cents across pages', async () => {
    const config = { requireStoreId: () => '9676' } as MoniConfigService;
    const auth = { ensureLoggedIn: async () => ({ shopId: '1497', loginToken: 'token' }) } as MoniAuthService;
    const http = {
      postReadOnly: jest.fn(async (path: string, parameters: Record<string, unknown>) => {
        if (path.endsWith('retailPriceBookList')) {
          return { list: [{ price_id: 34, price_name: 'Level 4', status_str: 'Active', created_at: '05/18/2026' }] };
        }
        return parameters.page_num === 1
          ? { list: [{ item_id: '104054', tier_price: '37.39', barcode: '9342905000589', sku: '00009', name: 'Example' }], has_more: 1 }
          : { list: [{ item_id: '104055', tier_price: '41.73', barcode: '9342905001029', sku: '00010', name: 'Example 2' }], has_more: 0 };
      }),
    } as unknown as MoniHttpClient;
    const gateway = new MoniPriceLevelGateway(config, auth, http);

    const level = await gateway.findActiveByName('Level 4');
    await expect(gateway.listAllAppliedItems(level.priceId)).resolves.toEqual([
      expect.objectContaining({ externalProductId: '104054', levelPriceCents: 3739 }),
      expect.objectContaining({ externalProductId: '104055', levelPriceCents: 4173 }),
    ]);
  });
});
