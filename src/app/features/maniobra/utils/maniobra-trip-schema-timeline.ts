import type { Trip } from '@shared/models/logistics.models';
import { formatStackedMx } from '@shared/utils/format-datetime-mx';

const DEFAULT_ONE_WAY_MS = 24 * 60 * 60 * 1000;
const ROUTE_AVG_SPEED_KMH = 55;

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

function estimateOneWayMs(trip: Trip): number {
  const km = trip.routeDistanceKm;
  if (km !== undefined && km !== null && Number.isFinite(km) && km > 0) {
    return (km / ROUTE_AVG_SPEED_KMH) * 60 * 60 * 1000;
  }
  return DEFAULT_ONE_WAY_MS;
}

/**
 * Fin de maniobra para ETA / avance: regreso real, simétrico con entrega,
 * o ida+regreso estimados desde salida (en tránsito sin `arrivedAt`).
 */
export function estimateManeuverEndIso(trip: Trip): string | null {
  if (trip.returnAt) {
    return trip.returnAt;
  }
  const symmetrical = estimateReturnIsoFromSymmetricalOutbound(trip);
  if (symmetrical) {
    return symmetrical;
  }
  const startIso = trip.departureAt ?? trip.scheduledAt;
  if (!startIso) {
    return null;
  }
  const start = new Date(startIso).getTime();
  if (!Number.isFinite(start)) {
    return null;
  }
  return new Date(start + estimateOneWayMs(trip) * 2).toISOString();
}

export function formatTripIsoOneLine(iso: string | null | undefined): string {
  if (!iso) {
    return '—';
  }
  const s = formatStackedMx(iso);
  return s ? `${s.date} · ${s.time}` : '—';
}
