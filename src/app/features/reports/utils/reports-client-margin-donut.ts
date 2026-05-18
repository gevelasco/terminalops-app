import type { Trip } from '@shared/models/logistics.models';
import type { ReportsDonutSlice } from '../models/reports-view.models';
import {
  isTripBillableForReporting,
  tripCollectedRevenue,
  tripCreditReceivable,
  tripDirectCost,
} from './reports-trip-helpers';

const DONUT_COLORS = [
  '#059669',
  '#0d9488',
  '#0891b2',
  '#0284c7',
  '#6366f1',
  '#8b5cf6',
  '#94a3b8',
] as const;

const TOP_N = 6;

export function buildTopClientsMarginDonut(trips: readonly Trip[]): ReportsDonutSlice[] {
  const byClient = new Map<string, number>();
  for (const t of trips) {
    if (!isTripBillableForReporting(t)) {
      continue;
    }
    const name = t.clientName?.trim() || 'Sin cliente';
    const revenue = tripCollectedRevenue(t) + tripCreditReceivable(t);
    const margin = revenue - tripDirectCost(t);
    byClient.set(name, (byClient.get(name) ?? 0) + margin);
  }

  const sorted = [...byClient.entries()]
    .map(([label, value]) => ({ label, value }))
    .filter((r) => r.value > 0)
    .sort((a, b) => b.value - a.value);

  if (sorted.length === 0) {
    return [];
  }

  const top = sorted.slice(0, TOP_N);
  const rest = sorted.slice(TOP_N);
  const otros = rest.reduce((a, r) => a + r.value, 0);
  const rows = [...top];
  if (otros > 0) {
    rows.push({ label: 'Otros', value: otros });
  }

  const total = rows.reduce((a, r) => a + r.value, 0) || 1;
  const slices: ReportsDonutSlice[] = rows.map((r, i) => ({
    key: r.label,
    label: r.label,
    value: Math.round(r.value),
    pct: 0,
    color: DONUT_COLORS[i % DONUT_COLORS.length],
  }));

  let assigned = 0;
  for (let i = 0; i < slices.length; i++) {
    if (i === slices.length - 1) {
      slices[i].pct = Math.max(0, 100 - assigned);
    } else {
      slices[i].pct = Math.round((slices[i].value / total) * 100);
      assigned += slices[i].pct;
    }
  }

  return slices;
}

export function donutConicGradient(slices: readonly ReportsDonutSlice[]): string {
  if (slices.length === 0) {
    return 'transparent';
  }
  let acc = 0;
  const stops: string[] = [];
  for (const s of slices) {
    const end = acc + s.pct;
    stops.push(`${s.color} ${acc}% ${end}%`);
    acc = end;
  }
  return `conic-gradient(from -90deg, ${stops.join(', ')})`;
}

export function donutMarginTotal(slices: readonly ReportsDonutSlice[]): number {
  return slices.reduce((a, s) => a + s.value, 0);
}
