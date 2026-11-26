import type { RouteTollPlazaRow } from '@core/services/api/routing';
import type { DestinationRateRouteTollContext } from '@features/clients/components/destination-rate-prices-editor/destination-rate-prices-editor.component';
import { buildDestinationRateRouteMapDrivingPoints } from '@features/clients/utils/destination-rate-route-map-driving-points.util';
import { destinationRateRouteTollContextKey } from '@features/clients/utils/destination-rate-route-waypoints.util';
import type { LatLon } from '@shared/services/osrm-driving-route.service';

/** Puntos OSRM para km: origen → casetas (o waypoints) → destino. */
export function definedRouteDrivingPoints(params: {
  ctx: DestinationRateRouteTollContext;
  plazas?: readonly RouteTollPlazaRow[];
}): LatLon[] {
  return buildDestinationRateRouteMapDrivingPoints({
    ctx: {
      originLat: params.ctx.originLat,
      originLon: params.ctx.originLon,
      destinationLat: params.ctx.destinationLat,
      destinationLon: params.ctx.destinationLon,
      waypoints: params.ctx.waypoints,
    },
    plazas: params.plazas,
  });
}

/** Firma estable de la geometría usada para km (incluye casetas manuales). */
export function definedRouteMetricsKey(
  ctx: DestinationRateRouteTollContext | null,
  plazas: readonly RouteTollPlazaRow[] = [],
): string {
  if (!ctx) {
    return '';
  }
  const plazaSig = plazas
    .map((p) => p.plazaKey.trim())
    .filter(Boolean)
    .join('|');
  return `${destinationRateRouteTollContextKey(ctx)}::plazas:${plazaSig}`;
}
