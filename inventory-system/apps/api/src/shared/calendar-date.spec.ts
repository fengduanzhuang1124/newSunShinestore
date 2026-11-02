import { calendarDateInZone, calendarDateStart, hourInZone, nextCalendarDateStart } from './calendar-date.js';

describe('calendar dates in a store time zone', () => {
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

describe('calendarDateInZone and hourInZone', () => {
  it('reads the store date and hour across midnight and daylight saving', () => {
    // 2026-10-21 11:20 UTC is 00:20 on 22 Oct in Auckland (NZDT, UTC+13).
    expect(calendarDateInZone(new Date('2026-10-21T11:20:00.000Z'), 'Pacific/Auckland')).toBe('2026-10-22');
    expect(hourInZone(new Date('2026-10-21T11:20:00.000Z'), 'Pacific/Auckland')).toBe(0);
    // 2026-07-01 12:30 UTC is 00:30 on 2 Jul in Auckland (NZST, UTC+12).
    expect(calendarDateInZone(new Date('2026-07-01T12:30:00.000Z'), 'Pacific/Auckland')).toBe('2026-07-02');
    expect(calendarDateInZone(new Date('2026-07-01T11:30:00.000Z'), 'Pacific/Auckland')).toBe('2026-07-01');
    expect(hourInZone(new Date('2026-07-01T11:30:00.000Z'), 'Pacific/Auckland')).toBe(23);
  });
});
