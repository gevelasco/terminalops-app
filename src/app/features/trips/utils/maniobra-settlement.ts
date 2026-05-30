import { tripDueDate } from '@features/reports/utils/reports-credit-receivable-charts';
import { formatMxn } from '@features/reports/utils/reports-money';
import {
  isTripBillableForReporting,
  isTripClientCollected,
  tripCasetas,
  tripDiesel,
  tripOperatorQuota,
  tripRevenue,
} from '@features/reports/utils/reports-trip-helpers';
import type { Expense, Trip } from '@shared/models/logistics.models';

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

function pushTripCostLine(
  lines: ManiobraSettlementLine[],
  id: string,
  label: string,
  amount: number,
): void {
  if (amount <= 0) {
    return;
  }
  lines.push({
    id,
    label,
    detail: 'Costo operativo programado',
    amount,
    incurredAt: null,
    source: 'trip',
  });
}

export function buildManiobraSettlementSummary(
  trip: Trip,
  expenses: readonly Expense[],
): ManiobraSettlementSummary {
  const hasBilling = isTripBillableForReporting(trip);
  const charged = tripRevenue(trip);
  const lines: ManiobraSettlementLine[] = [];

  pushTripCostLine(lines, 'trip-diesel', 'Diesel', tripDiesel(trip));
  pushTripCostLine(lines, 'trip-tolls', 'Casetas', tripCasetas(trip));
  pushTripCostLine(lines, 'trip-operator', 'Cuota operador', tripOperatorQuota(trip));

  const ledger = expenses
    .filter((e) => e.tripId.trim() === trip.id)
    .slice()
    .sort((a, b) => a.incurredAt.localeCompare(b.incurredAt));

  for (const e of ledger) {
    lines.push({
      id: e.id,
      label: e.category.trim() || 'Gasto',
      detail: e.description?.trim() || e.vendor?.trim() || 'Registro en gastos',
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
      paymentDetail: dueDateLabel
        ? `Plazo de ${creditDays} días; vence el ${dueDateLabel}.`
        : `Plazo de ${creditDays} días; fecha de vencimiento por confirmar.`,
      dueDateLabel,
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
    collectedAtLabel: null,
  };
}

export function formatSettlementMxn(amount: number): string {
  return formatMxn(amount);
}
