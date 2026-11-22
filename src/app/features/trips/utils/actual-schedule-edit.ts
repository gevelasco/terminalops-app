import type { Trip, TripStatus } from '@shared/models/logistics.models';
import type { UpdateActualSchedulePayload } from '@shared/models/api/api-trips-actual-schedule.model';
import {
  dateTimeLocalValueToIso,
  isoToDateTimeLocalValue,
  sameScheduleInstant,
} from '@features/trips/utils/datetime-local';
import {
  tripArrivalIso,
  tripCompletionIso,
  tripDepartureIso,
} from '@features/trips/utils/trip-schedule-accessors';

export type ActualScheduleFieldKey = 'departureAt' | 'arrivedAt' | 'returnAt';

export type ActualScheduleDrafts = Record<ActualScheduleFieldKey, string>;

/** Campos editables según estado de la maniobra. */
export function editableActualScheduleFields(status: TripStatus): ActualScheduleFieldKey[] {
  if (status === 'scheduled') {
    return ['departureAt', 'arrivedAt', 'returnAt'];
  }
  if (status === 'in_transit') {
    return ['arrivedAt', 'returnAt'];
  }
  return [];
}

export function isActualScheduleFieldEditable(
  status: TripStatus,
  field: ActualScheduleFieldKey,
): boolean {
  return editableActualScheduleFields(status).includes(field);
}

const MILESTONE_OPERATIVE_ISO: Record<
  ActualScheduleFieldKey,
  (trip: Parameters<typeof tripDepartureIso>[0]) => string | null
> = {
  departureAt: tripDepartureIso,
  arrivedAt: tripArrivalIso,
  returnAt: tripCompletionIso,
};

/** El hito ya pasó (ejecución real o, si no hay, plan operativo). */
export function isRealScheduleMilestoneElapsed(
  trip: Parameters<typeof tripDepartureIso>[0],
  field: ActualScheduleFieldKey,
  nowMs: number = Date.now(),
): boolean {
  const iso = MILESTONE_OPERATIVE_ISO[field](trip)?.trim();
  if (!iso) {
    return false;
  }
  const ms = new Date(iso).getTime();
  if (!Number.isFinite(ms)) {
    return false;
  }
  return ms <= nowMs;
}

const ELAPSED_FIELD_ERROR: Record<ActualScheduleFieldKey, string> = {
  departureAt: 'La salida ya ocurrió; no puedes modificar su fecha real.',
  arrivedAt: 'La cita cliente ya ocurrió; no puedes modificar su fecha real.',
  returnAt: 'La llegada origen ya ocurrió; no puedes modificar su fecha real.',
};

export function realScheduleElapsedChangeError(
  trip: Pick<
    Trip,
    ActualScheduleFieldKey | 'plannedDepartureAt' | 'plannedArrivalAt' | 'plannedCompletionAt' | 'status'
  >,
  drafts: ActualScheduleDrafts,
  nowMs: number = Date.now(),
): string | null {
  if (trip.status !== 'in_transit') {
    return null;
  }
  for (const field of editableActualScheduleFields(trip.status)) {
    if (
      actualScheduleFieldHasChange(trip, field, drafts[field]) &&
      isRealScheduleMilestoneElapsed(trip, field, nowMs)
    ) {
      return ELAPSED_FIELD_ERROR[field];
    }
  }
  return null;
}

const FIELD_PLANNED: Record<
  ActualScheduleFieldKey,
  'plannedDepartureAt' | 'plannedArrivalAt' | 'plannedCompletionAt'
> = {
  departureAt: 'plannedDepartureAt',
  arrivedAt: 'plannedArrivalAt',
  returnAt: 'plannedCompletionAt',
};

export function actualScheduleBaselineIso(
  trip: Pick<Trip, ActualScheduleFieldKey | 'plannedDepartureAt' | 'plannedArrivalAt' | 'plannedCompletionAt'>,
  field: ActualScheduleFieldKey,
): string {
  const persisted = trip[field]?.trim() ?? '';
  if (persisted) {
    return persisted;
  }
  const planned = String(trip[FIELD_PLANNED[field]] ?? '').trim();
  return planned;
}

export function seedActualScheduleDrafts(
  trip: Pick<Trip, ActualScheduleFieldKey | 'plannedDepartureAt' | 'plannedArrivalAt' | 'plannedCompletionAt'>,
): ActualScheduleDrafts {
  return {
    departureAt: isoToDateTimeLocalValue(actualScheduleBaselineIso(trip, 'departureAt')),
    arrivedAt: isoToDateTimeLocalValue(actualScheduleBaselineIso(trip, 'arrivedAt')),
    returnAt: isoToDateTimeLocalValue(actualScheduleBaselineIso(trip, 'returnAt')),
  };
}

export function actualScheduleDraftIso(draftLocal: string): string | null {
  return dateTimeLocalValueToIso(draftLocal);
}

export function actualScheduleFieldHasChange(
  trip: Pick<Trip, ActualScheduleFieldKey | 'plannedDepartureAt' | 'plannedArrivalAt' | 'plannedCompletionAt'>,
  field: ActualScheduleFieldKey,
  draftLocal: string,
): boolean {
  const draftIso = actualScheduleDraftIso(draftLocal);
  if (!draftIso) {
    return false;
  }
  const baseline = actualScheduleBaselineIso(trip, field);
  return !sameScheduleInstant(draftIso, baseline);
}

