import {
  buildDestinationRateTableRows,
  formatDestinationRateRoundTripEta,
  municipalityLabelForTable,
  type DestinationRateTableRow,
} from './destination-rates-table-rows';
import type { DestinationRate } from '@shared/models/destination-rate.models';

function rate(partial: Partial<DestinationRate> & Pick<DestinationRate, 'id'>): DestinationRate {
  return {
    companyId: '1',
    originOperationalCenterId: '1',
    originPostalCode: '01000',
    originCityMunicipality: 'CDMX',
    originLocality: 'Centro',
    postalCode: '11560',
    cityMunicipality: 'Miguel Hidalgo, Ciudad de México',
    locality: 'Polanco',
    isRoundTrip: true,
    prices: [],
    active: true,
    ...partial,
  };
}

describe('buildDestinationRateTableRows', () => {
  it('sorts alphabetically and merges estado/municipio/CP spans', () => {
    const rates: DestinationRate[] = [
      rate({
        id: '2',
        postalCode: '44100',
        cityMunicipality: 'Guadalajara, Jalisco',
        prices: [
          {
            id: 'p2',
            operationConfigurationId: 'c1',
            operationConfigurationName: 'Sencillo',
            clientCharge: 1000,
            operatorPaymentEstimate: 0,
            estimatedTollAmount: 0,
            perDiemAmount: 0,
          },
        ],
      }),
      rate({
        id: '1',
        postalCode: '11560',
        cityMunicipality: 'Miguel Hidalgo, Ciudad de México',
        estimatedArrivalTimeValue: 4,
        estimatedReturnTimeValue: 5,
        prices: [
          {
            id: 'p1a',
            operationConfigurationId: 'c1',
            operationConfigurationName: 'Full',
            operationConfigurationCode: 'full',
            clientCharge: 5000,
            operatorPaymentEstimate: 0,
            estimatedTollAmount: 0,
            perDiemAmount: 0,
          },
          {
            id: 'p1b',
            operationConfigurationId: 'c2',
            operationConfigurationName: 'Sencillo',
            clientCharge: 3000,
            operatorPaymentEstimate: 0,
            estimatedTollAmount: 0,
            perDiemAmount: 0,
          },
        ],
      }),
    ];
    const stateById = new Map([
      ['1', 'Ciudad de México'],
      ['2', 'Jalisco'],
    ]);

    const rows = buildDestinationRateTableRows(rates, stateById);

    expect(rows.map((r) => r.state)).toEqual([
      'Ciudad de México',
      'Ciudad de México',
      'Jalisco',
    ]);
    expect(rows[0]?.stateRowSpan).toBe(2);
    expect(rows[1]?.stateRowSpan).toBe(0);
    expect(rows[0]?.municipalityRowSpan).toBe(2);
    expect(rows[1]?.municipalityRowSpan).toBe(0);
    expect(rows[0]?.postalCodeRowSpan).toBe(2);
    expect(rows[1]?.postalCodeRowSpan).toBe(0);
    expect(rows[2]?.stateRowSpan).toBe(1);
    expect(rows[0]?.etaLabel).toBe('9 hrs');
    expect(rows[0]?.maneuver).toBe('Doble articulado');
    expect(rows.every((r: DestinationRateTableRow) => r.postalCode.length > 0)).toBe(
      true,
    );
  });

  it('does not show state name as municipality', () => {
    const label = municipalityLabelForTable(
      rate({
        id: '3',
        postalCode: '44100',
        cityMunicipality: 'Jalisco',
        locality: 'Centro',
      }),
      'Jalisco',
    );
    expect(label).toBe('—');
  });

  it('uses SEPOMEX override for municipality', () => {
    const label = municipalityLabelForTable(
      rate({
        id: '3',
        postalCode: '44100',
        cityMunicipality: 'Jalisco',
        locality: 'Centro',
      }),
      'Jalisco',
      new Map([['44100', 'Guadalajara']]),
    );
    expect(label).toBe('Guadalajara');
  });

  it('sums round-trip ETA', () => {
    expect(
      formatDestinationRateRoundTripEta({
        estimatedArrivalTimeValue: 3,
        estimatedReturnTimeValue: 4,
      }),
    ).toBe('7 hrs');
  });
});
