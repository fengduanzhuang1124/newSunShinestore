import { jest } from '@jest/globals';
import { MoniProductGateway } from './moni-product.gateway.js';

describe('MoniProductGateway', () => {
  it('converts POS price cents to NZD values', async () => {
    const auth = {
      ensureLoggedIn: jest.fn().mockResolvedValue({ shopId: '1497', loginToken: 'redacted' } as never),
    };
    const config = { requireStoreId: jest.fn().mockReturnValue('9676') };
    const http = {
      postReadOnly: jest.fn().mockResolvedValue({
        total: 1,
        page_total: 1,
        list: [{
          item_id: '108949',
          spu_code: 'SKU-1',
          item_name: 'Example Product',
          barcode: '9421906325126',
          item_price: 12000,
          cost_price: '3348',
          stock: '-2',
          status: 1,
        }],
      } as never),
    };
    const gateway = new MoniProductGateway(config as never, auth as never, http as never);

    await expect(gateway.listPage(1)).resolves.toMatchObject({
      products: [{ salePrice: 120, costPrice: 33.48, stock: -2 }],
    });
  });
});
