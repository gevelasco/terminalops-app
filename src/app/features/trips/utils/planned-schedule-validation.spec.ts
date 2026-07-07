import {
  isPlannedScheduleValid,
  plannedScheduleArrivalOrderIssue,
  plannedScheduleCompletionDepartureOrderIssue,
  plannedScheduleCompletionOrderIssue,
  plannedScheduleIsoTriplet,
  plannedScheduleOrderToastMessage,
} from './planned-schedule-validation';

describe('planned-schedule-validation', () => {
  const dep = '2026-06-01T08:00';
  const arr = '2026-06-01T12:00';
  const fin = '2026-06-01T16:00';

  it('accepts departure <= arrival <= completion', () => {
    expect(isPlannedScheduleValid(dep, arr, fin)).toBe(true);
    expect(isPlannedScheduleValid(dep, dep, dep)).toBe(true);
    const triplet = plannedScheduleIsoTriplet(dep, arr, fin);
    expect(triplet).not.toBeNull();
  });

  it('rejects missing or unordered values', () => {
    expect(isPlannedScheduleValid('', arr, fin)).toBe(false);
    expect(isPlannedScheduleValid(dep, fin, arr)).toBe(false);
    expect(plannedScheduleIsoTriplet(dep, fin, arr)).toBeNull();
  });

  it('reports specific order issues', () => {
    expect(plannedScheduleArrivalOrderIssue(dep, '2026-06-01T07:00')).toContain(
      'llegada al cliente',
    );
    expect(plannedScheduleCompletionOrderIssue(arr, '2026-06-01T11:00')).toContain(
      'llegada / fin',
    );
    expect(
      plannedScheduleCompletionDepartureOrderIssue(dep, '2026-05-31T23:00'),
    ).toContain('salida');
    expect(plannedScheduleOrderToastMessage(dep, '2026-06-01T07:00', fin)).toContain(
      'llegada al cliente',
    );
  });
});
