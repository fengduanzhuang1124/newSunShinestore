import { Injectable } from '@nestjs/common';
import { MoniConfigService } from '../../config/moni-config.service.js';
import { MoniSignatureService } from './moni-signature.service.js';

const READ_ONLY_PATHS = new Set([
  'Webstore/getStoreList',
  'Webstore/getStoreInfo',
  'Webretailbrand/brandList',
  'Webretailcate/cateList',
  'Webretailitem/itemList',
  'Webstoreorder/getStoreOrders',
  'Webstoreorder/getOrderDetail',
  'Webstorereport/getStoreReportContent',
  'Webstoreorder/onlineRefundPayment',
]);
const AUTH_PATHS = new Set([
  'Weblogin/accountLogin',
  'Weblogin/tokenLogin',
]);
const ALLOWED_PATHS = new Set([...READ_ONLY_PATHS, ...AUTH_PATHS]);

export class MoniApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MoniApiError';
  }
}

interface MoniEnvelope<T> {
  code: number | string;
  msg?: string;
  data?: T;
}

@Injectable()
export class MoniHttpClient {
  private readonly cookies = new Map<string, string>();

  constructor(
    private readonly config: MoniConfigService,
    private readonly signature: MoniSignatureService,
  ) {}

  async postReadOnly<T>(
    path: string,
    parameters: Readonly<Record<string, string | number>>,
    now = new Date(),
  ): Promise<T> {
    if (!READ_ONLY_PATHS.has(path)) {
      throw new MoniApiError('Moni endpoint is not on the read-only allowlist');
    }

    return this.post<T>(path, parameters, now);
  }

  async post<T>(
    path: string,
    parameters: Readonly<Record<string, string | number>>,
    now = new Date(),
  ): Promise<T> {
    if (!ALLOWED_PATHS.has(path)) {
      throw new MoniApiError('Moni endpoint is not on the allowlist');
    }

    const timestampSeconds = Math.floor(now.getTime() / 1000);
    const signed = this.signature.createSignedParameters(timestampSeconds);
    const body = new URLSearchParams();

    for (const [name, value] of Object.entries({ ...parameters, ...signed })) {
      body.set(name, String(value));
    }

    const baseUrl = `${this.config.apiBaseUrl.replace(/\/$/, '')}/`;
    const url = new URL(path, baseUrl);
    if (url.origin !== new URL(baseUrl).origin) {
      throw new MoniApiError('Moni endpoint must remain on the configured origin');
    }

    let response: Response;
    try {
      const headers: Record<string, string> = {
        accept: 'application/json',
        'content-type': 'application/x-www-form-urlencoded;charset=UTF-8',
      };
      if (this.cookies.size > 0) {
        headers.cookie = [...this.cookies.entries()]
          .map(([name, value]) => `${name}=${value}`)
          .join('; ');
      }

      response = await fetch(url, {
        method: 'POST',
        headers,
        body,
        signal: AbortSignal.timeout(this.config.timeoutMs),
        redirect: 'error',
      });
    } catch {
      throw new MoniApiError('Moni read-only request failed');
    }

    if (!response.ok) {
      throw new MoniApiError(
        `Moni read-only request returned HTTP ${response.status}`,
      );
    }

    for (const setCookie of response.headers.getSetCookie()) {
      const pair = setCookie.split(';', 1)[0];
      const separator = pair.indexOf('=');
      if (separator <= 0) {
        continue;
      }

      const name = pair.slice(0, separator).trim();
      const value = pair.slice(separator + 1).trim();
      if (/^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/.test(name) && value) {
        this.cookies.set(name, value);
      }
    }

    let envelope: MoniEnvelope<T>;
    try {
      envelope = (await response.json()) as MoniEnvelope<T>;
    } catch {
      throw new MoniApiError('Moni response is not valid JSON');
    }

    if (!envelope || typeof envelope !== 'object' || envelope.code === undefined) {
      throw new MoniApiError('Moni response envelope is invalid');
    }

    if (String(envelope.code) !== '0') {
      const message =
        typeof envelope.msg === 'string'
          ? envelope.msg.replace(/[\r\n\t]+/g, ' ').trim().slice(0, 200)
          : '';
      throw new MoniApiError(
        `Moni API returned code ${String(envelope.code)}${message ? `: ${message}` : ''}`,
      );
    }

    if (envelope.data === undefined) {
      throw new MoniApiError('Moni response data is missing');
    }

    return envelope.data;
  }
}
