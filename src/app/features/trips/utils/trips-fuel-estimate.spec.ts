import { buildFuelEstimateRequest } from './trips-fuel-estimate';

describe('buildFuelEstimateRequest', () => {
  const coords = { lat: 19.4, lon: -99.1 };

  it('arma la petición en cuanto hay km de ida, aunque el peso esté vacío', () => {
    const req = buildFuelEstimateRequest({
      distanceKm: 714,
      operationType: 'sencillo',
      loadType: 'vacio',
      containerType: 'na',
      approximateWeightTons: '',
      originCoords: coords,
      destinationCoords: coords,
    });

    expect(req).not.toBeNull();
    expect(req?.distanceKm).toBe(714);
    expect(req?.approximateWeightTons).toBe(0);
  });

  it('incluye rendimiento de unidad cuando es válido', () => {
    const req = buildFuelEstimateRequest({
      distanceKm: 120,
      operationType: 'sencillo',
      loadType: 'vacio',
      containerType: 'na',
      approximateWeightTons: '',
      originCoords: coords,
      destinationCoords: coords,
      unitId: '42',
      unitPerformanceKmL: 2.8,
    });
    expect(req?.unitId).toBe(42);
    expect(req?.unitPerformanceKmL).toBe(2.8);
  });

  it('no arma petición sin km de ida', () => {
    expect(
      buildFuelEstimateRequest({
        distanceKm: null,
        operationType: 'sencillo',
        loadType: 'vacio',
        containerType: 'na',
        approximateWeightTons: '18',
        originCoords: coords,
        destinationCoords: coords,
      }),
    ).toBeNull();
  });
});
