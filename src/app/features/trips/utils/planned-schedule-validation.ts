import { dateTimeLocalValueToIso } from './datetime-local';

function startOfLocalDay(value: Date): number {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
}

function localDateTimeIsOnOrAfterToday(local: string, now: Date): boolean {
  const iso = dateTimeLocalValueToIso(local);
  if (!iso) {
    return false;
  }
  return startOfLocalDay(new Date(iso)) >= startOfLocalDay(now);
}

/**
 * Maniobra ya cerrada en días anteriores. Si salida, cita o llegada origen
 * pueden caer hoy o después, la asignación vuelve a ser solo disponibles.
 */
export function isHistoricalManeuverAssignment(
  departureLocal: string,
  nowOrOptions?: Date | {
    arrivalLocal?: string;
    completionLocal?: string;
    now?: Date;
  },
): boolean {
  const opts =
    nowOrOptions instanceof Date || nowOrOptions == null
      ? { now: nowOrOptions }
      : nowOrOptions;
  const now = opts.now ?? new Date();
  const departureIso = dateTimeLocalValueToIso(departureLocal);
  if (!departureIso) {
    return false;
  }
  if (startOfLocalDay(new Date(departureIso)) >= startOfLocalDay(now)) {
    return false;
  }
  if (
    localDateTimeIsOnOrAfterToday(opts.arrivalLocal ?? '', now) ||
    localDateTimeIsOnOrAfterToday(opts.completionLocal ?? '', now)
  ) {
    return false;
  }
  return true;
}

/** Contrato de planificación: salida ≤ cita cliente ≤ llegada origen. */
export function isPlannedScheduleValid(
  departureLocal: string,
  arrivalLocal: string,
  completionLocal: string,
): boolean {
  const departureIso = dateTimeLocalValueToIso(departureLocal);
  const arrivalIso = dateTimeLocalValueToIso(arrivalLocal);
  const completionIso = dateTimeLocalValueToIso(completionLocal);
  if (!departureIso || !arrivalIso || !completionIso) {
    return false;
  }
  const departureMs = new Date(departureIso).getTime();
  const arrivalMs = new Date(arrivalIso).getTime();
  const completionMs = new Date(completionIso).getTime();
  return departureMs <= arrivalMs && arrivalMs <= completionMs;
}

export function plannedScheduleArrivalOrderIssue(
  departureLocal: string,
  arrivalLocal: string,
): string | null {
  const departureIso = dateTimeLocalValueToIso(departureLocal);
  const arrivalIso = dateTimeLocalValueToIso(arrivalLocal);
  if (!departureIso || !arrivalIso) {
    return null;
  }
  if (new Date(arrivalIso).getTime() < new Date(departureIso).getTime()) {
    return 'La cita cliente no puede ser anterior a la salida.';
  }
  return null;
}

export function plannedScheduleCompletionOrderIssue(
  arrivalLocal: string,
  completionLocal: string,
): string | null {
  const arrivalIso = dateTimeLocalValueToIso(arrivalLocal);
  const completionIso = dateTimeLocalValueToIso(completionLocal);
  if (!arrivalIso || !completionIso) {
    return null;
  }
  if (new Date(completionIso).getTime() < new Date(arrivalIso).getTime()) {
    return 'La llegada origen no puede ser anterior a la cita cliente.';
  }
  return null;
}

export function plannedScheduleCompletionDepartureOrderIssue(
  departureLocal: string,
  completionLocal: string,
): string | null {
  const departureIso = dateTimeLocalValueToIso(departureLocal);
  const completionIso = dateTimeLocalValueToIso(completionLocal);
  if (!departureIso || !completionIso) {
    return null;
  }
  if (new Date(completionIso).getTime() < new Date(departureIso).getTime()) {
    return 'La llegada origen no puede ser anterior a la salida.';
  }
  return null;
}

export function plannedScheduleOrderToastMessage(
  departureLocal: string,
  arrivalLocal: string,
  completionLocal: string,
): string | null {
  return (
    plannedScheduleArrivalOrderIssue(departureLocal, arrivalLocal) ??
    plannedScheduleCompletionDepartureOrderIssue(departureLocal, completionLocal) ??
    plannedScheduleCompletionOrderIssue(arrivalLocal, completionLocal)
  );
}

/** Día local `YYYY-MM-DD` de un `datetime-local`. */
export function dateTimeLocalDay(local: string): string | null {
  const t = local.trim();
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(t)) {
    return null;
  }
  return t.slice(0, 10);
}

/**
 * Cita de carga (opcional): si se captura, debe ser ≤ salida planificada.
 * Vacío no es error.
 */
export function loadDateDepartureIssue(
  loadLocal: string,
  departureLocal: string,
): string | null {
  if (!loadLocal.trim()) {
    return null;
  }
  const loadIso = dateTimeLocalValueToIso(loadLocal);
  const departureIso = dateTimeLocalValueToIso(departureLocal);
  if (!loadIso || !departureIso) {
    return null;
  }
  if (new Date(loadIso).getTime() > new Date(departureIso).getTime()) {
    return 'La cita de carga no puede ser posterior a la salida.';
  }
  return null;
}

export function plannedScheduleIsoTriplet(
  departureLocal: string,
  arrivalLocal: string,
  completionLocal: string,
): { plannedDepartureAt: string; plannedArrivalAt: string; plannedCompletionAt: string } | null {
  if (!isPlannedScheduleValid(departureLocal, arrivalLocal, completionLocal)) {
    return null;
  }
  return {
    plannedDepartureAt: dateTimeLocalValueToIso(departureLocal)!,
    plannedArrivalAt: dateTimeLocalValueToIso(arrivalLocal)!,
    plannedCompletionAt: dateTimeLocalValueToIso(completionLocal)!,
  };
}
