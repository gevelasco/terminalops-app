import { localYmd } from '@features/reports/utils/reports-filter';
import { tripKm, tripOperatorQuota } from '@features/reports/utils/reports-trip-helpers';
import type { ClientPaymentDueBadgeVariant } from '@features/clients/utils/client-balance-summary';
import type { Expense, Operator, Trip, TripStatus, Unit } from '@shared/models/logistics.models';
import { formatTripRouteLabel } from '@shared/utils/trip-route-label';
import { labelForUnitId } from '@shared/utils/fleet/unit-label';
import {
  normalizeOperatorPaymentSchedule,
  resolveOperatorPayAlertDueYmd,
  resolveTripPayRowDueYmd,
  tripCompletionAnchorYmd,
} from './operator-payment-schedule.util';

export const OPERATOR_SUMMARY_RECENT_DAYS = 30;

export interface OperatorManeuverStatusCounts {
  completed: number;
  inTransit: number;
  scheduled: number;
  cancelled: number;
  total: number;
}

export type OperatorPaymentRowStatus = 'paid' | 'pending' | 'due' | 'overdue';

export interface OperatorPaymentRow {
  tripId: string;
  maneuverCode: string;
  dueYmd: string;
  dueLabel: string;
  quotaAmount: number;
  balance: number;
  paidAmount: number;
  status: OperatorPaymentRowStatus;
  badgeVariant: ClientPaymentDueBadgeVariant;
  statusHint: string;
  expenseId: string | null;
  paidAtYmd: string | null;
  canConfirm: boolean;
  completionYmd: string | null;
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
  activeAssignment: OperatorActiveAssignment | null;
  owedTripCount: number;
  owedAmount: number;
  nextPayDueYmd: string | null;
  nextPayDueLabel: string;
  nextPayDueBadgeVariant: ClientPaymentDueBadgeVariant;
  pendingPaymentRows: OperatorPaymentRow[];
  recentPaymentRows: OperatorPaymentRow[];
}

export const EMPTY_OPERATOR_OPERATION_SUMMARY: OperatorOperationSummary = {
  hasTrips: false,
  statusCounts: {
    completed: 0,
    inTransit: 0,
    scheduled: 0,
    cancelled: 0,
    total: 0,
  },
  completedKm: 0,
  activeAssignment: null,
  owedTripCount: 0,
  owedAmount: 0,
  nextPayDueYmd: null,
  nextPayDueLabel: '—',
  nextPayDueBadgeVariant: 'neutral',
  pendingPaymentRows: [],
  recentPaymentRows: [],
};

/** Campos de la lista/cards de operadores derivados del resumen de pagos. */
export function operatorListPaymentFieldsFromSummary(
  summary: Pick<
    OperatorOperationSummary,
    'owedAmount' | 'nextPayDueYmd' | 'nextPayDueBadgeVariant'
  >,
): Pick<Operator, 'owedAmount' | 'nextPayDueOn' | 'nextPayDueVariant'> {
  if (summary.owedAmount <= 0) {
    return {
      owedAmount: undefined,
      nextPayDueOn: undefined,
      nextPayDueVariant: undefined,
    };
  }
  const variant = summary.nextPayDueBadgeVariant;
  return {
    owedAmount: summary.owedAmount,
    nextPayDueOn: summary.nextPayDueYmd?.trim() || undefined,
    nextPayDueVariant:
      variant === 'success' || variant === 'warning' || variant === 'danger'
        ? variant
        : undefined,
  };
}

function parsePayDueVariant(
  raw: unknown,
): ClientPaymentDueBadgeVariant {
  if (raw === 'success' || raw === 'warning' || raw === 'danger' || raw === 'neutral') {
    return raw;
  }
  return 'neutral';
}

