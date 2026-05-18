import type { Trip } from '@shared/models/logistics.models';
import type {
  ReportsCreditByClientRow,
  ReportsCreditDueBadgeVariant,
} from '../models/reports-view.models';
import { amountBarSlices } from './reports-chart-mappers';
import { localYmd } from './reports-filter';
import { tripCreditReceivable } from './reports-trip-helpers';

export function tripCollectionAnchor(t: Trip): Date | null {
  const iso = t.arrivedAt ?? t.returnAt ?? t.programmedAt;
  if (!iso?.trim()) {
    return null;
  }
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function tripDueDate(t: Trip): Date | null {
  const anchor = tripCollectionAnchor(t);
  if (!anchor) {
    return null;
  }
  const due = new Date(anchor);
  due.setDate(due.getDate() + Math.max(0, t.creditDays ?? 0));
  return due;
}

function dateLabel(ymd: string): string {
  const d = new Date(`${ymd}T12:00:00`);
  return new Intl.DateTimeFormat('es-MX', {
    day: 'numeric',
    month: 'short',
  }).format(d);
}

function addDaysYmd(ymd: string, days: number): string {
  const d = new Date(`${ymd}T12:00:00`);
  d.setDate(d.getDate() + days);
  return localYmd(d);
}

function creditDueBadgeVariant(
  dueYmd: string | null | undefined,
  asOfYmd: string,
): ReportsCreditDueBadgeVariant {
  if (!dueYmd) {
    return 'neutral';
  }
  if (dueYmd < asOfYmd) {
    return 'danger';
  }
  if (dueYmd <= addDaysYmd(asOfYmd, 7)) {
    return 'warning';
  }
  return 'success';
}

/** Clientes con mayor saldo por cobrar y próxima fecha de cobro (vencimiento más cercano). */
export function buildCreditByClientRows(
  trips: readonly Trip[],
): ReportsCreditByClientRow[] {
  const byClient = new Map<
    string,
    { label: string; amount: number; nextDueYmd: string | null }
  >();

  for (const t of trips) {
    const amount = tripCreditReceivable(t);
    if (amount <= 0) {
      continue;
    }
    const name = t.clientName?.trim() || 'Sin cliente';
    const due = tripDueDate(t);
    const dueYmd = due ? localYmd(due) : null;
    const row = byClient.get(name) ?? { label: name, amount: 0, nextDueYmd: null };
    row.amount += amount;
    if (dueYmd && (!row.nextDueYmd || dueYmd < row.nextDueYmd)) {
      row.nextDueYmd = dueYmd;
    }
    byClient.set(name, row);
  }

  const sorted = [...byClient.values()]
    .map((r) => ({ label: r.label, amount: Math.round(r.amount) }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 8);

  const barSlices = amountBarSlices(sorted, 'reports-chart-bar__fill--client');
  const asOfYmd = localYmd(new Date());

  return barSlices.map((slice, i) => {
    const src = sorted[i];
    const meta = byClient.get(src.label);
    const nextDueYmd = meta?.nextDueYmd ?? null;
    return {
      key: slice.key,
      label: slice.label,
      amount: slice.count,
      pct: slice.pct,
      fillClass: slice.fillClass,
      nextDueLabel: nextDueYmd ? dateLabel(nextDueYmd) : '—',
      nextDueBadgeVariant: creditDueBadgeVariant(nextDueYmd, asOfYmd),
    };
  });
}
