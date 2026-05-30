import type { Trip } from '@shared/models/logistics.models';
import { tripOperationalKm } from '@features/trips/utils/trip-operational-km';
import { resourceIdKey } from '@shared/utils/resource-id';

export type UnitCompletedTripStats = {
  completedCountByUnitId: Map<string, number>;
  completedDistanceKmSumByUnitId: Map<string, number>;
};

/** Conteo de maniobras `completed` y suma de km operativos por `unitId`. */
export function buildUnitCompletedTripStats(trips: Trip[]): UnitCompletedTripStats {
  const completedCountByUnitId = new Map<string, number>();
  const completedDistanceKmSumByUnitId = new Map<string, number>();
  for (const t of trips) {
    if (t.status !== 'completed') {
      continue;
    }
    const id = resourceIdKey(t.unitId);
    if (!id) {
      continue;
    }
    completedCountByUnitId.set(id, (completedCountByUnitId.get(id) ?? 0) + 1);
    const d = tripOperationalKm(t);
    if (d > 0) {
      completedDistanceKmSumByUnitId.set(
        id,
        (completedDistanceKmSumByUnitId.get(id) ?? 0) + d,
      );
    }
  }
  return { completedCountByUnitId, completedDistanceKmSumByUnitId };
}
