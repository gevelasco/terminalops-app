import type { Trip } from '@shared/models/logistics.models';
import {
  tripConflictsWithActiveSchedule,
  tripScheduleWindowsOverlap,
  tripScheduleWindowFromPlannedIso,
} from './trip-schedule-overlap.util';

describe('tripScheduleWindowsOverlap', () => {
  it('allows chaining when end meets next start', () => {
    const a = tripScheduleWindowFromPlannedIso(
      '2026-06-01T08:00:00.000Z',
      '2026-06-02T08:00:00.000Z',
    )!;
    const b = tripScheduleWindowFromPlannedIso(
      '2026-06-02T08:00:00.000Z',
      '2026-06-03T08:00:00.000Z',
    )!;
    expect(tripScheduleWindowsOverlap(a, b)).toBe(false);
  });
});

describe('tripConflictsWithActiveSchedule', () => {
  it('detects overlap with in_transit trip', () => {
    const candidate = tripScheduleWindowFromPlannedIso(
      '2026-06-01T20:00:00.000Z',
      '2026-06-02T20:00:00.000Z',
    )!;
    const trip = {
      status: 'in_transit',
      plannedDepartureAt: '2026-06-01T08:00:00.000Z',
      plannedCompletionAt: '2026-06-02T08:00:00.000Z',
    } as Trip;
    expect(tripConflictsWithActiveSchedule(trip, candidate)).toBe(true);
  });
});