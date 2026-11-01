import { buildHighlights, categoryMovers, categoryShares, dataThroughDate, demandGroups, demandRows, GENERAL, heatmapSummary, periodTotals, TOURIST } from './store-analysis.js';
import { productAudiences, productCategory, productFunctions } from '../shared/product-taxonomy.js';

const groupsOf = (name: string) => {
  const category = productCategory([name]);
  return demandGroups([name], category, productFunctions([name], category), productAudiences([name]));
};

describe('store analysis (CR-011)', () => {
  it('ends periods on the last whole day with data', () => {
    expect(dataThroughDate('2026-10-31', '2026-10-31')).toEqual({ through: '2026-10-30', stale: false });
    expect(dataThroughDate('2026-10-31', '2026-10-30')).toEqual({ through: '2026-10-30', stale: false });
    // A copy of the database taken on the morning of the 27th: that day is incomplete.
    expect(dataThroughDate('2026-10-31', '2026-10-27')).toEqual({ through: '2026-10-26', stale: true });
    expect(dataThroughDate('2026-11-01', null)).toEqual({ through: '2026-10-31', stale: false });
  });

  it('judges demand groups from what was bought; one product can serve several groups', () => {
    expect(groupsOf('Manuka Health 麦卢卡蜂蜜 UMF10+ 500g')).toEqual([TOURIST]);
    expect(groupsOf('Lanocreme 绵羊油 100g')).toEqual([TOURIST]);
    expect(groupsOf('Elevit 爱乐维女性综合叶酸100片')).toEqual(expect.arrayContaining(['孕产', '女性']));
    expect(groupsOf('维骨力 Glucosamine 1500mg')).toEqual(['中老年']);
    expect(groupsOf('Aptamil 爱他美 3段 900g')).toEqual(['婴幼儿']);
    expect(groupsOf('Ostelin 儿童维生素D')).toEqual(['儿童']);
    expect(groupsOf('Swisse 维生素C 泡腾片')).toEqual([GENERAL]);
  });

  it('writes highlights by urgency, rising groups and categories, with the advice the store agreed', () => {
    const highlights = buildHighlights({
      shortBestSellers: [{ productName: '护手霜', coverageWeeks: 0.5 }],
      expiringOverstock: 3,
      groups: [
        { name: TOURIST, share: 30, previousShare: 24 },
        { name: '中老年', share: 18, previousShare: 18 },
        { name: '男性', share: 5, previousShare: 4 },
        { name: GENERAL, share: 60, previousShare: 70 },
      ],
      categories: [{ name: '保健品', share: 45, previousShare: 46 }, { name: '护肤品', share: 26, previousShare: 20 }],
      falling: { level2: '鱼油与 Omega-3', delta: -320.5, changePercent: -22.4 },
    });
    expect(highlights.map((row) => row.title)).toEqual(['热销但库存不足 1 种', '临期滞销 3 种', '游客（伴手礼）需求上升', '中老年需求较多', '护肤品占比上升']);
    expect(highlights[2].advice).toContain('游客产品');
    expect(highlights[3].advice).toContain('中老年');
    expect(highlights[4].advice).toBe('增加护肤品广告曝光');
  });

  it('only compares shares when the previous period is complete, and reports the biggest drop', () => {
    const highlights = buildHighlights({
      shortBestSellers: [], expiringOverstock: 0,
      groups: [{ name: TOURIST, share: 10, previousShare: null }],
      categories: [{ name: '食品', share: 30, previousShare: null }],
      falling: { level2: '蜂蜜', delta: -100, changePercent: -15 },
    });
    expect(highlights.map((row) => row.title)).toEqual(['食品卖得最多', '蜂蜜下降最多']);
    expect(highlights[1].text).toBe('销售额比上期少 NZ$100.00（-15%）');
  });

  it('compares category revenue with the previous window only when that window is complete', () => {
    const level1: [Map<string, number>, Map<string, number>] = [new Map([['护肤品', 3000], ['保健品', 7000]]), new Map([['保健品', 8000]])];
    expect(categoryShares(level1, [10000, 8000], true)).toEqual([
      { name: '保健品', share: 70, previousShare: 100, level1: '保健品', revenue: 70 },
      { name: '护肤品', share: 30, previousShare: 0, level1: '护肤品', revenue: 30 },
    ]);
    expect(categoryShares(level1, [10000, 8000], false)[0].previousShare).toBeNull();

    const level2: [Map<string, { level1: string; cents: number }>, Map<string, { level1: string; cents: number }>] = [
      new Map([['面部护理', { level1: '护肤品', cents: 5000 }]]), new Map([['美容口服', { level1: '保健品', cents: 2000 }]]),
    ];
    const movers = categoryMovers(level2, true);
    expect(movers.gains.map((row) => [row.level2, row.delta])).toEqual([['面部护理', 50]]);
    expect(movers.losses.map((row) => [row.level2, row.delta, row.changePercent])).toEqual([['美容口服', -20, -100]]);
    expect(categoryMovers(level2, false)).toEqual({ gains: [], losses: [] });
  });

  it('counts each order once per demand group and names the category each group buys most', () => {
    const rows = demandRows({
      orderGroups: [new Map([['o1', new Set([TOURIST, '中老年'])], ['o2', new Set([TOURIST])]]), new Map()],
      groupCents: [new Map([[TOURIST, 4000]]), new Map()],
      groupCategoryCents: new Map([[TOURIST, new Map([['蜂蜜', 3000], ['香皂', 1000]])]]),
      orderTotals: [2, 0],
      previousComplete: false,
    });
    const tourist = rows.find((row) => row.group === TOURIST)!;
    expect(tourist).toMatchObject({ orders: 2, share: 100, previousShare: null, revenue: 40, topCategory: '蜂蜜' });
    expect(rows.find((row) => row.group === '中老年')).toMatchObject({ orders: 1, share: 50 });
  });

  it('trims the heatmap to open hours and reports the busiest cell', () => {
    const heat = Array.from({ length: 7 }, () => Array<number>(24).fill(0));
    heat[0][10] = 2;
    heat[5][14] = 6;
    const summary = heatmapSummary(heat);
    expect(summary.hours).toEqual([10, 11, 12, 13, 14]);
    expect(summary.cells[5]).toEqual([0, 0, 0, 0, 6]);
    expect(summary.peak).toEqual({ weekday: 5, hour: 14, orders: 6 });
    expect(heatmapSummary(Array.from({ length: 7 }, () => Array<number>(24).fill(0)))).toEqual({ hours: [], cells: [[], [], [], [], [], [], []], peak: null });
  });

  it('uses paid amounts for window totals', () => {
    expect(periodTotals({ cents: 10050, orders: 3 }, 7.4, 5)).toEqual({ revenue: 100.5, orders: 3, units: 7, avgOrderValue: 33.5, products: 5 });
    expect(periodTotals({ cents: 0, orders: 0 }, 0, 0).avgOrderValue).toBe(0);
  });
});
