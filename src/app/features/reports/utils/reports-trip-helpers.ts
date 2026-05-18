import type { Trip } from '@shared/models/logistics.models';
import { parseMoney } from './reports-money';

/** Monto pactado con el cliente (0 si no aplica cobro). */
export function tripRevenue(t: Trip): number {
  if (!isTripBillableForReporting(t)) {
    return 0;
  }
  return parseMoney(t.clientCharge);
}

export function isTripBillableForReporting(t: Trip): boolean {
  if (t.hasClientBilling === false) {
    return false;
  }
  if (parseMoney(t.clientCharge) <= 0) {
    return false;
  }
  if (t.status === 'completed') {
    return true;
  }
  if (t.status === 'cancelled' && t.falseManeuver === true) {
    return true;
  }
  return false;
}

export function isTripClientCollected(t: Trip): boolean {
  const at = t.clientCollectedAt;
  return typeof at === 'string' && at.trim().length > 0;
}

/** Ingreso efectivo: cobro confirmado en el periodo. */
export function tripCollectedRevenue(t: Trip): number {
  return isTripClientCollected(t) ? tripRevenue(t) : 0;
}

/** Por cobrar: cobro pactado aún no confirmado. */
export function tripCreditReceivable(t: Trip): number {
  return isTripBillableForReporting(t) && !isTripClientCollected(t) ? tripRevenue(t) : 0;
}

export function tripDiesel(t: Trip): number {
  return parseMoney(t.dieselAmount);
}

export function tripCasetas(t: Trip): number {
  return parseMoney(t.casetasAmount);
}

export function tripOperatorQuota(t: Trip): number {
  return parseMoney(t.operatorQuota);
}

export function tripDirectCost(t: Trip): number {
  return tripDiesel(t) + tripCasetas(t) + tripOperatorQuota(t);
}

export function tripKm(t: Trip): number {
  const km = t.routeDistanceKm;
  return typeof km === 'number' && Number.isFinite(km) && km > 0 ? km : 0;
}

export function sumTripKm(trips: readonly Trip[]): number {
  return trips.reduce((a, t) => a + tripKm(t), 0);
}

/** Total pactado (cobrado + por cobrar). */
export function sumTripRevenue(trips: readonly Trip[]): number {
  return trips.reduce((a, t) => a + tripRevenue(t), 0);
}

export function sumTripCollectedRevenue(trips: readonly Trip[]): number {
  return trips.reduce((a, t) => a + tripCollectedRevenue(t), 0);
}

export function sumTripCreditReceivable(trips: readonly Trip[]): number {
  return trips.reduce((a, t) => a + tripCreditReceivable(t), 0);
}

export function sumTripDirectCost(trips: readonly Trip[]): number {
  return trips.reduce((a, t) => a + tripDirectCost(t), 0);
}
