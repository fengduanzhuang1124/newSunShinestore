import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { PosInventoryApplicationService } from './pos-inventory-application.service.js';
import { PosObservationService } from './pos-observation.service.js';

const MAPPING_REFRESH_MS = 60 * 60 * 1000;
const STALE_RUN_MS = 30 * 60 * 1000;
const FIRST_TICK_DELAY_MS = 15 * 1000;

type SyncStore = { id: bigint; organizationId: bigint; organization: { timezone: string } };

export interface PosRealtimeSyncStatus {
  enabled: boolean;
  intervalMinutes: number;
  lastTickAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
  lastApplied: { storeId: string; appliedOrders: number; unitsApplied: number; reviewLines: number; shortfallUnits: number } | null;
}

// Keeps stock in step with POS sales: on a timer it refreshes product mappings (hourly), reads today's orders
// from the read-only POS API and deducts every paid order after the store's inventory baseline.
// Disabled unless POS_REALTIME_SYNC_MINUTES > 0; only one API instance should enable it.
@Injectable()
export class PosRealtimeSyncService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PosRealtimeSyncService.name);
  private timer?: NodeJS.Timeout;
  private firstTick?: NodeJS.Timeout;
  private ticking = false;
  private readonly mappingRefreshedAt = new Map<string, number>();
  private readonly mappingRefreshing = new Set<string>();
  private readonly state: PosRealtimeSyncStatus = {
    enabled: false, intervalMinutes: 0, lastTickAt: null, lastSuccessAt: null, lastError: null, lastApplied: null,
  };

  constructor(
    private readonly prisma: PrismaService,
    private readonly observation: PosObservationService,
    private readonly application: PosInventoryApplicationService,
  ) {}

  onModuleInit() {
    const minutes = this.intervalMinutes();
    this.state.intervalMinutes = minutes;
    this.state.enabled = minutes > 0;
    if (!minutes) return;
    this.firstTick = setTimeout(() => void this.tick(), FIRST_TICK_DELAY_MS);
    this.timer = setInterval(() => void this.tick(), minutes * 60 * 1000);
    this.firstTick.unref?.();
    this.timer.unref?.();
    this.logger.log(`POS realtime sync every ${minutes} minute(s)`);
  }

  onModuleDestroy() {
    clearTimeout(this.firstTick);
    clearInterval(this.timer);
  }

  status(): PosRealtimeSyncStatus {
    return { ...this.state, lastApplied: this.state.lastApplied ? { ...this.state.lastApplied } : null };
  }

  async tick(now = new Date()) {
    if (this.ticking) return;
    this.ticking = true;
    this.state.lastTickAt = now.toISOString();
    try {
      const userId = await this.actorId();
      const stores = await this.prisma.client.store.findMany({
        where: { status: 'ACTIVE', posSyncCursors: { some: {} } },
        select: { id: true, organizationId: true, organization: { select: { timezone: true } } },
      });
      for (const store of stores) await this.syncStore(store, userId, now);
      this.state.lastSuccessAt = now.toISOString();
      this.state.lastError = null;
    } catch (error) {
      this.state.lastError = error instanceof Error ? error.message : String(error);
      this.logger.error(`POS realtime sync failed: ${this.state.lastError}`);
    } finally {
      this.ticking = false;
    }
  }

  // Refreshes product mappings for a store at most hourly unless forced; returns false when skipped.
  async refreshMappings(organizationId: bigint, storeId: bigint, force = false, now = new Date()) {
    const key = storeId.toString();
    const last = this.mappingRefreshedAt.get(key);
    if (this.mappingRefreshing.has(key) || (!force && last !== undefined && now.getTime() - last < MAPPING_REFRESH_MS)) return false;
    this.mappingRefreshing.add(key);
    try {
      await this.observation.importProductMappings(organizationId, storeId);
      this.mappingRefreshedAt.set(key, now.getTime());
      return true;
    } finally {
      this.mappingRefreshing.delete(key);
    }
  }

  // Manual syncs return immediately; the slower catalogue refresh continues in the background.
  refreshMappingsInBackground(organizationId: bigint, storeId: bigint) {
    void this.refreshMappings(organizationId, storeId, true).catch((error: unknown) => {
      this.logger.error(`POS mapping refresh failed for store ${storeId}: ${error instanceof Error ? error.message : String(error)}`);
    });
  }

  private async syncStore(store: SyncStore, userId: bigint, now: Date) {
    const running = await this.prisma.client.posSyncRun.count({
      where: { storeId: store.id, status: 'RUNNING', startedAt: { gte: new Date(now.getTime() - STALE_RUN_MS) } },
    });
    if (running) return;

    // Mappings first so products newly listed in POS are linked before their sales are read and deducted.
    await this.refreshMappings(store.organizationId, store.id, false, now);
    for (const date of this.datesToSync(now, store.organization.timezone)) {
      await this.observation.observeOrders(store.organizationId, store.id, date, { reconcile: true });
    }

    const baseline = await this.application.resolveBaseline(store.id);
    if (!baseline) {
      this.logger.warn(`Store ${store.id} has no POS inventory baseline; sales were synced but not deducted`);
      return;
    }
    const result = await this.application.applyRange(store.organizationId, userId, store.id, baseline, now);
    // Lines that were unmapped when applied are deducted once their POS product gets mapped; short lines wait for a person.
    await this.application.reapplyNewlyMapped(store.organizationId, userId, store.id);
    this.state.lastApplied = {
      storeId: store.id.toString(),
      appliedOrders: result.summary.appliedOrders,
      unitsApplied: result.summary.unitsApplied,
      reviewLines: result.summary.reviewLines,
      shortfallUnits: result.summary.shortfallUnits,
    };
  }

  // Today in the store's zone; shortly after midnight also yesterday, so late orders are not missed.
  private datesToSync(now: Date, timeZone: string) {
    const date = (value: Date) => new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(value);
    const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', hourCycle: 'h23' }).format(now));
    return hour < 1 ? [date(new Date(now.getTime() - 86_400_000)), date(now)] : [date(now)];
  }

  private async actorId() {
    const username = process.env.POS_REALTIME_SYNC_USERNAME?.trim();
    if (!username) throw new Error('POS_REALTIME_SYNC_USERNAME is required to attribute automatic deductions');
    const user = await this.prisma.client.user.findFirst({ where: { username, status: 'ACTIVE' }, select: { id: true } });
    if (!user) throw new Error(`POS_REALTIME_SYNC_USERNAME ${username} is not an active user`);
    return user.id;
  }

  private intervalMinutes() {
    const minutes = Number(process.env.POS_REALTIME_SYNC_MINUTES ?? 0);
    return Number.isInteger(minutes) && minutes > 0 ? minutes : 0;
  }
}
