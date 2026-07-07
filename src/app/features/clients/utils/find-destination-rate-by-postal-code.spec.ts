import {
  findDestinationRatePriceByOperationCode,
  resolveManeuverDestinationRate,
  suggestedClientChargeFromDestinationRate,
} from './find-destination-rate-by-postal-code';
import type { DestinationRate } from '@shared/models/destination-rate.models';

function rate(partial: Partial<DestinationRate> & Pick<DestinationRate, 'id'>): DestinationRate {
  return {
    companyId: '1',
    originOperationalCenterId: 'oc-1',
    originPostalCode: '01000',
    originCityMunicipality: 'CDMX',
    originLocality: 'Centro',
    postalCode: '44100',
    cityMunicipality: 'Guadalajara',
    locality: 'Centro',
    isRoundTrip: true,
    prices: [],
    active: true,
    ...partial,
  };
}

describe('resolveManeuverDestinationRate', () => {
  const routeParams = {
    originOperationalCenterId: 'oc-1',
    destinationPostalCode: '44100',
    destinationLocality: 'Centro',
  };

  it('uses linked client tariff when delivery matches the route', () => {
    const linked = rate({
      id: 'rate-linked',
      prices: [
        {
          id: 'p1',
          operationConfigurationId: 'cfg-1',
          operationConfigurationCode: 'sencillo',
          clientCharge: 12000,
          operatorPaymentEstimate: 3000,
          estimatedTollAmount: 500,
        },
      ],
    });
    const other = rate({ id: 'rate-other', postalCode: '99999', locality: 'Otro' });

    const resolved = resolveManeuverDestinationRate([linked, other], {
      ...routeParams,
      clientDestinationRateId: 'rate-linked',
    });

    expect(resolved?.id).toBe('rate-linked');
  });

  it('returns null when linked tariff does not match delivery route', () => {
    const linked = rate({ id: 'rate-linked', postalCode: '99999', locality: 'Otro' });

    const resolved = resolveManeuverDestinationRate([linked], {
      ...routeParams,
      clientDestinationRateId: 'rate-linked',
    });

    expect(resolved).toBeNull();
  });
});

describe('suggestedClientChargeFromDestinationRate', () => {
  it('returns 0 when operation type has no price row', () => {
    const r = rate({
      id: 'r1',
      prices: [
        {
          id: 'p1',
          operationConfigurationId: 'cfg-1',
          operationConfigurationCode: 'sencillo',
          clientCharge: 8000,
          operatorPaymentEstimate: 2000,
          estimatedTollAmount: 400,
        },
      ],
    });

    expect(suggestedClientChargeFromDestinationRate(r, 'full')).toBe(0);
    expect(suggestedClientChargeFromDestinationRate(r, 'sencillo')).toBe(8000);
  });
});

describe('findDestinationRatePriceByOperationCode', () => {
  it('matches operation codes case-insensitively', () => {
    const r = rate({
      id: 'r1',
      prices: [
        {
          id: 'p1',
          operationConfigurationId: 'cfg-1',
          operationConfigurationCode: 'Full',
          clientCharge: 15000,
          operatorPaymentEstimate: 4000,
          estimatedTollAmount: 600,
        },
      ],
    });

    expect(findDestinationRatePriceByOperationCode(r, 'full')?.clientCharge).toBe(15000);
  });
});
