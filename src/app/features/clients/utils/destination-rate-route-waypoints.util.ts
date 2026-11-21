import type { RouteWaypointQuery } from '@core/services/api/routing';
import { destinationRateSakbeClampSearch } from '@features/clients/utils/destination-rate-sakbe-search.util';
import type { DestinationRateRouteWaypoint } from '@shared/models/destination-rate.models';
import type { PlaceSuggestion } from '@shared/services/photon-place-search.service';

export type DestinationRateRouteWaypointDraft = DestinationRateRouteWaypoint & {
  rowKey: string;
};

export function createRouteWaypointDraft(
  place: PlaceSuggestion,
  rowKey?: string,
): DestinationRateRouteWaypointDraft {
  const label = place.label.trim();
  return {
    rowKey: rowKey ?? `wp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    label,
    lat: place.lat,
    lon: place.lon,
    searchLabel: label,
  };
}

export function routeWaypointsToTollQuery(
  waypoints: readonly DestinationRateRouteWaypoint[],
): RouteWaypointQuery[] {
  return waypoints.map((wp) => ({
    lat: wp.lat,
    lon: wp.lon,
    label: wp.label.trim(),
    searchLabel: destinationRateSakbeClampSearch((wp.searchLabel ?? wp.label).trim()),
  }));
}

export function parseRouteWaypointsFromApi(raw: unknown): DestinationRateRouteWaypoint[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const out: DestinationRateRouteWaypoint[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') {
      continue;
    }
    const row = item as Record<string, unknown>;
    const lat = Number(row['lat']);
    const lon = Number(row['lon']);
    const label = String(row['label'] ?? '').trim();
    if (!label || !Number.isFinite(lat) || !Number.isFinite(lon)) {
      continue;
    }
    const searchLabel = String(row['searchLabel'] ?? '').trim();
    out.push({
      label,
      lat,
      lon,
      ...(searchLabel ? { searchLabel } : {}),
    });
    if (out.length >= 8) {
      break;
    }
  }
  return out;
}

export function routeWaypointsPersistPayload(
  waypoints: readonly DestinationRateRouteWaypoint[],
): DestinationRateRouteWaypoint[] {
  return waypoints.map((wp) => ({
    label: wp.label.trim(),
    lat: wp.lat,
    lon: wp.lon,
    searchLabel: (wp.searchLabel ?? wp.label).trim() || undefined,
  }));
}

export function routeWaypointDraftsFromStored(
  waypoints: readonly DestinationRateRouteWaypoint[],
): DestinationRateRouteWaypointDraft[] {
  return waypoints.map((wp, index) => ({
    rowKey: `wp-${index}-${wp.lat.toFixed(4)}-${wp.lon.toFixed(4)}`,
    label: wp.label,
    lat: wp.lat,
    lon: wp.lon,
    searchLabel: wp.searchLabel,
  }));
}

export function destinationRateRouteTollContextKey(parts: {
  originLat: number;
  originLon: number;
  destinationLat: number;
  destinationLon: number;
  originSearch?: string;
  destinationSearch?: string;
  waypoints?: readonly DestinationRateRouteWaypoint[];
}): string {
  const wpKey = (parts.waypoints ?? [])
    .map((w) => `${w.lat.toFixed(4)},${w.lon.toFixed(4)},${(w.searchLabel ?? w.label).trim().toLowerCase()}`)
    .join(';');
  return [
    parts.originLat,
    parts.originLon,
    parts.destinationLat,
    parts.destinationLon,
    (parts.originSearch ?? '').trim().toLowerCase(),
    (parts.destinationSearch ?? '').trim().toLowerCase(),
    wpKey,
  ].join('|');
}