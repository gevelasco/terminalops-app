import { tripDepartureIso } from '@features/trips/utils/trip-schedule-accessors';
import type { Operator, Trip } from '@shared/models/logistics.models';
import type { ReportsManiobraByOperatorRow } from '../models/reports-view.models';

const MS_PER_HOUR = 60 * 60 * 1000;
const MS_PER_DAY = 24 * MS_PER_HOUR;

function tripDurationMs(t: Trip): number | null {
  if (t.status === 'cancelled') {
    return null;
  }
  const startRaw = tripDepartureIso(t);
  const endRaw = t.returnAt ?? t.arrivedAt;
  if (!startRaw?.trim() || !endRaw?.trim()) {
    return null;
  }
  const start = Date.parse(startRaw);
  const end = Date.parse(endRaw);
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) {
    return null;
  }
  return end - start;
}

function formatManeuverDurationAvg(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) {
    return '—';
  }
  if (ms < MS_PER_DAY) {
    const hours = ms / MS_PER_HOUR;
    const value = hours >= 10 ? Math.round(hours) : Math.round(hours * 10) / 10;
    return `${value} h`;
  }
  const days = ms / MS_PER_DAY;
  const value = days >= 10 ? Math.round(days) : Math.round(days * 10) / 10;
  return `${value} día${value === 1 ? '' : 's'}`;
}

export function buildManiobrasByOperator(
  trips: readonly Trip[],
  operators: readonly Operator[],
): ReportsManiobraByOperatorRow[] {
  const nameById = new Map<string, string>();
  for (const op of operators) {
    const id = op.id.trim();
    if (id) {
      nameById.set(id, op.name.trim() || id);
    }
  }

  const byOperator = new Map<string, { count: number; durationTotalMs: number; durationSamples: number }>();

  for (const t of trips) {
    const id = (t.operatorId ?? '').trim();
    if (!id) {
      continue;
    }
    const row = byOperator.get(id) ?? { count: 0, durationTotalMs: 0, durationSamples: 0 };
    row.count += 1;
    const duration = tripDurationMs(t);
    if (duration !== null) {
      row.durationTotalMs += duration;
      row.durationSamples += 1;
    }
    byOperator.set(id, row);
  }

  return [...byOperator.entries()]
    .map(([key, v]) => {
      const avgMs =
        v.durationSamples > 0 ? v.durationTotalMs / v.durationSamples : null;
      return {
        key,
        label: nameById.get(key) ?? key,
        maneuverCount: v.count,
        avgDurationLabel: avgMs === null ? '—' : formatManeuverDurationAvg(avgMs),
      };
    })
    .sort((a, b) => b.maneuverCount - a.maneuverCount || a.label.localeCompare(b.label, 'es'))
    .slice(0, 8);
}
