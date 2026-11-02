// Store findings for the market analysis page (REQ-014 §4.3): sudden best sellers, overstock, products bought
// together and category trends. Pure functions over already-loaded sales so the rules can be tested directly.
import { changePercent } from './store-analysis.js';

export type MarketPeriod = 'WEEK' | 'MONTH' | 'QUARTER';
// Rolling windows ending today: a calendar week or month still in progress would always look like a drop.
export const PERIOD_DAYS: Record<MarketPeriod, number> = { WEEK: 7, MONTH: 30, QUARTER: 91 };
// The current window plus the four before it, which form the baseline for sudden best sellers.
export const WINDOW_COUNT = 5;

export const SURGE_MIN_UNITS = 5;
export const SURGE_RATIO = 1.5;
// Below one unit per window the earlier sales are too thin to compare with (often products only recently matched to
// the POS or merged), so these are reported as newly rising rather than as a huge multiple.
export const SURGE_MIN_BASELINE = 1;
export const OVERSTOCK_WEEKS = 12;
export const NO_SALE_DAYS = 60;
export const PAIR_MIN_ORDERS = 5;
export const PAIR_LIMIT = 20;
export const CATEGORY_TREND_PERCENT = 10;
export const CATEGORY_TREND_MIN_UNITS = 10;

const DAY = 86_400_000;

// Window boundaries, newest first: boundaries[0] is the end of today and window k runs from boundaries[k + 1] up to
// boundaries[k]. `dayStart` turns a calendar date into the instant it starts in the store's time zone, so windows
// stay whole days across daylight-saving changes.
export function windowBoundaries(today: string, days: number, dayStart: (date: string) => Date) {
  const noon = new Date(`${today}T12:00:00.000Z`);
  return Array.from({ length: WINDOW_COUNT + 1 }, (_, k) => dayStart(new Date(noon.getTime() + (1 - k * days) * DAY).toISOString().slice(0, 10)));
}

// Which window a sale falls in: 0 is the current window, 1 the one before, and so on; -1 when outside all of them.
export function windowIndex(orderedAt: Date, boundaries: Date[]) {
  for (let k = 0; k < boundaries.length - 1; k += 1) {
    if (orderedAt < boundaries[k] && orderedAt >= boundaries[k + 1]) return k;
  }
  return -1;
}

// Whether sales history covers window k completely.
export function windowCovered(boundaries: Date[], k: number, firstSaleAt: Date | null) {
  return firstSaleAt !== null && boundaries[k + 1] >= firstSaleAt;
}

// Earlier windows count towards the baseline only when sales history covers them completely.
export function baselineWindows(boundaries: Date[], firstSaleAt: Date | null) {
  let count = 0;
  for (let k = 1; k < WINDOW_COUNT; k += 1) if (windowCovered(boundaries, k, firstSaleAt)) count += 1;
  return count;
}

export type Surge = { productId: string; currentUnits: number; baselineUnits: number; ratio: number | null; newlyRising: boolean };

// Sold at least five in this window and at least 1.5 times the average of the earlier windows. Products with
// (almost) no earlier sales are reported as newly rising instead of with an inflated ratio.
export function findSurges(units: Map<string, number[]>, baselineCount: number): Surge[] {
  if (baselineCount < 1) return [];
  const surges: Surge[] = [];
  for (const [productId, windows] of units) {
    const currentUnits = windows[0] ?? 0;
    if (currentUnits < SURGE_MIN_UNITS) continue;
    const baselineUnits = Math.round((windows.slice(1, baselineCount + 1).reduce((sum, value) => sum + value, 0) / baselineCount) * 10) / 10;
    if (baselineUnits < SURGE_MIN_BASELINE) surges.push({ productId, currentUnits, baselineUnits, ratio: null, newlyRising: true });
    else if (currentUnits >= baselineUnits * SURGE_RATIO) {
      surges.push({ productId, currentUnits, baselineUnits, ratio: Math.round((currentUnits / baselineUnits) * 10) / 10, newlyRising: false });
    }
  }
  return surges.sort((a, b) => Number(a.newlyRising) - Number(b.newlyRising) || (b.ratio ?? 0) - (a.ratio ?? 0) || b.currentUnits - a.currentUnits);
}

