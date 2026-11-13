// CR-025: staff accounts limited to the store are checked against the store's position when they sign in.

export const LOGIN_RADIUS_OPTIONS = [100, 200, 300, 500, 1000] as const;
// A reading vaguer than this cannot tell the shop from the street around it.
export const MAX_LOCATION_ACCURACY_M = 1000;

export type Position = { latitude: number; longitude: number };

export function isValidPosition(value: Partial<Position>): value is Position {
  return typeof value.latitude === 'number' && typeof value.longitude === 'number'
    && Number.isFinite(value.latitude) && Number.isFinite(value.longitude)
    && Math.abs(value.latitude) <= 90 && Math.abs(value.longitude) <= 180;
}

// Great-circle distance in metres (haversine); accurate to a few metres at shop scale.
export function distanceMetres(from: Position, to: Position) {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = radians(to.latitude - from.latitude);
  const dLon = radians(to.longitude - from.longitude);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(radians(from.latitude)) * Math.cos(radians(to.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.min(1, Math.sqrt(a)));
}

export function distanceText(metres: number) {
  return metres < 1000 ? `${Math.round(metres)} 米` : `${(metres / 1000).toFixed(1)} 公里`;
}
