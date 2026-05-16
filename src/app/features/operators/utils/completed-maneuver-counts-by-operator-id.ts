import type { Trip } from '@shared/models/logistics.models';

/** Maniobras concluidas (contables) por `operatorId`. */
export function completedManeuverCountsByOperatorId(
  trips: Trip[],
): Map<string, number> {
  const m = new Map<string, number>();
  for (const t of trips) {
    if (t.status !== 'completed') {
      continue;
    }
    const id = t.operatorId?.trim();
    if (!id) {
      continue;
    }
    m.set(id, (m.get(id) ?? 0) + 1);
  }
  return m;
}
