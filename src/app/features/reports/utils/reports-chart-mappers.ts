import type { ReportsBarSlice } from '../models/reports-view.models';

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
