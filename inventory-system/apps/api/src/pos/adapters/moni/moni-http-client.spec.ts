import { jest } from '@jest/globals';
import { MoniHttpClient } from './moni-http-client.js';
import type { MoniConfigService } from '../../config/moni-config.service.js';
import type { MoniSignatureService } from './moni-signature.service.js';

describe('MoniHttpClient', () => {
  const config = {
    apiBaseUrl: 'https://api.example.test',
    timeoutMs: 10_000,
  } as MoniConfigService;
  const signature = {
    createSignedParameters: jest.fn(() => ({
      lang_id: 1,
      timestamp: '1700000000',
      request_device: 'synthetic-device',
      signYugu: 'synthetic-signature',
    })),
  } as unknown as MoniSignatureService;

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('sends one form-encoded request to an allowlisted read-only endpoint', async () => {
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ code: 0, data: { total: 0 } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const client = new MoniHttpClient(config, signature);

    await expect(
      client.postReadOnly(
        'Webstore/getStoreList',
        { shop_id: 'synthetic-shop', page_size: 1, page_num: 1 },
        new Date('2023-11-14T22:13:20.000Z'),
      ),
    ).resolves.toEqual({ total: 0 });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, request] = fetchMock.mock.calls[0];
    expect(String(url)).toBe('https://api.example.test/Webstore/getStoreList');
    expect(request?.method).toBe('POST');
    expect(String(request?.body)).toContain('shop_id=synthetic-shop');
    expect(String(request?.body)).toContain('signYugu=synthetic-signature');
  });

  it('blocks any endpoint not on the read-only allowlist before fetch', async () => {
    const fetchMock = jest.spyOn(globalThis, 'fetch');
    const client = new MoniHttpClient(config, signature);

    await expect(
      client.postReadOnly('Pushretailorder/voidOrder', {}),
    ).rejects.toThrow('not on the read-only allowlist');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('allows the documented store-information query', async () => {
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          code: 0,
          data: { store_info: { store_id: 42, store_name: 'Synthetic' } },
        }),
        { status: 200 },
      ),
    );
    const client = new MoniHttpClient(config, signature);

    await client.postReadOnly(
      'Webstore/getStoreInfo',
      { store_id: 'synthetic-store' },
      new Date('2023-11-14T22:13:20.000Z'),
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('allows the documented read-only price-level queries', async () => {
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ code: 0, data: { list: [] } }), {
        status: 200,
      }),
    );
    const client = new MoniHttpClient(config, signature);

    await client.postReadOnly(
      'Webretailpricelevel/retailPriceBookList',
      { store_id: 'synthetic-store' },
      new Date('2023-11-14T22:13:20.000Z'),
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('keeps the login cookie in memory for the following store request', async () => {
    const fetchMock = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            code: 0,
            data: {
              login_token: 'synthetic-token',
              shop: { shop_id: 7, store_list: [] },
            },
          }),
          { status: 200, headers: { 'set-cookie': 'sid=synthetic-session; Path=/; HttpOnly' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ code: 0, data: { total: 0 } }), {
          status: 200,
        }),
      );
    const client = new MoniHttpClient(config, signature);

    await client.post('Weblogin/accountLogin', {
      account: 'synthetic-account',
      password: 'synthetic-password',
    });
    await client.postReadOnly('Webstore/getStoreList', {
      shop_id: 'synthetic-shop',
    });

    const [, secondRequest] = fetchMock.mock.calls[1];
    expect(secondRequest?.headers).toMatchObject({
      cookie: 'sid=synthetic-session',
    });
  });

  it('does not retry a failed request', async () => {
    const fetchMock = jest
      .spyOn(globalThis, 'fetch')
      .mockRejectedValue(new Error('synthetic network failure'));
    const client = new MoniHttpClient(config, signature);

    await expect(
      client.postReadOnly('Webstore/getStoreList', { shop_id: 'synthetic-shop' }),
    ).rejects.toThrow('read-only request failed');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
