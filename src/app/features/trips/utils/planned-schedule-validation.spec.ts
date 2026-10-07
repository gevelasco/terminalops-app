import {
  isHistoricalManeuverAssignment,
  loadDateDepartureIssue,
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

  it('treats a departure already in the past as historical assignment', () => {
    const now = new Date('2026-09-01T20:00:00');
    expect(isHistoricalManeuverAssignment('2026-08-31T08:00', now)).toBe(true);
    expect(isHistoricalManeuverAssignment('2026-09-02T08:00', now)).toBe(false);
    expect(isHistoricalManeuverAssignment('', now)).toBe(false);
  });

  it('is live when arrival or completion can still fall on today', () => {
    const now = new Date('2026-09-01T20:00:00');
    expect(
      isHistoricalManeuverAssignment('2026-08-31T08:00', {
        arrivalLocal: '2026-09-01T10:00',
        completionLocal: '2026-09-01T18:00',
        now,
      }),
    ).toBe(false);
    expect(
      isHistoricalManeuverAssignment('2026-08-30T08:00', {
        arrivalLocal: '2026-08-30T12:00',
        completionLocal: '2026-08-30T18:00',
        now,
      }),
    ).toBe(true);
  });

  it('requires load date on or before departure', () => {
    expect(loadDateDepartureIssue('', '2026-08-01T08:00')).toBeNull();
    expect(loadDateDepartureIssue('2026-08-01T06:00', '2026-08-01T08:00')).toBeNull();
    expect(loadDateDepartureIssue('2026-08-01T08:00', '2026-08-01T08:00')).toBeNull();
    expect(loadDateDepartureIssue('2026-07-31T22:00', '2026-08-01T08:00')).toBeNull();
    expect(loadDateDepartureIssue('2026-08-02T06:00', '2026-08-01T08:00')).toContain(
      'posterior',
    );
  });

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
      'cita cliente',
    );
    expect(plannedScheduleCompletionOrderIssue(arr, '2026-06-01T11:00')).toContain(
      'llegada origen',
    );
    expect(
      plannedScheduleCompletionDepartureOrderIssue(dep, '2026-05-31T23:00'),
    ).toContain('salida');
    expect(plannedScheduleOrderToastMessage(dep, '2026-06-01T07:00', fin)).toContain(
      'cita cliente',
    );
  });
});
