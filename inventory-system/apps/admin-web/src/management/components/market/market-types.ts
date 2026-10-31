// REQ-014: shapes returned by GET /management/market-insights and the four market analysis modules.
export type MarketPeriod = 'WEEK' | 'MONTH' | 'QUARTER';
export type MarketModuleId = 'insights' | 'report' | 'trends' | 'campaigns';
export type InsightTab = 'surges' | 'overstock' | 'pairs' | 'categories';

type ProductFact = {
  productId: string; productName: string; brandName: string; level1: string; level2: string;
  currentInventory: number; weeklyUnits: number; coverageWeeks: number | null; inCurrentOrder: boolean;
};
export type SurgeRow = ProductFact & { currentUnits: number; baselineUnits: number; ratio: number | null; newlyRising: boolean };
export type OverstockRow = ProductFact & { reason: 'COVERAGE' | 'NO_SALE'; daysSinceLastSale: number | null; nearestExpiry: string | null; expiring: boolean };
export type PairRow = { orders: number; products: { productId: string; productName: string; share: number }[] };
export type CategoryRow = { level1: string; level2: string; currentUnits: number; previousUnits: number; changePercent: number | null; trend: 'UP' | 'DOWN' | 'FLAT' };

export type MarketInsights = {
  generatedAt: string;
  period: { type: MarketPeriod; days: number; from: string; to: string; previousFrom: string; previousTo: string; baselineWindows: number; previousComplete: boolean; historyDays: number };
  summary: {
    surgeProducts: number; newlyRisingProducts: number; overstockProducts: number; expiringOverstockProducts: number;
    pairs: number; risingCategories: number; fallingCategories: number; categoryCoverage: { identified: number; total: number };
  };
  surges: SurgeRow[]; overstock: OverstockRow[]; pairs: PairRow[]; categories: CategoryRow[];
  rules: { surge: string; overstock: string; pairs: string; category: string };
};

export type MarketModule = {
  id: MarketModuleId; title: string; english: string; summary: string; ready: boolean;
  // Two gradient stops for the card art, as "r g b".
  tint: [string, string];
};

export const MARKET_MODULES: MarketModule[] = [
  { id: 'insights', title: '店铺经营发现', english: 'STORE INSIGHTS', summary: '突然热销 · 超量滞销 · 常一起买 · 品类升降', ready: true, tint: ['40 150 220', '128 220 255'] },
  { id: 'report', title: 'AI 销售报告', english: 'AI SALES REPORT', summary: '周报 · 月报 · 季报，每条建议附依据', ready: false, tint: ['118 82 230', '196 160 255'] },
  { id: 'trends', title: '行业趋势', english: 'INDUSTRY TRENDS', summary: '国内 · 澳新 · 小红书 · 全球', ready: false, tint: ['226 132 30', '255 206 110'] },
  { id: 'campaigns', title: '活动策划', english: 'CAMPAIGNS', summary: '策划 · 清货 · 趋势活动，价格由你决定', ready: false, tint: ['42 160 104', '150 236 186'] },
];

export const PERIOD_LABEL: Record<MarketPeriod, string> = { WEEK: '近 7 天', MONTH: '近 30 天', QUARTER: '近 91 天' };
