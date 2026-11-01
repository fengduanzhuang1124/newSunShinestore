// Store analysis rules for "店铺经营发现" (CR-011): whole-day periods, demand groups judged from what was bought,
// and rule-written highlights. Pure functions so the rules can be tested directly.
import type { ProductCategory } from '../shared/product-taxonomy.js';

const DAY = 86_400_000;
const shiftDate = (date: string, days: number) => new Date(new Date(`${date}T12:00:00.000Z`).getTime() + days * DAY).toISOString().slice(0, 10);

// The last whole day with data. Normally yesterday; when the newest order is older than that (sync stopped, or a copy
// of the database), the day of that order may be incomplete, so the period ends the day before it.
export function dataThroughDate(today: string, lastOrderDate: string | null) {
  const yesterday = shiftDate(today, -1);
  if (!lastOrderDate || lastOrderDate >= yesterday) return { through: yesterday, stale: false };
  return { through: shiftDate(lastOrderDate, -1), stale: true };
}

export const TOURIST = '游客（伴手礼）';
export const GENERAL = '家庭通用';
export const DEMAND_GROUPS = [TOURIST, '婴幼儿', '儿童', '青少年', '孕产', '女性', '男性', '中老年', GENERAL] as const;
// Initial souvenir list (CR-011 §4); the customer may add or remove categories.
const TOURIST_CATEGORIES = new Set(['蜂蜜', '绵羊油系列', '蜂胶与蜂产品保健', '香皂', '喉糖与蜂蜜糖果']);
const GIFT_NAME = /礼盒|伴手礼|\bgift/i;
const IMPLIED_BY_CATEGORY: Record<string, string> = { 婴幼儿与儿童奶粉: '婴幼儿', 母婴用品: '婴幼儿' };
const IMPLIED_BY_FUNCTION: Record<string, string> = {
  儿童成长: '儿童', 孕产: '孕产', 女性健康: '女性', 男性健康: '男性',
  关节: '中老年', 心脑血管: '中老年', 护心: '中老年', 血糖平衡: '中老年', 血压: '中老年', 尿酸与痛风: '中老年',
};

// Who a product is bought for. A product can serve several groups; one that names none is for the whole family.
export function demandGroups(names: (string | null | undefined)[], category: ProductCategory, functions: string[], audiences: string[]) {
  const groups = new Set<string>(audiences);
  if (TOURIST_CATEGORIES.has(category.level2) || GIFT_NAME.test(names.filter(Boolean).join(' '))) groups.add(TOURIST);
  if (IMPLIED_BY_CATEGORY[category.level2]) groups.add(IMPLIED_BY_CATEGORY[category.level2]);
  for (const name of functions) if (IMPLIED_BY_FUNCTION[name]) groups.add(IMPLIED_BY_FUNCTION[name]);
  return groups.size ? DEMAND_GROUPS.filter((group) => groups.has(group)) : [GENERAL];
}

// Percentage of a total, one decimal.
export const percent = (part: number, total: number) => (total > 0 ? Math.round((part / total) * 1000) / 10 : 0);
export const changePercent = (current: number, previous: number | null) => (previous ? Math.round(((current - previous) / previous) * 1000) / 10 : null);

export const centsToAmount = (cents: number) => cents / 100;

type WindowPair<T> = [T, T];
type Level2Cents = Map<string, { level1: string; cents: number }>;
export type CategoryMover = { level1: string; level2: string; revenue: number; previousRevenue: number; delta: number; changePercent: number | null };
export const CATEGORY_MOVER_LIMIT = 6;

// Share of one name in the current window and, when the previous window is complete, in the previous one.
export function shareRow(name: string, values: WindowPair<Map<string, number>>, totals: WindowPair<number>, previousComplete: boolean) {
  return {
    name,
    share: percent(values[0].get(name) ?? 0, totals[0]),
    previousShare: previousComplete ? percent(values[1].get(name) ?? 0, totals[1]) : null,
  };
}

// Level-1 categories by share of list-price revenue, largest first.
export function categoryShares(level1Cents: WindowPair<Map<string, number>>, totals: WindowPair<number>, previousComplete: boolean) {
  const names = new Set([...level1Cents[0].keys(), ...level1Cents[1].keys()]);
  return [...names]
    .map((name) => ({ ...shareRow(name, level1Cents, totals, previousComplete), level1: name, revenue: centsToAmount(level1Cents[0].get(name) ?? 0) }))
    .filter((row) => row.revenue > 0)
    .sort((a, b) => b.revenue - a.revenue);
}

