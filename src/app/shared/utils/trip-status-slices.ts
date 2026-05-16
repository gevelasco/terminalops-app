import { Trip, TripStatus } from '@shared/models/logistics.models';
import { tripStatusUiLabel } from '@shared/utils/trip-status-ui';

export interface TripStatusSliceRow {
  label: string;
  count: number;
  pct: number;
  status: TripStatus;
}

const STATUS_ORDER: TripStatus[] = [
  'in_transit',
  'scheduled',
  'completed',
  'cancelled',
];

/** Conteos por estado y porcentajes sobre el total (para gráficas tipo dashboard). */
export function buildTripStatusSlices(trips: Trip[]): TripStatusSliceRow[] {
  const counts = new Map<TripStatus, number>();
  for (const s of STATUS_ORDER) {
    counts.set(s, 0);
  }
  for (const t of trips) {
    counts.set(t.status, (counts.get(t.status) ?? 0) + 1);
  }
  const total = trips.length || 1;
  return STATUS_ORDER.map((status) => ({
    status,
    label: tripStatusUiLabel(status),
    count: counts.get(status) ?? 0,
    pct: Math.round(((counts.get(status) ?? 0) / total) * 100),
  }));
}
