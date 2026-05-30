import type { Trip } from '@shared/models/logistics.models';
import type { TripEvaluator } from '@shared/models/trip-evaluation.model';
import { localYmd } from '@shared/utils/local-ymd';

function tripCompletionDayLocal(t: Trip): string | null {
  if (t.status !== 'completed') {
    return null;
  }
  const iso = (t.arrivedAt ?? t.returnAt ?? t.scheduledAt ?? '').trim();
  if (!iso) {
    return null;
  }
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return null;
  }
  return localYmd(d);
}

export function filterTripsProgrammedInCalendarMonth(
  trips: readonly Trip[],
  now = new Date(),
): Trip[] {
  const y = now.getFullYear();
  const m = now.getMonth();
  return trips.filter((t) => {
    const d = new Date(t.programmedAt);
    if (Number.isNaN(d.getTime())) {
      return false;
    }
    return d.getFullYear() === y && d.getMonth() === m;
  });
}

export interface WeeklyTripPoint {
  day: string;
  value: number;
}

export interface OperationTypeSlice {
  label: string;
  count: number;
  pct: number;
  tone: number;
  chartColor: string;
}

export function buildWeeklyCompletedTripsByDay(
  trips: readonly Trip[],
  now = new Date(),
): WeeklyTripPoint[] {
  const dayFmt = new Intl.DateTimeFormat('es-MX', { weekday: 'short' });
  const out: WeeklyTripPoint[] = [];
  const counts = new Map<string, number>();

  for (let i = 0; i < 7; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (6 - i));
    d.setHours(0, 0, 0, 0);
    const key = localYmd(d);
    counts.set(key, 0);
    out.push({ day: dayFmt.format(d), value: 0 });
  }

  for (const t of trips) {
    const key = tripCompletionDayLocal(t);
    if (!key || !counts.has(key)) {
      continue;
    }
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  for (let i = 0; i < 7; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (6 - i));
    d.setHours(0, 0, 0, 0);
    const key = localYmd(d);
    out[i] = { ...out[i], value: counts.get(key) ?? 0 };
  }

  return out;
}

/** Reparto dinámico vía TripEvaluationService (groupingKey + label consistentes). */
export function buildOperationTypeSlicesFromTrips(
  trips: readonly Trip[],
  evaluator: TripEvaluator,
): OperationTypeSlice[] {
  const total = Math.max(trips.length, 1);
  const by = new Map<
    string,
    { label: string; count: number; tone: number; chartColor: string }
  >();

  for (const t of trips) {
    const ev = evaluator.evaluateTrip(t);
    const prev = by.get(ev.groupingKey);
    by.set(ev.groupingKey, {
      label: evaluator.reportSliceLabel(ev),
      count: (prev?.count ?? 0) + 1,
      tone: ev.chartTone,
      chartColor: evaluator.chartColorForResult(ev),
    });
  }

  return [...by.entries()]
    .sort((a, b) => b[1].count - a[1].count || a[1].label.localeCompare(b[1].label, 'es'))
    .map(([, { label, count, tone, chartColor }]) => ({
      label,
      count,
      pct: Math.round((count / total) * 100),
      tone,
      chartColor,
    }));
}
