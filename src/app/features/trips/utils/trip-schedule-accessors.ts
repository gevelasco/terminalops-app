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

/** Salida y cita cliente no pueden compartir el mismo instante. */
function hasPairedSpuriousDepartureArrival(trip: TripScheduleRecord): boolean {
  const departure = trip.departureAt?.trim();
  const arrival = trip.arrivedAt?.trim();
  if (!departure || !arrival) {
    return false;
  }
  return sameScheduleInstant(departure, arrival);
}

/**
 * Salida y llegada origen no pueden ser el mismo instante (p. ej. overview rellena ambos con «ahora»).
 */
function hasPairedSpuriousDepartureCompletion(trip: TripScheduleRecord): boolean {
  const departure = trip.departureAt?.trim();
  const completion = trip.returnAt?.trim();
  if (!departure || !completion) {
    return false;
  }
  return sameScheduleInstant(departure, completion);
}

function actualInstantMs(
  trip: TripScheduleRecord,
  field: ActualScheduleFieldKey,
): number | null {
  const raw = trip[field]?.trim();
  if (!raw) {
    return null;
  }
  const ms = new Date(raw).getTime();
  return Number.isFinite(ms) ? ms : null;
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
  if (
    (field === 'departureAt' || field === 'arrivedAt') &&
    hasPairedSpuriousDepartureArrival(trip)
  ) {
    return null;
  }
  if (
    (field === 'departureAt' || field === 'returnAt') &&
    hasPairedSpuriousDepartureCompletion(trip)
  ) {
    return null;
  }
  if (trip.createdAt?.trim() && sameScheduleInstant(raw, trip.createdAt)) {
    return null;
  }

  const departureMs = actualInstantMs(trip, 'departureAt');
  const arrivalMs = actualInstantMs(trip, 'arrivedAt');
  const completionMs = actualInstantMs(trip, 'returnAt');
  if (
    field === 'departureAt' &&
    departureMs !== null &&
    arrivalMs !== null &&
    departureMs >= arrivalMs
  ) {
    return null;
  }
  if (
    field === 'returnAt' &&
    completionMs !== null &&
    arrivalMs !== null &&
    completionMs <= arrivalMs
  ) {
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

/** Cita cliente: ejecución real si existe; si no, plan operativo. */
export function tripArrivalIso(
  trip: TripScheduleRecord | Pick<Trip, 'arrivedAt' | 'plannedArrivalAt' | 'status' | 'createdAt'>,
): string | null {
  return (
    exposedActualIso(trip, 'arrivedAt') ??
    trip.plannedArrivalAt?.trim() ??
    null
  );
}

/** Llegada origen: real si existe; si no, plan operativo. */
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

/** Salida real persistida y válida (sin fallback al plan). */
export function tripActualDepartureIso(
  trip: TripScheduleRecord | Pick<Trip, 'departureAt' | 'status' | 'createdAt'>,
): string | null {
  return exposedActualIso(trip, 'departureAt');
}

/** Llegada al cliente real persistida y válida (sin fallback al plan). */
export function tripActualArrivalIso(
  trip: TripScheduleRecord | Pick<Trip, 'arrivedAt' | 'status' | 'createdAt'>,
): string | null {
  return exposedActualIso(trip, 'arrivedAt');
}

/** Fin real persistido y válido (sin fallback al plan). */
export function tripActualCompletionIso(
  trip: TripScheduleRecord | Pick<Trip, 'returnAt' | 'status' | 'createdAt'>,
): string | null {
  return exposedActualIso(trip, 'returnAt');
}

const PLANNED_FOR_ACTUAL: Record<
  ActualScheduleFieldKey,
  'plannedDepartureAt' | 'plannedArrivalAt' | 'plannedCompletionAt'
> = {
  departureAt: 'plannedDepartureAt',
  arrivedAt: 'plannedArrivalAt',
  returnAt: 'plannedCompletionAt',
};

/**
 * Columna «Actualización en …» del timeline: solo si hay ejecución real
 * distinta del plan (evita confundir cita planificada con entrega de vacío u otra fase).
 */
export function actualScheduleUpdateVisible(
  trip: TripScheduleRecord,
  field: ActualScheduleFieldKey,
): boolean {
  if (trip.status === 'scheduled') {
    return false;
  }
  const actual = exposedActualIso(trip, field);
  if (!actual) {
    return false;
  }
  const planned = String(trip[PLANNED_FOR_ACTUAL[field]] ?? '').trim();
  if (!planned) {
    return true;
  }
  return !sameScheduleInstant(actual, planned);
}

export { hasSpuriousActualScheduleCluster };
