import { isLocalInventoryOrigin } from './http-app.js';

describe('isLocalInventoryOrigin', () => {
  it('accepts the store machines on this tailnet and the local admin port', () => {
    expect(isLocalInventoryOrigin('https://node.tail10ff0a.ts.net')).toBe(true);
    expect(isLocalInventoryOrigin('https://macmacbook-pro.tail10ff0a.ts.net')).toBe(true);
    expect(isLocalInventoryOrigin('https://localhost:5174')).toBe(true);
    expect(isLocalInventoryOrigin('http://192.168.1.73:5174')).toBe(true);
  });

  it('rejects other sites, plain http on the tailnet and look-alike hosts', () => {
    expect(isLocalInventoryOrigin('http://node.tail10ff0a.ts.net')).toBe(false);
    expect(isLocalInventoryOrigin('https://node.tail10ff0a.ts.net.evil.com')).toBe(false);
    expect(isLocalInventoryOrigin('https://tail10ff0a.ts.net')).toBe(false);
    expect(isLocalInventoryOrigin('https://example.com')).toBe(false);
    expect(isLocalInventoryOrigin('http://127.0.0.1:5181')).toBe(false);
  });
});
