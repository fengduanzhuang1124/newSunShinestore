// Brands and the lanolin category that sell steadily enough for a default minimum stock and low-stock alerts
// (store owner, 2026-10-21). Most catalogue records have no brand field, so names are matched in Chinese and English.
const CORE_PATTERNS: RegExp[] = [
  /好健康|good\s*health/i,
  /高之源|go\s*health/i,
  /纽乐|nutra\s*life|(^|[^a-z])nl([^a-z]|$)/i,
  /swisse?([^a-z]|$)/i,
  /澳佳宝|blackmores|(^|[^a-z])bm([^a-z]|$)/i,
  /红印|red\s*seal/i,
  /life\s*space/i,
  /挪威小鱼|nordic\s*natural/i,
  /bio\s*-?\s*island/i,
  /绵羊油|lanolin/i,
];

export function isCoreReplenishmentProduct(...texts: (string | null | undefined)[]) {
  const haystack = texts.filter(Boolean).join(' ');
  return CORE_PATTERNS.some((pattern) => pattern.test(haystack));
}
