import { buildDestinationRateRouteMapDrivingPoints } from './destination-rate-route-map-driving-points.util';

describe('buildDestinationRateRouteMapDrivingPoints', () => {
  const ctx = {
    originLat: 19.43,
    originLon: -99.13,
    destinationLat: 25.67,
    destinationLon: -100.31,
    waypoints: undefined as undefined,
  };

  it('inserts toll plazas between origin and destination in list order', () => {
    const points = buildDestinationRateRouteMapDrivingPoints({
      ctx,
      plazas: [
        {
          order: 1,
          plazaKey: 'a',
          name: 'A',
          costMxn: 100,
          inegiPoint: '20.0,-99.5',
        },
        {
          order: 2,
          plazaKey: 'b',
          name: 'B',
          costMxn: 100,
          inegiPoint: '22.0,-100.0',
        },
      ],
    });
    expect(points).toHaveLength(4);
    expect(points[0]).toEqual({ lat: 19.43, lon: -99.13 });
    expect(points[1]).toEqual({ lat: 20, lon: -99.5 });
    expect(points[2]).toEqual({ lat: 22, lon: -100 });
    expect(points[3]).toEqual({ lat: 25.67, lon: -100.31 });
  });

  it('dedupes points that coincide with origin', () => {
    const points = buildDestinationRateRouteMapDrivingPoints({
      ctx,
      plazas: [
        {
          order: 1,
          plazaKey: 'a',
          name: 'A',
          costMxn: null,
          inegiPoint: '19.43001,-99.13001',
        },
      ],
    });
    expect(points).toHaveLength(2);
  });
});