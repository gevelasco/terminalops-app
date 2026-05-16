import type { Trip } from '@shared/models/logistics.models';
import { formatStackedMx } from '@shared/utils/format-datetime-mx';

/** Heurística: si ya hubo ida, estimar regreso sumando la misma duración ida→entrega tras la entrega. */
export function estimateReturnIsoFromSymmetricalOutbound(trip: Trip): string | null {
  const dep = trip.departureAt;
  const arr = trip.arrivedAt;
  if (!dep || !arr) {
    return null;
  }
  const t0 = new Date(dep).getTime();
  const t1 = new Date(arr).getTime();
  const dur = t1 - t0;
  if (!Number.isFinite(dur) || dur <= 0) {
    return null;
  }
  return new Date(t1 + dur).toISOString();
}

export function formatTripIsoOneLine(iso: string | null | undefined): string {
  if (!iso) {
    return '—';
  }
  const s = formatStackedMx(iso);
  return s ? `${s.date} · ${s.time}` : '—';
}
