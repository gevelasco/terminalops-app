import type { TripMapItem } from '@shared/models/api/api-trips-map.model';
import { buildTripMapRouteDrivingPoints } from './trips-map-route-driving-points.util';

function baseItem(overrides: Partial<TripMapItem> = {}): TripMapItem {
  return {
    id: '1',
    maneuverCode: 'M1',
    status: 'in_transit',
    origin: {
      lat: 19.43,
      lng: -99.13,
      label: 'Origen',
      source: 'destination_rate',
    },
    destination: {
      lat: 25.68,
      lng: -100.31,
      label: 'Destino',
      source: 'destination_rate',
    },
    geoQuality: 'resolved',
    ...overrides,
  };
}

describe('buildTripMapRouteDrivingPoints', () => {
  it('returns origin and destination when no tariff route', () => {
    const points = buildTripMapRouteDrivingPoints(baseItem());
    expect(points).toEqual([
      { lat: 19.43, lon: -99.13 },
      { lat: 25.68, lon: -100.31 },
    ]);
  });

  it('includes tariff waypoints in order', () => {
    const points = buildTripMapRouteDrivingPoints(
      baseItem({
        routeWaypoints: [{ lat: 21.0, lon: -101.0 }],
      }),
    );
    expect(points?.map((p) => [p.lat, p.lon])).toEqual([
      [19.43, -99.13],
      [21.0, -101.0],
      [25.68, -100.31],
    ]);
  });
});