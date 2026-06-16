import {
  computePlannedScheduleSuggestionFromRate,
  estimatedTimeUnitToMs,
} from './planned-schedule-from-destination-rate';

describe('planned-schedule-from-destination-rate', () => {
  it('estimatedTimeUnitToMs converts hours and days', () => {
    expect(estimatedTimeUnitToMs(2, 'hours')).toBe(2 * 60 * 60 * 1000);
    expect(estimatedTimeUnitToMs(1, 'days')).toBe(24 * 60 * 60 * 1000);
  });

  it('computePlannedScheduleSuggestionFromRate sums arrival and return', () => {
    const departure = '2026-05-28T08:00';
    const suggested = computePlannedScheduleSuggestionFromRate(departure, {
      estimatedArrivalTimeValue: 4,
      estimatedReturnTimeValue: 2,
      estimatedTimeUnit: 'hours',
    });
    expect(suggested).toEqual({
      arrivalLocal: '2026-05-28T12:00',
      completionLocal: '2026-05-28T14:00',
    });
  });

  it('returns null when estimated times are incomplete', () => {
    expect(
      computePlannedScheduleSuggestionFromRate('2026-05-28T08:00', {
        estimatedArrivalTimeValue: 4,
        estimatedReturnTimeValue: undefined,
        estimatedTimeUnit: 'hours',
      }),
    ).toBeNull();
  });
});