export type Overstock = { productId: string; coverageWeeks: number | null; daysSinceLastSale: number | null; reason: 'COVERAGE' | 'NO_SALE' };

// In stock and either twelve weeks or more of stock at the last 28 days' pace, or unsold for 60 days. "Unsold" is only
// judged once sales history is at least that long.
export function overstockReason(stock: number, unitsLast28Days: number, lastSoldAt: Date | null, now: Date, historyDays: number): Overstock['reason'] | null {
  if (stock <= 0) return null;
  const weekly = unitsLast28Days / 4;
  if (weekly > 0 && stock / weekly >= OVERSTOCK_WEEKS) return 'COVERAGE';
  const daysSince = lastSoldAt ? (now.getTime() - lastSoldAt.getTime()) / DAY : null;
  if (historyDays >= NO_SALE_DAYS && (daysSince === null || daysSince >= NO_SALE_DAYS)) return 'NO_SALE';
  return null;
}

export type Pair = { productIds: [string, string]; orders: number; shares: [number, number] };

// Two products in the same order. `shares` is the percentage of each product's orders that also contained the other.
export function findPairs(orders: Iterable<Set<string>>): Pair[] {
  const pairCounts = new Map<string, number>();
  const productOrders = new Map<string, number>();
  for (const products of orders) {
    const ids = [...products].sort();
    for (const id of ids) productOrders.set(id, (productOrders.get(id) ?? 0) + 1);
    for (let i = 0; i < ids.length; i += 1) {
      for (let j = i + 1; j < ids.length; j += 1) {
        const key = `${ids[i]}|${ids[j]}`;
        pairCounts.set(key, (pairCounts.get(key) ?? 0) + 1);
      }
    }
  }
  const share = (count: number, id: string) => Math.round((count / (productOrders.get(id) ?? count)) * 100);
  return [...pairCounts]
    .filter(([, count]) => count >= PAIR_MIN_ORDERS)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, PAIR_LIMIT)
    .map(([key, count]) => {
      const [a, b] = key.split('|') as [string, string];
      return { productIds: [a, b], orders: count, shares: [share(count, a), share(count, b)] };
    });
}

export type CategoryTrend = { level1: string; level2: string; currentUnits: number; previousUnits: number; changePercent: number | null; trend: 'UP' | 'DOWN' | 'FLAT' };

// Without a complete previous window there is nothing fair to compare with, so no change is reported.
export function categoryTrends(rows: { level1: string; level2: string; currentUnits: number; previousUnits: number }[], previousComplete = true): CategoryTrend[] {
  const grouped = new Map<string, { level1: string; level2: string; currentUnits: number; previousUnits: number }>();
  for (const row of rows) {
    const key = `${row.level1}/${row.level2}`;
    const entry = grouped.get(key) ?? { level1: row.level1, level2: row.level2, currentUnits: 0, previousUnits: 0 };
    entry.currentUnits += row.currentUnits;
    entry.previousUnits += row.previousUnits;
    grouped.set(key, entry);
  }
  return [...grouped.values()]
    .filter((row) => row.currentUnits > 0 || row.previousUnits > 0)
    .map((row) => {
      const change = previousComplete ? changePercent(row.currentUnits, row.previousUnits) : null;
      const significant = Math.max(row.currentUnits, row.previousUnits) >= CATEGORY_TREND_MIN_UNITS;
      const trend = change !== null && significant && change >= CATEGORY_TREND_PERCENT ? 'UP' as const
        : change !== null && significant && change <= -CATEGORY_TREND_PERCENT ? 'DOWN' as const : 'FLAT' as const;
      return { ...row, changePercent: change, trend };
    })
    .sort((a, b) => b.currentUnits - a.currentUnits);
}
