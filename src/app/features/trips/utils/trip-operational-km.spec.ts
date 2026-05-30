import type { Trip } from '@shared/models/logistics.models';
import { tripOperationalKm } from './trip-operational-km';

describe('tripOperationalKm', () => {
  it('returns operationalDistanceKm from API only', () => {
    const trip = { operationalDistanceKm: 200 } as Trip;
    expect(tripOperationalKm(trip)).toBe(200);
  });

  it('returns 0 when operationalDistanceKm is missing', () => {
    const trip = { routeDistanceKm: 100 } as Trip;
    expect(tripOperationalKm(trip)).toBe(0);
  });
});
