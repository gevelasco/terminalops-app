import type { RouteTollContext, RouteTollPlazaRow } from '@core/services/api/routing';

type RouteMapContext = Pick<
  RouteTollContext,
  'originLat' | 'originLon' | 'destinationLat' | 'destinationLon' | 'waypoints'
>;
import { latLonFromTollPlazaRow } from '@features/clients/utils/destination-rate-inegi-point.util';
import { formatTollPlazaListLabel } from '@features/clients/utils/destination-rate-toll-plaza-display.util';
import type { DestinationRateMapMarker } from '@features/clients/utils/destination-rate-route-map-echarts.util';

export function buildDestinationRateRouteMapMarkers(params: {
  ctx: RouteMapContext;
  plazas: readonly RouteTollPlazaRow[];
  originLabel?: string;
  destinationLabel?: string;
}): DestinationRateMapMarker[] {
  const markers: DestinationRateMapMarker[] = [];
  markers.push({
    kind: 'origin',
    lng: params.ctx.originLon,
    lat: params.ctx.originLat,
    label: params.originLabel?.trim() || 'Origen',
  });
  for (const wp of params.ctx.waypoints ?? []) {
    markers.push({
      kind: 'waypoint',
      lng: wp.lon,
      lat: wp.lat,
      label: wp.label.trim() || 'Punto intermedio',
    });
  }
  markers.push({
    kind: 'destination',
    lng: params.ctx.destinationLon,
    lat: params.ctx.destinationLat,
    label: params.destinationLabel?.trim() || 'Destino',
  });
  for (const plaza of params.plazas) {
    const point = latLonFromTollPlazaRow(plaza);
    if (!point) {
      continue;
    }
    markers.push({
      kind: 'toll',
      lng: point.lon,
      lat: point.lat,
      label:
        formatTollPlazaListLabel(plaza).trim() ||
        plaza.name.trim() ||
        `Caseta ${plaza.order}`,
    });
  }
  return markers;
}