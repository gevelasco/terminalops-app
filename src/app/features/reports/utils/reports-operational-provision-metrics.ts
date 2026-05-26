import type { Expense } from '@shared/models/logistics.models';
import {
  isOperationalProvisionExpense,
  isWearRelatedExpenseKind,
} from '@shared/utils/operational-provision';
import type {
  ReportsKpiCard,
  ReportsOperationalProvisionView,
} from '../models/reports-view.models';
import type { ReportsFilteredBundle } from './reports-bundle-filter';
import { amountBarSlices } from './reports-chart-mappers';
import { deltaLabel, formatMxn } from './reports-money';

export type OperationalProvisionTotals = {
  tiresProvision: number;
  pmProvision: number;
  tiresExercised: number;
  pmExercised: number;
  totalProvision: number;
  totalExercised: number;
  balance: number;
};

function sumMxn(expenses: readonly Expense[], pick: (e: Expense) => boolean): number {
  let sum = 0;
  for (const e of expenses) {
    if (e.currency !== 'MXN' || !pick(e)) {
      continue;
    }
    sum += e.amount;
  }
  return sum;
}

export function computeOperationalProvisionTotals(
  expenses: readonly Expense[],
): OperationalProvisionTotals {
  const tiresProvision = sumMxn(
    expenses,
    (e) => isOperationalProvisionExpense(e) && e.kind === 'tires',
  );
  const pmProvision = sumMxn(
    expenses,
    (e) =>
      isOperationalProvisionExpense(e) &&
      (e.kind === 'maintenance' || e.kind === 'repair'),
  );
  const tiresExercised = sumMxn(
    expenses,
    (e) =>
      !isOperationalProvisionExpense(e) &&
      isWearRelatedExpenseKind(e.kind) &&
      e.kind === 'tires',
  );
  const pmExercised = sumMxn(
    expenses,
    (e) =>
      !isOperationalProvisionExpense(e) &&
      isWearRelatedExpenseKind(e.kind) &&
      (e.kind === 'maintenance' || e.kind === 'repair'),
  );
  const totalProvision = tiresProvision + pmProvision;
  const totalExercised = tiresExercised + pmExercised;
  return {
    tiresProvision,
    pmProvision,
    tiresExercised,
    pmExercised,
    totalProvision,
    totalExercised,
    balance: totalProvision - totalExercised,
  };
}

function filterExpensesScope(
  expenses: readonly Expense[],
  unitId: string,
): Expense[] {
  if (!unitId.trim()) {
    return [...expenses];
  }
  return expenses.filter((e) => {
    if (e.relatedUnitId?.trim() && e.relatedUnitId !== unitId) {
      return false;
    }
    return true;
  });
}

function provisionKpi(
  id: string,
  title: string,
  value: string,
  legend: string,
  current: number,
  previous: number,
): ReportsKpiCard {
  const d = deltaLabel(current, previous);
  return {
    id,
    title,
    titleIcon: 'maintenance',
    value,
    legend,
    deltaLabel: d.label,
    deltaTone: d.tone,
  };
}

function provisionCoverageLegend(exercised: number, provisioned: number): string {
  if (provisioned <= 0) {
    return exercised > 0 ? 'Sin provisión en el periodo' : 'Sin movimiento';
  }
  return `${Math.round((exercised / provisioned) * 100)}% del estimado ya pagado`;
}

function countOperationalProvisionTrips(expenses: readonly Expense[]): number {
  const tripIds = new Set<string>();
  for (const e of expenses) {
    if (!isOperationalProvisionExpense(e) || !e.tripId?.trim()) {
      continue;
    }
    tripIds.add(e.tripId);
  }
  return tripIds.size;
}

