import { buildTripMapRouteDrivingPoints } from '@features/trips/utils/trips-map-route-driving-points.util';
import type { TripMapItem } from '@shared/models/api/api-trips-map.model';
import type { LatLon } from '@shared/services/osrm-driving-route.service';
import {
  osrmRouteCacheKey,
  osrmRouteThroughCacheKey,
} from '@shared/services/osrm-driving-route.util';

export type TripMapRoutePair = {
  key: string;
  points: LatLon[];
  tripIds: string[];
};

function tripMapRouteCacheKey(points: readonly LatLon[]): string {
  if (points.length < 2) {
    return '';
  }
  if (points.length === 2) {
    return osrmRouteCacheKey(points[0], points[points.length - 1]);
  }
  return `through:${osrmRouteThroughCacheKey(points)}`;
}

/** Rutas únicas (incl. tarifa con waypoints) para no repetir OSRM en el mapa. */
export function uniqueTripMapRoutePairs(
  items: readonly TripMapItem[],
): TripMapRoutePair[] {
  const byKey = new Map<string, TripMapRoutePair>();

  for (const item of items) {
    const points = buildTripMapRouteDrivingPoints(item);
    if (!points || points.length < 2) {
      continue;
    }
    const key = tripMapRouteCacheKey(points);
    if (!key) {
      continue;
    }
    const existing = byKey.get(key);
    if (existing) {
      existing.tripIds.push(item.id);
      continue;
    }
    byKey.set(key, { key, points, tripIds: [item.id] });
  }

  return [...byKey.values()];
}
