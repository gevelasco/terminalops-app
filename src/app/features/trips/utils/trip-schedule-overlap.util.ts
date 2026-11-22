import type { Trip, TripStatus } from '@shared/models/logistics.models';
import { tripCompletionIso, tripDepartureIso } from '@features/trips/utils/trip-schedule-accessors';

export type TripScheduleWindow = {
  startMs: number;
  endMs: number;
};

const ACTIVE: TripStatus[] = ['scheduled', 'in_transit'];

export function tripScheduleWindowFromPlannedIso(
  departureIso: string,
  completionIso: string,
): TripScheduleWindow | null {
  const startMs = Date.parse(departureIso);
  const endMs = Date.parse(completionIso);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) {
    return null;
  }
  return { startMs, endMs: Math.max(startMs, endMs) };
}

export function tripScheduleWindowFromTrip(trip: Trip): TripScheduleWindow | null {
  const startIso = tripDepartureIso(trip);
  const endIso = tripCompletionIso(trip);
  if (!startIso || !endIso) {
    return null;
  }
  return tripScheduleWindowFromPlannedIso(startIso, endIso);
}

export function tripScheduleWindowsOverlap(
  a: TripScheduleWindow,
  b: TripScheduleWindow,
): boolean {
  return a.startMs < b.endMs && b.startMs < a.endMs;
}

export function tripConflictsWithActiveSchedule(
  trip: Trip,
  candidate: TripScheduleWindow,
): boolean {
  if (!ACTIVE.includes(trip.status)) {
    return false;
  }
  const other = tripScheduleWindowFromTrip(trip);
  if (!other) {
    return true;
  }
  return tripScheduleWindowsOverlap(candidate, other);
}

export function resourceIdsBlockedBySchedule(
  trips: readonly Trip[],
  candidate: TripScheduleWindow,
  resource: {
    unitId?: string;
    operatorId?: string;
    equipmentIds?: readonly string[];
  },
): boolean {
  for (const trip of trips) {
    if (!ACTIVE.includes(trip.status)) {
      continue;
    }
    const unitMatch =
      resource.unitId != null &&
      resource.unitId.length > 0 &&
      trip.unitId === resource.unitId;
    const operatorMatch =
      resource.operatorId != null &&
      resource.operatorId.length > 0 &&
      trip.operatorId === resource.operatorId;
    const equipmentMatch =
      resource.equipmentIds?.some((id) => (trip.equipmentIds ?? []).includes(id)) ??
      false;
    if (!unitMatch && !operatorMatch && !equipmentMatch) {
      continue;
    }
    if (tripConflictsWithActiveSchedule(trip, candidate)) {
      return true;
    }
  }
  return false;
}