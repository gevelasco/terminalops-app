import type { TripIncident } from '@shared/models/logistics.models';

export function isTripBitacoraIncident(entry: Pick<TripIncident, 'isIncident'>): boolean {
  return entry.isIncident === true;
}

export function tripBitacoraSorted(
  incidents: readonly TripIncident[] | undefined,
): TripIncident[] {
  const list = incidents ?? [];
  return [...list].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export function tripMarkedIncidentsSorted(
  incidents: readonly TripIncident[] | undefined,
): TripIncident[] {
  return tripBitacoraSorted(incidents).filter(isTripBitacoraIncident);
}
