import { buildDestinationRateRouteMapDrivingPoints } from './destination-rate-route-map-driving-points.util';

describe('buildDestinationRateRouteMapDrivingPoints', () => {
  const ctx = {
    originLat: 19.43,
    originLon: -99.13,
    destinationLat: 25.67,
    destinationLon: -100.31,
    waypoints: undefined as undefined,
  };

  it('routes origin → user plazas → destination', () => {
    const points = buildDestinationRateRouteMapDrivingPoints({
      ctx,
      plazas: [
        {
          order: 1,
          plazaKey: 'a',
          name: 'A',
          costMxn: 100,
          lat: 20.0,
          lng: -99.5,
          inegiPoint: '20.0,-99.5',
        },
        {
          order: 2,
          plazaKey: 'b',
          name: 'B',
          costMxn: 100,
          lat: 22.0,
          lng: -100.0,
          inegiPoint: '22.0,-100.0',
        },
      ],
    });
    expect(points).toEqual([
      { lat: 19.43, lon: -99.13 },
      { lat: 20.0, lon: -99.5 },
      { lat: 22.0, lon: -100.0 },
      { lat: 25.67, lon: -100.31 },
    ]);
  });

  it('keeps user waypoints before plazas', () => {
    const points = buildDestinationRateRouteMapDrivingPoints({
      ctx: {
        ...ctx,
        waypoints: [{ lat: 19.8, lon: -99.4, label: 'Paso', searchLabel: 'Paso' }],
      },
      plazas: [
        {
          order: 1,
          plazaKey: 'a',
          name: 'A',
          costMxn: 100,
          inegiPoint: '20.5,-99.6',
        },
      ],
    });
    expect(points).toEqual([
      { lat: 19.43, lon: -99.13 },
      { lat: 19.8, lon: -99.4 },
      { lat: 20.5, lon: -99.6 },
      { lat: 25.67, lon: -100.31 },
    ]);
  });
});
