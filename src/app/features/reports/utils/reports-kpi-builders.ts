import type {
  ReportsKpiCard,
  ReportsKpiLegendPlacement,
} from '../models/reports-view.models';
import type { ReportsFilteredBundle } from './reports-bundle-filter';
import { deltaLabel, formatMxn } from './reports-money';
import { sumCreditPayableExpensesMxn } from '@shared/utils/expense-credit-payable';
import {
  sumTripCollectedRevenue,
  sumTripCreditReceivable,
  sumTripDirectCost,
} from './reports-trip-helpers';

function sumLedgerExpenses(expenses: readonly { amount: number; currency: string }[]): number {
  return expenses.reduce((a, e) => a + (e.currency === 'MXN' ? e.amount : 0), 0);
}

function totalGastos(
  expenses: readonly { amount: number; currency: string }[],
  trips: ReportsFilteredBundle['trips'],
): number {
  return sumLedgerExpenses(expenses) + sumTripDirectCost(trips);
}

function generalKpi(
  id: string,
  title: string,
  icon: ReportsKpiCard['titleIcon'],
  value: string,
  current: number,
  previous: number,
  invertTone = false,
  legend?: string,
  legendPlacement?: ReportsKpiLegendPlacement,
  trackAmount = true,
): ReportsKpiCard {
  const card: ReportsKpiCard = { id, title, titleIcon: icon, value };
  if (trackAmount && Number.isFinite(current)) {
    card.amount = current;
  }
  if (legend) {
    card.legend = legend;
  }
  if (legendPlacement) {
    card.legendPlacement = legendPlacement;
  }
  const d = deltaLabel(current, previous);
  let tone = d.tone;
  if (invertTone) {
    tone = tone === 'up' ? 'down' : tone === 'down' ? 'up' : 'neutral';
  }
  card.deltaLabel = d.label;
  card.deltaTone = tone;
  return card;
}

/** Maniobras, Gastos, Ingresos, Crédito, Margen — pestaña General. */
export function buildGeneralKpis(bundle: ReportsFilteredBundle): ReportsKpiCard[] {
  const trips = bundle.trips;
  const expenses = bundle.expenses;
  const income = sumTripCollectedRevenue(trips);
  const credit = sumTripCreditReceivable(trips);
  const gastos = totalGastos(expenses, trips);
  const deuda = sumCreditPayableExpensesMxn(expenses);
  const margin = income + credit - gastos;

  const prevIncome = sumTripCollectedRevenue(bundle.previousTrips);
  const prevCredit = sumTripCreditReceivable(bundle.previousTrips);
  const prevGastos = totalGastos(bundle.previousExpenses, bundle.previousTrips);
  const prevDeuda = sumCreditPayableExpensesMxn(bundle.previousExpenses);
  const prevMargin = prevIncome + prevCredit - prevGastos;

  return [
    generalKpi(
      'maniobras',
      'Maniobras',
      'maniobras',
      String(trips.length),
      trips.length,
      bundle.previousTrips.length,
      false,
      undefined,
      undefined,
      false,
    ),
    generalKpi(
      'gastos',
      'Gastos',
      'revenue',
      formatMxn(gastos),
      gastos,
      prevGastos,
      true,
    ),
    generalKpi(
      'ingresos',
      'Ingresos',
      'revenue',
      formatMxn(income),
      income,
      prevIncome,
    ),
    generalKpi(
      'credito',
      'Crédito',
      'revenue',
      formatMxn(credit),
      credit,
      prevCredit,
      false,
      'Por cobrar a clientes',
      'beside',
    ),
    generalKpi(
      'deuda',
      'Deuda',
      'credit',
      formatMxn(deuda),
      deuda,
      prevDeuda,
      true,
      'Crédito, TDC y proveedor',
      'beside',
    ),
    generalKpi(
      'margen',
      'Margen',
      'revenue',
      formatMxn(margin),
      margin,
      prevMargin,
    ),
  ];
}

/** Ingreso total, Gastos, Ingresos, Crédito, Por pagar, Margen — pestaña Balance. */
export function buildBalanceKpis(bundle: ReportsFilteredBundle): ReportsKpiCard[] {
  const trips = bundle.trips;
  const expenses = bundle.expenses;
  const cobrado = sumTripCollectedRevenue(trips);
  const porCobrar = sumTripCreditReceivable(trips);
  const ingresoTotal = cobrado + porCobrar;
  const gastos = totalGastos(expenses, trips);
  const margin = ingresoTotal - gastos;

  const porPagarPeriodo = sumCreditPayableExpensesMxn(expenses);
  const porPagarAcumulado = sumCreditPayableExpensesMxn(bundle.allExpenses);

  const prevCobrado = sumTripCollectedRevenue(bundle.previousTrips);
  const prevPorCobrar = sumTripCreditReceivable(bundle.previousTrips);
  const prevIngresoTotal = prevCobrado + prevPorCobrar;
  const prevGastos = totalGastos(bundle.previousExpenses, bundle.previousTrips);
  const prevMargin = prevIngresoTotal - prevGastos;
  const prevPorPagarPeriodo = sumCreditPayableExpensesMxn(bundle.previousExpenses);

  return [
    generalKpi(
      'ingreso-total',
      'Ingreso total',
      'revenue',
      formatMxn(ingresoTotal),
      ingresoTotal,
      prevIngresoTotal,
    ),
    generalKpi(
      'gastos',
      'Gastos',
      'revenue',
      formatMxn(gastos),
      gastos,
      prevGastos,
      true,
    ),
    generalKpi(
      'ingresos',
      'Ingresos',
      'revenue',
      formatMxn(cobrado),
      cobrado,
      prevCobrado,
    ),
    generalKpi(
      'credito',
      'Crédito',
      'revenue',
      formatMxn(porCobrar),
      porCobrar,
      prevPorCobrar,
      false,
      'Por cobrar a clientes',
      'beside',
    ),
    generalKpi(
      'por-pagar',
      'Por pagar',
      'credit',
      formatMxn(porPagarAcumulado),
      porPagarPeriodo,
      prevPorPagarPeriodo,
      true,
      'Crédito, TDC y proveedor',
      'beside',
    ),
    generalKpi(
      'margen',
      'Margen',
      'revenue',
      formatMxn(margin),
      margin,
      prevMargin,
    ),
  ];
}
