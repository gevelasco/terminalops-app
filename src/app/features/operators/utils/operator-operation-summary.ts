import { tripDueDate } from '@features/reports/utils/reports-credit-receivable-charts';
import { localYmd } from '@features/reports/utils/reports-filter';
import { tripKm, tripOperatorQuota } from '@features/reports/utils/reports-trip-helpers';
import type { ClientPaymentDueBadgeVariant } from '@features/clients/utils/client-balance-summary';
import type { Expense, Trip, TripStatus, Unit } from '@shared/models/logistics.models';
import { formatTripRouteLabel } from '@shared/utils/trip-route-label';
import { labelForUnitId } from '@shared/utils/fleet/unit-label';

const OPERATOR_PAY_DAYS_AFTER_CLOSE = 7;

export interface OperatorManeuverStatusCounts {
  completed: number;
  inTransit: number;
  scheduled: number;
  cancelled: number;
  total: number;
}

export interface OperatorUpcomingPayRow {
  tripId: string;
  maneuverCode: string;
  dueYmd: string;
  dueLabel: string;
  amount: number;
  badgeVariant: ClientPaymentDueBadgeVariant;
  statusHint: string;
}

export interface OperatorActiveAssignment {
  maneuverCode: string;
  routeLabel: string;
  clientName: string;
  unitLabel: string;
  equipmentLabel: string;
  statusLabel: string;
}

export interface OperatorOperationSummary {
  hasTrips: boolean;
  statusCounts: OperatorManeuverStatusCounts;
  completedKm: number;
  distinctClients: number;
  topRouteLabel: string;
  topRouteCount: number;
  activeAssignment: OperatorActiveAssignment | null;
  owedTripCount: number;
  owedAmount: number;
  nextPayDueYmd: string | null;
  nextPayDueLabel: string;
  nextPayDueBadgeVariant: ClientPaymentDueBadgeVariant;
  upcomingPayments: OperatorUpcomingPayRow[];
}

function tripMatchesOperator(t: Trip, operatorId: string): boolean {
  const id = operatorId.trim();
  return id.length > 0 && (t.operatorId ?? '').trim() === id;
}

