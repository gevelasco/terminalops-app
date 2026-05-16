import type { Trip } from '@shared/models/logistics.models';
import { formatRouteKmEsMx } from '@features/maniobra/utils/maniobra-route-display';
import { estimateReturnIsoFromSymmetricalOutbound } from '@features/maniobra/utils/maniobra-trip-schema-timeline';

function parseIsoMs(iso: string | null | undefined): number | null {
  if (!iso?.trim()) {
    return null;
  }
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? t : null;
}

function maneuverStartMs(trip: Trip): number | null {
  return parseIsoMs(trip.departureAt ?? trip.scheduledAt);
}

function maneuverEndMs(trip: Trip): number | null {
  const closed = parseIsoMs(trip.returnAt);
  if (closed !== null) {
    return closed;
  }
  return parseIsoMs(estimateReturnIsoFromSymmetricalOutbound(trip));
}

/** Duración aproximada de la maniobra (ida + regreso estimado o real). */
export function approximateManeuverDaysLabel(trip: Trip): string {
  const start = maneuverStartMs(trip);
  const end = maneuverEndMs(trip);
  if (start === null || end === null || end <= start) {
    return '—';
  }
  const ms = end - start;
  const days = ms / (1000 * 60 * 60 * 24);
  if (days < 1) {
    const hours = Math.max(1, Math.round(ms / (1000 * 60 * 60)));
    return `~${hours} h`;
  }
  const rounded =
    days >= 10 ? Math.round(days) : Math.round(days * 10) / 10;
  const unit = rounded === 1 ? 'día' : 'días';
  return `~${rounded.toLocaleString('es-MX')} ${unit}`;
}

/** Km aproximados (ida + regreso) a partir de `routeDistanceKm` OSRM. */
export function approximateManeuverKmLabel(trip: Trip): string {
  const oneWay = trip.routeDistanceKm;
  if (oneWay === undefined || oneWay === null || !Number.isFinite(oneWay)) {
    return '—';
  }
  const total = oneWay * 2;
  return `~${formatRouteKmEsMx(total)} km`;
}
