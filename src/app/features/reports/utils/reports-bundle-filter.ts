import type { Client } from '@shared/models/client.models';
import type {
  Equipment,
  Expense,
  Operator,
  Trip,
  Unit,
} from '@shared/models/logistics.models';
import { withoutOperationalProvisionExpenses } from '@shared/utils/operational-provision';
import { isTripClientPaymentMethod } from '@shared/catalogs/trip-client-payment-options';
import type {
  ReportsFilter,
  ReportsTripPaymentMethod,
} from '../models/reports-view.models';
import { expenseDay, isoDayInRange, tripCreatedDay } from './reports-filter';

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
  /** Todos los gastos (sin filtro de fechas; para saldos acumulados). */
  allExpenses: Expense[];
};

export function tripMatchesClientPaymentMethods(
  t: Trip,
  methods: readonly ReportsTripPaymentMethod[],
): boolean {
  if (methods.length === 0) {
    return true;
  }
  const pm = t.paymentMethod?.trim().toLowerCase() ?? '';
  if (!pm || !isTripClientPaymentMethod(pm)) {
    return false;
  }
  return methods.includes(pm);
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
    if (!tripMatchesClientPaymentMethods(t, filter.clientPaymentMethods)) {
      return false;
    }
    return isoDayInRange(tripCreatedDay(t), from, to);
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
    if (!tripMatchesClientPaymentMethods(t, filter.clientPaymentMethods)) {
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
    allExpenses: [...raw.expenses],
  };
}

/** Omite reservas automáticas cuando el usuario desactivó el análisis operativo. */
export function bundleWithoutOperationalProvision(
  bundle: ReportsFilteredBundle,
): ReportsFilteredBundle {
  return {
    ...bundle,
    expenses: withoutOperationalProvisionExpenses(bundle.expenses),
    previousExpenses: withoutOperationalProvisionExpenses(bundle.previousExpenses),
    allExpenses: withoutOperationalProvisionExpenses(bundle.allExpenses),
  };
}
