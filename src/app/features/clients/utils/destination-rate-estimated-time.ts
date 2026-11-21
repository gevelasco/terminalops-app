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

/** Visualización en tabla/detalle: horas de manejo. */
export function formatDestinationRateEstimatedTimeDisplay(
  value: number | undefined,
): string {
  if (value == null || !Number.isFinite(value) || value <= 0) {
    return '—';
  }
  return `${formatEstimatedTimeValueNumber(value)} hrs`;
}

export function validateDestinationRateEstimatedTimesInput(params: {
  arrivalRaw: string;
  returnRaw: string;
}): string | null {
  const arrivalRaw = params.arrivalRaw.trim();
  const returnRaw = params.returnRaw.trim();
  if (!arrivalRaw && !returnRaw) {
    return null;
  }
  const arrival = parseEstimatedTimeValueInput(arrivalRaw);
  const returnValue = parseEstimatedTimeValueInput(returnRaw);
  if (arrival === undefined) {
    return 'Indica el tiempo de manejo (ida) en horas.';
  }
  if (returnValue === undefined) {
    return 'Indica el tiempo de manejo (retorno) en horas.';
  }
  return null;
}

export function estimatedTimesFormStringsFromRate(rate: {
  estimatedArrivalTimeValue?: number;
  estimatedReturnTimeValue?: number;
}): {
  arrival: string;
  returnValue: string;
} {
  const arrival =
    rate.estimatedArrivalTimeValue != null && rate.estimatedArrivalTimeValue > 0
      ? formatEstimatedTimeValueNumber(rate.estimatedArrivalTimeValue)
      : '';
  const returnValue =
    rate.estimatedReturnTimeValue != null && rate.estimatedReturnTimeValue > 0
      ? formatEstimatedTimeValueNumber(rate.estimatedReturnTimeValue)
      : '';
  return { arrival, returnValue };
}

/** ETA redondo en tabla (ida + retorno). */
export function formatDestinationRateRoundTripDriveTime(
  rate: Pick<
    { estimatedArrivalTimeValue?: number; estimatedReturnTimeValue?: number },
    'estimatedArrivalTimeValue' | 'estimatedReturnTimeValue'
  >,
): string {
  const arrival =
    rate.estimatedArrivalTimeValue != null &&
    Number.isFinite(rate.estimatedArrivalTimeValue) &&
    rate.estimatedArrivalTimeValue > 0
      ? rate.estimatedArrivalTimeValue
      : 0;
  const ret =
    rate.estimatedReturnTimeValue != null &&
    Number.isFinite(rate.estimatedReturnTimeValue) &&
    rate.estimatedReturnTimeValue > 0
      ? rate.estimatedReturnTimeValue
      : 0;
  const total = arrival + ret;
  if (total <= 0) {
    return '—';
  }
  return `${formatEstimatedTimeValueNumber(total)} hrs`;
}