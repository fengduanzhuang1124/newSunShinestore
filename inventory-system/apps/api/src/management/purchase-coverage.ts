// Weeks of stock a purchase aims to cover. The store receives goods weekly, so two weeks covers the wait for the
// next delivery plus a buffer (CR-009 P2); each purchase order line can be set from 1 to 8 weeks.
export const DEFAULT_COVERAGE_WEEKS = 2;
export const MIN_COVERAGE_WEEKS = 1;
export const MAX_COVERAGE_WEEKS = 8;
// Below one sale a week no coverage target is set; slow sellers keep a display quantity instead.
const MIN_WEEKLY_SALES = 1;

// The single coverage rule behind purchase suggestions and the quantity proposed when adding to a purchase order.
export function purchaseCoverage(recent28DayQty: number, currentInventory: number, weeks = DEFAULT_COVERAGE_WEEKS) {
  const weeklyVelocity = Math.round((recent28DayQty / 4) * 100) / 100;
  const targetWeeks = weeklyVelocity >= MIN_WEEKLY_SALES ? weeks : null;
  const targetInventory = targetWeeks === null ? 0 : Math.ceil(weeklyVelocity * targetWeeks);
  const gap = targetWeeks === null ? 0 : Math.max(0, targetInventory - currentInventory);
  return { weeklyVelocity, targetWeeks, targetInventory, gap };
}