function parsePaymentRowStatus(
  raw: unknown,
  dueYmd?: string,
  asOfYmd?: string,
): OperatorPaymentRowStatus {
  if (raw === 'paid' || raw === 'pending' || raw === 'due' || raw === 'overdue') {
    return raw;
  }
  if (dueYmd && asOfYmd) {
    if (dueYmd < asOfYmd) {
      return 'overdue';
    }
    if (dueYmd === asOfYmd) {
      return 'due';
    }
  }
  return 'pending';
}

function mapPaymentRow(
  p: Record<string, unknown>,
  asOfYmd = localYmd(new Date()),
): OperatorPaymentRow {
  const dueYmd = String(p['dueYmd'] ?? '');
  const quotaAmount = Number(p['quotaAmount'] ?? p['amount'] ?? 0) || 0;
  const paidAmount = Number(p['paidAmount'] ?? 0) || 0;
  const balanceRaw = Number(p['balance'] ?? 0) || 0;
  const balance =
    balanceRaw > 0 ? balanceRaw : Math.max(0, quotaAmount - paidAmount);
  const statusHint = String(p['statusHint'] ?? '');
  const status = parsePaymentRowStatus(
    p['status'],
    dueYmd || undefined,
    asOfYmd,
  );
  const inferredStatus =
    status === 'pending' &&
    balance > 0 &&
    (statusHint === 'Vencido' || (dueYmd && dueYmd < asOfYmd))
      ? 'overdue'
      : status;
  const canConfirm = balance > 0 && inferredStatus !== 'paid';

  return {
    tripId: String(p['tripId'] ?? ''),
    maneuverCode: String(p['maneuverCode'] ?? ''),
    dueYmd,
    dueLabel: String(p['dueLabel'] ?? ''),
    quotaAmount: quotaAmount || balance,
    balance,
    paidAmount,
    status: inferredStatus,
    badgeVariant: parsePayDueVariant(p['badgeVariant']),
    statusHint,
    expenseId:
      p['expenseId'] != null && String(p['expenseId']).trim()
        ? String(p['expenseId'])
        : null,
    paidAtYmd:
      typeof p['paidAtYmd'] === 'string' && p['paidAtYmd'].trim()
        ? p['paidAtYmd'].trim()
        : null,
    canConfirm,
    completionYmd:
      typeof p['completionYmd'] === 'string' && p['completionYmd'].trim()
        ? p['completionYmd'].trim()
        : null,
  };
}

function splitLegacyPaymentRows(
  rows: readonly OperatorPaymentRow[],
  asOfYmd: string,
): {
  pendingPaymentRows: OperatorPaymentRow[];
  recentPaymentRows: OperatorPaymentRow[];
} {
  const fromYmd = addDaysYmd(asOfYmd, -(30 - 1));
  const pendingPaymentRows: OperatorPaymentRow[] = [];
  const recentPaymentRows: OperatorPaymentRow[] = [];

  for (const row of rows) {
    if (row.balance > 0 || row.canConfirm) {
      pendingPaymentRows.push(row);
      continue;
    }
    const completionYmd = row.completionYmd ?? row.paidAtYmd ?? row.dueYmd;
    if (completionYmd >= fromYmd && completionYmd <= asOfYmd) {
      recentPaymentRows.push(row);
    }
  }

  return { pendingPaymentRows, recentPaymentRows };
}

