import type { Client } from '@shared/models/client.models';
import type {
  Equipment,
  Expense,
  Operator,
  Trip,
  Unit,
} from '@shared/models/logistics.models';
import type {
  ReportsClientPaymentMethodFilter,
  ReportsFilter,
} from '../models/reports-view.models';
import { expenseDay, isoDayInRange, tripProgrammedDay } from './reports-filter';

export type ReportsRawBundle = {
  trips: Trip[];
  expenses: Expense[];
  units: Unit[];
  equipment: Equipment[];
  operators: Operator[];
  clients: Client[];
};

export type ReportsFilteredBundle = ReportsRawBundle & {
  trips: Trip[];
  expenses: Expense[];
  previousTrips: Trip[];
  previousExpenses: Expense[];
  /** Maniobras para cartera (mismo filtro de cliente/unidad, sin rango de fechas). */
  creditScopeTrips: Trip[];
  /** Catálogo completo de viajes (estado operativo actual de flota). */
  allTrips: Trip[];
};

export function tripMatchesClientPaymentMethod(
  t: Trip,
  mode: ReportsClientPaymentMethodFilter,
): boolean {
  if (mode === 'both') {
    return true;
  }
  const pm = t.paymentMethod;
  if (mode === 'cash') {
    return pm === 'cash';
  }
  if (mode === 'transfer') {
    return pm === 'transfer';
  }
  return true;
}

export function filterTrips(
  trips: readonly Trip[],
  filter: ReportsFilter,
  range?: { from: string; to: string },
): Trip[] {
  const from = range?.from ?? filter.from;
  const to = range?.to ?? filter.to;
  return trips.filter((t) => {
    if (
      filter.clientIds.length > 0 &&
      (!t.clientId || !filter.clientIds.includes(t.clientId))
    ) {
      return false;
    }
    if (filter.unitId && t.unitId !== filter.unitId) {
      return false;
    }
    if (!tripMatchesClientPaymentMethod(t, filter.clientPaymentMethod)) {
      return false;
    }
    return isoDayInRange(tripProgrammedDay(t), from, to);
  });
}

export function filterExpenses(
  expenses: readonly Expense[],
  filter: ReportsFilter,
  range?: { from: string; to: string },
): Expense[] {
  const from = range?.from ?? filter.from;
  const to = range?.to ?? filter.to;
  return expenses.filter((e) => {
    if (filter.unitId && e.relatedUnitId && e.relatedUnitId !== filter.unitId) {
      return false;
    }
    if (filter.clientIds.length > 0) {
      return false;
    }
    return isoDayInRange(expenseDay(e), from, to);
  });
}

export function filterTripsCreditScope(
  trips: readonly Trip[],
  filter: ReportsFilter,
): Trip[] {
  return trips.filter((t) => {
    if (
      filter.clientIds.length > 0 &&
      (!t.clientId || !filter.clientIds.includes(t.clientId))
    ) {
      return false;
    }
    if (filter.unitId && t.unitId !== filter.unitId) {
      return false;
    }
    if (!tripMatchesClientPaymentMethod(t, filter.clientPaymentMethod)) {
      return false;
    }
    return true;
  });
}

export function buildFilteredBundle(
  raw: ReportsRawBundle,
  filter: ReportsFilter,
  previousRange: { from: string; to: string },
): ReportsFilteredBundle {
  return {
    ...raw,
    trips: filterTrips(raw.trips, filter),
    expenses: filterExpenses(raw.expenses, filter),
    previousTrips: filterTrips(raw.trips, filter, previousRange),
    previousExpenses: filterExpenses(raw.expenses, filter, previousRange),
    creditScopeTrips: filterTripsCreditScope(raw.trips, filter),
    allTrips: [...raw.trips],
  };
}
