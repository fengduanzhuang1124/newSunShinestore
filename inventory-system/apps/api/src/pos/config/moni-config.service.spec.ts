import {
  MoniConfigurationError,
  parseMoniConfig,
} from './moni-config.service.js';

const validEnvironment = (): NodeJS.ProcessEnv => ({
  MONI_API_BASE_URL: 'https://api.example.test',
  MONI_REQUEST_DEVICE: 'synthetic-device',
  MONI_API_KEY: 'synthetic-key',
  MONI_ACCOUNT: 'synthetic-account',
  MONI_PASSWORD: 'synthetic-password',
  MONI_TIMEOUT_MS: '10000',
  MONI_SHOP_ID: 'synthetic-shop',
  MONI_STORE_ID: 'synthetic-store',
});

describe('parseMoniConfig', () => {
  it('parses a complete configuration without exposing it in errors', () => {
    expect(parseMoniConfig(validEnvironment())).toEqual({
      apiBaseUrl: 'https://api.example.test',
      requestDevice: 'synthetic-device',
      apiKey: 'synthetic-key',
      account: 'synthetic-account',
      password: 'synthetic-password',
      timeoutMs: 10_000,
      shopId: 'synthetic-shop',
      storeId: 'synthetic-store',
    });
  });

  it('uses a conservative default timeout', () => {
    const environment = validEnvironment();
    delete environment.MONI_TIMEOUT_MS;

    expect(parseMoniConfig(environment).timeoutMs).toBe(10_000);
  });

  it('allows shop ID to remain unset until a store request is made', () => {
    const environment = validEnvironment();
    delete environment.MONI_SHOP_ID;

    expect(parseMoniConfig(environment).shopId).toBeUndefined();
  });

  it.each([
    'MONI_REQUEST_DEVICE',
    'MONI_API_KEY',
    'MONI_ACCOUNT',
    'MONI_PASSWORD',
  ] as const)(
    'rejects a missing %s',
    (variableName) => {
      const environment = validEnvironment();
      delete environment[variableName];

      expect(() => parseMoniConfig(environment)).toThrow(
        MoniConfigurationError,
      );
    },
  );

  it('requires HTTPS', () => {
    const environment = validEnvironment();
    environment.MONI_API_BASE_URL = 'http://api.example.test';

    expect(() => parseMoniConfig(environment)).toThrow('must use HTTPS');
  });

  it.each(['999', '60001', '1.5', 'ten seconds'])(
    'rejects an unsafe timeout: %s',
    (timeout) => {
      const environment = validEnvironment();
      environment.MONI_TIMEOUT_MS = timeout;

      expect(() => parseMoniConfig(environment)).toThrow(
        MoniConfigurationError,
      );
    },
  );

  it('does not include credential values in validation errors', () => {
    const environment = validEnvironment();
    environment.MONI_API_BASE_URL = 'not-a-url';

    try {
      parseMoniConfig(environment);
      throw new Error('Expected configuration parsing to fail');
    } catch (error) {
      const message = String(error);
      expect(message).not.toContain(environment.MONI_REQUEST_DEVICE);
      expect(message).not.toContain(environment.MONI_API_KEY);
    }
  });
});