// Level-2 categories that gained or lost the most revenue against the previous window.
export function categoryMovers(level2Cents: WindowPair<Level2Cents>, previousComplete: boolean): { gains: CategoryMover[]; losses: CategoryMover[] } {
  if (!previousComplete) return { gains: [], losses: [] };
  const names = new Set([...level2Cents[0].keys(), ...level2Cents[1].keys()]);
  const rows: CategoryMover[] = [...names].map((level2) => {
    const current = level2Cents[0].get(level2)?.cents ?? 0;
    const previous = level2Cents[1].get(level2)?.cents ?? 0;
    const level1 = level2Cents[0].get(level2)?.level1 ?? level2Cents[1].get(level2)!.level1;
    return { level1, level2, revenue: centsToAmount(current), previousRevenue: centsToAmount(previous), delta: centsToAmount(current - previous), changePercent: changePercent(current, previous) };
  });
  return {
    gains: rows.filter((row) => row.delta > 0).sort((a, b) => b.delta - a.delta).slice(0, CATEGORY_MOVER_LIMIT),
    losses: rows.filter((row) => row.delta < 0).sort((a, b) => a.delta - b.delta).slice(0, CATEGORY_MOVER_LIMIT),
  };
}

// How many orders touched each demand group (an order counts once per group).
export function countGroupOrders(orderGroups: Map<string, Set<string>>) {
  const counts = new Map<string, number>();
  for (const groups of orderGroups.values()) for (const group of groups) counts.set(group, (counts.get(group) ?? 0) + 1);
  return counts;
}

// One row per demand group: order share, list-price revenue and the level-2 category it buys most.
export function demandRows(input: {
  orderGroups: WindowPair<Map<string, Set<string>>>;
  groupCents: WindowPair<Map<string, number>>;
  groupCategoryCents: Map<string, Map<string, number>>;
  orderTotals: WindowPair<number>;
  previousComplete: boolean;
}) {
  const counts: WindowPair<Map<string, number>> = [countGroupOrders(input.orderGroups[0]), countGroupOrders(input.orderGroups[1])];
  return DEMAND_GROUPS.map((group) => {
    const top = [...(input.groupCategoryCents.get(group) ?? new Map<string, number>())].sort((a, b) => b[1] - a[1])[0];
    return {
      ...shareRow(group, counts, input.orderTotals, input.previousComplete),
      group,
      orders: counts[0].get(group) ?? 0,
      revenue: centsToAmount(input.groupCents[0].get(group) ?? 0),
      topCategory: top?.[0] ?? null,
    };
  });
}

// Weekday × hour order counts trimmed to the hours the store had orders, plus the busiest cell.
export function heatmapSummary(heat: number[][]) {
  const hourTotals = Array<number>(24).fill(0);
  let peak: { weekday: number; hour: number; orders: number } | null = null;
  for (let weekday = 0; weekday < heat.length; weekday += 1) {
    for (let hour = 0; hour < 24; hour += 1) {
      const orders = heat[weekday][hour];
      hourTotals[hour] += orders;
      if (orders > (peak?.orders ?? 0)) peak = { weekday, hour, orders };
    }
  }
  const openHours = hourTotals.flatMap((value, hour) => (value > 0 ? [hour] : []));
  const hours = openHours.length ? Array.from({ length: openHours.at(-1)! - openHours[0] + 1 }, (_, k) => openHours[0] + k) : [];
  return { hours, cells: heat.map((row) => hours.map((hour) => row[hour])), peak };
}

// Paid totals for one window; the average order value uses what customers actually paid.
export function periodTotals(paid: { cents: number; orders: number }, units: number, products: number) {
  return { revenue: centsToAmount(paid.cents), orders: paid.orders, units: Math.round(units), avgOrderValue: paid.orders ? Math.round(paid.cents / paid.orders) / 100 : 0, products };
}

export const HIGHLIGHT_SHARE_MIN = { group: 15, category: 25 };
export const HIGHLIGHT_SHARE_POINTS = 3;
export const HIGHLIGHT_DROP_PERCENT = 10;
export const HIGHLIGHT_LIMIT = 5;

