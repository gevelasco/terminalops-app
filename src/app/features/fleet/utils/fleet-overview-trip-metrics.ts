import { formatRouteKmEsMx } from '@features/trips/utils/maniobra-route-display';
import {
  tripCompletionIso,
  tripDepartureIso,
} from '@features/trips/utils/trip-schedule-accessors';
import type { FleetOverviewTripDto } from '@shared/models/api/fleet-overview.model';

export interface FleetOverviewTripProgress {
  percent: number;
  ariaLabel: string;
}

const MS_PER_DAY = 86_400_000;
const MS_PER_HOUR = 3_600_000;

function parseIsoMs(iso: string | null | undefined): number | null {
  if (!iso?.trim()) {
    return null;
  }
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? t : null;
}

/**
 * Salida / llegada fin: real si existe y es válida; si no, plan.
 * Si el cruce real+plan queda inválido, cae al plan puro.
 */
function resolveTripScheduleWindow(
  trip: FleetOverviewTripDto,
): { start: number; end: number } | null {
  const start = parseIsoMs(tripDepartureIso(trip));
  const end = parseIsoMs(tripCompletionIso(trip));
  if (start !== null && end !== null && end > start) {
    return { start, end };
  }

  const planStart = parseIsoMs(trip.plannedDepartureAt);
  const planEnd = parseIsoMs(trip.plannedCompletionAt);
  if (planStart !== null && planEnd !== null && planEnd > planStart) {
    return { start: planStart, end: planEnd };
  }
  return null;
}

/** Avance lineal por horas entre Salida y Llegada fin. */
function maneuverProgressRatioByHours(
  startMs: number,
  endMs: number,
  nowMs: number,
): number {
  if (nowMs <= startMs) {
    return 0;
  }
  if (nowMs >= endMs) {
    return 1;
  }
  const totalMs = endMs - startMs;
  if (totalMs <= 0) {
    return 0;
  }
  return Math.max(0, Math.min(1, (nowMs - startMs) / totalMs));
}

/** Duración aproximada salida → llegada fin (real o plan). */
export function overviewTripEtaDaysLabel(trip: FleetOverviewTripDto): string {
  const window = resolveTripScheduleWindow(trip);
  if (!window) {
    return '—';
  }
  const ms = window.end - window.start;
  const days = ms / MS_PER_DAY;
  if (days < 1) {
    const hours = Math.max(1, Math.round(ms / MS_PER_HOUR));
    return `~${hours} h`;
  }
  const rounded =
    days >= 10 ? Math.round(days) : Math.round(days * 10) / 10;
  const unit = rounded === 1 ? 'día' : 'días';
  return `~${rounded.toLocaleString('es-MX')} ${unit}`;
}

/** Km operativos ida + vuelta (campo ya resuelto por el API). */
export function overviewTripEtaKmLabel(trip: FleetOverviewTripDto): string {
  const total = trip.operationalDistanceKm;
  if (typeof total !== 'number' || !Number.isFinite(total) || total <= 0) {
    return '—';
  }
  return `~${formatRouteKmEsMx(total)} km`;
}

/** Campo «Llegada fin»: real si existe; si no, plan operativo. */
export function overviewTripCompletionLine(trip: FleetOverviewTripDto): string {
  const iso = tripCompletionIso(trip);
  if (!iso?.trim()) {
    return '—';
  }
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return '—';
  }
  const date = new Intl.DateTimeFormat('es-MX', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(d);
  const time = new Intl.DateTimeFormat('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
  return `${date} · ${time}`;
}

/** Avance temporal: salida real→plan, fin real→plan. */
export function overviewTripProgress(
  trip: FleetOverviewTripDto,
): FleetOverviewTripProgress {
  if (trip.status === 'scheduled') {
    return {
      percent: 0,
      ariaLabel: 'Maniobra programada; avance 0%',
    };
  }

  const window = resolveTripScheduleWindow(trip);
  if (!window) {
    return {
      percent: 0,
      ariaLabel: 'Sin fechas suficientes para calcular el avance',
    };
  }

  const now = Date.now();
  const ratio = maneuverProgressRatioByHours(window.start, window.end, now);
  const percent = Math.round(ratio * 100);
  return {
    percent,
    ariaLabel: `Avance del plazo: ${percent}% del tiempo entre salida y llegada fin`,
  };
}
