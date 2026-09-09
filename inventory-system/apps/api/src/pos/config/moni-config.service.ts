import { Injectable } from '@nestjs/common';

const DEFAULT_TIMEOUT_MS = 10_000;
const MIN_TIMEOUT_MS = 1_000;
const MAX_TIMEOUT_MS = 60_000;

export interface MoniConfig {
  apiBaseUrl: string;
  requestDevice: string;
  apiKey: string;
  account: string;
  password: string;
  timeoutMs: number;
  shopId?: string;
  storeId?: string;
}

export class MoniConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MoniConfigurationError';
  }
}

function requireSecret(
  environment: NodeJS.ProcessEnv,
  variableName:
    | 'MONI_REQUEST_DEVICE'
    | 'MONI_API_KEY'
    | 'MONI_ACCOUNT'
    | 'MONI_PASSWORD',
): string {
  const value = environment[variableName]?.trim();

  if (!value) {
    throw new MoniConfigurationError(`${variableName} is required`);
  }

  return value;
}

function parseBaseUrl(environment: NodeJS.ProcessEnv): string {
  const value = environment.MONI_API_BASE_URL?.trim();

  if (!value) {
    throw new MoniConfigurationError('MONI_API_BASE_URL is required');
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new MoniConfigurationError('MONI_API_BASE_URL must be a valid URL');
  }

  if (url.protocol !== 'https:') {
    throw new MoniConfigurationError('MONI_API_BASE_URL must use HTTPS');
  }

  if (url.username || url.password || url.search || url.hash) {
    throw new MoniConfigurationError(
      'MONI_API_BASE_URL must not contain credentials, query, or fragment',
    );
  }

  return url.toString().replace(/\/$/, '');
}

function parseTimeout(environment: NodeJS.ProcessEnv): number {
  const raw = environment.MONI_TIMEOUT_MS?.trim();

  if (!raw) {
    return DEFAULT_TIMEOUT_MS;
  }

  if (!/^\d+$/.test(raw)) {
    throw new MoniConfigurationError(
      'MONI_TIMEOUT_MS must be an integer number of milliseconds',
    );
  }

  const timeoutMs = Number(raw);
  if (timeoutMs < MIN_TIMEOUT_MS || timeoutMs > MAX_TIMEOUT_MS) {
    throw new MoniConfigurationError(
      `MONI_TIMEOUT_MS must be between ${MIN_TIMEOUT_MS} and ${MAX_TIMEOUT_MS}`,
    );
  }

  return timeoutMs;
}

export function parseMoniConfig(environment: NodeJS.ProcessEnv): MoniConfig {
  const shopId = environment.MONI_SHOP_ID?.trim();
  const storeId = environment.MONI_STORE_ID?.trim();

  return Object.freeze({
    apiBaseUrl: parseBaseUrl(environment),
    requestDevice: requireSecret(environment, 'MONI_REQUEST_DEVICE'),
    apiKey: requireSecret(environment, 'MONI_API_KEY'),
    account: requireSecret(environment, 'MONI_ACCOUNT'),
    password: requireSecret(environment, 'MONI_PASSWORD'),
    timeoutMs: parseTimeout(environment),
    ...(shopId ? { shopId } : {}),
    ...(storeId ? { storeId } : {}),
  });
}

@Injectable()
export class MoniConfigService {
  readonly apiBaseUrl: string;
  readonly requestDevice: string;
  readonly apiKey: string;
  readonly account: string;
  readonly password: string;
  readonly timeoutMs: number;
  readonly shopId?: string;
  readonly storeId?: string;

  constructor() {
    const config = parseMoniConfig(process.env);
    this.apiBaseUrl = config.apiBaseUrl;
    this.requestDevice = config.requestDevice;
    this.apiKey = config.apiKey;
    this.account = config.account;
    this.password = config.password;
    this.timeoutMs = config.timeoutMs;
    this.shopId = config.shopId;
    this.storeId = config.storeId;
  }

  toJSON(): Record<string, unknown> {
    return {
      apiBaseUrl: this.apiBaseUrl,
      timeoutMs: this.timeoutMs,
      shopIdConfigured: Boolean(this.shopId),
      storeIdConfigured: Boolean(this.storeId),
      credentials: '[REDACTED]',
    };
  }

  requireShopId(): string {
    if (!this.shopId) {
      throw new MoniConfigurationError(
        'MONI_SHOP_ID is required for store-list requests',
      );
    }

    return this.shopId;
  }

  requireStoreId(): string {
    if (!this.storeId) {
      throw new MoniConfigurationError(
        'MONI_STORE_ID is required for store-information requests',
      );
    }

    return this.storeId;
  }
}
