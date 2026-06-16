import { dateTimeLocalValueToIso } from '@features/trips/utils/datetime-local';
import type {
  DestinationRate,
  DestinationRateEstimatedTimeUnit,
} from '@shared/models/destination-rate.models';

type DestinationRateEstimatedTimeFields = Pick<
  DestinationRate,
  'estimatedArrivalTimeValue' | 'estimatedReturnTimeValue' | 'estimatedTimeUnit'
>;

function hasEstimatedTimeFields(rate: DestinationRateEstimatedTimeFields): boolean {
  return (
    rate.estimatedArrivalTimeValue != null &&
    rate.estimatedArrivalTimeValue > 0 &&
    rate.estimatedReturnTimeValue != null &&
    rate.estimatedReturnTimeValue > 0 &&
    (rate.estimatedTimeUnit === 'hours' || rate.estimatedTimeUnit === 'days')
  );
}

export function estimatedTimeUnitToMs(
  value: number,
  unit: DestinationRateEstimatedTimeUnit,
): number {
  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }
  return unit === 'days'
    ? value * 24 * 60 * 60 * 1000
    : value * 60 * 60 * 1000;
}

/** Convierte `Date` local a valor `datetime-local` (`yyyy-mm-ddTHH:mm`). */
export function dateToDateTimeLocalValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * Sugiere llegada cliente y fin a partir de salida + tiempos referenciales de tarifa.
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
  const unit = rate.estimatedTimeUnit!;
  const arrivalMs =
    new Date(departureIso).getTime() +
    estimatedTimeUnitToMs(rate.estimatedArrivalTimeValue!, unit);
  const completionMs =
    arrivalMs + estimatedTimeUnitToMs(rate.estimatedReturnTimeValue!, unit);
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