function countByStatus(trips: readonly Trip[]): OperatorManeuverStatusCounts {
  const counts: Record<TripStatus, number> = {
    completed: 0,
    in_transit: 0,
    scheduled: 0,
    cancelled: 0,
  };
  for (const t of trips) {
    counts[t.status] = (counts[t.status] ?? 0) + 1;
  }
  return {
    completed: counts.completed,
    inTransit: counts.in_transit,
    scheduled: counts.scheduled,
    cancelled: counts.cancelled,
    total: trips.length,
  };
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

function isOperatorPayExpenseKind(kind: Expense['kind']): boolean {
  return kind === 'operator_payment' || kind === 'operator_commission';
}

function operatorPaidOnTrip(tripId: string, expenses: readonly Expense[]): number {
  const id = tripId.trim();
  if (!id) {
    return 0;
  }
  let sum = 0;
  for (const e of expenses) {
    if (!isOperatorPayExpenseKind(e.kind)) {
      continue;
    }
    if ((e.tripId ?? '').trim() !== id) {
      continue;
    }
    sum += e.amount;
  }
  return sum;
}

/** Fecha objetivo de pago al operador (cierre de maniobra + plazo interno). */
export function operatorPayDueDate(t: Trip): Date | null {
  const anchor = t.returnAt ?? t.arrivedAt;
  if (!anchor?.trim()) {
    return tripDueDate(t);
  }
  const d = new Date(anchor);
  if (Number.isNaN(d.getTime())) {
    return tripDueDate(t);
  }
  d.setDate(d.getDate() + OPERATOR_PAY_DAYS_AFTER_CLOSE);
  return d;
}

function topRoute(
  trips: readonly Trip[],
): { label: string; count: number } {
  const counts = new Map<string, number>();
  for (const t of trips) {
    const label = formatTripRouteLabel(t.origin, t.destination);
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  let bestLabel = '—';
  let bestCount = 0;
  for (const [label, n] of counts) {
    if (n > bestCount) {
      bestCount = n;
      bestLabel = label;
    }
  }
  return { label: bestLabel, count: bestCount };
}

function buildActiveAssignment(
  trips: readonly Trip[],
  units: readonly Unit[],
): OperatorActiveAssignment | null {
  const active =
    trips.find((t) => t.status === 'in_transit') ??
    trips.find((t) => t.status === 'scheduled');
  if (!active) {
    return null;
  }
  const equipment = (active.equipment ?? []).filter((x) => x.trim().length > 0);
  return {
    maneuverCode: active.maneuverCode,
    routeLabel: formatTripRouteLabel(active.origin, active.destination),
    clientName: active.clientName?.trim() || '—',
    unitLabel: labelForUnitId(active.unitId, units),
    equipmentLabel: equipment.length > 0 ? equipment.join(' · ') : '—',
    statusLabel:
      active.status === 'in_transit' ? 'En curso' : 'Programada',
  };
}

export function buildOperatorOperationSummary(
  operatorId: string,
  trips: readonly Trip[],
  expenses: readonly Expense[],
  units: readonly Unit[],
  asOf: Date = new Date(),
): OperatorOperationSummary {
  const subset = trips.filter((t) => tripMatchesOperator(t, operatorId));
  const asOfYmd = localYmd(asOf);
  const { label: topRouteLabel, count: topRouteCount } = topRoute(subset);

  const clients = new Set<string>();
  for (const t of subset) {
    const c = (t.clientId ?? '').trim();
    if (c) {
      clients.add(c);
    }
  }

  const completedKm = subset
    .filter((t) => t.status === 'completed')
    .reduce((sum, t) => sum + tripKm(t), 0);

  const upcomingPayments: OperatorUpcomingPayRow[] = [];
  let owedAmount = 0;
  let owedTripCount = 0;
  let nextPayDueYmd: string | null = null;

  for (const t of subset) {
    if (t.status !== 'completed') {
      continue;
    }
    const quota = tripOperatorQuota(t);
    if (quota <= 0) {
      continue;
    }
    const paid = operatorPaidOnTrip(t.id, expenses);
    const balance = Math.max(0, quota - paid);
    if (balance <= 0) {
      continue;
    }
    owedTripCount += 1;
    owedAmount += balance;
    const due = operatorPayDueDate(t);
    const dueYmd = due ? localYmd(due) : asOfYmd;
    if (!nextPayDueYmd || dueYmd < nextPayDueYmd) {
      nextPayDueYmd = dueYmd;
    }
    upcomingPayments.push({
      tripId: t.id,
      maneuverCode: t.maneuverCode,
      dueYmd,
      dueLabel: dateLabel(dueYmd),
      amount: balance,
      badgeVariant: dueBadgeVariant(dueYmd, asOfYmd),
      statusHint: dueStatusHint(dueYmd, asOfYmd),
    });
  }
  upcomingPayments.sort((a, b) => a.dueYmd.localeCompare(b.dueYmd));

  const nextPayDueBadgeVariant = nextPayDueYmd
    ? dueBadgeVariant(nextPayDueYmd, asOfYmd)
    : 'neutral';

  return {
    hasTrips: subset.length > 0,
    statusCounts: countByStatus(subset),
    completedKm: Math.round(completedKm),
    distinctClients: clients.size,
    topRouteLabel,
    topRouteCount,
    activeAssignment: buildActiveAssignment(subset, units),
    owedTripCount,
    owedAmount,
    nextPayDueYmd,
    nextPayDueLabel: nextPayDueYmd ? dateLabel(nextPayDueYmd) : '—',
    nextPayDueBadgeVariant: nextPayDueBadgeVariant,
    upcomingPayments,
  };
}
