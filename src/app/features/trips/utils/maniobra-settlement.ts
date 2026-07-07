import { tripDueDate } from '@features/reports/utils/reports-credit-receivable-charts';
import { formatMxn } from '@features/reports/utils/reports-money';
import { localYmd } from '@shared/utils/local-ymd';
import {
  isTripBillableForReporting,
  isTripClientCollected,
  tripCasetas,
  tripDiesel,
  tripOperatorQuota,
  tripRevenue,
} from '@features/reports/utils/reports-trip-helpers';
import type { Expense, ExpenseKind, Trip } from '@shared/models/logistics.models';

/** Gastos automáticos al programar; si ya están en ledger, no duplicar desde campos del trip. */
const TRIP_PROGRAMMED_EXPENSE_KINDS = {
  diesel: 'fuel',
  tolls: 'tolls',
  operator: 'operator_payment',
} as const satisfies Record<string, ExpenseKind>;

export type ManiobraSettlementLineSource = 'trip' | 'ledger';

export interface ManiobraSettlementLine {
  id: string;
  label: string;
  detail: string;
  amount: number;
  incurredAt: string | null;
  source: ManiobraSettlementLineSource;
}

export type ManiobraPaymentStatus =
  | 'no_billing'
  | 'paid'
  | 'credit_pending'
  | 'cash_pending';

/** Urgencia del plazo de crédito respecto a hoy (solo `credit_pending`). */
export type CreditDueUrgency = 'on_track' | 'due_today' | 'overdue' | 'unknown';

export interface ManiobraSettlementSummary {
  hasBilling: boolean;
  charged: number;
  spent: number;
  margin: number;
  marginPct: number | null;
  lines: ManiobraSettlementLine[];
  paymentStatus: ManiobraPaymentStatus;
  paymentStatusLabel: string;
  paymentDetail: string;
  dueDateLabel: string | null;
  creditDueUrgency: CreditDueUrgency;
  collectedAtLabel: string | null;
}

function formatLongDate(iso: string | null | undefined): string | null {
  const t = iso?.trim();
  if (!t) {
    return null;
  }
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) {
    return null;
  }
  return new Intl.DateTimeFormat('es-MX', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(d);
}

export function resolveCreditDueUrgency(
  due: Date | null,
  asOf: Date = new Date(),
): CreditDueUrgency {
  if (!due) {
    return 'unknown';
  }
  const dueYmd = localYmd(due);
  const todayYmd = localYmd(asOf);
  if (dueYmd < todayYmd) {
    return 'overdue';
  }
  if (dueYmd === todayYmd) {
    return 'due_today';
  }
  return 'on_track';
}

function pushTripCostLine(
  lines: ManiobraSettlementLine[],
  id: string,
  label: string,
  amount: number,
  detail = 'Costo operativo programado',
): void {
  if (amount <= 0) {
    return;
  }
  lines.push({
    id,
    label,
    detail,
    amount,
    incurredAt: null,
    source: 'trip',
  });
}

function parseTripDieselLiters(raw?: string | null): number | null {
  if (raw == null || !String(raw).trim()) {
    return null;
  }
  const liters = Number(String(raw).replace(/\s/g, '').replace(/,/g, ''));
  return Number.isFinite(liters) && liters > 0 ? liters : null;
}

function formatDieselLitersLabel(liters: number): string {
  return `${new Intl.NumberFormat('es-MX', { maximumFractionDigits: 3 }).format(liters)} L`;
}

function tripManeuverRef(trip: Trip): string {
  return trip.maneuverCode?.trim() || trip.id;
}

function formatFuelSettlementDetail(trip: Trip): string {
  const ref = tripManeuverRef(trip);
  const liters = parseTripDieselLiters(trip.dieselLiters);
  if (liters != null) {
    return `Diesel ${formatDieselLitersLabel(liters)} — maniobra ${ref}`;
  }
  return `Diesel — maniobra ${ref}`;
}

function parsePercentFromText(text: string): number | null {
  const match = text.match(/(\d+(?:[.,]\d+)?)\s*%/);
  if (!match?.[1]) {
    return null;
  }
  const pct = Number(match[1].replace(',', '.'));
  return Number.isFinite(pct) && pct > 0 ? pct : null;
}

