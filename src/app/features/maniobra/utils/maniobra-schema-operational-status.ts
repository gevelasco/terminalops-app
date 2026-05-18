import type { Trip, TripIncident } from '@shared/models/logistics.models';
import { estimateManeuverEndIso } from '@features/maniobra/utils/maniobra-trip-schema-timeline';
import {
  tripHasIncidents,
  tripIncidentsSorted,
} from '@features/maniobra/utils/trip-incidents';

export type SchemaOperationalStatus = 'en_curso' | 'retrasado' | 'accidente' | 'detenido';

const DELAY_GRACE_MS = 2 * 60 * 60 * 1000;
const DEFAULT_ONE_WAY_MS = 24 * 60 * 60 * 1000;
const ROUTE_AVG_SPEED_KMH = 55;

const DETENIDO_RE =
  /detenid|parada de seguridad|frenos|falla en sistema|revisión sct|punto de control|guardia nacional|incompletos en punto|límite de tiempo de conducción/i;
const ACCIDENTE_RE = /accident|colisión|choque|volcad|impacto/i;
const RETRASO_RE =
  /retraso|caseta|congestión|desviación|fuera de rango|pérdida de señal|temperatura/i;

function parseIsoMs(iso: string | null | undefined): number | null {
  if (!iso?.trim()) {
    return null;
  }
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? t : null;
}

function estimateOneWayMs(trip: Trip): number {
  const km = trip.routeDistanceKm;
  if (km !== undefined && km !== null && Number.isFinite(km) && km > 0) {
    return (km / ROUTE_AVG_SPEED_KMH) * 60 * 60 * 1000;
  }
  return DEFAULT_ONE_WAY_MS;
}

function incidentImpliesDetenido(inc: TripIncident): boolean {
  return DETENIDO_RE.test(inc.description);
}

function incidentImpliesAccidente(inc: TripIncident): boolean {
  return ACCIDENTE_RE.test(inc.description);
}

function incidentImpliesRetraso(inc: TripIncident): boolean {
  if (RETRASO_RE.test(inc.description)) {
    return true;
  }
  return inc.severity === 'high' || inc.severity === 'medium';
}

function isManeuverDelayed(trip: Trip): boolean {
  const now = Date.now();
  const dep = parseIsoMs(trip.departureAt ?? trip.scheduledAt);
  if (dep === null) {
    return false;
  }

  if (!trip.arrivedAt) {
    if (now > dep + estimateOneWayMs(trip) + DELAY_GRACE_MS) {
      return true;
    }
  }

  const end = parseIsoMs(estimateManeuverEndIso(trip));
  if (end !== null && trip.status === 'in_transit' && now > end + DELAY_GRACE_MS) {
    return true;
  }

  return false;
}

/**
 * Si la maniobra está detenida o retrasada, instante en que deja de avanzar la barra de progreso.
 * `null` = el avance sigue con el reloj actual.
 */
export function schemaProgressFreezeMs(trip: Trip): number | null {
  const status = schemaOperationalStatus(trip);
  if (status !== 'detenido' && status !== 'retrasado') {
    return null;
  }

  const incidents = tripIncidentsSorted(trip);

  if (status === 'detenido') {
    const stopIncident =
      incidents.find(incidentImpliesDetenido) ?? incidents[0] ?? null;
    const at = parseIsoMs(stopIncident?.occurredAt);
    if (at !== null) {
      return at;
    }
  }

  if (status === 'retrasado') {
    const delayIncident = incidents.find(incidentImpliesRetraso) ?? null;
    const at = parseIsoMs(delayIncident?.occurredAt);
    if (at !== null) {
      return at;
    }
    const dep = parseIsoMs(trip.departureAt ?? trip.scheduledAt);
    if (dep !== null && !trip.arrivedAt) {
      return dep + estimateOneWayMs(trip) + DELAY_GRACE_MS;
    }
    const end = parseIsoMs(estimateManeuverEndIso(trip));
    if (end !== null) {
      return end + DELAY_GRACE_MS;
    }
  }

  return null;
}

export function schemaOperationalStatus(trip: Trip): SchemaOperationalStatus {
  if (tripHasIncidents(trip)) {
    const incidents = tripIncidentsSorted(trip);
    if (incidents.some(incidentImpliesDetenido)) {
      return 'detenido';
    }
    if (incidents.some(incidentImpliesAccidente)) {
      return 'accidente';
    }
    if (incidents.some(incidentImpliesRetraso)) {
      return 'retrasado';
    }
    return 'en_curso';
  }
  if (isManeuverDelayed(trip)) {
    return 'retrasado';
  }
  return 'en_curso';
}

export function schemaOperationalStatusLabel(trip: Trip): string {
  switch (schemaOperationalStatus(trip)) {
    case 'en_curso':
      return 'En curso';
    case 'retrasado':
      return 'Retrasado';
    case 'accidente':
      return 'Accidente';
    case 'detenido':
      return 'Detenido';
  }
}

export function schemaOperationalStatusClass(trip: Trip): string {
  const base = 'to-table-pill maniobra-schema__status-pill';
  switch (schemaOperationalStatus(trip)) {
    case 'en_curso':
      return `${base} to-table-pill--done`;
    case 'retrasado':
      return `${base} to-table-pill--delayed`;
    case 'accidente':
      return `${base} maniobra-schema__status-pill--accidente`;
    case 'detenido':
      return `${base} to-table-pill--cancelled`;
  }
}
