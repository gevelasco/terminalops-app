import type { Trip } from '@shared/models/logistics.models';
import { sameScheduleInstant } from '@features/trips/utils/datetime-local';

type TripScheduleRecord = {
  status?: string | null;
  createdAt?: string | null;
  departureAt?: string | null;
  arrivedAt?: string | null;
  returnAt?: string | null;
  plannedDepartureAt?: string | null;
  plannedArrivalAt?: string | null;
  plannedCompletionAt?: string | null;
};

type ActualScheduleFieldKey = 'departureAt' | 'arrivedAt' | 'returnAt';

function hasSpuriousActualScheduleCluster(trip: TripScheduleRecord): boolean {
  const values = [trip.departureAt, trip.arrivedAt, trip.returnAt]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));
  if (values.length < 2) {
    return false;
  }
  const first = values[0]!;
  return values.every((value) => sameScheduleInstant(value, first));
}

/** Fecha real persistida y válida; null si aún no hay ejecución registrada. */
function exposedActualIso(
  trip: TripScheduleRecord,
  field: ActualScheduleFieldKey,
): string | null {
  const raw = trip[field]?.trim();
  if (!raw) {
    return null;
  }
  if (trip.status === 'scheduled') {
    return null;
  }
  if (hasSpuriousActualScheduleCluster(trip)) {
    return null;
  }
  if (trip.createdAt?.trim() && sameScheduleInstant(raw, trip.createdAt)) {
    return null;
  }
  return raw;
}

/** Salida: ejecución real si existe; si no, plan operativo. */
export function tripDepartureIso(
  trip: TripScheduleRecord | Pick<Trip, 'departureAt' | 'plannedDepartureAt' | 'status' | 'createdAt'>,
): string | null {
  return (
    exposedActualIso(trip, 'departureAt') ??
    trip.plannedDepartureAt?.trim() ??
    null
  );
}

/** Llegada al cliente: ejecución real si existe; si no, plan operativo. */
export function tripArrivalIso(
  trip: TripScheduleRecord | Pick<Trip, 'arrivedAt' | 'plannedArrivalAt' | 'status' | 'createdAt'>,
): string | null {
  return (
    exposedActualIso(trip, 'arrivedAt') ??
    trip.plannedArrivalAt?.trim() ??
    null
  );
}

/** Fin de maniobra: real si existe; si no, plan operativo. */
export function tripCompletionIso(
  trip:
    | TripScheduleRecord
    | Pick<Trip, 'returnAt' | 'plannedCompletionAt' | 'status' | 'createdAt'>,
): string | null {
  return (
    exposedActualIso(trip, 'returnAt') ??
    trip.plannedCompletionAt?.trim() ??
    null
  );
}

export { hasSpuriousActualScheduleCluster };
