import { jest } from '@jest/globals';
import { PosRealtimeSyncService } from './pos-realtime-sync.service.js';

const baseline = new Date('2026-10-20T10:01:47.000Z');

function setup({ running = 0, baselineAt = baseline as Date | null } = {}) {
  const calls: string[] = [];
  const client = {
    user: { findFirst: jest.fn().mockResolvedValue({ id: 2n } as never) },
    store: {
      findMany: jest.fn().mockResolvedValue([
        { id: 1n, organizationId: 9n, organization: { timezone: 'Pacific/Auckland' } },
      ] as never),
    },
    posSyncRun: { count: jest.fn().mockResolvedValue(running as never) },
  };
  const observation = {
    importProductMappings: jest.fn(async () => { calls.push('mappings'); return {}; }),
    observeOrders: jest.fn(async (_org: bigint, _store: bigint, date: string) => { calls.push(`orders:${date}`); return {}; }),
  };
  const application = {
    resolveBaseline: jest.fn().mockResolvedValue(baselineAt as never),
    applyRange: jest.fn(async () => {
      calls.push('apply');
      return { summary: { appliedOrders: 3, unitsApplied: 5, reviewLines: 1, shortfallUnits: 1 } };
    }),
  };
  const service = new PosRealtimeSyncService({ client } as never, observation as never, application as never);
  return { service, client, observation, application, calls };
}

describe('PosRealtimeSyncService', () => {
  const previous = process.env.POS_REALTIME_SYNC_USERNAME;
  beforeEach(() => { process.env.POS_REALTIME_SYNC_USERNAME = 'wf1124'; });
  afterAll(() => {
    if (previous === undefined) delete process.env.POS_REALTIME_SYNC_USERNAME;
    else process.env.POS_REALTIME_SYNC_USERNAME = previous;
  });

  it('refreshes mappings, reads today\'s orders, then deducts everything after the store baseline', async () => {
    const { service, application, calls } = setup();
    const now = new Date('2026-10-21T02:00:00.000Z'); // 15:00 in Auckland

    await service.tick(now);

    expect(calls).toEqual(['mappings', 'orders:2026-10-21', 'apply']);
    expect(application.applyRange).toHaveBeenCalledWith(9n, 2n, 1n, baseline, now);
    expect(service.status()).toMatchObject({
      lastError: null,
      lastSuccessAt: now.toISOString(),
      lastApplied: { storeId: '1', appliedOrders: 3, unitsApplied: 5, reviewLines: 1, shortfallUnits: 1 },
    });
  });

  it('refreshes the product catalogue at most hourly', async () => {
    const { service, observation } = setup();
    await service.tick(new Date('2026-10-21T02:00:00.000Z'));
    await service.tick(new Date('2026-10-21T02:05:00.000Z'));
    await service.tick(new Date('2026-10-21T03:01:00.000Z'));

    expect(observation.importProductMappings).toHaveBeenCalledTimes(2);
    expect(observation.observeOrders).toHaveBeenCalledTimes(3);
  });

  it('also syncs yesterday shortly after midnight in the store time zone', async () => {
    const { service, calls } = setup();

    await service.tick(new Date('2026-10-21T11:20:00.000Z')); // 00:20 on 22 Oct in Auckland

    expect(calls).toEqual(['mappings', 'orders:2026-10-21', 'orders:2026-10-22', 'apply']);
  });

  it('skips a store while a manual sync is running and does not deduct without a baseline', async () => {
    const busy = setup({ running: 1 });
    await busy.service.tick(new Date('2026-10-21T02:00:00.000Z'));
    expect(busy.calls).toEqual([]);

    const noBaseline = setup({ baselineAt: null });
    await noBaseline.service.tick(new Date('2026-10-21T02:00:00.000Z'));
    expect(noBaseline.calls).toEqual(['mappings', 'orders:2026-10-21']);
    expect(noBaseline.application.applyRange).not.toHaveBeenCalled();
  });

  it('records an error instead of deducting when no actor is configured', async () => {
    delete process.env.POS_REALTIME_SYNC_USERNAME;
    const { service, calls } = setup();

    await service.tick(new Date('2026-10-21T02:00:00.000Z'));

    expect(calls).toEqual([]);
    expect(service.status().lastError).toContain('POS_REALTIME_SYNC_USERNAME');
  });

  it('stays disabled unless an interval is configured', () => {
    const previousMinutes = process.env.POS_REALTIME_SYNC_MINUTES;
    delete process.env.POS_REALTIME_SYNC_MINUTES;
    const { service } = setup();
    service.onModuleInit();
    expect(service.status()).toMatchObject({ enabled: false, intervalMinutes: 0 });
    service.onModuleDestroy();
    if (previousMinutes !== undefined) process.env.POS_REALTIME_SYNC_MINUTES = previousMinutes;
  });
});
