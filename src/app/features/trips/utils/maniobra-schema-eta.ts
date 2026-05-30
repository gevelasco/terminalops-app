import type { Trip } from '@shared/models/logistics.models';
import { formatRouteKmEsMx } from '@features/trips/utils/maniobra-route-display';
import { tripOperationalKm } from '@features/trips/utils/trip-operational-km';
import {
  schemaOperationalStatus,
  schemaProgressFreezeMs,
} from '@features/trips/utils/maniobra-schema-operational-status';
import { estimateManeuverEndIso } from '@features/trips/utils/maniobra-trip-schema-timeline';

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
  return parseIsoMs(estimateManeuverEndIso(trip));
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

/** Km operativos de la maniobra (backend: ida + vuelta). */
export function approximateManeuverKmLabel(trip: Trip): string {
  const total = tripOperationalKm(trip);
  if (total <= 0) {
    return '—';
  }
  return `~${formatRouteKmEsMx(total)} km`;
}

/** Avance temporal: salida → hoy → regreso (real o estimado). */
export interface ManeuverTimeProgress {
  percent: number;
  ariaLabel: string;
}

export function maneuverTimeProgress(trip: Trip): ManeuverTimeProgress | null {
  const start = maneuverStartMs(trip);
  const end = maneuverEndMs(trip);
  if (start === null || end === null || end <= start) {
    return null;
  }
  const freezeMs = schemaProgressFreezeMs(trip);
  const now = freezeMs ?? Date.now();
  const ratio = Math.max(0, Math.min(1, (now - start) / (end - start)));
  const percent = Math.round(ratio * 100);
  if (freezeMs !== null) {
    const status = schemaOperationalStatus(trip);
    const statusLabel =
      status === 'detenido' ? 'detenida' : status === 'retrasado' ? 'retrasada' : status;
    return {
      percent,
      ariaLabel: `Avance detenido al ${percent}% (maniobra ${statusLabel})`,
    };
  }
  return {
    percent,
    ariaLabel: `Avance del plazo: ${percent}% entre salida y regreso estimado`,
  };
}
