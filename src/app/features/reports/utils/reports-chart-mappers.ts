import type { OperationTypeSlice } from '@features/reports/utils/dashboard-charts-from-trips';
import type { TripStatus } from '@shared/models/logistics.models';
import type { TripStatusSliceRow } from '@shared/utils/trip-status-slices';
import type { ReportsBarSlice } from '../models/reports-view.models';

export function statusSliceToBar(row: TripStatusSliceRow): ReportsBarSlice {
  return {
    key: row.status,
    label: row.label,
    count: row.count,
    pct: row.pct,
    fillClass: statusFillClass(row.status),
  };
}

export function operationSliceToBar(
  row: OperationTypeSlice,
  fillClassForTone: (tone: number) => string,
): ReportsBarSlice {
  return {
    key: row.label,
    label: row.label,
    count: row.count,
    pct: row.pct,
    fillClass: fillClassForTone(row.tone),
  };
}

export function statusFillClass(status: TripStatus): string {
  switch (status) {
    case 'in_transit':
      return 'reports-chart-bar__fill--transit';
    case 'scheduled':
      return 'reports-chart-bar__fill--scheduled';
    case 'completed':
      return 'reports-chart-bar__fill--completed';
    case 'cancelled':
      return 'reports-chart-bar__fill--cancelled';
  }
}

export function operationFillClass(
  tone: OperationTypeSlice['tone'],
  fillClassForTone: (tone: number) => string,
): string {
  return fillClassForTone(tone);
}

export function amountBarSlices(
  rows: { label: string; amount: number }[],
  fillPrefix: string,
): ReportsBarSlice[] {
  const total = rows.reduce((a, r) => a + r.amount, 0) || 1;
  return rows.map((r, i) => ({
    key: r.label,
    label: r.label,
    count: Math.round(r.amount),
    pct: Math.round((r.amount / total) * 100),
    fillClass: `${fillPrefix}-${(i % 5) + 1}`,
  }));
}

const NUMBERED_BAR_FILL_PREFIXES = new Set([
  'reports-chart-bar__fill--client',
  'reports-chart-bar__fill--expense',
  'reports-chart-bar__fill--cost',
  'reports-chart-bar__fill--cancelled',
  'reports-chart-bar__fill--maint',
  'reports-chart-bar__fill--unit',
  'reports-chart-bar__fill--provision',
  'reports-chart-bar__fill--payable',
]);

export function countBarFillClass(fillPrefix: string, index: number): string {
  if (NUMBERED_BAR_FILL_PREFIXES.has(fillPrefix)) {
    return `${fillPrefix}-${(index % 5) + 1}`;
  }
  return fillPrefix;
}

/** Minimum width so small shares remain visible in the track. */
export function barFillWidthPct(count: number, pct: number): number {
  if (count <= 0) {
    return 0;
  }
  return Math.max(8, pct);
}

export function countBarSlices(
  rows: { label: string; count: number }[],
  fillPrefix: string,
  maxRows = 8,
): ReportsBarSlice[] {
  const sorted = [...rows]
    .filter((r) => r.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, maxRows);
  const total = sorted.reduce((a, r) => a + r.count, 0) || 1;
  return sorted.map((r, i) => ({
    key: r.label,
    label: r.label,
    count: r.count,
    pct: Math.round((r.count / total) * 100),
    fillClass: countBarFillClass(fillPrefix, i),
  }));
}
