// Barcodes stay strings. A numeric barcode printed as UPC-A (12 digits) and scanned or exported as EAN-13/GTIN-14
// differs only by leading zeros, so lookups treat those spellings as the same code.
const GTIN_MAX_LENGTH = 14;

export function normalizeBarcode(barcode: string): string {
  const trimmed = barcode.trim();
  return /^\d+$/.test(trimmed) ? trimmed.replace(/^0+(?=\d)/, '') : trimmed;
}

// Every stored spelling that normalizes to the same code, for an indexed `barcode IN (...)` lookup.
export function barcodeSpellings(barcode: string): string[] {
  const trimmed = barcode.trim();
  if (!/^\d+$/.test(trimmed)) return [trimmed];
  const core = normalizeBarcode(trimmed);
  const spellings = new Set([trimmed, core]);
  for (let padded = core; padded.length < GTIN_MAX_LENGTH; ) {
    padded = `0${padded}`;
    spellings.add(padded);
  }
  return [...spellings];
}

export type BarcodeMatch<T> =
  | { kind: 'exact'; row: T }
  | { kind: 'normalized'; row: T }
  | { kind: 'ambiguous'; rows: T[] }
  | { kind: 'none' };

// Exact spelling wins; otherwise a single product sharing the normalized code is a match, several are a conflict.
export function pickBarcodeMatch<T extends { barcode: string; productId: bigint }>(barcode: string, rows: T[]): BarcodeMatch<T> {
  const trimmed = barcode.trim();
  const exact = rows.find((row) => row.barcode === trimmed);
  if (exact) return { kind: 'exact', row: exact };
  const target = normalizeBarcode(trimmed);
  const normalized = rows.filter((row) => normalizeBarcode(row.barcode) === target);
  const products = new Set(normalized.map((row) => row.productId));
  if (products.size === 1) return { kind: 'normalized', row: normalized[0] };
  if (products.size > 1) return { kind: 'ambiguous', rows: normalized };
  return { kind: 'none' };
}

export class AmbiguousBarcodeError extends Error {
  constructor(readonly barcode: string) {
    super(`Barcode ${barcode} matches several products`);
  }
}

// Returns the spelling actually stored for a scanned code (so exact lookups keep working), or the scanned code itself
// when nothing matches. Several products sharing the normalized code is a conflict for a person to resolve.
export async function resolveStoredBarcode(
  barcode: string,
  findBySpellings: (spellings: string[]) => Promise<{ barcode: string; productId: bigint }[]>,
) {
  const match = pickBarcodeMatch(barcode, await findBySpellings(barcodeSpellings(barcode)));
  if (match.kind === 'ambiguous') throw new AmbiguousBarcodeError(barcode.trim());
  return match.kind === 'none' ? barcode.trim() : match.row.barcode;
}
