import { baselineWindows, categoryTrends, findPairs, findSurges, overstockReason, windowBoundaries, windowIndex } from './market-insights.js';
import { calendarDateStart } from '../shared/calendar-date.js';
import { productAudiences, productCategory, productFunctions } from '../shared/product-taxonomy.js';

const DAY = 86_400_000;
const end = new Date('2026-10-31T11:00:00.000Z');
const daysAgo = (days: number) => new Date(end.getTime() - days * DAY);

describe('market insights', () => {
  const auckland = (date: string) => calendarDateStart(date, 'Pacific/Auckland');

  it('places sales in whole-day rolling windows ending today, across daylight saving', () => {
    // 31 Oct 2026 in Auckland; daylight saving started on 27 Sep.
    const quarter = windowBoundaries('2026-10-31', 91, auckland);
    expect(quarter[0].toISOString()).toBe('2026-10-31T11:00:00.000Z'); // 1 Nov 00:00 NZDT
    expect(quarter[1].toISOString()).toBe('2026-08-01T12:00:00.000Z'); // 2 Aug 00:00 NZST
    const week = windowBoundaries('2026-10-31', 7, auckland);
    expect(windowIndex(new Date('2026-10-31T10:59:00.000Z'), week)).toBe(0);
    expect(windowIndex(new Date('2026-10-24T11:00:00.000Z'), week)).toBe(0); // 25 Oct 00:00
    expect(windowIndex(new Date('2026-10-24T10:59:00.000Z'), week)).toBe(1);
    expect(windowIndex(new Date('2026-09-25T00:00:00.000Z'), week)).toBe(-1);
    expect(windowIndex(new Date('2026-10-31T11:00:00.000Z'), week)).toBe(-1);
  });

  it('only uses earlier windows that sales history fully covers', () => {
    const week = windowBoundaries('2026-10-31', 7, auckland);
    expect(baselineWindows(week, daysAgo(400))).toBe(4);
    expect(baselineWindows(windowBoundaries('2026-10-31', 30, auckland), daysAgo(70))).toBe(1);
    expect(baselineWindows(windowBoundaries('2026-10-31', 91, auckland), daysAgo(158))).toBe(0);
    expect(baselineWindows(week, null)).toBe(0);
  });

  it('finds sudden best sellers at five units and 1.5 times the earlier average', () => {
    const units = new Map([
      ['steady', [10, 9, 10, 11, 10]],
      ['surge', [12, 4, 4, 4, 4]],
      ['edge', [6, 4, 4, 4, 4]],
      ['small', [4, 1, 0, 0, 0]],
      ['new', [8, 0, 0, 0, 0]],
      ['thin', [9, 1, 0, 1, 0]],
    ]);
    expect(findSurges(units, 4)).toEqual([
      { productId: 'surge', currentUnits: 12, baselineUnits: 4, ratio: 3, newlyRising: false },
      { productId: 'edge', currentUnits: 6, baselineUnits: 4, ratio: 1.5, newlyRising: false },
      { productId: 'thin', currentUnits: 9, baselineUnits: 0.5, ratio: null, newlyRising: true },
      { productId: 'new', currentUnits: 8, baselineUnits: 0, ratio: null, newlyRising: true },
    ]);
    // With one earlier window only that window is the baseline.
    expect(findSurges(new Map([['p', [8, 6, 0, 0, 0]]]), 1)).toEqual([]);
    expect(findSurges(units, 0)).toEqual([]);
  });

  it('flags overstock at twelve weeks of stock or sixty days unsold', () => {
    const now = end;
    expect(overstockReason(60, 20, daysAgo(1), now, 150)).toBe('COVERAGE'); // 5 a week, 12 weeks
    expect(overstockReason(59, 20, daysAgo(1), now, 150)).toBeNull();
    expect(overstockReason(3, 0, daysAgo(61), now, 150)).toBe('NO_SALE');
    expect(overstockReason(3, 0, null, now, 150)).toBe('NO_SALE');
    // Too little history to call anything unsold.
    expect(overstockReason(3, 0, null, now, 40)).toBeNull();
    expect(overstockReason(0, 0, null, now, 150)).toBeNull();
  });

  it('counts products bought together from five shared orders', () => {
    const orders = [
      ...Array.from({ length: 5 }, () => new Set(['fish', 'calcium'])),
      ...Array.from({ length: 5 }, () => new Set(['fish'])),
      new Set(['fish', 'lanolin']),
    ];
    expect(findPairs(orders)).toEqual([{ productIds: ['calcium', 'fish'], orders: 5, shares: [100, 45] }]);
  });

  it('compares category sales with the previous window and ignores small categories', () => {
    expect(categoryTrends([
      { level1: '保健品', level2: '鱼油与 Omega-3', currentUnits: 30, previousUnits: 20 },
      { level1: '保健品', level2: '鱼油与 Omega-3', currentUnits: 3, previousUnits: 0 },
      { level1: '护肤品', level2: '面膜', currentUnits: 4, previousUnits: 8 },
      { level1: '食品', level2: '蜂蜜', currentUnits: 0, previousUnits: 12 },
      { level1: '日用品', level2: '口腔护理', currentUnits: 5, previousUnits: 0 },
    ])).toEqual([
      { level1: '保健品', level2: '鱼油与 Omega-3', currentUnits: 33, previousUnits: 20, changePercent: 65, trend: 'UP' },
      { level1: '日用品', level2: '口腔护理', currentUnits: 5, previousUnits: 0, changePercent: null, trend: 'FLAT' },
      { level1: '护肤品', level2: '面膜', currentUnits: 4, previousUnits: 8, changePercent: -50, trend: 'FLAT' },
      { level1: '食品', level2: '蜂蜜', currentUnits: 0, previousUnits: 12, changePercent: -100, trend: 'DOWN' },
    ]);
    expect(categoryTrends([{ level1: '食品', level2: '蜂蜜', currentUnits: 30, previousUnits: 12 }], false))
      .toEqual([{ level1: '食品', level2: '蜂蜜', currentUnits: 30, previousUnits: 12, changePercent: null, trend: 'FLAT' }]);
  });
});

