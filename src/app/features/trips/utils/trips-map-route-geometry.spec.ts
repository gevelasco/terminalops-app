import type { TripMapItem } from '@shared/models/api/api-trips-map.model';
import { uniqueTripMapRoutePairs } from './trips-map-route-geometry';

function item(
  id: string,
  origin: [number, number],
  destination: [number, number],
): TripMapItem {
  return {
    id,
    maneuverCode: id,
    status: 'in_transit',
    origin: {
      lat: origin[0],
      lng: origin[1],
      label: 'Origen',
      source: 'operational_center',
    },
    destination: {
      lat: destination[0],
      lng: destination[1],
      label: 'Destino',
      source: 'destination_rate',
    },
    geoQuality: 'resolved',
  };
}

describe('uniqueTripMapRoutePairs', () => {
  it('groups trips that share origin and destination', () => {
    const pairs = uniqueTripMapRoutePairs([
      item('a', [19.43, -99.13], [25.68, -100.31]),
      item('b', [19.43, -99.13], [25.68, -100.31]),
      item('c', [20.6, -100.4], [25.68, -100.31]),
    ]);

    expect(pairs.length).toBe(2);
    expect(pairs[0]?.tripIds).toEqual(['a', 'b']);
    expect(pairs[0]?.points.length).toBe(2);
    expect(pairs[1]?.tripIds).toEqual(['c']);
  });

  it('splits routes when tariff waypoints differ', () => {
    const pairs = uniqueTripMapRoutePairs([
      item('a', [19.43, -99.13], [25.68, -100.31]),
      {
        ...item('b', [19.43, -99.13], [25.68, -100.31]),
        routeWaypoints: [{ lat: 21.0, lon: -101.0 }],
      },
    ]);
    expect(pairs.length).toBe(2);
    expect(pairs.find((p) => p.tripIds.includes('a'))?.points.length).toBe(2);
    expect(pairs.find((p) => p.tripIds.includes('b'))?.points.length).toBe(3);
  });

  it('skips trips without both coordinates', () => {
    const incomplete: TripMapItem = {
      ...item('x', [19, -99], [20, -100]),
      destination: {
        lat: null,
        lng: null,
        label: 'Sin geo',
        source: 'unresolved',
      },
      geoQuality: 'unresolved',
    };
    expect(uniqueTripMapRoutePairs([incomplete])).toEqual([]);
  });
});
