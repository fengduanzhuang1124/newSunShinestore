import { ForbiddenException } from '@nestjs/common';
import { jest } from '@jest/globals';
import { PosQueryService } from './pos-query.service.js';

describe('PosQueryService', () => {
  it('rejects access to a store outside the signed-in user scope', async () => {
    const client = {
      userStoreRole: { findFirst: jest.fn().mockResolvedValue(null as never) },
    };
    const service = new PosQueryService({ client } as never);

    await expect(service.syncStatus(1n, 2n, '3'))
      .rejects.toBeInstanceOf(ForbiddenException);
  });

  it('returns a redacted POS synchronization status for an allowed store', async () => {
    const client = {
      userStoreRole: {
        findFirst: jest.fn().mockResolvedValue({
          store: { id: 3n, name: 'Sunshine Health' },
        } as never),
      },
      posSyncRun: {
        findFirst: jest.fn().mockResolvedValue({
          id: 4n,
          status: 'SUCCEEDED',
          startedAt: new Date('2026-08-24T00:00:00.000Z'),
          finishedAt: new Date('2026-08-24T00:00:02.000Z'),
          ordersObserved: 10,
          ordersInserted: 1,
          ordersUpdated: 2,
          itemsObserved: 20,
          exceptionsCount: 1,
          errorCode: null,
          errorMessage: null,
        } as never),
      },
      posSyncCursor: {
        findUnique: jest.fn().mockResolvedValue({
          lastSourceTimestamp: new Date('2026-08-24T00:00:00.000Z'),
          updatedAt: new Date('2026-08-24T00:00:02.000Z'),
        } as never),
      },
      posRefundReview: { count: jest.fn().mockResolvedValue(1 as never) },
      posOrderItem: { count: jest.fn().mockResolvedValueOnce(2 as never).mockResolvedValueOnce(3 as never) },
    };
    const service = new PosQueryService({ client } as never);

    const result = await service.syncStatus(1n, 2n, '3');

    expect(result).toMatchObject({
      store: { id: '3', name: 'Sunshine Health' },
      provider: 'MONI',
      latestRun: { id: '4', status: 'SUCCEEDED' },
      exceptions: { pendingReviews: 1, unmappedItems: 2, inactiveItems: 3 },
    });
    expect(result).not.toHaveProperty('credentials');
  });
});
