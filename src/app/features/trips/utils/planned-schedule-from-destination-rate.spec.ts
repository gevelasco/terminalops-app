import {
  computePlannedScheduleSuggestionFromRate,
  estimatedHoursToMs,
} from './planned-schedule-from-destination-rate';

describe('planned-schedule-from-destination-rate', () => {
  it('estimatedHoursToMs converts hours', () => {
    expect(estimatedHoursToMs(2)).toBe(2 * 60 * 60 * 1000);
    expect(estimatedHoursToMs(0)).toBe(0);
  });

  it('computePlannedScheduleSuggestionFromRate uses arrival and return hours', () => {
    const result = computePlannedScheduleSuggestionFromRate('2025-06-01T08:00', {
      estimatedArrivalTimeValue: 10,
      estimatedReturnTimeValue: 10,
    });
    expect(result).not.toBeNull();
    expect(result!.arrivalLocal).toBe('2025-06-01T18:00');
    expect(result!.completionLocal).toBe('2025-06-02T04:00');
  });

  it('returns null when times are missing', () => {
    expect(
      computePlannedScheduleSuggestionFromRate('2025-06-01T08:00', {
        estimatedArrivalTimeValue: 10,
      }),
    ).toBeNull();
  });
});