describe('product taxonomy', () => {
  it.each([
    ['red seal 蜂胶 牙膏100g', '日用品', '口腔护理'],
    ['alpine 绵羊油护手霜', '护肤品', '手部护理'],
    ['Comvita 康维他 麦卢卡蜂蜜 Lozenges with 蜂胶', '食品', '喉糖与蜂蜜糖果'],
    ['MANUKA DOCTOR MGO40+ 250g', '食品', '蜂蜜'],
    ['Lumea VitaminE 面霜50ml', '护肤品', '面部护理'],
    ['Gohealthy 鱼油 2000mg 230粒', '保健品', '鱼油与 Omega-3'],
    ['gohealthy辅酶300mg 60s', '保健品', '辅酶与抗氧化营养素'],
    ['Anchor Blue Milk Powder 1kg', '奶粉与乳制品', '成人奶粉'],
    ['HAAB 绵羊油 霜 150g', '护肤品', '绵羊油系列'],
    ['careline', '其他', '未识别'],
  ])('classifies %s as %s / %s', (name, level1, level2) => {
    expect(productCategory([name])).toMatchObject({ level1, level2 });
  });

  it('prefers a category typed in by a person', () => {
    expect(productCategory(['careline'], '面部护理')).toMatchObject({ level1: '护肤品', level2: '面部护理' });
    expect(productCategory(['careline'], '自定义')).toMatchObject({ level1: '自定义', level2: '自定义' });
  });

  it('tags functions within the category family and audiences from the name', () => {
    const name = 'Blackmores 澳佳宝 加强版叶黄素60s';
    expect(productFunctions([name], productCategory([name]))).toEqual(['护眼']);
    const liver = 'Thompson‘s 42000奶蓟草护肝片60粒';
    expect(productFunctions([liver], productCategory([liver]))).toContain('护肝');
    // Cod liver oil is not a liver product.
    const cod = 'bioisland 鱼肝油 90s';
    expect(productFunctions([cod], productCategory([cod]))).not.toContain('护肝');
    expect(productAudiences(['Goodhealth 儿童叶黄素dha护眼咀嚼片'])).toEqual(['儿童']);
  });
});
