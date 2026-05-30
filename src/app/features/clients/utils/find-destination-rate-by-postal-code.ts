import { normalizeMxPostalCodeDigits } from '@features/trips/utils/mx-postal-settlement';
import type {
  DestinationRate,
  DestinationRatePrice,
} from '@shared/models/destination-rate.models';

/**
 * Match operacional por CP (sin lat/lng ni geofencing).
 * Si hay varias tarifas activas para el mismo CP, devuelve la primera.
 */
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

export function suggestedClientChargeFromDestinationRate(
  rate: DestinationRate,
  operationConfigurationCode: string,
): number | null {
  const price = findDestinationRatePriceByOperationCode(
    rate,
    operationConfigurationCode,
  );
  if (!price || price.clientCharge <= 0) {
    return null;
  }
  return price.clientCharge;
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
