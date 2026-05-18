import type { ReportsWeeklyPoint } from '../models/reports-view.models';
import type { ReportsFilteredBundle } from './reports-bundle-filter';
import { localYmd } from './reports-filter';
import {
  sumTripCollectedRevenue,
  sumTripCreditReceivable,
  sumTripDirectCost,
} from './reports-trip-helpers';

function sumLedgerExpenses(expenses: readonly { amount: number; currency: string }[]): number {
  return expenses.reduce((a, e) => a + (e.currency === 'MXN' ? e.amount : 0), 0);
}

function dayGastos(
  dayExpenses: ReportsFilteredBundle['expenses'],
  dayTrips: ReportsFilteredBundle['trips'],
): number {
  return sumLedgerExpenses(dayExpenses) + sumTripDirectCost(dayTrips);
}

/** Margen diario = (cobrado + por cobrar) − costos directos y gastos del día. */
export function buildDailyMarginSeries(
  trips: ReportsFilteredBundle['trips'],
  expenses: ReportsFilteredBundle['expenses'],
  from: string,
  to: string,
): ReportsWeeklyPoint[] {
  const keys: string[] = [];
  const a = new Date(from + 'T12:00:00');
  const b = new Date(to + 'T12:00:00');
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) {
    return [];
  }
  const fmt = new Intl.DateTimeFormat('es-MX', { weekday: 'short', day: 'numeric' });
  const cur = new Date(a);
  while (cur.getTime() <= b.getTime() && keys.length < 14) {
    keys.push(localYmd(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return keys.map((key) => {
    const dayTrips = trips.filter((t) => t.programmedAt.slice(0, 10) === key);
    const dayExp = expenses.filter((e) => e.incurredAt.slice(0, 10) === key);
    const income = sumTripCollectedRevenue(dayTrips);
    const credit = sumTripCreditReceivable(dayTrips);
    const gastos = dayGastos(dayExp, dayTrips);
    const d = new Date(key + 'T12:00:00');
    return { label: fmt.format(d), value: Math.round(income + credit - gastos) };
  });
}
