const CARTON_PRICES = new Set([
  90, 98, 100, 105, 108, 110, 111, 114, 115, 128, 129, 130, 148, 150,
  153, 154, 163, 165, 168, 170, 172, 175, 180, 193, 200, 212, 225, 242,
  315, 316, 326, 363, 378, 383, 386,
]);

const brandRules = [
  { brand: 'Anchor', patterns: [/\banchor\b/i] },
  { brand: 'Taupo', patterns: [/\btaupo\b/i] },
  { brand: 'A2', patterns: [/\ba\s*2\b/i] },
  { brand: 'Healtheries Goat Powder', patterns: [/healtheries/i, /goat/i] },
  { brand: 'Diploma', patterns: [/\bdiploma\b/i] },
  { brand: 'The Pure', patterns: [/\bthe\s*pure\b/i] },
  { brand: 'Karicare', patterns: [/\bkaricare\b/i] },
  { brand: 'Aptamil', patterns: [/\baptamil\b/i] },
  { brand: 'Abbott', patterns: [/\babbot+t\b/i] },
  { brand: "Bellamy's", patterns: [/\bbellamy'?s?\b/i, /\bbeilami\b/i, /bei\s*la\s*mi/i, /贝拉米/] },
  { brand: 'Maxigenes', patterns: [/\bmaxigenes?\b/i, /mei\s*ke\s*zhuo/i, /美可卓/] },
] as const;

const milkMarker = /(\b(?:\d+(?:\.\d+)?\s*kg|(?:[4-9]\d{2}|[1-9]\d{3,})\s*g)\b|\bstage\s*\d+\b|\bstep\s*\d+\b|\bmilk\s*pow(?:der|er)\b|\bgoat\s*powder\b|\bformula\b|\binfant\b|\btoddler\b|\bjunior\b|\bgrowing\s*up\b|\bplatinum\b|\bgold\+?\b|\bpro\b|\bskim\b|\btrim\b|\bfull\s*cream\b|\bensure\b|\bglucerna\b)/i;
const packageMarker = /(\*\s*\d+\s*(?:tins?|s)?(?:\b|$)|\b\d+\s*(?:tins?|bags?)\b)/i;
const externalWarehouseMarker = /(tins?|6\s*bags?|stage|\*\s*(?:3|6)(?!\d))/i;
const excludedFoodMarker = /\b(?:butter|cheese|yog(?:h)?urt)\b/i;

export interface MilkProductClassification {
  brand: string;
  packQuantity: number | null;
  cartonPriceMatched: boolean;
  inventoryPolicy: 'LOCAL_STOCK' | 'EXTERNAL_WAREHOUSE' | 'REVIEW_REQUIRED';
  recognitionReason: string;
}

function identifyBrand(name: string): string | null {
  for (const rule of brandRules) {
    if (rule.patterns.every((pattern) => pattern.test(name))) return rule.brand;
  }
  return null;
}

function identifyPackQuantity(name: string): number | null {
  const starPack = /\*\s*(\d+)\s*(?:tins?|s)?(?:\b|$)/i.exec(name);
  const tinsPack = /\b(\d+)\s*tins?\b/i.exec(name);
  const bagsPack = /\b(\d+)\s*bags?\b/i.exec(name);
  const value = Number(starPack?.[1] ?? tinsPack?.[1] ?? bagsPack?.[1]);
  return Number.isSafeInteger(value) && value > 1 && value <= 100 ? value : null;
}

export function classifyMilkProduct(
  nameValue: string | null,
  salePrice: number | null,
): MilkProductClassification | null {
  const name = nameValue?.trim();
  if (!name) return null;

  const brand = identifyBrand(name);
  if (
    !brand ||
    excludedFoodMarker.test(name) ||
    (!milkMarker.test(name) && !packageMarker.test(name))
  ) return null;

  const packQuantity = identifyPackQuantity(name);
  const cartonPriceMatched = salePrice !== null && CARTON_PRICES.has(salePrice);
  const inventoryPolicy = externalWarehouseMarker.test(name)
    ? 'EXTERNAL_WAREHOUSE'
    : cartonPriceMatched
      ? 'REVIEW_REQUIRED'
      : 'LOCAL_STOCK';
  const reasons = [`品牌:${brand}`];
  if (milkMarker.test(name)) reasons.push('奶粉名称特征');
  if (packQuantity !== null) reasons.push(`包装:${packQuantity}`);
  if (externalWarehouseMarker.test(name)) reasons.push('外仓关键词');
  if (cartonPriceMatched) reasons.push('成箱价格');
  if (inventoryPolicy === 'EXTERNAL_WAREHOUSE') reasons.push('库存:外仓发货不扣本地库存');
  if (inventoryPolicy === 'REVIEW_REQUIRED') reasons.push('库存:待人工确认');
  if (inventoryPolicy === 'LOCAL_STOCK') reasons.push('库存:本地候选');

  return {
    brand,
    packQuantity,
    cartonPriceMatched,
    inventoryPolicy,
    recognitionReason: reasons.join('；'),
  };
}
