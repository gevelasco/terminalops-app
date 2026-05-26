import { expenseKindLabel } from '@features/expenses/utils/expense-row-labels';
import type { ExpenseKind } from '@shared/models/logistics.models';
import type {
  ReportsFilter,
  ReportsGeneralTabView,
  ReportsKpiCard,
  ReportsPeriodBalanceBar,
} from '../models/reports-view.models';
import type { ReportsFilteredBundle } from './reports-bundle-filter';
import { amountBarSlices } from './reports-chart-mappers';
import { buildTopClientsMarginDonut } from './reports-client-margin-donut';
import { buildGeneralKpis } from './reports-kpi-builders';
import {
  tripCollectedRevenue,
  tripCreditReceivable,
  tripKm,
} from './reports-trip-helpers';

const PERIOD_BALANCE_KPI_ORDER = [
  'gastos',
  'ingresos',
  'credito',
  'deuda',
  'margen',
] as const;

function periodBalanceFromKpis(kpis: readonly ReportsKpiCard[]): ReportsPeriodBalanceBar[] {
  const byId = new Map(
    kpis
      .filter((k): k is ReportsKpiCard & { amount: number } => k.amount != null)
      .map((k) => [k.id, k] as const),
  );
  return PERIOD_BALANCE_KPI_ORDER.flatMap((id) => {
    const k = byId.get(id);
    if (!k || k.amount == null) {
      return [];
    }
    return [{ key: k.id, label: k.title, value: Math.round(k.amount) }];
  });
}

export function buildGeneralTabView(
  bundle: ReportsFilteredBundle,
  _filter: ReportsFilter,
): ReportsGeneralTabView {
  const trips = bundle.trips;
  const expenses = bundle.expenses;
  const kpis = buildGeneralKpis(bundle);
  const periodBalance = periodBalanceFromKpis(kpis);

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

  const topClientsMarginDonut = buildTopClientsMarginDonut(trips);

  return {
    kpis,
    periodBalance,
    expenseByKind,
    topClients,
    topClientsMarginDonut,
  };
}

