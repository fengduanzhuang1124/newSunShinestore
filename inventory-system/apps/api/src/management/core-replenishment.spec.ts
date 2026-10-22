import { isCoreReplenishmentProduct } from './core-replenishment.js';

describe('isCoreReplenishmentProduct', () => {
  it.each([
    ['GoodHealth 液体钙50CAPS'],
    ['gohealthy辅酶300mg 60s'],
    ['NL 纽乐卵磷脂200s'],
    ['Nutralife 鱼油 1500mg Plus VD 180粒'],
    ['swiss女士维生素120片'],
    ['Swisse 卵磷脂300caps'],
    ['BM辅酶150mg 30s'],
    ['Blackmores 澳佳宝 迷你鱼油 400s'],
    ['RedSeal 红印柠檬牙膏100g'],
    ['lifespace 60s成人益生菌'],
    ['Nordic 挪威小鱼宠物 omega-3 pet 237ml'],
    ['bioisland 成人乳钙 150粒'],
    ['HAAB 绵羊油 霜 150g'],
    ['Lano garden Lanolin Cream'],
  ])('treats %s as a core product', (name) => {
    expect(isCoreReplenishmentProduct(name)).toBe(true);
  });

  it.each([
    ['Kerastase Elixir Ultime set'],
    ['8+面膜 补水'],
    ['Comvita 康维他 喉糖12'],
    ['bmw keyring'],
    ['Trilogy 玫瑰果 油抗氧化果油30ml'],
  ])('does not treat %s as a core product', (name) => {
    expect(isCoreReplenishmentProduct(name)).toBe(false);
  });

  it('checks brand, Chinese, English and category text together', () => {
    expect(isCoreReplenishmentProduct(null, '某商品', undefined, '绵羊油')).toBe(true);
  });
});
