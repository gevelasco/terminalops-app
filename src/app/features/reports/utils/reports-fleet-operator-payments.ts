import { operatorPayDueDate } from '@features/operators/utils/operator-operation-summary';
import { localYmd } from '@features/reports/utils/reports-filter';
import { tripOperatorQuota } from '@features/reports/utils/reports-trip-helpers';
import type { Expense, Operator, Trip } from '@shared/models/logistics.models';
import type { ReportsFleetOperatorPayRow } from '../models/reports-view.models';

function isOperatorPayKind(kind: Expense['kind']): boolean {
  return kind === 'operator_payment' || kind === 'operator_commission';
}

function paidOnTrip(tripId: string, expenses: readonly Expense[]): number {
  const id = tripId.trim();
  if (!id) {
    return 0;
  }
  let sum = 0;
  for (const e of expenses) {
    if (!isOperatorPayKind(e.kind) || (e.tripId ?? '').trim() !== id) {
      continue;
    }
    sum += e.amount;
  }
  return sum;
}

function formatDueLabel(iso: string): string {
  const d = new Date(iso.includes('T') ? iso : `${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) {
    return iso;
  }
  return new Intl.DateTimeFormat('es-MX', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(d);
}

function inTransitDueLabel(t: Trip): string {
  const sched = t.scheduledAt?.trim();
  if (sched) {
    return `En curso · ${formatDueLabel(sched)}`;
  }
  const prog = t.programmedAt?.trim();
  if (prog) {
    return `En curso · ${formatDueLabel(prog)}`;
  }
  return 'En curso';
}

export function buildFleetOperatorPayments(
  trips: readonly Trip[],
  expenses: readonly Expense[],
  operators: readonly Operator[],
): ReportsFleetOperatorPayRow[] {
  const paidByOperator = new Map<string, number>();
  for (const e of expenses) {
    if (!isOperatorPayKind(e.kind) || e.currency !== 'MXN') {
      continue;
    }
    const id = e.relatedOperatorId?.trim();
    if (!id) {
      continue;
    }
    paidByOperator.set(id, (paidByOperator.get(id) ?? 0) + e.amount);
  }

  const rows: ReportsFleetOperatorPayRow[] = [];

  for (const op of operators) {
    const id = op.id.trim();
    if (!id) {
      continue;
    }
    const opTrips = trips.filter((t) => (t.operatorId ?? '').trim() === id);
    let pendingCompleted = 0;
    let pendingInTransit = 0;
    let nextDueYmd: string | null = null;
    let pendingDueLabel = '—';

    for (const t of opTrips) {
      const quota = tripOperatorQuota(t);
      if (quota <= 0) {
        continue;
      }
      if (t.status === 'in_transit' || t.status === 'scheduled') {
        pendingInTransit += quota;
        const label = inTransitDueLabel(t);
        if (pendingDueLabel === '—' || t.status === 'in_transit') {
          pendingDueLabel = label;
        }
        continue;
      }
      if (t.status !== 'completed') {
        continue;
      }
      const balance = Math.max(0, quota - paidOnTrip(t.id, expenses));
      if (balance <= 0) {
        continue;
      }
      pendingCompleted += balance;
      const due = operatorPayDueDate(t);
      const dueYmd = due ? localYmd(due) : null;
      if (dueYmd && (!nextDueYmd || dueYmd < nextDueYmd)) {
        nextDueYmd = dueYmd;
        pendingDueLabel = formatDueLabel(dueYmd);
      }
    }

    const paidAmount = paidByOperator.get(id) ?? 0;
    if (paidAmount <= 0 && pendingCompleted <= 0 && pendingInTransit <= 0) {
      continue;
    }

    if (pendingCompleted > 0 && nextDueYmd) {
      pendingDueLabel = formatDueLabel(nextDueYmd);
    } else if (pendingInTransit > 0 && pendingCompleted <= 0) {
      // keep inTransitDueLabel already set
    } else if (pendingCompleted > 0 && !nextDueYmd) {
      pendingDueLabel = 'Por liquidar';
    }

    rows.push({
      key: id,
      label: op.name?.trim() || id,
      paidAmount: Math.round(paidAmount),
      pendingCompletedAmount: Math.round(pendingCompleted),
      pendingInTransitAmount: Math.round(pendingInTransit),
      pendingDueLabel,
    });
  }

  return rows.sort(
    (a, b) =>
      b.paidAmount +
      b.pendingCompletedAmount +
      b.pendingInTransitAmount -
      (a.paidAmount + a.pendingCompletedAmount + a.pendingInTransitAmount),
  );
}
