import { buildFuelEstimateRequest } from './trips-fuel-estimate';

describe('buildFuelEstimateRequest', () => {
  const coords = { lat: 19.4, lon: -99.1 };
  const complete = {
    distanceKm: 714 as number | null,
    operationType: 'sencillo',
    loadType: 'lleno' as const,
    containerType: '40dc' as const,
    approximateWeightTons: '18',
    originCoords: coords,
    destinationCoords: coords,
    unitId: '42',
    unitPerformanceKmL: 2.8 as number | null,
  };

  it('no arma petición sin peso capturado', () => {
    expect(
      buildFuelEstimateRequest({
        ...complete,
        approximateWeightTons: '',
      }),
    ).toBeNull();
  });

  it('no arma petición con peso 0', () => {
    expect(
      buildFuelEstimateRequest({
        ...complete,
        approximateWeightTons: '0',
      }),
    ).toBeNull();
  });

  it('no arma petición sin unidad', () => {
    expect(
      buildFuelEstimateRequest({
        ...complete,
        unitId: '',
      }),
    ).toBeNull();
  });

  it('no arma petición sin rendimiento de unidad', () => {
    expect(
      buildFuelEstimateRequest({
        ...complete,
        unitPerformanceKmL: null,
      }),
    ).toBeNull();
  });

  it('no arma petición sin km de ida', () => {
    expect(
      buildFuelEstimateRequest({
        ...complete,
        distanceKm: null,
      }),
    ).toBeNull();
  });

  it('arma la petición cuando hay km, unidad con rendimiento y peso', () => {
    const req = buildFuelEstimateRequest(complete);
    expect(req).not.toBeNull();
    expect(req?.distanceKm).toBe(714);
    expect(req?.approximateWeightTons).toBe(18);
    expect(req?.unitId).toBe(42);
    expect(req?.unitPerformanceKmL).toBe(2.8);
  });

  it('arma la petición con id de unidad no numérico si hay rendimiento', () => {
    const req = buildFuelEstimateRequest({
      ...complete,
      unitId: 'u-busy',
    });
    expect(req).not.toBeNull();
    expect(req?.unitId).toBeUndefined();
    expect(req?.unitPerformanceKmL).toBe(2.8);
  });
});