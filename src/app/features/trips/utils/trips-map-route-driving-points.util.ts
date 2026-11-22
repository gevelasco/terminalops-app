import type { RouteTollPlazaRow } from '@core/services/api/routing';
import { buildDestinationRateRouteMapDrivingPoints } from '@features/clients/utils/destination-rate-route-map-driving-points.util';
import type { TripMapItem } from '@shared/models/api/api-trips-map.model';
import type { LatLon } from '@shared/services/osrm-driving-route.service';

function plottableLatLon(
  lat: number | null,
  lng: number | null,
): LatLon | null {
  if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }
  return { lat, lon: lng };
}

function tripMapTollPlazaRows(item: TripMapItem): RouteTollPlazaRow[] {
  const raw = item.routeTollPlazas ?? [];
  return raw.map((plaza) => ({
    order: plaza.order,
    plazaKey: plaza.plazaKey,
    name: plaza.name,
    costMxn: null,
    ...(plaza.inegiPoint?.trim() ? { inegiPoint: plaza.inegiPoint.trim() } : {}),
  }));
}

/** Misma secuencia OSRM que el mapa de tarifa (waypoints/casetas), sin pintar casetas. */
export function buildTripMapRouteDrivingPoints(item: TripMapItem): LatLon[] | null {
  const origin = plottableLatLon(item.origin.lat, item.origin.lng);
  const dest = plottableLatLon(item.destination.lat, item.destination.lng);
  if (!origin || !dest) {
    return null;
  }

  const waypoints = item.routeWaypoints ?? [];
  const tollRows = tripMapTollPlazaRows(item);
  const hasRateRoute = waypoints.length > 0 || tollRows.length > 0;
  if (!hasRateRoute) {
    return [origin, dest];
  }

  return buildDestinationRateRouteMapDrivingPoints({
    ctx: {
      originLat: origin.lat,
      originLon: origin.lon,
      destinationLat: dest.lat,
      destinationLon: dest.lon,
      waypoints: waypoints.map((wp) => ({
        lat: wp.lat,
        lon: wp.lon,
        label: '',
        searchLabel: '',
      })),
    },
    plazas: tollRows,
  });
}