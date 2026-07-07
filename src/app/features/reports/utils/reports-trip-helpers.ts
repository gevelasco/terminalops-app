import type { Expense, ExpenseKind, Trip } from '@shared/models/logistics.models';
import { tripOperationalKm } from '@features/trips/utils/trip-operational-km';
import { parseMoney } from './reports-money';

/** Gastos automáticos al programar maniobra; si existen en ledger, no usar campos del trip. */
const TRIP_PROGRAMMED_LEDGER_KINDS: ReadonlySet<ExpenseKind> = new Set([
  'fuel',
  'tolls',
  'operator_payment',
]);

export function tripLedgerExpenses(
  tripId: string,
  expenses: readonly Expense[],
): Expense[] {
  const id = tripId.trim();
  return expenses.filter((e) => e.tripId.trim() === id);
}

export function ledgerCoversTripProgrammedCosts(ledger: readonly Expense[]): boolean {
  return ledger.some((e) => TRIP_PROGRAMMED_LEDGER_KINDS.has(e.kind));
}

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

export function tripPerDiem(t: Trip): number {
  return parseMoney(t.perDiemAmount);
}

export function tripDirectCost(t: Trip): number {
  return tripDiesel(t) + tripCasetas(t) + tripOperatorQuota(t) + tripPerDiem(t);
}

/** Costo de maniobra sin duplicar ledger vs montos programados del trip. */
export function tripResolvedDirectCost(
  trip: Trip,
  expenses: readonly Expense[] = [],
): number {
  const ledger = tripLedgerExpenses(trip.id, expenses);
  if (ledgerCoversTripProgrammedCosts(ledger)) {
    return ledger.reduce((sum, expense) => sum + expense.amount, 0);
  }
  return tripDirectCost(trip);
}

export function sumTripResolvedDirectCost(
  trips: readonly Trip[],
  expenses: readonly Expense[] = [],
): number {
  return trips.reduce((sum, trip) => sum + tripResolvedDirectCost(trip, expenses), 0);
}

export function tripKm(t: Trip): number {
  return tripOperationalKm(t);
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
