import {
  downsampleOsrmCoordinates,
  osrmRouteCacheKey,
  parseOsrmDrivingRoute,
} from './osrm-driving-route.util';

describe('parseOsrmDrivingRoute', () => {
  it('reads km and GeoJSON line coordinates', () => {
    const parsed = parseOsrmDrivingRoute({
      code: 'Ok',
      routes: [
        {
          distance: 12340,
          geometry: {
            type: 'LineString',
            coordinates: [
              [-99.13, 19.43],
              [-99.2, 19.5],
              [-100.3, 20.1],
            ],
          },
        },
      ],
    });

    expect(parsed).toEqual({
      km: 12.3,
      coordinates: [
        [-99.13, 19.43],
        [-99.2, 19.5],
        [-100.3, 20.1],
      ],
    });
  });

  it('returns null when OSRM did not find a route', () => {
    expect(parseOsrmDrivingRoute({ code: 'NoRoute', routes: [] })).toBeNull();
  });

  it('picks the shortest alternative when several are returned', () => {
    const parsed = parseOsrmDrivingRoute({
      code: 'Ok',
      routes: [
        {
          distance: 345_000,
          geometry: {
            type: 'LineString',
            coordinates: [
              [-104.3, 19.1],
              [-103.1, 20.6],
              [-103.4, 20.7],
            ],
          },
        },
        {
          distance: 283_000,
          geometry: {
            type: 'LineString',
            coordinates: [
              [-104.3, 19.1],
              [-103.5, 20.3],
              [-103.4, 20.7],
            ],
          },
        },
      ],
    });
    expect(parsed?.km).toBe(283);
  });
});

describe('osrmRouteCacheKey', () => {
  it('rounds coordinates so nearby points share a cache entry', () => {
    expect(
      osrmRouteCacheKey(
        { lat: 19.432001, lon: -99.133201 },
        { lat: 25.686001, lon: -100.316001 },
      ),
    ).toBe(
      osrmRouteCacheKey(
        { lat: 19.43204, lon: -99.13324 },
        { lat: 25.68604, lon: -100.31604 },
      ),
    );
  });
});

describe('downsampleOsrmCoordinates', () => {
  it('keeps the first and last point', () => {
    const coords: Array<[number, number]> = Array.from({ length: 20 }, (_, i) => [
      i,
      i,
    ]);
    const down = downsampleOsrmCoordinates(coords, 5);
    expect(down[0]).toEqual([0, 0]);
    expect(down[down.length - 1]).toEqual([19, 19]);
    expect(down.length).toBe(5);
  });
});
