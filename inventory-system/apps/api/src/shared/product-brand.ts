import { PURCHASE_BRAND_GROUPS } from './replenishment-rules.js';

// Brand of a product for grouping (CR-008 F5): the recorded brand when there is one, otherwise recognised from its
// names. Product records rarely carry a brand, so known brands are matched by pattern (Chinese or English spelling)
// and anything else falls back to the first English word of the name, case-insensitively, swiss read as Swisse.
const KNOWN_BRANDS: [RegExp, string][] = [
  ...PURCHASE_BRAND_GROUPS.map((group): [RegExp, string] => [group.pattern, group.label]),
  [/comvita|康维他/i, '康维他 Comvita'],
  [/go\s*healthy|高之源/i, '高之源 GO Healthy'],
  [/vida\s*glow/i, 'Vida Glow'],
  [/mitoq/i, 'MitoQ'],
  [/bio\s*island/i, 'Bio Island'],
  [/blackmores|澳佳宝|^bm\b/i, '澳佳宝 Blackmores'],
  [/good\s*health|好健康/i, '好健康 Good Health'],
  [/be\s*pure/i, 'BePure'],
  [/swiss|斯维诗/i, 'Swisse'],
  [/nutra\s*life|纽乐|^nl\b/i, 'Nutra-Life'],
  [/life\s*space/i, 'Life Space'],
  [/healtheries|贺寿利/i, 'Healtheries'],
  [/bruntwood/i, 'Bruntwood Lane'],
  [/antipodes/i, 'Antipodes'],
  [/a2\b/i, 'a2'],
  [/manuka\s*health|蜜纽康/i, '蜜纽康 Manuka Health'],
  [/manuka\s*doc|麦卢卡医生/i, 'Manuka Doctor'],
  [/la\s*roche|理肤泉/i, 'La Roche-Posay'],
  [/thursday\s*plantation|星期四农庄/i, 'Thursday Plantation'],
  [/henry\s*bloo/i, 'Henry Blooms'],
];

export const UNKNOWN_BRAND = '未识别品牌';

export function productBrand(explicitBrand: string | null | undefined, ...names: (string | null | undefined)[]) {
  if (explicitBrand?.trim()) return explicitBrand.trim();
  const present = names.map((name) => name?.trim() ?? '').filter(Boolean);
  const known = KNOWN_BRANDS.find(([pattern]) => present.some((name) => pattern.test(name)));
  if (known) return known[1];
  for (const name of present) {
    // "The Good", "Dr. Lewinns": a leading article or title belongs to the brand.
    const words = name.match(/^(?:(?:the|dr\.?|mr\.?|la|le)\s+)?[A-Za-z][A-Za-z0-9&'.-]*/i)?.[0];
    if (words && words.length > 1) return words.split(/\s+/).map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
  }
  return UNKNOWN_BRAND;
}
