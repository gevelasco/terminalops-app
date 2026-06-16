import {
  isPlannedScheduleValid,
  plannedScheduleIsoTriplet,
} from './planned-schedule-validation';

describe('planned-schedule-validation', () => {
  const dep = '2026-06-01T08:00';
  const arr = '2026-06-01T12:00';
  const fin = '2026-06-01T16:00';

  it('accepts strict departure < arrival < completion', () => {
    expect(isPlannedScheduleValid(dep, arr, fin)).toBe(true);
    const triplet = plannedScheduleIsoTriplet(dep, arr, fin);
    expect(triplet).not.toBeNull();
    const depMs = new Date(triplet!.plannedDepartureAt).getTime();
    const arrMs = new Date(triplet!.plannedArrivalAt).getTime();
    const finMs = new Date(triplet!.plannedCompletionAt).getTime();
    expect(depMs).toBeLessThan(arrMs);
    expect(arrMs).toBeLessThan(finMs);
  });

  it('rejects missing or unordered values', () => {
    expect(isPlannedScheduleValid('', arr, fin)).toBe(false);
    expect(isPlannedScheduleValid(dep, fin, arr)).toBe(false);
    expect(plannedScheduleIsoTriplet(dep, fin, arr)).toBeNull();
  });
});
