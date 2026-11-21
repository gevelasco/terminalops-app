import { dateTimeLocalValueToIso } from '@features/trips/utils/datetime-local';
import type { DestinationRate } from '@shared/models/destination-rate.models';

type DestinationRateEstimatedTimeFields = Pick<
  DestinationRate,
  'estimatedArrivalTimeValue' | 'estimatedReturnTimeValue'
>;

function hasEstimatedTimeFields(rate: DestinationRateEstimatedTimeFields): boolean {
  return (
    rate.estimatedArrivalTimeValue != null &&
    rate.estimatedArrivalTimeValue > 0 &&
    rate.estimatedReturnTimeValue != null &&
    rate.estimatedReturnTimeValue > 0
  );
}

export function estimatedHoursToMs(value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }
  return value * 60 * 60 * 1000;
}

/** Convierte `Date` local a valor `datetime-local` (`yyyy-mm-ddTHH:mm`). */
export function dateToDateTimeLocalValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * Sugiere cita cliente y llegada origen a partir de salida + tiempos referenciales de tarifa (horas).
 * Solo UX — no operativo.
 */
export function computePlannedScheduleSuggestionFromRate(
  departureLocal: string,
  rate: DestinationRateEstimatedTimeFields,
): { arrivalLocal: string; completionLocal: string } | null {
  if (!hasEstimatedTimeFields(rate)) {
    return null;
  }
  const departureIso = dateTimeLocalValueToIso(departureLocal);
  if (!departureIso) {
    return null;
  }
  const arrivalMs =
    new Date(departureIso).getTime() +
    estimatedHoursToMs(rate.estimatedArrivalTimeValue!);
  const completionMs =
    arrivalMs + estimatedHoursToMs(rate.estimatedReturnTimeValue!);
  const arrivalDate = new Date(arrivalMs);
  const completionDate = new Date(completionMs);
  if (
    Number.isNaN(arrivalDate.getTime()) ||
    Number.isNaN(completionDate.getTime())
  ) {
    return null;
  }
  return {
    arrivalLocal: dateToDateTimeLocalValue(arrivalDate),
    completionLocal: dateToDateTimeLocalValue(completionDate),
  };
}