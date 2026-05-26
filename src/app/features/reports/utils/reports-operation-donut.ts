import { buildOperationTypeSlicesFromTrips } from '@features/reports/utils/dashboard-charts-from-trips';
import type { Trip } from '@shared/models/logistics.models';
import type { ReportsDonutSlice } from '../models/reports-view.models';

const OP_COLORS: Record<string, string> = {
  Sencillo: '#6366f1',
  Full: '#0ea5e9',
  Plana: '#a855f7',
};

export function buildOperationDonut(trips: readonly Trip[]): ReportsDonutSlice[] {
  const slices = buildOperationTypeSlicesFromTrips(trips).filter((s) => s.count > 0);
  const total = slices.reduce((a, s) => a + s.count, 0) || 1;

  let assigned = 0;
  return slices.map((s, i) => {
    const pct =
      i === slices.length - 1 ? Math.max(0, 100 - assigned) : Math.round((s.count / total) * 100);
    assigned += pct;
    return {
      key: s.label,
      label: s.label,
      value: s.count,
      pct,
      color: OP_COLORS[s.label] ?? '#94a3b8',
    };
  });
}

export function donutSliceTotal(slices: readonly ReportsDonutSlice[]): number {
  return slices.reduce((a, s) => a + s.value, 0);
}