/** Respuesta GET /operators/:id/operation-summary */
export function mapApiOperatorOperationSummary(
  row: Record<string, unknown>,
): OperatorOperationSummary {
  const counts = (row['statusCounts'] ?? {}) as Record<string, unknown>;
  const active = row['activeAssignment'] as Record<string, unknown> | null | undefined;
  const asOfYmd = localYmd(new Date());
  const pendingRaw = Array.isArray(row['pendingPaymentRows'])
    ? (row['pendingPaymentRows'] as Record<string, unknown>[])
    : null;
  const recentRaw = Array.isArray(row['recentPaymentRows'])
    ? (row['recentPaymentRows'] as Record<string, unknown>[])
    : null;
  const legacyRowsRaw =
    pendingRaw == null && recentRaw == null
      ? Array.isArray(row['paymentRows'])
        ? (row['paymentRows'] as Record<string, unknown>[])
        : Array.isArray(row['upcomingPayments'])
          ? (row['upcomingPayments'] as Record<string, unknown>[])
          : []
      : [];
  const paymentSections =
    pendingRaw != null || recentRaw != null
      ? {
          pendingPaymentRows: (pendingRaw ?? []).map((p) =>
            mapPaymentRow(p, asOfYmd),
          ),
          recentPaymentRows: (recentRaw ?? []).map((p) => mapPaymentRow(p, asOfYmd)),
        }
      : splitLegacyPaymentRows(
          legacyRowsRaw.map((p) => mapPaymentRow(p, asOfYmd)),
          asOfYmd,
        );

  return {
    hasTrips: Boolean(row['hasTrips']),
    statusCounts: {
      completed: Number(counts['completed'] ?? 0) || 0,
      inTransit: Number(counts['inTransit'] ?? 0) || 0,
      scheduled: Number(counts['scheduled'] ?? 0) || 0,
      cancelled: Number(counts['cancelled'] ?? 0) || 0,
      total: Number(counts['total'] ?? 0) || 0,
    },
    completedKm: Number(row['completedKm'] ?? 0) || 0,
    activeAssignment:
      active && typeof active === 'object'
        ? {
            maneuverCode: String(active['maneuverCode'] ?? '—'),
            routeLabel: String(active['routeLabel'] ?? '—'),
            clientName: String(active['clientName'] ?? '—'),
            unitLabel: String(active['unitLabel'] ?? '—'),
            equipmentLabel: String(active['equipmentLabel'] ?? '—'),
            statusLabel: String(active['statusLabel'] ?? '—'),
          }
        : null,
    owedTripCount: Number(row['owedTripCount'] ?? 0) || 0,
    owedAmount: Number(row['owedAmount'] ?? 0) || 0,
    nextPayDueYmd:
      typeof row['nextPayDueYmd'] === 'string' && row['nextPayDueYmd'].trim()
        ? row['nextPayDueYmd'].trim()
        : null,
    nextPayDueLabel: String(row['nextPayDueLabel'] ?? '—'),
    nextPayDueBadgeVariant: parsePayDueVariant(row['nextPayDueBadgeVariant']),
    pendingPaymentRows: paymentSections.pendingPaymentRows,
    recentPaymentRows: paymentSections.recentPaymentRows,
  };
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

function tripActivityYmd(t: Trip): string | null {
  for (const value of [
    t.returnAt,
    t.arrivedAt,
    t.departureAt,
    t.plannedCompletionAt,
    t.plannedDepartureAt,
  ]) {
    if (!value?.trim()) {
      continue;
    }
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) {
      return localYmd(d);
    }
  }
  return null;
}