function formatPercentLabel(pct: number): string {
  const rounded = Math.round(pct * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function resolveOperationalControlPercent(
  trip: Trip,
  expense: Expense,
  charged: number,
): number | null {
  const fromDescription = expense.description
    ? parsePercentFromText(expense.description)
    : null;
  if (fromDescription != null) {
    return fromDescription;
  }
  if (charged > 0 && expense.amount > 0) {
    return Math.round((expense.amount / charged) * 1000) / 10;
  }
  return null;
}

function formatOperationalControlSettlementDetail(
  trip: Trip,
  expense: Expense,
  charged: number,
): string {
  const ref = tripManeuverRef(trip);
  const pct = resolveOperationalControlPercent(trip, expense, charged);
  if (pct != null) {
    return `Control operativo ${formatPercentLabel(pct)}% — maniobra ${ref}`;
  }
  return `Control operativo — maniobra ${ref}`;
}

function settlementExpenseDetail(
  trip: Trip,
  expense: Expense,
  charged: number,
): string {
  const fallback =
    expense.description?.trim() || expense.vendor?.trim() || 'Registro en gastos';
  if (expense.kind === 'fuel') {
    return formatFuelSettlementDetail(trip);
  }
  if (expense.kind === 'operational_control') {
    return formatOperationalControlSettlementDetail(trip, expense, charged);
  }
  return fallback;
}

function formatCreditCollectionDaysRemaining(
  due: Date | null,
  asOf: Date = new Date(),
): string {
  if (!due) {
    return 'Plazo de cobro por confirmar';
  }
  const dueYmd = localYmd(due);
  const todayYmd = localYmd(asOf);
  const dueDate = new Date(`${dueYmd}T12:00:00`);
  const today = new Date(`${todayYmd}T12:00:00`);
  const diffDays = Math.round((dueDate.getTime() - today.getTime()) / 86400000);

  if (diffDays < 0) {
    const overdue = Math.abs(diffDays);
    return overdue === 1 ? 'Venció hace 1 día' : `Venció hace ${overdue} días`;
  }
  if (diffDays === 0) {
    return 'Vence hoy';
  }
  if (diffDays === 1) {
    return '1 día restante';
  }
  return `${diffDays} días restantes`;
}

function ledgerHasTripProgrammedKind(
  ledger: readonly Expense[],
  kind: ExpenseKind,
): boolean {
  return ledger.some((e) => e.kind === kind);
}
export function buildManiobraSettlementSummary(
  trip: Trip,
  expenses: readonly Expense[],
): ManiobraSettlementSummary {
  const hasBilling = isTripBillableForReporting(trip);
  const charged = tripRevenue(trip);
  const lines: ManiobraSettlementLine[] = [];

  const ledger = expenses
    .filter((e) => e.tripId.trim() === trip.id)
    .slice()
    .sort((a, b) => a.incurredAt.localeCompare(b.incurredAt));

  if (!ledgerHasTripProgrammedKind(ledger, TRIP_PROGRAMMED_EXPENSE_KINDS.diesel)) {
    pushTripCostLine(
      lines,
      'trip-diesel',
      'Diesel',
      tripDiesel(trip),
      formatFuelSettlementDetail(trip),
    );
  }
  if (!ledgerHasTripProgrammedKind(ledger, TRIP_PROGRAMMED_EXPENSE_KINDS.tolls)) {
    pushTripCostLine(lines, 'trip-tolls', 'Casetas', tripCasetas(trip));
  }
  if (
    !ledgerHasTripProgrammedKind(ledger, TRIP_PROGRAMMED_EXPENSE_KINDS.operator)
  ) {
    pushTripCostLine(lines, 'trip-operator', 'Cuota operador', tripOperatorQuota(trip));
  }

  for (const e of ledger) {
    lines.push({
      id: e.id,
      label: e.category.trim() || 'Gasto',
      detail: settlementExpenseDetail(trip, e, charged),
      amount: e.amount,
      incurredAt: e.incurredAt,
      source: 'ledger',
    });
  }

  const spent = lines.reduce((sum, line) => sum + line.amount, 0);
  const margin = charged - spent;
  const marginPct =
    charged > 0 ? Math.round((margin / charged) * 100) : null;

  const collectedAtLabel = formatLongDate(trip.clientCollectedAt ?? undefined);
  const due = tripDueDate(trip);
  const dueDateLabel = due ? formatLongDate(due.toISOString()) : null;

  if (!hasBilling) {
    return {
      hasBilling: false,
      charged,
      spent,
      margin,
      marginPct,
      lines,
      paymentStatus: 'no_billing',
      paymentStatusLabel: 'Sin cobro al cliente',
      paymentDetail:
        'Maniobra interna o sin monto pactado; no aplica seguimiento de cobro.',
      dueDateLabel: null,
      creditDueUrgency: 'unknown',
      collectedAtLabel: null,
    };
  }

  if (isTripClientCollected(trip)) {
    return {
      hasBilling: true,
      charged,
      spent,
      margin,
      marginPct,
      lines,
      paymentStatus: 'paid',
      paymentStatusLabel: 'Pagada',
      paymentDetail: collectedAtLabel
        ? `Cobro confirmado el ${collectedAtLabel}.`
        : 'Cobro confirmado al cliente.',
      dueDateLabel: null,
      creditDueUrgency: 'unknown',
      collectedAtLabel,
    };
  }

  const creditDays = Math.max(0, trip.creditDays ?? 0);
  if (creditDays > 0) {
    return {
      hasBilling: true,
      charged,
      spent,
      margin,
      marginPct,
      lines,
      paymentStatus: 'credit_pending',
      paymentStatusLabel: 'A crédito',
      paymentDetail: formatCreditCollectionDaysRemaining(due),
      dueDateLabel,
      creditDueUrgency: resolveCreditDueUrgency(due),
      collectedAtLabel: null,
    };
  }

  return {
    hasBilling: true,
    charged,
    spent,
    margin,
    marginPct,
    lines,
    paymentStatus: 'cash_pending',
    paymentStatusLabel: 'Pendiente de cobro',
    paymentDetail:
      'Contado sin crédito; el cobro aún no se ha confirmado en sistema.',
    dueDateLabel: null,
    creditDueUrgency: 'unknown',
    collectedAtLabel: null,
  };
}

export function formatSettlementMxn(amount: number): string {
  return formatMxn(amount);
}
