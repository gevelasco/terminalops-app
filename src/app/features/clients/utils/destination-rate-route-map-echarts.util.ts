import type { EChartsOption } from 'echarts';
import { TRIPS_MAP_GEO_NAME } from '@features/trips/utils/trips-map-echarts-option';
import type { RouteMapViewport } from '@features/clients/utils/destination-rate-route-map-viewport.util';

export type DestinationRateMapMarkerKind = 'origin' | 'destination' | 'waypoint' | 'toll';

export type DestinationRateMapMarker = {
  kind: DestinationRateMapMarkerKind;
  lng: number;
  lat: number;
  label: string;
};

const MARKER_STYLE: Record<
  DestinationRateMapMarkerKind,
  { color: string; size: number; symbol?: string }
> = {
  origin: { color: '#16a34a', size: 11 },
  destination: { color: '#dc2626', size: 11 },
  waypoint: { color: '#2563eb', size: 9 },
  toll: { color: '#d97706', size: 11, symbol: 'diamond' },
};

export function buildDestinationRateRouteMapEchartsOption(params: {
  viewport: RouteMapViewport;
  routeLine: Array<[number, number]>;
  markers: readonly DestinationRateMapMarker[];
}): EChartsOption {
  const byKind = (kind: DestinationRateMapMarkerKind) =>
    params.markers
      .filter((m) => m.kind === kind)
      .map((m) => ({
        name: m.label,
        value: [m.lng, m.lat] as [number, number],
      }));

  const routeData =
    params.routeLine.length >= 2
      ? [
          {
            coords: params.routeLine,
            lineStyle: {
              color: '#3b82f6',
              width: 3,
              opacity: 0.88,
              curveness: 0,
            },
          },
        ]
      : [];

  const scatterSeries = (
    name: string,
    kind: DestinationRateMapMarkerKind,
    z: number,
  ) => {
    const style = MARKER_STYLE[kind];
    const data = byKind(kind);
    if (data.length === 0) {
      return null;
    }
    return {
      name,
      type: 'scatter' as const,
      coordinateSystem: 'geo' as const,
      geoIndex: 0,
      zlevel: 3,
      z,
      symbol: style.symbol ?? 'circle',
      symbolSize: style.size,
      itemStyle: {
        color: style.color,
        borderColor: '#f8fafc',
        borderWidth: 1.5,
      },
      tooltip: {
        show: true,
        formatter: (p: { name?: string }) => p.name ?? name,
      },
      data,
    };
  };

  const series = [
    {
      name: 'Recorrido (aprox.)',
      type: 'lines' as const,
      coordinateSystem: 'geo' as const,
      polyline: true,
      zlevel: 1,
      data: routeData,
    },
    scatterSeries('Origen', 'origin', 4),
    scatterSeries('Destino', 'destination', 5),
    scatterSeries('Intermedios', 'waypoint', 3),
    scatterSeries('Casetas', 'toll', 6),
  ].filter((s): s is NonNullable<typeof s> => s != null);

  return {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'item' },
    geo: {
      map: TRIPS_MAP_GEO_NAME,
      roam: true,
      ...(params.viewport.boundingCoords
        ? { boundingCoords: params.viewport.boundingCoords }
        : { center: params.viewport.center, zoom: params.viewport.zoom }),
      aspectScale: 0.75,
      layoutCenter: ['50%', '50%'],
      layoutSize: '100%',
      scaleLimit: { min: 0.8, max: 14 },
      label: { show: false },
      itemStyle: {
        areaColor: 'rgba(148, 163, 184, 0.22)',
        borderColor: 'rgba(100, 116, 139, 0.45)',
        borderWidth: 1,
      },
      emphasis: {
        label: { show: false },
        itemStyle: {
          areaColor: 'rgba(148, 163, 184, 0.32)',
        },
      },
    },
    series,
  };
}