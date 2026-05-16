import type {
  CriticalAlertKind,
  IncidentSeverity,
  Operator,
  Trip,
  TripIncident,
} from '@shared/models/logistics.models';

/** Personal de torre / coordinación (no operador en ruta). */
const STAFF_AUTHOR_LABELS: Readonly<Record<string, string>> = {
  gvelasco: 'Germán Velasco · Coordinador de operaciones',
  jlopez: 'Jessica López · Supervisor de monitoreo',
};

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
  postedBy: string,
  operators: readonly Operator[] = [],
): string {
  const u = postedBy.trim().toLowerCase();
  if (!u) {
    return '—';
  }
  const staff = STAFF_AUTHOR_LABELS[u];
  if (staff) {
    return staff;
  }
  const op = operators.find((o) => o.portalUsername?.trim().toLowerCase() === u);
  if (op) {
    return `${op.name} · Operador`;
  }
  return u;
}

export function buildTripIncidentFeed(
  trips: readonly Trip[],
  operators: readonly Operator[] = [],
): TripIncidentFeedItem[] {
  const items: TripIncidentFeedItem[] = [];

  for (const trip of trips) {
    for (const inc of trip.incidents ?? []) {
      if (!inc.description?.trim()) {
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
        authorLabel: tripIncidentAuthorLabel(inc.postedBy, operators),
        severity: incidentSeverity(trip, inc),
        kind: inferIncidentKind(inc.description),
      });
    }
  }

  return items.sort(
    (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
  );
}
