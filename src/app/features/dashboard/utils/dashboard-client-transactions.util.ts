import type { ClientBalanceOverviewItem } from '@core/services/api/clients';
import { COMMERCIAL_HANDSHAKE_ICON_SRC } from '@shared/constants/commercial-handshake-icon';
import type { ReportsBalanceDailyActivityDay } from '@shared/models/api/api-reports-balance.model';
import type { ToIconName } from '@shared/ui/to-icon/to-icon-paths';
import { operationalTodayYmd } from './dashboard-upcoming-payments.util';

/** Tope en el panel estrecho del dashboard (evita scroll excesivo). */
export const DASHBOARD_CLIENT_TRANSACTIONS_MAX_ROWS = 14;

export interface DashboardClientTransactionsRange {
  from: string;
  to: string;
  today: string;
}

export type DashboardClientTransactionKind = 'overdue' | 'upcoming' | 'collected';

export interface DashboardClientTransactionRow {
  id: string;
  kind: DashboardClientTransactionKind;
  clientName: string;
  maneuverCode: string | null;
  amount: number;
  dateYmd: string;
  dateLabel: string;
  statusLabel: string;
  overdueDays: number;
  /** Cobros pendientes: handshake (tab Clientes en Comercial). */
  iconImageSrc?: string;
  icon?: ToIconName;
}

function ymdMinusDays(ymd: string, days: number): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
  if (!match) {
    return ymd;
  }
  const date = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]) - days,
    12,
    0,
    0,
    0,
  );
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Ventana de 30 días calendario (inclusive) hasta hoy (MX). */
export function dashboardClientTransactionsRange(
  now = new Date(),
): DashboardClientTransactionsRange {
  const today = operationalTodayYmd(now);
  return {
    today,
    to: today,
    from: ymdMinusDays(today, 29),
  };
}

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

function daysOverdue(dueYmd: string, todayYmd: string): number {
  const due = new Date(`${dueYmd}T12:00:00`);
  const today = new Date(`${todayYmd}T12:00:00`);
  if (Number.isNaN(due.getTime()) || Number.isNaN(today.getTime())) {
    return 0;
  }
  const diff = Math.floor((today.getTime() - due.getTime()) / 86_400_000);
  return diff > 0 ? diff : 0;
}

function sortRows(rows: DashboardClientTransactionRow[]): DashboardClientTransactionRow[] {
  const rank: Record<DashboardClientTransactionKind, number> = {
    overdue: 0,
    upcoming: 1,
    collected: 2,
  };
  return [...rows].sort((a, b) => {
    const byKind = rank[a.kind] - rank[b.kind];
    if (byKind !== 0) {
      return byKind;
    }
    if (a.kind === 'overdue') {
      return b.overdueDays - a.overdueDays || a.dateYmd.localeCompare(b.dateYmd);
    }
    if (a.kind === 'upcoming') {
      return a.dateYmd.localeCompare(b.dateYmd);
    }
    return b.dateYmd.localeCompare(a.dateYmd);
  });
}

export function buildDashboardClientTransactions(
  overviewItems: readonly ClientBalanceOverviewItem[],
  dailyActivity: readonly ReportsBalanceDailyActivityDay[],
  range = dashboardClientTransactionsRange(),
): DashboardClientTransactionRow[] {
  const rows: DashboardClientTransactionRow[] = [];

  for (const item of overviewItems) {
    const clientName = item.name.trim() || 'Cliente';
    for (const payment of item.summary.upcomingPayments ?? []) {
      const dueYmd = payment.dueYmd.trim();
      if (!dueYmd) {
        continue;
      }
      const overdueDays = daysOverdue(dueYmd, range.today);
      const isOverdue = overdueDays > 0 || payment.badgeVariant === 'danger';
      const kind: DashboardClientTransactionKind = isOverdue ? 'overdue' : 'upcoming';
      const statusLabel = isOverdue
        ? overdueDays > 0
          ? `Vencido · ${overdueDays} ${overdueDays === 1 ? 'día' : 'días'}`
          : payment.statusHint || 'Vencido'
        : payment.statusHint || `Vence ${compactDateLabel(dueYmd)}`;
      rows.push({
        id: `due:${item.clientId}:${payment.tripId}`,
        kind,
        clientName,
        maneuverCode: payment.maneuverCode || null,
        amount: payment.amount,
        dateYmd: dueYmd,
        dateLabel: compactDateLabel(dueYmd),
        statusLabel,
        overdueDays: isOverdue ? Math.max(overdueDays, 1) : 0,
        iconImageSrc: COMMERCIAL_HANDSHAKE_ICON_SRC,
      });
    }
  }

  for (const day of dailyActivity) {
    const dateYmd = day.date.trim();
    if (!dateYmd || dateYmd < range.from || dateYmd > range.to) {
      continue;
    }
    for (const [eventIndex, event] of day.events.entries()) {
      if (event.kind !== 'income' || event.amount <= 0) {
        continue;
      }
      const label = event.label.trim() || 'Cobro';
      rows.push({
        id: `in:${dateYmd}:${eventIndex}:${label}`,
        kind: 'collected',
        clientName: label,
        maneuverCode: null,
        amount: event.amount,
        dateYmd,
        dateLabel: compactDateLabel(dateYmd),
        statusLabel: 'Confirmado',
        overdueDays: 0,
        icon: 'checkCircle',
      });
    }
  }

  return sortRows(rows).slice(0, DASHBOARD_CLIENT_TRANSACTIONS_MAX_ROWS);
}