import { purchaseCycle, skipUntil } from './purchase-cycle.js';

const zone = 'Pacific/Auckland';
const at = (local: string) => new Date(`${local}+13:00`); // New Zealand daylight time in November

describe('purchaseCycle (CR-018)', () => {
  it('runs Tuesday to Monday and switches on Monday at 18:00 store time', () => {
    expect(purchaseCycle(zone, at('2026-11-09T12:30:00')).firstDay).toBe('2026-11-03');
    expect(purchaseCycle(zone, at('2026-11-09T17:59:00')).firstDay).toBe('2026-11-03');
    expect(purchaseCycle(zone, at('2026-11-09T18:00:00')).firstDay).toBe('2026-11-10');
    expect(purchaseCycle(zone, at('2026-11-10T09:00:00')).firstDay).toBe('2026-11-10');
    expect(purchaseCycle(zone, at('2026-11-15T23:00:00')).firstDay).toBe('2026-11-10');
    expect(purchaseCycle(zone, at('2026-11-09T12:30:00')).nextStart).toEqual(at('2026-11-09T18:00:00'));
  });

  it('keeps a skipped product hidden until the cycle after the chosen number of weeks', () => {
    expect(skipUntil(zone, 1, at('2026-11-09T12:30:00'))).toEqual(at('2026-11-09T18:00:00'));
    expect(skipUntil(zone, 2, at('2026-11-11T10:00:00'))).toEqual(at('2026-11-23T18:00:00'));
    expect(skipUntil(zone, 4, at('2026-11-11T10:00:00'))).toEqual(at('2026-12-07T18:00:00'));
  });
});
