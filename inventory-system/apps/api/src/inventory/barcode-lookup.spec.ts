import { barcodeSpellings, normalizeBarcode, pickBarcodeMatch } from './barcode-lookup.js';

describe('barcode lookup', () => {
  it('treats UPC-A and EAN-13 spellings of the same code as equal without converting to numbers', () => {
    expect(normalizeBarcode(' 0735940885232 ')).toBe('735940885232');
    expect(normalizeBarcode('00000')).toBe('0');
    expect(normalizeBarcode('LOCAL-0012')).toBe('LOCAL-0012');
    expect(barcodeSpellings('735940885232')).toEqual(expect.arrayContaining(['735940885232', '0735940885232', '00735940885232']));
    expect(barcodeSpellings('LOCAL-1845')).toEqual(['LOCAL-1845']);
  });

  it('prefers the exact spelling, accepts one normalized product, and reports several as ambiguous', () => {
    const rows = [
      { barcode: '0735940885232', productId: 1n },
      { barcode: '735940885232', productId: 2n },
    ];
    expect(pickBarcodeMatch('735940885232', rows)).toEqual({ kind: 'exact', row: rows[1] });
    expect(pickBarcodeMatch('00735940885232', rows)).toEqual({ kind: 'ambiguous', rows });
    expect(pickBarcodeMatch('00735940885232', [rows[0]])).toEqual({ kind: 'normalized', row: rows[0] });
    expect(pickBarcodeMatch('9400000000000', rows)).toEqual({ kind: 'none' });
  });
});
