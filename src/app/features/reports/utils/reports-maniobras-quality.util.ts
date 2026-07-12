import type { ReportsManiobrasInsights } from '@shared/models/api/api-reports-maniobras.model';

export function countManiobrasWithIncidents(
  routes: ReportsManiobrasInsights['recurringIncidentRoutes'],
): number {
  const codes = new Set<string>();
  for (const route of routes) {
    for (const code of route.maneuverCodes) {
      const trimmed = code?.trim();
      if (trimmed) {
        codes.add(trimmed);
      }
    }
  }
  return codes.size;
}

export function maniobrasIncidentRatePercent(
  tripsWithIncidents: number,
  completedTrips: number,
): number | null {
  if (completedTrips <= 0) {
    return null;
  }
  return Math.round((tripsWithIncidents / completedTrips) * 1000) / 10;
}

export function maniobrasDelayedRatePercent(
  delayedTrips: number,
  completedTrips: number,
): number | null {
  if (completedTrips <= 0) {
    return null;
  }
  return Math.round((delayedTrips / completedTrips) * 1000) / 10;
}
