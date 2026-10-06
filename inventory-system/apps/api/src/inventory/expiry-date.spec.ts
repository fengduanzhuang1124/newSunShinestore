import { BadRequestException } from '@nestjs/common';
import { parseExpiryInput } from './expiry-date.js';

describe('parseExpiryInput', () => {
  it('keeps a month-only expiry distinct from a specific date', () => {
    expect(parseExpiryInput('2027-03')).toEqual({
      expiryDate: new Date('2027-03-31T00:00:00.000Z'),
      expiryDisplay: '2027-03',
      expiryPrecision: 'MONTH',
    });
  });

  it('accepts an optional valid day', () => {
    expect(parseExpiryInput('2028-02', 29)).toEqual({
      expiryDate: new Date('2028-02-29T00:00:00.000Z'),
      expiryDisplay: '2028-02-29',
      expiryPrecision: 'DATE',
    });
  });

  it('rejects a day that does not exist in the selected month', () => {
    expect(() => parseExpiryInput('2027-02', 29)).toThrow(BadRequestException);
  });
});
