const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function timeZoneOffset(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-NZ', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const value = (name: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === name)?.value);
  const representedAsUtc = Date.UTC(
    value('year'),
    value('month') - 1,
    value('day'),
    value('hour'),
    value('minute'),
    value('second'),
  );
  return representedAsUtc - date.getTime();
}

export function dateTimeInZone(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  timeZone: string,
): Date {
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, second);
  let result = new Date(utcGuess - timeZoneOffset(new Date(utcGuess), timeZone));
  result = new Date(utcGuess - timeZoneOffset(result, timeZone));
  return result;
}

export function calendarDateStart(date: string, timeZone: string): Date {
  const match = date.match(DATE_PATTERN);
  if (!match) throw new Error('Date must use YYYY-MM-DD');
  const [, year, month, day] = match;
  const value = dateTimeInZone(
    Number(year),
    Number(month),
    Number(day),
    0,
    0,
    0,
    timeZone,
  );
  const formatted = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(value);
  if (formatted !== date) throw new Error('Date is invalid');
  return value;
}

export function nextCalendarDateStart(date: string, timeZone: string): Date {
  const match = date.match(DATE_PATTERN);
  if (!match) throw new Error('Date must use YYYY-MM-DD');
  const next = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  next.setUTCDate(next.getUTCDate() + 1);
  return calendarDateStart(next.toISOString().slice(0, 10), timeZone);
}
