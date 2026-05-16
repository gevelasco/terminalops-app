import type { Trip, TripOperationType } from '@shared/models/logistics.models';
import { localYmd, tripCompletionDayLocal } from './dashboard-kpis-from-tables';

/** Maniobras cuya `programmedAt` cae en el mes calendario de `now` (fecha local). */
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

/** Misma forma que `mock-dashboard-charts` para la UI existente. */
export interface WeeklyTripPoint {
  day: string;
  value: number;
}

export interface OperationTypeSlice {
  label: string;
  count: number;
  pct: number;
  tone: 'a' | 'b' | 'c';
}

/**
 * Maniobras **completadas** por día en la ventana de los últimos 7 días (fecha local).
 */
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

const OP_ORDER: { op: TripOperationType; label: string; tone: OperationTypeSlice['tone'] }[] =
  [
    { op: 'sencillo', label: 'Sencillo', tone: 'a' },
    { op: 'full', label: 'Full', tone: 'b' },
    { op: 'plana', label: 'Plana', tone: 'c' },
  ];

/** Reparto por `operationType` sobre el total de maniobras cargadas. */
export function buildOperationTypeSlicesFromTrips(
  trips: readonly Trip[],
): OperationTypeSlice[] {
  const total = Math.max(trips.length, 1);
  const by = new Map<TripOperationType, number>();
  for (const { op } of OP_ORDER) {
    by.set(op, 0);
  }
  for (const t of trips) {
    const c = by.get(t.operationType) ?? 0;
    by.set(t.operationType, c + 1);
  }
  return OP_ORDER.map(({ op, label, tone }) => {
    const count = by.get(op) ?? 0;
    return {
      label,
      count,
      pct: Math.round((count / total) * 100),
      tone,
    };
  });
}
