import { tripDueDate } from '@features/reports/utils/reports-credit-receivable-charts';
import { CLIENT_COMMERCIAL_DUE_SOON_DAYS } from '@features/clients/utils/client-commercial-status.util';
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
  dueYmd: string;
  dueLabel: string;
  collectedYmd: string;
  collectedLabel: string;
  amount: number;
  delayDays: number;
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
  avgDelayDays: number | null;
  volumeMonthsWindow: number;
  volumeBillableCount: number;
  volumeAllCount: number;
  volumeManeuversPerMonth: number;
  volumeBilledPerMonth: number;
  volumeOperationalPerMonth: number;
  volumeProfitPerMonth: number;
  period?: ClientBalancePeriodSummary;
}

export interface ClientBalancePeriodSummary {
  from: string;
  to: string;
  paymentHistory: ClientPaymentHistoryRow[];
  statusCounts: ClientManeuverStatusCounts;
  completedCount: number;
  totalKm: number;
  volumeMonthsWindow: number;
  volumeBillableCount: number;
  volumeAllCount: number;
  volumeManeuversPerMonth: number;
  volumeBilledPerMonth: number;
  volumeOperationalPerMonth: number;
  volumeProfitPerMonth: number;
}

/** Resumen vacío para clientes sin maniobras (p. ej. overview API). */
export function emptyClientBalanceSummary(): ClientBalanceSummary {
  return {
    hasTrips: false,
    hasBillable: false,
    statusCounts: {
      completed: 0,
      inTransit: 0,
      scheduled: 0,
      cancelled: 0,
      total: 0,
    },
    completedCount: 0,
    totalKm: 0,
    collected: 0,
    receivable: 0,
    totalRevenue: 0,
    directCost: 0,
    margin: 0,
    marginPct: 0,
    nextDueYmd: null,
    nextDueLabel: '—',
    nextDueBadgeVariant: 'neutral',
    upcomingPayments: [],
    paymentHistory: [],
    avgDelayDays: null,
    volumeMonthsWindow: 0,
    volumeBillableCount: 0,
    volumeAllCount: 0,
    volumeManeuversPerMonth: 0,
    volumeBilledPerMonth: 0,
    volumeOperationalPerMonth: 0,
    volumeProfitPerMonth: 0,
  };
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
  if (dueYmd <= addDaysYmd(asOfYmd, CLIENT_COMMERCIAL_DUE_SOON_DAYS)) {
    return 'warning';
  }
  return 'success';
}

function dueStatusHint(dueYmd: string, asOfYmd: string): string {
  if (dueYmd < asOfYmd) {
    return 'Vencido';
  }
  if (dueYmd <= addDaysYmd(asOfYmd, CLIENT_COMMERCIAL_DUE_SOON_DAYS)) {
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
  const delayDaysSamples: number[] = [];

  for (const t of billable) {
    const due = tripDueDate(t);

    if (isTripClientCollected(t)) {
      const iso = (t.clientCollectedAt ?? '').trim();
      if (!iso) {
        continue;
      }
      const collectedDate = new Date(iso);
      const collectedYmd = localYmd(collectedDate);
      const dueYmd = due ? localYmd(due) : asOfYmd;
      let delayDays = 0;

      if (due) {
        const diffMs = collectedDate.getTime() - due.getTime();
        delayDays = Math.round(diffMs / 86400000);
        delayDaysSamples.push(delayDays);
      }

      paymentHistory.push({
        tripId: t.id,
        maneuverCode: t.maneuverCode,
        dueYmd,
        dueLabel: dateLabel(dueYmd),
        collectedYmd,
        collectedLabel: dateLabelFromIso(iso),
        amount: tripRevenue(t),
        delayDays,
      });
    } else if (due) {
      const diffMs = asOf.getTime() - due.getTime();
      const overdueDays = Math.round(diffMs / 86400000);
      if (overdueDays > 0) {
        delayDaysSamples.push(overdueDays);
      }
    }
  }
  paymentHistory.sort((a, b) => b.collectedYmd.localeCompare(a.collectedYmd));

  const avgDelayDays =
    delayDaysSamples.length > 0
      ? Math.round(
          (delayDaysSamples.reduce((s, d) => s + d, 0) / delayDaysSamples.length) * 10,
        ) / 10
      : null;

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
    avgDelayDays,
    ...computeVolumeSummaryFromTrips(subset, billable),
  };
}

