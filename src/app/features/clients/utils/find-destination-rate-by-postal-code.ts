import { normalizeMxPostalCodeDigits } from '@features/trips/utils/mx-postal-settlement';
import type {
  DestinationRate,
  DestinationRatePrice,
} from '@shared/models/destination-rate.models';

/**
 * Match operacional por centro operativo + CP destino + localidad destino.
 */
export function findDestinationRateByRoute(
  rates: readonly DestinationRate[],
  params: {
    originOperationalCenterId: string;
    destinationPostalCode: string;
    destinationLocality: string;
  },
  options?: { activeOnly?: boolean },
): DestinationRate | null {
  const originId = params.originOperationalCenterId.trim();
  const cp = normalizeMxPostalCodeDigits(params.destinationPostalCode);
  const locality = params.destinationLocality.trim().toLowerCase();
  const activeOnly = options?.activeOnly !== false;
  if (!originId || cp.length !== 5 || !locality) {
    return null;
  }
  return (
    rates.find(
      (r) =>
        (!activeOnly || r.active) &&
        r.originOperationalCenterId === originId &&
        r.postalCode === cp &&
        r.locality.trim().toLowerCase() === locality,
    ) ?? null
  );
}

function destinationRouteMatchesRate(
  rate: DestinationRate,
  params: {
    originOperationalCenterId: string;
    destinationPostalCode: string;
    destinationLocality: string;
  },
): boolean {
  const originId = params.originOperationalCenterId.trim();
  const cp = normalizeMxPostalCodeDigits(params.destinationPostalCode);
  const locality = params.destinationLocality.trim().toLowerCase();
  if (!originId || cp.length !== 5 || !locality) {
    return false;
  }
  return (
    rate.active &&
    rate.originOperationalCenterId === originId &&
    rate.postalCode === cp &&
    rate.locality.trim().toLowerCase() === locality
  );
}

/**
 * Tarifa aplicable al crear maniobra: ruta operativa + tarifa vinculada a la entrega del cliente.
 */
export function resolveManeuverDestinationRate(
  rates: readonly DestinationRate[],
  params: {
    originOperationalCenterId: string;
    destinationPostalCode: string;
    destinationLocality: string;
    clientDestinationRateId?: string | null;
  },
): DestinationRate | null {
  const routeParams = {
    originOperationalCenterId: params.originOperationalCenterId,
    destinationPostalCode: params.destinationPostalCode,
    destinationLocality: params.destinationLocality,
  };
  const routeMatch = findDestinationRateByRoute(rates, routeParams);
  const linkedId = params.clientDestinationRateId?.trim();
  if (!linkedId) {
    return routeMatch;
  }

  const linkedRate = rates.find((r) => r.id === linkedId && r.active) ?? null;
  if (!linkedRate) {
    return routeMatch;
  }

  if (!destinationRouteMatchesRate(linkedRate, routeParams)) {
    return null;
  }

  return linkedRate;
}

/** @deprecated Usar findDestinationRateByRoute */
export function findDestinationRateByPostalCode(
  rates: readonly DestinationRate[],
  postalCode: string,
): DestinationRate | null {
  const cp = normalizeMxPostalCodeDigits(postalCode);
  if (cp.length !== 5) {
    return null;
  }
  return rates.find((r) => r.active && r.postalCode === cp) ?? null;
}

export function findDestinationRatePriceByOperationCode(
  rate: DestinationRate,
  operationConfigurationCode: string,
): DestinationRatePrice | null {
  const code = operationConfigurationCode.trim().toLowerCase();
  if (!code) {
    return null;
  }
  return (
    rate.prices.find(
      (p) => (p.operationConfigurationCode ?? '').trim().toLowerCase() === code,
    ) ?? null
  );
}

/** Cobro sugerido: 0 si la tarifa no define precio para el tipo de maniobra. */
export function suggestedClientChargeFromDestinationRate(
  rate: DestinationRate,
  operationConfigurationCode: string,
): number {
  const price = findDestinationRatePriceByOperationCode(
    rate,
    operationConfigurationCode,
  );
  return price?.clientCharge ?? 0;
}

export function destinationRateHasClientChargeForOperation(
  rate: DestinationRate,
  operationConfigurationCode: string,
): boolean {
  return findDestinationRatePriceByOperationCode(rate, operationConfigurationCode) != null;
}

export function suggestedOperatorPaymentFromDestinationRate(
  rate: DestinationRate,
  operationConfigurationCode: string,
): number | null {
  const price = findDestinationRatePriceByOperationCode(
    rate,
    operationConfigurationCode,
  );
  if (!price || price.operatorPaymentEstimate <= 0) {
    return null;
  }
  return price.operatorPaymentEstimate;
}

export function suggestedEstimatedTollFromDestinationRate(
  rate: DestinationRate,
  operationConfigurationCode: string,
): number | null {
  const price = findDestinationRatePriceByOperationCode(
    rate,
    operationConfigurationCode,
  );
  if (!price || price.estimatedTollAmount <= 0) {
    return null;
  }
  return price.estimatedTollAmount;
}

export function destinationRateHasRouteCache(rate: DestinationRate): boolean {
  return rate.routeDistanceKm != null && rate.routeDistanceKm > 0;
}

/** Referencia UX: tiempos estimados configurados en tarifa (no operativo). */
export function destinationRateHasEstimatedTime(rate: DestinationRate): boolean {
  return (
    rate.estimatedArrivalTimeValue != null &&
    rate.estimatedArrivalTimeValue > 0 &&
    rate.estimatedReturnTimeValue != null &&
    rate.estimatedReturnTimeValue > 0 &&
    (rate.estimatedTimeUnit === 'hours' || rate.estimatedTimeUnit === 'days')
  );
}
