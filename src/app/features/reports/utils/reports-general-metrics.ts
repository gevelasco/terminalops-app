import { expenseKindLabel } from '@features/expenses/utils/expense-row-labels';
import type { ExpenseKind } from '@shared/models/logistics.models';
import type { ReportsFilter, ReportsGeneralTabView } from '../models/reports-view.models';
import type { ReportsFilteredBundle } from './reports-bundle-filter';
import { amountBarSlices } from './reports-chart-mappers';
import { buildTopClientsMarginDonut } from './reports-client-margin-donut';
import { buildDailyMarginSeries } from './reports-daily-margin-series';
import { buildGeneralKpis } from './reports-kpi-builders';
import {
  tripCollectedRevenue,
  tripCreditReceivable,
  tripKm,
} from './reports-trip-helpers';

export function buildGeneralTabView(
  bundle: ReportsFilteredBundle,
  filter: ReportsFilter,
): ReportsGeneralTabView {
  const trips = bundle.trips;
  const expenses = bundle.expenses;
  const kpis = buildGeneralKpis(bundle);

  const byClient = new Map<string, { maneuvers: number; km: number; revenue: number }>();
  for (const t of trips) {
    const name = t.clientName?.trim() || 'Sin cliente';
    const row = byClient.get(name) ?? { maneuvers: 0, km: 0, revenue: 0 };
    if (t.status === 'completed') {
      row.maneuvers += 1;
      row.km += tripKm(t);
    }
    row.revenue += tripCollectedRevenue(t) + tripCreditReceivable(t);
    byClient.set(name, row);
  }
  const totalClientRevenue = [...byClient.values()].reduce((sum, v) => sum + v.revenue, 0);
  const topClients = [...byClient.entries()]
    .map(([clientName, v]) => ({
      clientName,
      maneuvers: v.maneuvers,
      km: Math.round(v.km),
      revenue: v.revenue,
      revenuePct:
        totalClientRevenue > 0
          ? Math.round((v.revenue / totalClientRevenue) * 100)
          : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 8);

  const kindMap = new Map<string, number>();
  for (const e of expenses) {
    if (e.currency !== 'MXN') {
      continue;
    }
    kindMap.set(e.kind, (kindMap.get(e.kind) ?? 0) + e.amount);
  }
  const expenseByKind = amountBarSlices(
    [...kindMap.entries()]
      .map(([kind, amount]) => ({
        label: expenseKindLabel(kind as ExpenseKind),
        amount,
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 8),
    'reports-chart-bar__fill--expense',
  );

  const weeklyBalance = buildDailyMarginSeries(trips, expenses, filter.from, filter.to);
  const topClientsMarginDonut = buildTopClientsMarginDonut(trips);

  return {
    kpis,
    weeklyBalance,
    expenseByKind,
    topClients,
    topClientsMarginDonut,
  };
}

