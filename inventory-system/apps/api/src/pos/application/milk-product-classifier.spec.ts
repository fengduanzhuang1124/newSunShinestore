import { classifyMilkProduct } from './milk-product-classifier.js';

describe('classifyMilkProduct', () => {
  it.each([
    ['Anchor Full cream 1kg SF *6', 108, 'Anchor', 6, true],
    ['Aptamil Pro 2 SF* 3TINS', 175, 'Aptamil', 3, true],
    ['Healtheries goat powder 6 tins SF', 180, 'Healtheries Goat Powder', 6, true],
    ['Taupo Milk Power A2 *6', 119, 'Taupo', 6, false],
    ['Abbott Ensure 3tins', 190, 'Abbott', 3, false],
    ['Karicare formula 6bags', 210, 'Karicare', 6, false],
  ])('recognizes %s', (name, price, brand, packQuantity, cartonPriceMatched) => {
    expect(classifyMilkProduct(name, price)).toMatchObject({
      brand,
      packQuantity,
      cartonPriceMatched,
      inventoryPolicy: 'EXTERNAL_WAREHOUSE',
    });
  });

  it('treats stage as external warehouse without inventing a pack size', () => {
    expect(classifyMilkProduct('a2 stage3', 148)).toMatchObject({
      brand: 'A2',
      packQuantity: null,
      cartonPriceMatched: true,
      inventoryPolicy: 'EXTERNAL_WAREHOUSE',
    });
  });

  it('keeps a single retail tin as a local-stock candidate', () => {
    expect(classifyMilkProduct('Aptamil Gold 1 900g', 45)).toMatchObject({
      brand: 'Aptamil',
      packQuantity: null,
      cartonPriceMatched: false,
      inventoryPolicy: 'LOCAL_STOCK',
    });
  });

  it.each(['Anchor butter 500g', 'Taupo Pure Lactoferrin Plus 40g(buy 1 get 1 free)', 'random formula 900g', 'shipping fee'])(
    'does not classify unrelated product %s',
    (name) => expect(classifyMilkProduct(name, 108)).toBeNull(),
  );
});
