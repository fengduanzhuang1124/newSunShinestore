import { calendarDateStart, nextCalendarDateStart } from './pos-date.js';

describe('POS calendar dates', () => {
  it('uses Auckland daylight-saving time in summer', () => {
    expect(calendarDateStart('2026-01-20', 'Pacific/Auckland').toISOString())
      .toBe('2026-01-19T11:00:00.000Z');
  });

  it('uses Auckland standard time in winter', () => {
    expect(calendarDateStart('2026-06-20', 'Pacific/Auckland').toISOString())
      .toBe('2026-06-19T12:00:00.000Z');
  });

  it('returns the next local calendar day across a daylight-saving boundary', () => {
    expect(nextCalendarDateStart('2026-04-04', 'Pacific/Auckland').toISOString())
      .toBe('2026-04-04T11:00:00.000Z');
  });
});
