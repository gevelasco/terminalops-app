import type { Trip } from '@shared/models/logistics.models';
import { derivedDieselPricePerLiter, tripOperationalKm } from './trip-operational-km';

describe('tripOperationalKm', () => {
  it('returns routeDistanceKm × 2', () => {
    const trip = { routeDistanceKm: 100 } as Trip;
    expect(tripOperationalKm(trip)).toBe(200);
  });

  it('returns 0 when routeDistanceKm is missing', () => {
    const trip = {} as Trip;
    expect(tripOperationalKm(trip)).toBe(0);
  });

  it('uses maneuverKind fallback × 2', () => {
    expect(tripOperationalKm({ maneuverKind: 'Local' } as Trip)).toBe(50);
  });
});

describe('derivedDieselPricePerLiter', () => {
  it('divides amount by liters', () => {
    expect(
      derivedDieselPricePerLiter({ dieselAmount: '250', dieselLiters: '10' }),
    ).toBe(25);
  });

  it('returns null when liters are invalid', () => {
    expect(
      derivedDieselPricePerLiter({ dieselAmount: '250', dieselLiters: '0' }),
    ).toBeNull();
  });
});
