import { expenseKindLabel } from '@features/expenses/utils/expense-row-labels';
import type { Expense, ExpenseKind } from '@shared/models/logistics.models';
import {
  isExpenseCreditPayable,
  sumCreditPayableExpensesMxn,
} from '@shared/utils/expense-credit-payable';
import type {
  ReportsExpensePayablesView,
  ReportsKpiCard,
} from '../models/reports-view.models';
import type { ReportsFilteredBundle } from './reports-bundle-filter';
import { amountBarSlices } from './reports-chart-mappers';
import { deltaLabel, formatMxn } from './reports-money';

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

function creditExpensesInPeriod(expenses: readonly Expense[]): Expense[] {
  return expenses.filter((e) => e.currency === 'MXN' && isExpenseCreditPayable(e));
}

function vendorLabel(e: Expense): string {
  const vendor = e.vendor?.trim();
  if (vendor) {
    return vendor;
  }
  return 'Proveedor sin nombre';
}

function payablesKpi(
  id: string,
  title: string,
  value: string,
  legend: string,
  current: number,
  previous: number,
  invertTone = false,
): ReportsKpiCard {
  const d = deltaLabel(current, previous);
  let tone = d.tone;
  if (invertTone) {
    tone = tone === 'up' ? 'down' : tone === 'down' ? 'up' : 'neutral';
  }
  return {
    id,
    title,
    titleIcon: 'credit',
    value,
    legend,
    deltaLabel: d.label,
    deltaTone: tone,
  };
}

export function buildExpensePayablesView(
  bundle: ReportsFilteredBundle,
  unitId: string,
): ReportsExpensePayablesView {
  const periodExpenses = creditExpensesInPeriod(bundle.expenses);
  const prevPeriodExpenses = creditExpensesInPeriod(bundle.previousExpenses);
  const scoped = filterExpensesScope(bundle.allExpenses, unitId);
  const accumulatedExpenses = scoped.filter(
    (e) => e.currency === 'MXN' && isExpenseCreditPayable(e),
  );

  const periodTotal = sumCreditPayableExpensesMxn(bundle.expenses);
  const prevPeriodTotal = sumCreditPayableExpensesMxn(bundle.previousExpenses);
  const accumulatedTotal = sumCreditPayableExpensesMxn(scoped);

  const kindTotals = new Map<string, number>();
  for (const e of periodExpenses) {
    kindTotals.set(e.kind, (kindTotals.get(e.kind) ?? 0) + e.amount);
  }

  const vendorTotals = new Map<string, number>();
  for (const e of periodExpenses) {
    const key = vendorLabel(e);
    vendorTotals.set(key, (vendorTotals.get(key) ?? 0) + e.amount);
  }

  const breakdownByKind = amountBarSlices(
    [...kindTotals.entries()]
      .map(([kind, amount]) => ({
        label: expenseKindLabel(kind as ExpenseKind),
        amount,
      }))
      .sort((a, b) => b.amount - a.amount),
    'reports-chart-bar__fill--payable',
  );

  const byVendor = amountBarSlices(
    [...vendorTotals.entries()]
      .map(([label, amount]) => ({ label, amount }))
      .sort((a, b) => b.amount - a.amount),
    'reports-chart-bar__fill--payable',
  );

  const kpis: ReportsKpiCard[] = [
    payablesKpi(
      'pay-period',
      'Deuda del periodo',
      formatMxn(periodTotal),
      `${periodExpenses.length} gasto${periodExpenses.length === 1 ? '' : 's'} pendientes de pago`,
      periodTotal,
      prevPeriodTotal,
      true,
    ),
    payablesKpi(
      'pay-accumulated',
      'Deuda acumulada',
      formatMxn(accumulatedTotal),
      'Histórico: crédito, TDC y proveedor',
      accumulatedTotal,
      accumulatedTotal,
    ),
  ];

  return {
    kpis,
    breakdownByKind,
    byVendor,
    detailHint:
      'Suma de gastos reales con forma de pago «Crédito / proveedor» o «Tarjeta de crédito». ' +
      'Representa lo que la empresa aún debe (facturas de proveedor o cargos TDC por liquidar). ' +
      'La tarjeta de débito no se incluye porque el cargo es inmediato desde la cuenta.',
    period: {
      total: periodTotal,
      count: periodExpenses.length,
    },
    accumulated: {
      total: accumulatedTotal,
      count: accumulatedExpenses.length,
    },
  };
}
