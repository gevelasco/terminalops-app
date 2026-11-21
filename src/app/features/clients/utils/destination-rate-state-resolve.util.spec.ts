import {
  matchMexicoStateLabelToGeoName,
  parseMexicanCityMunicipalityLine,
} from './destination-rate-state-resolve.util';
import { resolveDestinationRateStateName } from './destination-rates-map-search';

const veracruzFeature = {
  type: 'Feature' as const,
  properties: { name: 'Veracruz de Ignacio de la Llave' },
  geometry: { type: 'Polygon' as const, coordinates: [[[0, 0]]] },
};

describe('destination-rate state resolve', () => {
  it('parses municipality and state from city line', () => {
    expect(
      parseMexicanCityMunicipalityLine(
        'Tierra Blanca, Veracruz de Ignacio de la Llave',
      ),
    ).toEqual({
      municipality: 'Tierra Blanca',
      state: 'Veracruz de Ignacio de la Llave',
    });
  });

  it('matches estado label to geojson name', () => {
    expect(
      matchMexicoStateLabelToGeoName('Veracruz de Ignacio de la Llave', [
        veracruzFeature,
      ]),
    ).toBe('Veracruz de Ignacio de la Llave');
  });

  it('resolves estado from cityMunicipality when coords are missing', () => {
    const geo = { type: 'FeatureCollection' as const, features: [veracruzFeature] };
    const name = resolveDestinationRateStateName(
      {
        id: '7',
        companyId: '1',
        postalCode: '95160',
        cityMunicipality: 'Tierra Blanca, Veracruz de Ignacio de la Llave',
        locality: '12 de Noviembre',
        prices: [],
        active: true,
      },
      geo,
    );
    expect(name).toBe('Veracruz de Ignacio de la Llave');
  });
});