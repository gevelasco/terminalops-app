import { dateTimeLocalValueToIso } from './datetime-local';

/** Contrato de planificación: salida < llegada cliente < fin de maniobra. */
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
  return departureMs < arrivalMs && arrivalMs < completionMs;
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
