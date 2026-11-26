import type { DestinationRate, DestinationRatePriceDraft } from '@shared/models/destination-rate.models';
import {
  appendDestinationRatePriceInputRow,
  canAppendDestinationRatePriceRow,
  createEmptyPriceDraft,
  fillEmptyRateMoneyFields,
  moneyInputToAmount,
  priceDraftsFromRate,
  validateDestinationRateForm,
} from './destination-rate-payload';

function validForm(overrides: Partial<Parameters<typeof validateDestinationRateForm>[0]> = {}) {
  return {
    originOperationalCenterId: 'oc-1',
    postalCode: '44100',
    cityMunicipality: 'Guadalajara',
    locality: 'Centro',
    priceDrafts: [] as DestinationRatePriceDraft[],
    ...overrides,
  };
}

function draft(partial: Partial<DestinationRatePriceDraft> = {}): DestinationRatePriceDraft {
  return {
    ...createEmptyPriceDraft('row-1'),
    operationConfigurationId: 'cfg-1',
    operationConfigurationName: 'Sencillo',
    ...partial,
  };
}

describe('moneyInputToAmount', () => {
  it('treats empty as zero', () => {
    expect(moneyInputToAmount('')).toBe(0);
    expect(moneyInputToAmount('   ')).toBe(0);
  });

  it('parses grouped amounts', () => {
    expect(moneyInputToAmount('1,250.5')).toBe(1250.5);
  });

  it('rejects negatives', () => {
    expect(moneyInputToAmount('-1')).toBeUndefined();
  });
});

describe('appendDestinationRatePriceInputRow', () => {
  it('requires maneuver type on the last row', () => {
    const result = appendDestinationRatePriceInputRow([createEmptyPriceDraft()]);
    expect(result.ok).toBeFalse();
    if (!result.ok) {
      expect(result.message).toContain('tipo de maniobra');
    }
  });

  it('defaults empty money fields to zero and appends a blank row', () => {
    const result = appendDestinationRatePriceInputRow([
      draft({
        clientCharge: '',
        operatorPaymentEstimate: '',
        estimatedTollAmount: '',
        perDiemAmount: '',
      }),
    ]);
    expect(result.ok).toBeTrue();
    if (result.ok) {
      expect(result.rows).toHaveSize(2);
      expect(result.rows[0]?.clientCharge).toBe('0');
      expect(result.rows[0]?.operatorPaymentEstimate).toBe('0');
      expect(result.rows[0]?.estimatedTollAmount).toBe('0');
      expect(result.rows[0]?.perDiemAmount).toBe('0');
      expect(canAppendDestinationRatePriceRow(result.rows)).toBeFalse();
    }
  });

  it('keeps amounts already set', () => {
    const filled = fillEmptyRateMoneyFields(
      draft({ clientCharge: '1,200', operatorPaymentEstimate: '' }),
    );
    expect(filled.ok).toBeTrue();
    if (filled.ok) {
      expect(filled.row.clientCharge).toBe('1,200');
      expect(filled.row.operatorPaymentEstimate).toBe('0');
    }
  });
});

describe('priceDraftsFromRate', () => {
  it('returns a blank input row when the rate has no prices', () => {
    const rate = {
      id: 'r1',
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
    } satisfies DestinationRate;

    expect(priceDraftsFromRate(rate)).toHaveSize(1);
    expect(priceDraftsFromRate(rate)[0]?.operationConfigurationId).toBe('');
  });
});

describe('validateDestinationRateForm', () => {
  it('requires at least one committed maneuver type', () => {
    expect(validateDestinationRateForm(validForm())).toBe(
      'Agrega al menos un tipo de maniobra con tarifa.',
    );
  });

  it('ignores a trailing empty input row', () => {
    expect(
      validateDestinationRateForm(
        validForm({
          priceDrafts: [draft(), createEmptyPriceDraft('row-empty')],
        }),
      ),
    ).toBeNull();
  });

  it('accepts empty money as zero', () => {
    expect(
      validateDestinationRateForm(
        validForm({
          priceDrafts: [
            draft({
              clientCharge: '',
              operatorPaymentEstimate: '',
              estimatedTollAmount: '',
              perDiemAmount: '',
            }),
          ],
        }),
      ),
    ).toBeNull();
  });
});
