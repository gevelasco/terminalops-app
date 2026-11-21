import type { RouteTollPlazaRow } from '@core/services/api/routing';
import type { DestinationRateRouteTollContext } from '@features/clients/components/destination-rate-prices-editor/destination-rate-prices-editor.component';
import { buildDestinationRateRouteMapDrivingPoints } from '@features/clients/utils/destination-rate-route-map-driving-points.util';
import { destinationRateRouteTollContextKey } from '@features/clients/utils/destination-rate-route-waypoints.util';
import type { LatLon } from '@shared/services/osrm-driving-route.service';

export function definedRouteDrivingPoints(params: {
  ctx: DestinationRateRouteTollContext;
  plazas: readonly RouteTollPlazaRow[];
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

/** Firma estable para re-calcular km OSRM cuando cambia la ruta definida. */
export function definedRouteMetricsKey(
  ctx: DestinationRateRouteTollContext | null,
  plazas: readonly RouteTollPlazaRow[],
  excludedPlazaKeys: readonly string[],
): string {
  if (!ctx) {
    return '';
  }
  const plazaSig = plazas
    .map((p) => `${p.order}:${p.plazaKey}`)
    .join(',');
  const excl = [...excludedPlazaKeys].sort().join(',');
  return `${destinationRateRouteTollContextKey(ctx)}|${plazaSig}|${excl}`;
}