import type { Trip } from '@shared/models/logistics.models';

export type UnitCompletedTripStats = {
  completedCountByUnitId: Map<string, number>;
  completedDistanceKmSumByUnitId: Map<string, number>;
};

/** Conteo de maniobras `completed` y suma de `routeDistanceKm` por `unitId`. */
export function buildUnitCompletedTripStats(trips: Trip[]): UnitCompletedTripStats {
  const completedCountByUnitId = new Map<string, number>();
  const completedDistanceKmSumByUnitId = new Map<string, number>();
  for (const t of trips) {
    if (t.status !== 'completed') {
      continue;
    }
    const id = t.unitId?.trim();
    if (!id) {
      continue;
    }
    completedCountByUnitId.set(id, (completedCountByUnitId.get(id) ?? 0) + 1);
    const d = t.routeDistanceKm;
    if (typeof d === 'number' && Number.isFinite(d) && d > 0) {
      completedDistanceKmSumByUnitId.set(
        id,
        (completedDistanceKmSumByUnitId.get(id) ?? 0) + d,
      );
    }
  }
  return { completedCountByUnitId, completedDistanceKmSumByUnitId };
}