export function actualScheduleHasAnyChange(
  trip: Pick<
    Trip,
    ActualScheduleFieldKey | 'plannedDepartureAt' | 'plannedArrivalAt' | 'plannedCompletionAt' | 'status'
  >,
  drafts: ActualScheduleDrafts,
  nowMs: number = Date.now(),
): boolean {
  return editableActualScheduleFields(trip.status).some((field) => {
    if (
      trip.status === 'in_transit' &&
      isRealScheduleMilestoneElapsed(trip, field, nowMs)
    ) {
      return false;
    }
    return actualScheduleFieldHasChange(trip, field, drafts[field]);
  });
}

export function effectiveActualScheduleIso(
  trip: Pick<Trip, ActualScheduleFieldKey | 'plannedDepartureAt' | 'plannedArrivalAt' | 'plannedCompletionAt'>,
  field: ActualScheduleFieldKey,
  draftLocal: string,
): string | null {
  if (actualScheduleFieldHasChange(trip, field, draftLocal)) {
    return actualScheduleDraftIso(draftLocal);
  }
  return trip[field]?.trim() || null;
}

export function validateActualScheduleChronology(params: {
  departureIso: string | null;
  arrivedIso: string | null;
  returnIso: string | null;
}): string | null {
  const { departureIso: dep, arrivedIso: arr, returnIso: ret } = params;
  if (dep && arr) {
    if (new Date(dep).getTime() >= new Date(arr).getTime()) {
      return 'El cronograma real debe cumplir: salida < cita cliente.';
    }
  }
  if (arr && ret) {
    if (new Date(arr).getTime() >= new Date(ret).getTime()) {
      return 'La llegada origen real no puede ser anterior a la cita cliente.';
    }
  }
  if (dep && ret && !arr) {
    if (new Date(dep).getTime() >= new Date(ret).getTime()) {
      return 'El cronograma real debe cumplir: salida < llegada origen.';
    }
  }
  return null;
}

export function arrivalIsoForCompletionValidation(
  trip: Pick<Trip, ActualScheduleFieldKey | 'plannedDepartureAt' | 'plannedArrivalAt' | 'plannedCompletionAt'>,
  drafts: ActualScheduleDrafts,
): string | null {
  const effective = effectiveActualScheduleIso(trip, 'arrivedAt', drafts.arrivedAt);
  if (effective) {
    return effective;
  }
  const baseline = actualScheduleBaselineIso(trip, 'arrivedAt').trim();
  return baseline || null;
}

export function buildActualSchedulePayload(
  trip: Pick<
    Trip,
    ActualScheduleFieldKey | 'plannedDepartureAt' | 'plannedArrivalAt' | 'plannedCompletionAt' | 'status'
  >,
  drafts: ActualScheduleDrafts,
  justification: string,
  nowMs: number = Date.now(),
): UpdateActualSchedulePayload | null {
  if (!actualScheduleHasAnyChange(trip, drafts, nowMs)) {
    return null;
  }

  const payload: UpdateActualSchedulePayload = { justification: justification.trim() };

  for (const field of editableActualScheduleFields(trip.status)) {
    if (
      trip.status === 'in_transit' &&
      isRealScheduleMilestoneElapsed(trip, field, nowMs)
    ) {
      continue;
    }
    if (!actualScheduleFieldHasChange(trip, field, drafts[field])) {
      continue;
    }
    const iso = actualScheduleDraftIso(drafts[field]);
    if (!iso) {
      return null;
    }
    payload[field] = iso;
  }

  return payload;
}

export function validateActualScheduleBeforeSave(
  trip: Pick<
    Trip,
    ActualScheduleFieldKey | 'plannedDepartureAt' | 'plannedArrivalAt' | 'plannedCompletionAt' | 'status'
  >,
  drafts: ActualScheduleDrafts,
  justification: string,
  nowMs: number = Date.now(),
): { payload: UpdateActualSchedulePayload } | { error: string } {
  if (!actualScheduleHasAnyChange(trip, drafts, nowMs)) {
    return { error: 'no_changes' };
  }

  if (!justification.trim()) {
    return { error: 'Indica la justificación del cambio en fechas reales.' };
  }

  const elapsedError = realScheduleElapsedChangeError(trip, drafts, nowMs);
  if (elapsedError) {
    return { error: elapsedError };
  }

  for (const field of editableActualScheduleFields(trip.status)) {
    if (actualScheduleFieldHasChange(trip, field, drafts[field])) {
      if (!actualScheduleDraftIso(drafts[field])) {
        return { error: 'Revisa que todas las fechas editadas sean válidas.' };
      }
    }
  }

  const dep = effectiveActualScheduleIso(trip, 'departureAt', drafts.departureAt);
  const arr = arrivalIsoForCompletionValidation(trip, drafts);
  const ret = effectiveActualScheduleIso(trip, 'returnAt', drafts.returnAt);

  const chronologyError = validateActualScheduleChronology({
    departureIso: dep,
    arrivedIso: arr,
    returnIso: ret,
  });
  if (chronologyError) {
    return { error: chronologyError };
  }

  const payload = buildActualSchedulePayload(trip, drafts, justification, nowMs);
  if (!payload) {
    return { error: 'No se pudo preparar la actualización de fechas reales.' };
  }

  return { payload };
}
