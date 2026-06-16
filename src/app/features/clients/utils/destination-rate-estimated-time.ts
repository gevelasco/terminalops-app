import type { DestinationRateEstimatedTimeUnit } from '@shared/models/destination-rate.models';

export function parseEstimatedTimeValueInput(raw: string): number | undefined {
  const t = raw.trim().replace(',', '.');
  if (t === '') {
    return undefined;
  }
  const n = Number(t);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

export function formatEstimatedTimeValueNumber(value: number): string {
  if (!Number.isFinite(value)) {
    return '—';
  }
  if (Number.isInteger(value)) {
    return String(value);
  }
  return new Intl.NumberFormat('es-MX', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  }).format(value);
}

/** Visualización pura para tabla y detalle: «X hrs» o «X días». */
export function formatDestinationRateEstimatedTimeDisplay(
  value: number | undefined,
  unit: DestinationRateEstimatedTimeUnit | undefined,
): string {
  if (value == null || unit == null || !Number.isFinite(value) || value <= 0) {
    return '—';
  }
  const suffix = unit === 'hours' ? 'hrs' : 'días';
  return `${formatEstimatedTimeValueNumber(value)} ${suffix}`;
}

export function estimatedTimeUnitSuffix(
  unit: string,
): string {
  if (unit === 'hours') {
    return 'hrs';
  }
  if (unit === 'days') {
    return 'días';
  }
  return '';
}

export function validateDestinationRateEstimatedTimesInput(params: {
  arrivalRaw: string;
  returnRaw: string;
  unit: string;
}): string | null {
  const arrivalRaw = params.arrivalRaw.trim();
  const returnRaw = params.returnRaw.trim();
  const unit = params.unit.trim();
  if (!arrivalRaw && !returnRaw && !unit) {
    return null;
  }
  if (!unit || (unit !== 'hours' && unit !== 'days')) {
    return 'Selecciona la unidad de tiempo (horas o días).';
  }
  const arrival = parseEstimatedTimeValueInput(arrivalRaw);
  const returnValue = parseEstimatedTimeValueInput(returnRaw);
  if (arrival === undefined) {
    return 'Indica el tiempo de ida (valor mayor a 0).';
  }
  if (returnValue === undefined) {
    return 'Indica el tiempo de retorno (valor mayor a 0).';
  }
  return null;
}

export function estimatedTimesFormStringsFromRate(rate: {
  estimatedArrivalTimeValue?: number;
  estimatedReturnTimeValue?: number;
  estimatedTimeUnit?: DestinationRateEstimatedTimeUnit;
}): {
  arrival: string;
  returnValue: string;
  unit: string;
} {
  const unit = rate.estimatedTimeUnit ?? '';
  const arrival =
    rate.estimatedArrivalTimeValue != null && rate.estimatedArrivalTimeValue > 0
      ? formatEstimatedTimeValueNumber(rate.estimatedArrivalTimeValue)
      : '';
  const returnValue =
    rate.estimatedReturnTimeValue != null && rate.estimatedReturnTimeValue > 0
      ? formatEstimatedTimeValueNumber(rate.estimatedReturnTimeValue)
      : '';
  return { arrival, returnValue, unit };
}
