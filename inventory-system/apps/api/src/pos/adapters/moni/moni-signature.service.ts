import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { MoniConfigService } from '../../config/moni-config.service.js';

export interface MoniSignatureCredentials {
  requestDevice: string;
  apiKey: string;
}

export interface MoniSignedParameters {
  lang_id: number;
  timestamp: string;
  request_device: string;
  signYugu: string;
}

function md5(value: string): string {
  return createHash('md5').update(value, 'utf8').digest('hex');
}

function requireTenDigitTimestamp(timestampSeconds: number): string {
  if (
    !Number.isSafeInteger(timestampSeconds) ||
    timestampSeconds < 1_000_000_000 ||
    timestampSeconds > 9_999_999_999
  ) {
    throw new RangeError('Moni timestamp must be a 10-digit Unix timestamp');
  }

  return String(timestampSeconds);
}

function buildCanonicalParameters(
  parameters: Readonly<Record<string, string | number>>,
): string {
  return Object.entries(parameters)
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .map(([name, value]) => `${name}=${String(value)}&`)
    .join('');
}

@Injectable()
export class MoniSignatureService {
  constructor(private readonly config: MoniConfigService) {}

  createSignedParameters(
    timestampSeconds: number,
    langId = 1,
  ): MoniSignedParameters {
    if (!Number.isSafeInteger(langId) || langId < 1) {
      throw new RangeError('Moni lang_id must be a positive integer');
    }

    const timestamp = requireTenDigitTimestamp(timestampSeconds);
    const fixedParameters = Object.freeze({
      lang_id: langId,
      timestamp,
      request_device: this.config.requestDevice,
    });
    const canonical = buildCanonicalParameters(fixedParameters);
    const intermediateDigest = md5(this.config.apiKey + timestamp);
    const signYugu = md5(canonical + intermediateDigest);

    return {
      ...fixedParameters,
      signYugu,
    };
  }
}
