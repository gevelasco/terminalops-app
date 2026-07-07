import type {
  CriticalAlertKind,
  IncidentSeverity,
  Operator,
  Trip,
  TripIncident,
} from '@shared/models/logistics.models';
import { isTripBitacoraIncident } from '@features/trips/utils/trip-bitacora';

export interface TripIncidentFeedItem {
  incidentId: string;
  tripId: string;
  maneuverCode: string;
  clientName: string;
  routeLabel: string;
  description: string;
  occurredAt: string;
  postedBy: string;
  authorLabel: string;
  severity: IncidentSeverity;
  kind: CriticalAlertKind;
}

export function inferIncidentKind(description: string): CriticalAlertKind {
  const d = description.toLowerCase();
  if (/fr[ií]o|temperatura|refriger|cadena/.test(d)) {
    return 'cold_chain';
  }
  if (/gps|señal|telemetr|ubicaci/.test(d)) {
    return 'gps';
  }
  if (/operador|conducci|descanso|horas?\s+de/.test(d)) {
    return 'driver';
  }
  if (/freno|mantenim|reparaci|falla\s+mec|pinchazo|llanta|neum|gr[uú]a/.test(d)) {
    return 'maintenance';
  }
  if (/document|sct|permiso|manifiesto|carta\s+porte|sello/.test(d)) {
    return 'document';
  }
  if (/caseta|retraso|programad|entrega|congesti|desviaci[oó]n|ruta|clima|lluvia/.test(d)) {
    return 'schedule';
  }
  return 'default';
}

export function defaultIncidentSeverity(
  trip: Pick<Trip, 'status'>,
  description: string,
): IncidentSeverity {
  const d = description.toLowerCase();
  if (
    trip.status === 'in_transit' &&
    /temperatura|gps|freno|pinchazo|gr[uú]a|desviaci/.test(d)
  ) {
    return 'critical';
  }
  if (trip.status === 'in_transit') {
    return 'high';
  }
  if (trip.status === 'scheduled') {
    return 'high';
  }
  if (/caseta|retraso/.test(d)) {
    return 'medium';
  }
  return 'low';
}

export function incidentSeverity(
  trip: Pick<Trip, 'status'>,
  inc: TripIncident,
): IncidentSeverity {
  return inc.severity ?? defaultIncidentSeverity(trip, inc.description);
}

export function tripIncidentAuthorLabel(
  inc: Pick<TripIncident, 'postedBy' | 'postedByLabel'>,
  operators: readonly Operator[] = [],
): string {
  const fromApi = inc.postedByLabel?.trim();
  if (fromApi) {
    return fromApi;
  }
  const u = inc.postedBy.trim().toLowerCase();
  if (!u) {
    return '—';
  }
  const op = operators.find((o) => o.portalUsername?.trim().toLowerCase() === u);
  if (op) {
    return `${op.name} · Operador`;
  }
  return inc.postedBy.trim();
}

export function buildTripIncidentFeed(
  trips: readonly Trip[],
  operators: readonly Operator[] = [],
): TripIncidentFeedItem[] {
  const items: TripIncidentFeedItem[] = [];

  for (const trip of trips) {
    for (const inc of trip.incidents ?? []) {
      if (!inc.description?.trim() || !isTripBitacoraIncident(inc)) {
        continue;
      }
      items.push({
        incidentId: inc.id,
        tripId: trip.id,
        maneuverCode: trip.maneuverCode,
        clientName: trip.clientName,
        routeLabel: `${trip.origin} → ${trip.destination}`,
        description: inc.description.trim(),
        occurredAt: inc.occurredAt,
        postedBy: inc.postedBy,
        authorLabel: tripIncidentAuthorLabel(inc, operators),
        severity: incidentSeverity(trip, inc),
        kind: inferIncidentKind(inc.description),
      });
    }
  }

  return items.sort(
    (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
  );
}
