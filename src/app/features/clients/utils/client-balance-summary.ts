import { tripDueDate } from '@features/reports/utils/reports-credit-receivable-charts';
import { localYmd } from '@features/reports/utils/reports-filter';
import {
  isTripBillableForReporting,
  isTripClientCollected,
  sumTripCollectedRevenue,
  sumTripCreditReceivable,
  sumTripResolvedDirectCost,
  sumTripRevenue,
  tripCreditReceivable,
  tripKm,
  tripRevenue,
} from '@features/reports/utils/reports-trip-helpers';
import type { Expense, Trip, TripStatus } from '@shared/models/logistics.models';

export type ClientPaymentDueBadgeVariant = 'success' | 'warning' | 'danger' | 'neutral';

export interface ClientManeuverStatusCounts {
  completed: number;
  inTransit: number;
  scheduled: number;
  cancelled: number;
  total: number;
}

export interface ClientUpcomingPaymentRow {
  tripId: string;
  maneuverCode: string;
  dueYmd: string;
  dueLabel: string;
  amount: number;
  badgeVariant: ClientPaymentDueBadgeVariant;
  statusHint: string;
}

export interface ClientPaymentHistoryRow {
  tripId: string;
  maneuverCode: string;
  collectedYmd: string;
  collectedLabel: string;
  amount: number;
}

export interface ClientBalanceSummary {
  hasTrips: boolean;
  hasBillable: boolean;
  statusCounts: ClientManeuverStatusCounts;
  completedCount: number;
  totalKm: number;
  collected: number;
  receivable: number;
  totalRevenue: number;
  directCost: number;
  margin: number;
  marginPct: number;
  /** Vencimiento más cercano entre maniobras por cobrar. */
  nextDueYmd: string | null;
  nextDueLabel: string;
  nextDueBadgeVariant: ClientPaymentDueBadgeVariant;
  upcomingPayments: ClientUpcomingPaymentRow[];
  paymentHistory: ClientPaymentHistoryRow[];
}

function tripMatchesClient(t: Trip, clientId: string): boolean {
  const id = clientId.trim();
  if (!id) {
    return false;
  }
  return (t.clientId ?? '').trim() === id;
}

function dateLabel(ymd: string): string {
  const d = new Date(`${ymd}T12:00:00`);
  if (Number.isNaN(d.getTime())) {
    return ymd;
  }
  return new Intl.DateTimeFormat('es-MX', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(d);
}

function dateLabelFromIso(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return iso;
  }
  return new Intl.DateTimeFormat('es-MX', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(d);
}

function addDaysYmd(ymd: string, days: number): string {
  const d = new Date(`${ymd}T12:00:00`);
  d.setDate(d.getDate() + days);
  return localYmd(d);
}

function dueBadgeVariant(
  dueYmd: string,
  asOfYmd: string,
): ClientPaymentDueBadgeVariant {
  if (dueYmd < asOfYmd) {
    return 'danger';
  }
  if (dueYmd <= addDaysYmd(asOfYmd, 7)) {
    return 'warning';
  }
  return 'success';
}

function dueStatusHint(dueYmd: string, asOfYmd: string): string {
  if (dueYmd < asOfYmd) {
    return 'Vencido';
  }
  if (dueYmd <= addDaysYmd(asOfYmd, 7)) {
    return 'Vence pronto';
  }
  return 'Programado';
}

function countByStatus(trips: readonly Trip[]): ClientManeuverStatusCounts {
  const counts: Record<TripStatus, number> = {
    completed: 0,
    in_transit: 0,
    scheduled: 0,
    cancelled: 0,
  };
  for (const t of trips) {
    counts[t.status] = (counts[t.status] ?? 0) + 1;
  }
  const total = trips.length;
  return {
    completed: counts.completed,
    inTransit: counts.in_transit,
    scheduled: counts.scheduled,
    cancelled: counts.cancelled,
    total,
  };
}

/** Balance operativo y cartera del cliente a partir de maniobras cargadas. */
export function buildClientBalanceSummary(
  clientId: string,
  trips: readonly Trip[],
  expenses: readonly Expense[] = [],
  asOf: Date = new Date(),
): ClientBalanceSummary {
  const subset = trips.filter((t) => tripMatchesClient(t, clientId));
  const billable = subset.filter((t) => isTripBillableForReporting(t));
  const completed = subset.filter((t) => t.status === 'completed');
  const asOfYmd = localYmd(asOf);

  const collected = sumTripCollectedRevenue(billable);
  const receivable = sumTripCreditReceivable(billable);
  const totalRevenue = sumTripRevenue(billable);
  const directCost = sumTripResolvedDirectCost(billable, expenses);
  const margin = totalRevenue - directCost;
  const marginPct =
    totalRevenue > 0 ? Math.round((margin / totalRevenue) * 100) : 0;

  const totalKm = completed.reduce((sum, t) => sum + tripKm(t), 0);

  const paymentHistory: ClientPaymentHistoryRow[] = [];
  for (const t of billable) {
    if (!isTripClientCollected(t)) {
      continue;
    }
    const iso = (t.clientCollectedAt ?? '').trim();
    if (!iso) {
      continue;
    }
    const collectedYmd = localYmd(new Date(iso));
    paymentHistory.push({
      tripId: t.id,
      maneuverCode: t.maneuverCode,
      collectedYmd,
      collectedLabel: dateLabelFromIso(iso),
      amount: tripRevenue(t),
    });
  }
  paymentHistory.sort((a, b) => b.collectedYmd.localeCompare(a.collectedYmd));

  const upcomingPayments: ClientUpcomingPaymentRow[] = [];
  let nextDueYmd: string | null = null;

  for (const t of billable) {
    const amount = tripCreditReceivable(t);
    if (amount <= 0) {
      continue;
    }
    const due = tripDueDate(t);
    const dueYmd = due ? localYmd(due) : asOfYmd;
    if (!nextDueYmd || dueYmd < nextDueYmd) {
      nextDueYmd = dueYmd;
    }
    upcomingPayments.push({
      tripId: t.id,
      maneuverCode: t.maneuverCode,
      dueYmd,
      dueLabel: dateLabel(dueYmd),
      amount,
      badgeVariant: dueBadgeVariant(dueYmd, asOfYmd),
      statusHint: dueStatusHint(dueYmd, asOfYmd),
    });
  }
  upcomingPayments.sort((a, b) => a.dueYmd.localeCompare(b.dueYmd));

  const nextDueBadgeVariant = nextDueYmd
    ? dueBadgeVariant(nextDueYmd, asOfYmd)
    : 'neutral';

  return {
    hasTrips: subset.length > 0,
    hasBillable: billable.length > 0,
    statusCounts: countByStatus(subset),
    completedCount: completed.length,
    totalKm: Math.round(totalKm),
    collected,
    receivable,
    totalRevenue,
    directCost,
    margin,
    marginPct,
    nextDueYmd,
    nextDueLabel: nextDueYmd ? dateLabel(nextDueYmd) : '—',
    nextDueBadgeVariant: nextDueBadgeVariant,
    upcomingPayments,
    paymentHistory,
  };
}
