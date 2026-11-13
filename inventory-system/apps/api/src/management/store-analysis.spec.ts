import { buildHighlights, buildSankey, categoryMovers, categoryShares, dataThroughDate, demandGroups, demandRows, GENERAL, heatmapSummary, NO_FUNCTION, periodTotals, TOURIST } from './store-analysis.js';
import { classificationNames, productAudiences, productCategory, productFunctions, storeLabelSub } from '../shared/product-taxonomy.js';

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
    // CR-021 F1: a joint product is for whoever buys it unless the name says who it is for.
    expect(groupsOf('维骨力 Glucosamine 1500mg')).toEqual([GENERAL]);
    expect(groupsOf('Blackmores 中老年 关节灵 50+')).toEqual(['中老年']);
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

describe('people → function flow (CR-021)', () => {
  const entries = [
    // Fish oil for heart and brain, bought for the whole family: split across two functions.
    { productId: '1', cents: 10_000, groups: [], functions: [{ group: '心脑血管', label: '鱼油与 Omega-3' }, { group: '脑与情绪', label: '健脑益智' }], fallback: '保健品' },
    // A product named for women and the elderly: split across two groups.
    { productId: '2', cents: 6_000, groups: ['女性', '中老年'], functions: [{ group: '骨骼关节', label: '补钙与维 D' }], fallback: '保健品' },
    { productId: '3', cents: 3_000, groups: ['游客（伴手礼）'], functions: [], fallback: '食品' },
    { productId: '4', cents: 0, groups: [], functions: [], fallback: '食品' },
  ];

  it('splits revenue evenly so every layer adds up to the total', () => {
    const flow = buildSankey(entries);
    expect(flow.total).toBe(190);
    for (const layer of [0, 1, 2]) {
      const sum = flow.nodes.filter((node) => node.layer === layer).reduce((total, node) => total + node.value, 0);
      expect(sum).toBeCloseTo(190, 1);
    }
    const node = (id: string) => flow.nodes.find((row) => row.id === id);
    expect(node('p:家庭通用')?.value).toBe(100);
    expect(node('g:心脑血管')?.value).toBe(50);
    expect(node('p:女性')?.value).toBe(30);
    expect(node('f:骨骼关节/补钙与维 D')).toMatchObject({ value: 60, group: '骨骼关节', layer: 2 });
    expect(node(`g:${NO_FUNCTION}`)?.value).toBe(30);
    expect(node(`f:${NO_FUNCTION}/食品`)?.value).toBe(30);
    expect(flow.links).toContainEqual({ source: 'p:中老年', target: 'g:骨骼关节', value: 30 });
    expect(flow.links).toContainEqual({ source: 'g:心脑血管', target: 'f:心脑血管/鱼油与 Omega-3', value: 50 });
    expect(flow.flows).toContainEqual({ people: '女性', group: '骨骼关节', label: '补钙与维 D', value: 30 });
  });

  it('orders nodes by layer and value and lists the products behind each node', () => {
    const flow = buildSankey(entries);
    expect(flow.nodes.map((node) => node.layer)).toEqual([...flow.nodes.map((node) => node.layer)].sort());
    expect(flow.nodes.filter((node) => node.layer === 0)[0].name).toBe('家庭通用');
    expect(flow.products['g:骨骼关节']).toEqual([{ productId: '2', revenue: 60 }]);
    expect(flow.products['p:家庭通用']).toEqual([{ productId: '1', revenue: 100 }]);
  });
});

describe('store sub-category labels (REQ-016 A6–A8)', () => {
  const classify = (name: string, storeLabel: string | null) => {
    const names = classificationNames({ name, storeLabel });
    const category = productCategory(names);
    return { category: category.level2, functions: productFunctions(names, category), groups: demandGroups(names, category, productFunctions(names, category), productAudiences(names)) };
  };

  it('recognises functions, categories and the gift mark from the label together with the names', () => {
    expect(classify('Trilogy Certified Organic Rosehip Oil 45ml', '抗皱紧致')).toMatchObject({ category: '面部护理', functions: ['抗皱紧致'] });
    expect(classify('antipodes kiwi gold 30ml', '眼部护理')).toMatchObject({ category: '眼部护理' });
    expect(classify('Anchor Full cream 1kg SF *6', '日常营养')).toMatchObject({ category: '成人奶粉', functions: ['日常营养'] });
    expect(classify('Anchor Blue Milk Powder 1kg', null).functions).toEqual(['日常营养']);
    expect(classify('Healtheries 儿童DHA', '儿童健脑').groups).toContain('儿童');
    expect(classify('Kiwi Bliss 火山泥面膜', '火山泥伴手礼').groups).toContain(TOURIST);
    // A label never replaces a category recognised from the names: honey stays honey.
    expect(classify('Manuka Hunters 15+ 500g', '美容口服').category).toBe('蜂蜜');
  });

  it('takes the first part that is not the gift mark as the sub-category', () => {
    expect(storeLabelSub('香皂/伴手礼')).toBe('香皂');
    expect(storeLabelSub('伴手礼／护手')).toBe('护手');
    expect(storeLabelSub(' 高级洗发 ')).toBe('高级洗发');
    expect(storeLabelSub('伴手礼')).toBeNull();
    expect(storeLabelSub(null)).toBeNull();
  });

  it('shows labelled products without a function under their category and label', () => {
    const flow = buildSankey([
      { productId: '1', cents: 5_000, groups: [], functions: [], fallback: '洗护用品', storeSub: '高级洗发' },
      { productId: '2', cents: 2_000, groups: [], functions: [], fallback: '食品', storeSub: null },
    ]);
    expect(flow.nodes.find((node) => node.id === 'f:洗护用品/高级洗发')).toMatchObject({ layer: 2, name: '高级洗发', group: '洗护用品', value: 50 });
    expect(flow.nodes.find((node) => node.id === `f:${NO_FUNCTION}/食品`)?.value).toBe(20);
  });
});
