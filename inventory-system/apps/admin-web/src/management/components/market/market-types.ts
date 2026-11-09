// REQ-014: shapes returned by GET /management/market-insights and the four market analysis modules.
export type MarketPeriod = 'WEEK' | 'MONTH' | 'QUARTER';
export type MarketModuleId = 'insights' | 'report' | 'trends' | 'campaigns';
// CR-011: the cards of the store insights card wall, and the lists under 商品榜.
export type InsightTab = 'overview' | 'products' | 'mix' | 'pairs';
export const INSIGHT_TABS: { id: InsightTab; label: string }[] = [
  { id: 'overview', label: '经营画像' }, { id: 'products', label: '商品榜' }, { id: 'mix', label: '品类与时段' }, { id: 'pairs', label: '连带购买' },
];
export type ProductList = 'top' | 'surges' | 'falling' | 'short' | 'overstock';
type ProductFact = {
  productId: string; productName: string; brandName: string; level1: string; level2: string;
  currentInventory: number; weeklyUnits: number; coverageWeeks: number | null; inCurrentOrder: boolean;
};
export type SurgeRow = ProductFact & { currentUnits: number; baselineUnits: number; ratio: number | null; newlyRising: boolean };
export type OverstockRow = ProductFact & { reason: 'COVERAGE' | 'NO_SALE'; daysSinceLastSale: number | null; nearestExpiry: string | null; expiring: boolean };
export type PairRow = { orders: number; products: { productId: string; productName: string; share: number }[] };
export type RankedRow = ProductFact & { revenue: number; units: number; previousUnits: number; history: number[]; changePercent: number | null };
type Totals = { revenue: number; orders: number; units: number; avgOrderValue: number; products: number };
type ShareRow = { share: number; previousShare: number | null };
export type Highlight = { tone: 'urgent' | 'warn' | 'up' | 'down' | 'info'; title: string; text: string; advice: string; action: 'procurement' | 'inventory' | 'demand' | 'categories' | null };
export type CategoryMover = { level1: string; level2: string; revenue: number; previousRevenue: number; delta: number; changePercent: number | null };
// CR-021: people → function group → function. Node ids are p:/g:/f: prefixed; values are list-price revenue.
export type SankeyNode = { id: string; layer: 0 | 1 | 2; name: string; group: string | null; value: number };
export type SankeyProduct = ProductFact & { revenue: number; units: number };
export type SankeyData = {
  total: number; nodes: SankeyNode[]; links: { source: string; target: string; value: number }[];
  flows: { people: string; group: string; label: string; value: number }[]; products: Record<string, SankeyProduct[]>;
};
export type CategoryRow = { level1: string; level2: string; currentUnits: number; previousUnits: number; changePercent: number | null; trend: 'UP' | 'DOWN' | 'FLAT' };

export type MarketInsights = {
  generatedAt: string;
  period: { type: MarketPeriod; days: number; from: string; to: string; previousFrom: string; previousTo: string; baselineWindows: number; previousComplete: boolean; historyDays: number; dataThrough: string; stale: boolean };
  overview: { current: Totals; previous: Totals | null; history: { revenue: number[]; orders: number[] } };
  daily: { dates: string[]; current: { revenue: number; orders: number }[]; previous: { revenue: number; orders: number }[] | null };
  categoryShare: (ShareRow & { level1: string; revenue: number })[];
  categoryMovers: { gains: CategoryMover[]; losses: CategoryMover[] };
  demand: { orders: number; rows: (ShareRow & { group: string; orders: number; revenue: number; topCategory: string | null })[] };
  sankey?: SankeyData;
  heatmap: { hours: number[]; cells: number[][]; peak: { weekday: number; hour: number; orders: number } | null };
  rankings: { top: RankedRow[]; falling: RankedRow[] };
  highlights: Highlight[];
  summary: {
    surgeProducts: number; newlyRisingProducts: number; overstockProducts: number; expiringOverstockProducts: number;
    pairs: number; risingCategories: number; fallingCategories: number; categoryCoverage: { identified: number; total: number };
  };
  surges: SurgeRow[]; overstock: OverstockRow[]; pairs: PairRow[]; categories: CategoryRow[];
  rules: { revenue: string; demand: string; sankey?: string; surge: string; overstock: string; pairs: string; category: string };
};

export type MarketModule = {
  id: MarketModuleId; title: string; english: string; summary: string; ready: boolean;
  // Two gradient stops for the card art, as "r g b".
  tint: [string, string];
};

export const MARKET_MODULES: MarketModule[] = [
  { id: 'insights', title: '店铺经营发现', english: 'STORE INSIGHTS', summary: '买了什么 · 为谁买 · 经营重点', ready: true, tint: ['40 150 220', '128 220 255'] },
  { id: 'report', title: 'AI 销售报告', english: 'AI SALES REPORT', summary: '周报 · 月报 · 季报，每条建议附依据', ready: false, tint: ['118 82 230', '196 160 255'] },
  { id: 'trends', title: '行业趋势', english: 'INDUSTRY TRENDS', summary: '国内 · 澳新 · 小红书 · 全球', ready: false, tint: ['226 132 30', '255 206 110'] },
  { id: 'campaigns', title: '活动策划', english: 'CAMPAIGNS', summary: '策划 · 清货 · 趋势活动，价格由你决定', ready: false, tint: ['42 160 104', '150 236 186'] },
];

export const PERIOD_LABEL: Record<MarketPeriod, string> = { WEEK: '近 7 天', MONTH: '近 30 天', QUARTER: '近 91 天' };

// Fixed colour slot per first-level category, so a category keeps its colour whatever the period or filter.
export const LEVEL1_SLOT: Record<string, number> = { 保健品: 1, 护肤品: 2, 食品: 3, 奶粉与乳制品: 4, 洗护用品: 5, 日用品: 6, 家庭常备: 7 };
export const WEEKDAYS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

// Whole dollars for the market pages, e.g. NZ$80,738 (the analysis compares sizes, cents add nothing).
const NZD = new Intl.NumberFormat('en-NZ', { style: 'currency', currency: 'NZD', maximumFractionDigits: 0 });
export const marketMoney = (value: number) => NZD.format(value).replace('$', 'NZ$');