const GROUP_ADVICE: Record<string, string> = {
  [TOURIST]: '重视游客产品：增加陈列、备货和礼盒组合',
  中老年: '针对中老年推出商品组合和活动',
  婴幼儿: '加强母婴儿童专区和组合推荐', 儿童: '加强母婴儿童专区和组合推荐', 孕产: '加强母婴儿童专区和组合推荐', 青少年: '做青少年专项推荐',
  女性: '做女性专项推荐', 男性: '做男性专项推荐',
};
const CATEGORY_ADVICE: Record<string, string> = { 护肤品: '增加护肤品广告曝光' };

export type Highlight = { tone: 'urgent' | 'warn' | 'up' | 'down' | 'info'; title: string; text: string; advice: string; action: 'procurement' | 'inventory' | 'demand' | 'categories' | null };
type ShareRow = { name: string; share: number; previousShare: number | null };

// What the store should pay attention to, most urgent first. Shares rise or stand out against fixed thresholds; with
// no complete previous period only the size of a share counts.
export function buildHighlights(input: {
  shortBestSellers: { productName: string; coverageWeeks: number | null }[];
  expiringOverstock: number;
  groups: ShareRow[];
  categories: ShareRow[];
  falling: { level2: string; delta: number; changePercent: number | null } | null;
}): Highlight[] {
  const highlights: Highlight[] = [];
  const [first] = input.shortBestSellers;
  if (first) highlights.push({ tone: 'urgent', title: `热销但库存不足 ${input.shortBestSellers.length} 种`, text: `如 ${first.productName}，现有库存约够 ${first.coverageWeeks ?? 0} 周`, advice: '加入本周进货单', action: 'procurement' });
  if (input.expiringOverstock > 0) highlights.push({ tone: 'warn', title: `临期滞销 ${input.expiringOverstock} 种`, text: '库存多、卖得慢且临近到期', advice: '近期策划清货活动', action: 'inventory' });
  const rise = (row: ShareRow) => (row.previousShare === null ? 0 : row.share - row.previousShare);
  const notable = (row: ShareRow, min: number) => row.share >= min || rise(row) >= HIGHLIGHT_SHARE_POINTS;
  const shareText = (row: ShareRow, noun: string) => `${noun} ${row.share}%${row.previousShare === null ? '' : `（上期 ${row.previousShare}%）`}`;
  const groups = input.groups.filter((row) => GROUP_ADVICE[row.name] && notable(row, HIGHLIGHT_SHARE_MIN.group))
    .sort((a, b) => rise(b) - rise(a) || b.share - a.share).slice(0, 2);
  for (const row of groups) {
    highlights.push({ tone: rise(row) >= HIGHLIGHT_SHARE_POINTS ? 'up' : 'info', title: `${row.name}需求${rise(row) >= HIGHLIGHT_SHARE_POINTS ? '上升' : '较多'}`, text: shareText(row, '相关订单占'), advice: GROUP_ADVICE[row.name], action: 'demand' });
  }
  const category = input.categories.filter((row) => row.name !== '其他' && notable(row, HIGHLIGHT_SHARE_MIN.category))
    .sort((a, b) => Number(Boolean(CATEGORY_ADVICE[b.name])) - Number(Boolean(CATEGORY_ADVICE[a.name])) || rise(b) - rise(a) || b.share - a.share)[0];
  if (category) {
    highlights.push({ tone: rise(category) >= HIGHLIGHT_SHARE_POINTS ? 'up' : 'info', title: `${category.name}${rise(category) >= HIGHLIGHT_SHARE_POINTS ? '占比上升' : '卖得最多'}`, text: shareText(category, '销售额占'), advice: CATEGORY_ADVICE[category.name] ?? `关注${category.name}的备货和陈列`, action: 'categories' });
  }
  const falling = input.falling;
  if (falling && falling.delta < 0 && falling.changePercent !== null && falling.changePercent <= -HIGHLIGHT_DROP_PERCENT) {
    highlights.push({ tone: 'down', title: `${falling.level2}下降最多`, text: `销售额比上期少 NZ$${Math.abs(falling.delta).toFixed(2)}（${falling.changePercent}%）`, advice: '检查是否缺货，或安排活动', action: 'categories' });
  }
  return highlights.slice(0, HIGHLIGHT_LIMIT);
}
