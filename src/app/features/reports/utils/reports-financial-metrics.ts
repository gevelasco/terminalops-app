import { expenseKindLabel } from '@features/expenses/utils/expense-row-labels';
import type { Expense, ExpenseKind } from '@shared/models/logistics.models';
import type { ReportsBalanceTabView, ReportsFilter } from '../models/reports-view.models';
import type { ReportsFilteredBundle } from './reports-bundle-filter';
import { buildCollectionPaymentDonut } from './reports-collection-payment-donut';
import { buildCreditByClientRows } from './reports-credit-receivable-charts';
import { buildExpenseCategoryDonut } from './reports-expense-category-slices';
import { buildFleetPayablesBarSlices } from './reports-fleet-payables';
import { amountBarSlices } from './reports-chart-mappers';
import { buildBalanceKpis } from './reports-kpi-builders';
import { buildExpensePayablesView } from './reports-expense-payables-metrics';
import { buildOperationalProvisionView, emptyOperationalProvisionView } from './reports-operational-provision-metrics';
import { buildRouteClientProfitability } from './reports-route-client-profit';
import {
  tripCasetas,
  tripDiesel,
  tripOperatorQuota,
} from './reports-trip-helpers';

function tripCostParts(trips: ReportsFilteredBundle['trips']) {
  let diesel = 0;
  let casetas = 0;
  let operator = 0;
  for (const t of trips) {
    diesel += tripDiesel(t);
    casetas += tripCasetas(t);
    operator += tripOperatorQuota(t);
  }
  return { diesel, casetas, operator };
}

export function buildBalanceTabView(
  bundle: ReportsFilteredBundle,
  filter: ReportsFilter,
  operationalAnalysisEnabled = true,
): ReportsBalanceTabView {
  const trips = bundle.trips;
  const expenses = bundle.expenses;
  const creditTrips = bundle.creditScopeTrips;

  const parts = tripCostParts(trips);
  const costBreakdown = amountBarSlices(
    [
      { label: 'Diesel (maniobras)', amount: parts.diesel },
      { label: 'Casetas (maniobras)', amount: parts.casetas },
      { label: 'Operador (maniobras)', amount: parts.operator },
      ...aggregateExpenseKinds(expenses).map((r) => ({
        label: expenseKindLabel(r.kind as ExpenseKind),
        amount: r.amount,
      })),
    ].filter((r) => r.amount > 0),
    'reports-chart-bar__fill--cost',
  );

  const kpis = buildBalanceKpis(bundle);

  const fleetUnits = filter.unitId
    ? bundle.units.filter((u) => u.id === filter.unitId)
    : bundle.units;
  const fleetEquipment = filter.unitId
    ? bundle.equipment.filter((e) => e.unitId === filter.unitId)
    : bundle.equipment;

  return {
    kpis,
    operationalProvision: operationalAnalysisEnabled
      ? buildOperationalProvisionView(bundle, bundle.allExpenses, filter.unitId)
      : emptyOperationalProvisionView(),
    expensePayables: buildExpensePayablesView(bundle, filter.unitId),
    collectionPaymentDonut: buildCollectionPaymentDonut(trips),
    costBreakdown,
    expenseByCategoryDonut: buildExpenseCategoryDonut(trips, expenses),
    fleetPayables: buildFleetPayablesBarSlices(
      fleetUnits,
      fleetEquipment,
      filter.to,
    ),
    creditByClient: buildCreditByClientRows(creditTrips),
    routeClientProfitability: buildRouteClientProfitability(trips),
  };
}

function aggregateExpenseKinds(
  expenses: readonly Expense[],
): { kind: string; amount: number }[] {
  const map = new Map<string, number>();
  for (const e of expenses) {
    if (e.currency !== 'MXN') {
      continue;
    }
    map.set(e.kind, (map.get(e.kind) ?? 0) + e.amount);
  }
  return [...map.entries()]
    .map(([kind, amount]) => ({ kind, amount }))
    .sort((a, b) => b.amount - a.amount);
}
