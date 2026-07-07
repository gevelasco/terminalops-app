import { dateTimeLocalValueToIso } from './datetime-local';

/** Contrato de planificación: salida ≤ llegada cliente ≤ fin de maniobra. */
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
    return 'La llegada al cliente no puede ser anterior a la salida.';
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
    return 'La llegada / fin no puede ser anterior a la llegada al cliente.';
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
    return 'La llegada / fin no puede ser anterior a la salida.';
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