export function buildOperationalProvisionView(
  bundle: ReportsFilteredBundle,
  allExpenses: readonly Expense[],
  unitId: string,
): ReportsOperationalProvisionView {
  const period = computeOperationalProvisionTotals(bundle.expenses);
  const prevPeriod = computeOperationalProvisionTotals(bundle.previousExpenses);
  const scoped = filterExpensesScope(allExpenses, unitId);
  const accumulated = computeOperationalProvisionTotals(scoped);
  const periodBalance = period.totalProvision - period.totalExercised;
  const prevPeriodBalance = prevPeriod.totalProvision - prevPeriod.totalExercised;
  const periodManeuverCount = countOperationalProvisionTrips(bundle.expenses);

  const kpis: ReportsKpiCard[] = [
    provisionKpi(
      'op-prov-period',
      'Provisionado (periodo)',
      formatMxn(period.totalProvision),
      'Estimado por maniobras del rango',
      period.totalProvision,
      prevPeriod.totalProvision,
    ),
    provisionKpi(
      'op-prov-exercised',
      'Ejercido (periodo)',
      formatMxn(period.totalExercised),
      'Pagos reales a llantas y taller',
      period.totalExercised,
      prevPeriod.totalExercised,
    ),
    provisionKpi(
      'op-prov-period-balance',
      'Saldo del periodo',
      formatMxn(periodBalance),
      'Provisionado − ejercido en el rango',
      periodBalance,
      prevPeriodBalance,
    ),
    provisionKpi(
      'op-prov-balance',
      'Saldo acumulado',
      formatMxn(accumulated.balance),
      'Histórico: provisionado − ejercido',
      accumulated.balance,
      accumulated.balance,
    ),
    {
      id: 'op-prov-coverage',
      title: 'Cobertura del periodo',
      titleIcon: 'maintenance',
      value:
        period.totalProvision > 0
          ? `${Math.round((period.totalExercised / period.totalProvision) * 100)}%`
          : '—',
      legend: provisionCoverageLegend(period.totalExercised, period.totalProvision),
      deltaLabel: deltaLabel(
        period.totalExercised,
        prevPeriod.totalExercised,
      ).label,
      deltaTone: deltaLabel(period.totalExercised, prevPeriod.totalExercised).tone,
    },
  ];

  const breakdown = amountBarSlices(
    [
      { label: 'Llantas (provisión)', amount: period.tiresProvision },
      { label: 'Mant. preventivo (provisión)', amount: period.pmProvision },
      { label: 'Llantas (pagos reales)', amount: period.tiresExercised },
      { label: 'Mant. (pagos reales)', amount: period.pmExercised },
    ].filter((r) => r.amount > 0),
    'reports-chart-bar__fill--provision',
  );

  const accumulatedBreakdown = amountBarSlices(
    [
      { label: 'Llantas (provisión acum.)', amount: accumulated.tiresProvision },
      { label: 'Mant. (provisión acum.)', amount: accumulated.pmProvision },
      { label: 'Llantas (pagos reales acum.)', amount: accumulated.tiresExercised },
      { label: 'Mant. (pagos reales acum.)', amount: accumulated.pmExercised },
    ].filter((r) => r.amount > 0),
    'reports-chart-bar__fill--provision',
  );

  return {
    kpis,
    breakdown,
    accumulatedBreakdown,
    detailHint:
      'La provisión operativa reserva un monto por km al programar cada maniobra, ' +
      'repartido entre la unidad (tracto) y los equipos del convoy. ' +
      'El saldo acumulado indica cuánto quedaría disponible si los pagos reales ' +
      'a talleres y llantas siguieran el ritmo de las maniobras.',
    accumulated,
    period: {
      totalProvision: period.totalProvision,
      totalExercised: period.totalExercised,
      balance: periodBalance,
      maneuverCount: periodManeuverCount,
    },
  };
}

export function emptyOperationalProvisionView(): ReportsOperationalProvisionView {
  return {
    kpis: [],
    breakdown: [],
    accumulatedBreakdown: [],
    detailHint: '',
    period: {
      totalProvision: 0,
      totalExercised: 0,
      balance: 0,
      maneuverCount: 0,
    },
    accumulated: {
      totalProvision: 0,
      totalExercised: 0,
      balance: 0,
    },
  };
}
