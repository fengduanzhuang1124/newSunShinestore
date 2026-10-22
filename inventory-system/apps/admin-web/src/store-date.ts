// The store trades in Hamilton, so "today" in the UI means the Auckland calendar date, not the device's.
export const STORE_TIME_ZONE = 'Pacific/Auckland';

export function storeToday(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: STORE_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}