function parseMoney(raw: string | undefined): number {
  if (raw == null || !String(raw).trim()) return 0;
  const n = Number(String(raw).replace(/\s/g, '').replace(/,/g, ''));
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function computeVolumeSummaryFromTrips(
  allForClient: readonly Trip[],
  billable: readonly Trip[],
): {
  volumeMonthsWindow: number;
  volumeBillableCount: number;
  volumeAllCount: number;
  volumeManeuversPerMonth: number;
  volumeBilledPerMonth: number;
  volumeOperationalPerMonth: number;
  volumeProfitPerMonth: number;
} {
  const volumeAllCount = allForClient.length;
  const volumeBillableCount = billable.length;

  if (volumeBillableCount === 0) {
    return {
      volumeMonthsWindow: 0,
      volumeBillableCount,
      volumeAllCount,
      volumeManeuversPerMonth: 0,
      volumeBilledPerMonth: 0,
      volumeOperationalPerMonth: 0,
      volumeProfitPerMonth: 0,
    };
  }

  let billedTotal = 0;
  let opsTotal = 0;
  const dates: Date[] = [];

  for (const t of billable) {
    billedTotal += parseMoney(t.clientCharge);
    opsTotal +=
      parseMoney(t.dieselAmount) +
      parseMoney(t.casetasAmount) +
      parseMoney(t.operatorQuota);
    const iso = (t.createdAt ?? '').trim();
    if (iso) {
      const d = new Date(iso);
      if (!Number.isNaN(d.getTime())) dates.push(d);
    }
  }

  if (dates.length === 0) {
    return {
      volumeMonthsWindow: 0,
      volumeBillableCount,
      volumeAllCount,
      volumeManeuversPerMonth: 0,
      volumeBilledPerMonth: 0,
      volumeOperationalPerMonth: 0,
      volumeProfitPerMonth: 0,
    };
  }

  const minT = Math.min(...dates.map((d) => d.getTime()));
  const maxT = Math.max(...dates.map((d) => d.getTime()));
  const lo = new Date(minT);
  const hi = new Date(maxT);
  const volumeMonthsWindow = Math.max(
    1,
    (hi.getUTCFullYear() - lo.getUTCFullYear()) * 12 +
      (hi.getUTCMonth() - lo.getUTCMonth()) +
      1,
  );

  const volumeManeuversPerMonth = volumeBillableCount / volumeMonthsWindow;
  const volumeBilledPerMonth = billedTotal / volumeMonthsWindow;
  const volumeOperationalPerMonth = opsTotal / volumeMonthsWindow;
  const volumeProfitPerMonth = volumeBilledPerMonth - volumeOperationalPerMonth;

  return {
    volumeMonthsWindow,
    volumeBillableCount,
    volumeAllCount,
    volumeManeuversPerMonth: Math.round(volumeManeuversPerMonth * 10) / 10,
    volumeBilledPerMonth: Math.round(volumeBilledPerMonth),
    volumeOperationalPerMonth: Math.round(volumeOperationalPerMonth),
    volumeProfitPerMonth: Math.round(volumeProfitPerMonth),
  };
}

const mxMoney0 = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
  maximumFractionDigits: 0,
});

function compactDateLabel(ymd: string): string {
  const d = new Date(`${ymd}T12:00:00`);
  if (Number.isNaN(d.getTime())) {
    return ymd;
  }
  return new Intl.DateTimeFormat('es-MX', {
    day: 'numeric',
    month: 'short',
  }).format(d);
}

function daysOverdue(dueYmd: string, asOfYmd: string): number {
  const due = new Date(`${dueYmd}T12:00:00`);
  const asOf = new Date(`${asOfYmd}T12:00:00`);
  if (Number.isNaN(due.getTime()) || Number.isNaN(asOf.getTime())) {
    return 0;
  }
  const diff = Math.floor((asOf.getTime() - due.getTime()) / 86_400_000);
  return diff > 0 ? diff : 0;
}

/** Formato monetario compartido para balance de cliente (cards y drawer). */
export function formatClientBalanceMoney(value: number): string {
  return mxMoney0.format(value);
}

export interface ClientBalanceCollectionStatus {
  label: string;
  variant: ClientPaymentDueBadgeVariant;
  icon: 'warning' | 'cancelCircle' | null;
}

/** Etiqueta de cobranza derivada del resumen (cards de balance). */
export function clientBalanceCollectionStatus(
  balance: ClientBalanceSummary,
  asOf: Date = new Date(),
): ClientBalanceCollectionStatus {
  const pendingCount = balance.upcomingPayments.length;
  if (balance.receivable <= 0 || pendingCount === 0) {
    return { label: 'Vigente', variant: 'success', icon: null };
  }

  const overdue = balance.upcomingPayments.filter(
    (row) => row.badgeVariant === 'danger',
  );
  if (overdue.length > 0) {
    const days = daysOverdue(overdue[0].dueYmd, localYmd(asOf));
    return {
      label: days > 0 ? `Pago vencido (${days} días)` : 'Pago vencido',
      variant: 'danger',
      icon: 'cancelCircle',
    };
  }

  const noun = pendingCount === 1 ? 'maniobra' : 'maniobras';
  return {
    label: `${pendingCount} ${noun} por cobrar`,
    variant: 'warning',
    icon: 'warning',
  };
}

export interface ClientBalanceHighlightedPayment {
  sectionLabel: string;
  dueLabel: string;
  amountLabel: string;
  overdue: boolean;
}

/** Próximo cobro o vencimiento más urgente (primer `upcomingPayments`). */
export function clientBalanceHighlightedPayment(
  balance: ClientBalanceSummary,
): ClientBalanceHighlightedPayment {
  const next = balance.upcomingPayments[0];
  if (!next) {
    return {
      sectionLabel: 'Próximo pago',
      dueLabel: '—',
      amountLabel: '—',
      overdue: false,
    };
  }

  const overdue = next.badgeVariant === 'danger';
  return {
    sectionLabel: overdue ? 'Fecha vencimiento' : 'Próximo pago',
    dueLabel: compactDateLabel(next.dueYmd),
    amountLabel: formatClientBalanceMoney(next.amount),
    overdue,
  };
}
