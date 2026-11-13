import { distanceMetres, distanceText, isValidPosition } from './store-location.js';

describe('store location (CR-025)', () => {
  it('measures distances on the ground and words them for staff', () => {
    expect(Math.round(distanceMetres({ latitude: -37.787, longitude: 175.279 }, { latitude: -37.788, longitude: 175.279 }))).toBe(111);
    // Hamilton to central Auckland, about 114 km in a straight line.
    expect(Math.round(distanceMetres({ latitude: -37.787, longitude: 175.279 }, { latitude: -36.8485, longitude: 174.7633 }) / 1000)).toBe(114);
    expect(distanceText(240.4)).toBe('240 米');
    expect(distanceText(1446)).toBe('1.4 公里');
  });

  it('accepts only real coordinates', () => {
    expect(isValidPosition({ latitude: -37.7, longitude: 175.2 })).toBe(true);
    expect(isValidPosition({ latitude: 91, longitude: 0 })).toBe(false);
    expect(isValidPosition({ latitude: Number.NaN, longitude: 0 })).toBe(false);
    expect(isValidPosition({ latitude: -37.7 })).toBe(false);
  });
});
