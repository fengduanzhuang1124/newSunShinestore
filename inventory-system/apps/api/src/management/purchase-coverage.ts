// Weeks of stock to aim for, by weekly sales: fast sellers need less buffer. Below 1 a week nothing is suggested.
const COVERAGE_TIERS = [
  { minWeeklySales: 30, weeks: 4 },
  { minWeeklySales: 10, weeks: 5 },
  { minWeeklySales: 1, weeks: 6 },
];

// The single coverage rule behind purchase suggestions and the quantity proposed when adding to a purchase order.
export function purchaseCoverage(recent28DayQty: number, currentInventory: number) {
  const weeklyVelocity = Math.round((recent28DayQty / 4) * 100) / 100;
  const targetWeeks = COVERAGE_TIERS.find((tier) => weeklyVelocity >= tier.minWeeklySales)?.weeks ?? null;
  const targetInventory = targetWeeks === null ? 0 : Math.ceil(weeklyVelocity * targetWeeks);
  const gap = targetWeeks === null ? 0 : Math.max(0, targetInventory - currentInventory);
  return { weeklyVelocity, targetWeeks, targetInventory, gap };
}
