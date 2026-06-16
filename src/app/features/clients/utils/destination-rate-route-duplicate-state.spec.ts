import {
  buildDestinationRateRouteKey,
  destinationRateRouteKeyFingerprint,
  destinationRateRouteKeysEqual,
} from './destination-rate-route-duplicate-state';

describe('destination-rate-route-duplicate-state', () => {
  it('builds route key only when origin, cp and locality are valid', () => {
    expect(
      buildDestinationRateRouteKey({
        originOperationalCenterId: ' 12 ',
        postalCode: '44100',
        locality: 'Guadalajara',
      }),
    ).toEqual({
      originOperationalCenterId: '12',
      postalCode: '44100',
      locality: 'Guadalajara',
    });

    expect(
      buildDestinationRateRouteKey({
        originOperationalCenterId: '',
        postalCode: '44100',
        locality: 'Guadalajara',
      }),
    ).toBeNull();
  });

  it('compares route keys case-insensitively for locality', () => {
    const a = buildDestinationRateRouteKey({
      originOperationalCenterId: '1',
      postalCode: '44100',
      locality: 'Centro',
    });
    const b = buildDestinationRateRouteKey({
      originOperationalCenterId: '1',
      postalCode: '44100',
      locality: 'centro',
    });
    expect(destinationRateRouteKeysEqual(a, b)).toBe(true);
  });

  it('fingerprints normalized route keys consistently', () => {
    const key = buildDestinationRateRouteKey({
      originOperationalCenterId: '9',
      postalCode: '01000',
      locality: 'Alvaro Obregon',
    });
    expect(key).not.toBeNull();
    expect(destinationRateRouteKeyFingerprint(key!)).toBe('9|01000|alvaro obregon');
  });
});
