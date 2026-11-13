import { MoniSignatureService } from './moni-signature.service.js';
import type { MoniConfigService } from '../../config/moni-config.service.js';

const createService = (apiKey = 'synthetic-key') =>
  new MoniSignatureService({
    requestDevice: 'synthetic-device',
    apiKey,
  } as MoniConfigService);

describe('MoniSignatureService', () => {
  it('creates deterministic signed fixed parameters', () => {
    expect(createService().createSignedParameters(1_700_000_000)).toEqual({
      lang_id: 1,
      timestamp: '1700000000',
      request_device: 'synthetic-device',
      signYugu: '27468747523aa76144edb26ea142433a',
    });
  });

  it('does not expose the API key in the result', () => {
    const result = createService().createSignedParameters(1_700_000_000);

    expect(JSON.stringify(result)).not.toContain('synthetic-key');
  });

  it('changes the signature when the key changes', () => {
    const timestamp = 1_700_000_000;

    expect(
      createService('first-key').createSignedParameters(timestamp).signYugu,
    ).not.toBe(
      createService('second-key').createSignedParameters(timestamp).signYugu,
    );
  });

  it.each([999_999_999, 10_000_000_000, 1_700_000_000.5])(
    'rejects an invalid timestamp: %s',
    (timestamp) => {
      expect(() => createService().createSignedParameters(timestamp)).toThrow(
        RangeError,
      );
    },
  );

  it.each([0, -1, 1.5])('rejects an invalid lang_id: %s', (langId) => {
    expect(() =>
      createService().createSignedParameters(1_700_000_000, langId),
    ).toThrow(RangeError);
  });
});