function isTripWithinRecentDays(
  trip: Trip,
  asOfYmd: string,
  dayCount: number,
): boolean {
  const activityYmd = tripActivityYmd(trip);
  if (!activityYmd) {
    return false;
  }
  const fromYmd = addDaysYmd(asOfYmd, -(dayCount - 1));
  return activityYmd >= fromYmd && activityYmd <= asOfYmd;
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

/** Fecha de alerta de pago al operador al concluir la maniobra (modo maniobra). */
export function operatorPayDueDate(t: Trip): Date | null {
  const ymd = tripCompletionAnchorYmd(t);
  if (!ymd) {
    return null;
  }
  const d = new Date(`${ymd}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
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
  paymentScheduleRaw?: string | null,
): OperatorOperationSummary {
  const subset = trips.filter((t) => tripMatchesOperator(t, operatorId));
  const asOfYmd = localYmd(asOf);
  const paymentSchedule = normalizeOperatorPaymentSchedule(paymentScheduleRaw);
  const recentTrips = subset.filter((trip) =>
    isTripWithinRecentDays(trip, asOfYmd, OPERATOR_SUMMARY_RECENT_DAYS),
  );

  const completedKm = recentTrips
    .filter((t) => t.status === 'completed')
    .reduce((sum, t) => sum + tripKm(t), 0);

  const paymentSections = {
    pendingPaymentRows: [] as OperatorPaymentRow[],
    recentPaymentRows: [] as OperatorPaymentRow[],
  };
  let owedAmount = 0;
  let owedTripCount = 0;
  const unpaidCompletionYmds: string[] = [];

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
    const completionYmd = tripCompletionAnchorYmd(t);
    if (completionYmd) {
      unpaidCompletionYmds.push(completionYmd);
    }
  }

  const batchDueYmd =
    owedAmount > 0
      ? resolveOperatorPayAlertDueYmd(
          paymentSchedule,
          asOfYmd,
          unpaidCompletionYmds,
        )
      : null;
  const nextPayDueYmd = batchDueYmd;

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
    const completionYmd = tripCompletionAnchorYmd(t);
    const dueYmd = resolveTripPayRowDueYmd(
      paymentSchedule,
      asOfYmd,
      completionYmd,
      batchDueYmd,
    );
    const row: OperatorPaymentRow = {
      tripId: t.id,
      maneuverCode: t.maneuverCode,
      dueYmd,
      dueLabel: dateLabel(dueYmd),
      quotaAmount: quota,
      balance,
      paidAmount: paid,
      status: dueYmd < asOfYmd ? 'overdue' : 'pending',
      badgeVariant: dueBadgeVariant(dueYmd, asOfYmd),
      statusHint: dueStatusHint(dueYmd, asOfYmd),
      expenseId: null,
      paidAtYmd: null,
      canConfirm: balance > 0,
      completionYmd,
    };
    paymentSections.pendingPaymentRows.push(row);
  }

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
    if (balance > 0) {
      continue;
    }
    const completionYmd = tripCompletionAnchorYmd(t);
    if (!completionYmd || !isTripWithinRecentDays(t, asOfYmd, 30)) {
      continue;
    }
    const dueYmd = resolveTripPayRowDueYmd(
      paymentSchedule,
      asOfYmd,
      completionYmd,
      batchDueYmd,
    );
    paymentSections.recentPaymentRows.push({
      tripId: t.id,
      maneuverCode: t.maneuverCode,
      dueYmd,
      dueLabel: dateLabel(dueYmd),
      quotaAmount: quota,
      balance: 0,
      paidAmount: paid,
      status: 'paid',
      badgeVariant: 'success',
      statusHint: 'Pagado',
      expenseId: null,
      paidAtYmd: completionYmd,
      canConfirm: false,
      completionYmd,
    });
  }

  paymentSections.pendingPaymentRows.sort((a, b) =>
    a.dueYmd.localeCompare(b.dueYmd),
  );
  paymentSections.recentPaymentRows.sort((a, b) =>
    (b.completionYmd ?? b.dueYmd).localeCompare(a.completionYmd ?? a.dueYmd),
  );

  const nextPayDueBadgeVariant = nextPayDueYmd
    ? dueBadgeVariant(nextPayDueYmd, asOfYmd)
    : 'neutral';

  return {
    hasTrips: subset.length > 0,
    statusCounts: countByStatus(recentTrips),
    completedKm: Math.round(completedKm),
    activeAssignment: buildActiveAssignment(subset, units),
    owedTripCount,
    owedAmount,
    nextPayDueYmd,
    nextPayDueLabel: nextPayDueYmd ? dateLabel(nextPayDueYmd) : '—',
    nextPayDueBadgeVariant,
    pendingPaymentRows: paymentSections.pendingPaymentRows,
    recentPaymentRows: paymentSections.recentPaymentRows,
  };
}
