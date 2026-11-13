import { calendarDateInZone, calendarDateStart, dateTimeInZone, hourInZone } from '../shared/calendar-date.js';

// Purchase cycles run Tuesday to Monday and roll over on Monday at 18:00 store time, when the next week's buying is
// reviewed (CR-018; replaces CR-009's Wednesday start).
export const CYCLE_SWITCH_HOUR = 18;
const DAY_MS = 86_400_000;

// The cycle `now` falls in: its first calendar day, the start of that day, and the moment the next cycle begins.
export function purchaseCycle(timeZone: string, now = new Date()) {
  const day = new Date(`${calendarDateInZone(now, timeZone)}T12:00:00Z`);
  if (day.getUTCDay() === 1 && hourInZone(now, timeZone) >= CYCLE_SWITCH_HOUR) day.setUTCDate(day.getUTCDate() + 1);
  day.setUTCDate(day.getUTCDate() - ((day.getUTCDay() + 5) % 7));
  const firstDay = day.toISOString().slice(0, 10);
  const monday = new Date(day.getTime() + 6 * DAY_MS);
  const nextStart = dateTimeInZone(monday.getUTCFullYear(), monday.getUTCMonth() + 1, monday.getUTCDate(), CYCLE_SWITCH_HOUR, 0, 0, timeZone);
  return { firstDay, start: calendarDateStart(firstDay, timeZone), nextStart };
}

// "Not this week" lasts until the next cycle starts; each extra week adds one more cycle.
export function skipUntil(timeZone: string, weeks: number, now = new Date()) {
  return new Date(purchaseCycle(timeZone, now).nextStart.getTime() + (weeks - 1) * 7 * DAY_MS);
}
