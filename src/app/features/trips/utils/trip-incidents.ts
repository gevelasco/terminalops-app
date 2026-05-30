import type { Operator, Trip, TripIncident } from '@shared/models/logistics.models';
import { tripIncidentAuthorLabel } from '@shared/utils/trip-incident-feed';

/** `true` si hay incidentes en lista o marcador histórico (`hasIncident`). */
export function tripHasIncidents(trip: Pick<Trip, 'hasIncident' | 'incidents'>): boolean {
  return (trip.incidents?.length ?? 0) > 0 || trip.hasIncident === true;
}

export function tripIncidentsSorted(trip: Pick<Trip, 'incidents'>): TripIncident[] {
  const list = trip.incidents ?? [];
  return [...list].sort(
    (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
  );
}

export function tripIncidentPostedBy(
  inc: TripIncident,
  operators: readonly Operator[] = [],
): string {
  return tripIncidentAuthorLabel(inc, operators);
}
