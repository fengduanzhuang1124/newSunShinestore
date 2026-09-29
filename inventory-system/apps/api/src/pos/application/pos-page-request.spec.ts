import { BadRequestException } from '@nestjs/common';
import { createPosPageRequest } from './pos-page-request.js';

describe('createPosPageRequest', () => {
  it('uses a conservative default page size', () => {
    expect(createPosPageRequest({})).toEqual({ limit: 100 });
  });

  it('preserves cursor and a valid time window', () => {
    const from = new Date('2026-08-01T00:00:00.000Z');
    const to = new Date('2026-08-02T00:00:00.000Z');

    expect(
      createPosPageRequest({ cursor: 'next-page', from, to, limit: 50 }),
    ).toEqual({ cursor: 'next-page', from, to, limit: 50 });
  });

  it.each([0, -1, 1.5, 501])('rejects an unsafe page limit: %s', (limit) => {
    expect(() => createPosPageRequest({ limit })).toThrow(BadRequestException);
  });

  it('rejects an inverted synchronization window', () => {
    expect(() =>
      createPosPageRequest({
        from: new Date('2026-08-02T00:00:00.000Z'),
        to: new Date('2026-08-01T00:00:00.000Z'),
      }),
    ).toThrow(BadRequestException);
  });
});
