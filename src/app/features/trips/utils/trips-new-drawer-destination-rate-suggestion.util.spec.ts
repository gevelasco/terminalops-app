import {
  autoAssistValueMatches,
  computeDestinationRateSuggestionFields,
  destinationRateMatchKey,
  destinationRatePlannedScheduleContextFingerprint,
  destinationRateSuggestionInputFingerprint,
  detectDestinationRateManualEdits,
} from '@features/trips/utils/trips-new-drawer-destination-rate-suggestion.util';
import type { DestinationRate } from '@shared/models/destination-rate.models';
import { formatFuelEstimateMoney } from '@features/trips/utils/trips-fuel-estimate';

describe('trips-new-drawer-destination-rate-suggestion.util', () => {
  it('builds stable fingerprints', () => {
    expect(destinationRateMatchKey('o1', '01000', 'Polanco', 'r1')).toBe(
      'o1|01000|Polanco|r1',
    );
    expect(
      destinationRateSuggestionInputFingerprint('o1', '01000', 'Polanco', 'full', true),
    ).toBe('o1|01000|Polanco|full|1');
    expect(
      destinationRateSuggestionInputFingerprint('o1', '01000', 'Polanco', 'full', false),
    ).toBe('o1|01000|Polanco|full|0');
    expect(
      destinationRatePlannedScheduleContextFingerprint('o1', 'c1', '01000', 'Polanco', 'r9'),
    ).toBe('o1|c1|01000|Polanco|r9');
  });

  it('detects manual edits against last auto values', () => {
    const formatted = formatFuelEstimateMoney(100);
    const edited = formatFuelEstimateMoney(150);
    expect(
      detectDestinationRateManualEdits({
        operatorQuota: edited,
        clientCharge: formatted,
        casetasAmount: formatted,
        lastAutoOperatorQuota: formatted,
        lastAutoClientCharge: formatted,
        lastAutoCasetasAmount: formatted,
      }),
    ).toEqual({
      operatorManual: true,
      chargeManual: false,
      casetasManual: false,
      locked: true,
    });
    expect(autoAssistValueMatches(formatted, formatted)).toBe(true);
    expect(autoAssistValueMatches(edited, formatted)).toBe(false);
  });

  it('computes suggestion fields with billing off', () => {
    const rate = {
      id: 'r1',
      prices: [
        {
          operationConfigurationCode: 'full',
          operatorPaymentEstimate: 1200,
          clientCharge: 8000,
          estimatedTollAmount: 500,
        },
      ],
    } as unknown as DestinationRate;

    const fields = computeDestinationRateSuggestionFields(rate, 'full', false);
    expect(fields.clientCharge).toBeNull();
    expect(fields.clientChargeUi).toBe('none');
    expect(fields.operatorQuota).toBe(formatFuelEstimateMoney(1200));
    expect(fields.casetasAmount).toBe(formatFuelEstimateMoney(500));
  });
});
