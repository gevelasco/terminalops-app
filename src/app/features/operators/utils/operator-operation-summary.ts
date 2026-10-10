import { localYmd } from '@features/reports/utils/reports-filter';
import type { ClientPaymentDueBadgeVariant } from '@features/clients/utils/client-balance-summary';
import type { Operator } from '@shared/models/logistics.models';

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
  const apiCanConfirm = p['canConfirm'];
  const canConfirm =
    apiCanConfirm === false
      ? false
      : balance > 0 && inferredStatus !== 'paid';

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

function addDaysYmd(ymd: string, days: number): string {
  const d = new Date(`${ymd}T12:00:00`);
  d.setDate(d.getDate() + days);
  return localYmd(d);
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
