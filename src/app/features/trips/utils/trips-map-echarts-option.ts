import type { CallbackDataParams } from 'echarts/types/dist/shared';
import type { EChartsOption } from 'echarts';
import type { TripMapItem } from '@shared/models/api/api-trips-map.model';
import { computeTripsMapViewport } from '@features/trips/utils/trips-map-viewport.util';
import { tripsMapRouteColor } from '@features/trips/utils/trips-map-route-colors';
import {
  buildGeoRegionsForStateActivity,
  countManeuversByOriginState,
  type MexicoStatesGeoJson,
} from '@features/trips/utils/trips-map-state-activity';
import {
  formatTripsMapAddressTooltipHtml,
  isTripsMapGeoRegionTooltip,
  resolveTripsMapGeoTooltipName,
  resolveTripsMapPointDatum,
  resolveTripsMapTooltipItem,
  shortenTripsMapPointLabel,
  TRIPS_MAP_TOOLTIP_BASE,
} from '@features/trips/utils/trips-map-tooltip.util';
import {
  countManeuversByDestinationStateBreakdown,
  formatStateDestinationTooltipHtml,
} from '@features/trips/utils/trips-map-state-tooltip';

export const TRIPS_MAP_GEO_NAME = 'mexico';

export type TripsMapRouteDatum = {
  tripId: string;
  maneuverCode: string;
  status: string;
  coords: [[number, number], [number, number]];
  lineStyle: {
    color: string;
    width: number;
    opacity: number;
    curveness: number;
  };
  effect: {
    show: true;
    period: number;
    trailLength: number;
    symbol: string;
    symbolSize: number;
    color: string;
  };
};

export type TripsMapPointDatum = {
  name?: string;
  tripId: string;
  maneuverCode: string;
  kind: 'origin' | 'destination';
  value: [number, number];
  pointLabel: string;
};

function resolvePlottableCoords(
  lat: number | null,
  lng: number | null,
): { lat: number; lng: number } | null {
  if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }
  return { lat, lng };
}

export function buildTripsMapChartData(items: readonly TripMapItem[]) {
  const routes: TripsMapRouteDatum[] = [];
  const origins: TripsMapPointDatum[] = [];
  const destinations: TripsMapPointDatum[] = [];

  for (const item of items) {
    const { origin, destination } = item;
    const originCoords = resolvePlottableCoords(origin.lat, origin.lng);
    const destinationCoords = resolvePlottableCoords(destination.lat, destination.lng);

    if (originCoords) {
      origins.push({
        tripId: item.id,
        maneuverCode: item.maneuverCode,
        kind: 'origin',
        value: [originCoords.lng, originCoords.lat],
        pointLabel: origin.label,
      });
    }

    if (destinationCoords) {
      const destinationLabel = shortenTripsMapPointLabel(destination.label);
      destinations.push({
        name: destinationLabel,
        tripId: item.id,
        maneuverCode: item.maneuverCode,
        kind: 'destination',
        value: [destinationCoords.lng, destinationCoords.lat],
        pointLabel: destinationLabel,
      });
    }

    if (originCoords && destinationCoords) {
      const colors = tripsMapRouteColor(item.status);
      routes.push({
        tripId: item.id,
        maneuverCode: item.maneuverCode,
        status: item.status,
        coords: [
          [originCoords.lng, originCoords.lat],
          [destinationCoords.lng, destinationCoords.lat],
        ],
        lineStyle: {
          color: colors.line,
          width: 1.4,
          opacity: 0.65,
          curveness: 0.18,
        },
        effect: {
          show: true,
          period: 6,
          trailLength: 0.12,
          symbol: 'arrow',
          symbolSize: 5,
          color: colors.effect,
        },
      });
    }
  }

  return { routes, origins, destinations };
}

export function buildTripsMapEchartsOption(
  items: readonly TripMapItem[],
  geoJson?: MexicoStatesGeoJson | null,
): EChartsOption {
  const { routes, origins, destinations } = buildTripsMapChartData(items);
  const viewport = computeTripsMapViewport(items);
  const stateBreakdown = geoJson
    ? countManeuversByDestinationStateBreakdown(items, geoJson)
    : new Map();
  const originStateCounts = geoJson ? countManeuversByOriginState(items, geoJson) : new Map();
  const destinationStateCounts = new Map(
    [...stateBreakdown.entries()].map(([name, breakdown]) => [name, breakdown.total]),
  );
  const stateRegions = buildGeoRegionsForStateActivity(
    originStateCounts,
    destinationStateCounts,
  );

  const formatStateTooltip = (stateName: string): string | null => {
    const breakdown = stateBreakdown.get(stateName);
    if (!breakdown || breakdown.total <= 0) {
      return null;
    }
    return formatStateDestinationTooltipHtml(stateName, breakdown);
  };

  const formatDestinationTooltip = (
    params: CallbackDataParams | CallbackDataParams[],
  ): string | undefined => {
    const item = resolveTripsMapTooltipItem(params);
    if (!item) {
      return undefined;
    }
    const datum = resolveTripsMapPointDatum(item, destinations);
    const label = datum?.pointLabel?.trim() || String(item.name ?? '').trim();
    const html = label ? formatTripsMapAddressTooltipHtml(label) : '';
    return html || undefined;
  };

  const formatSeriesTooltip = (
    item: NonNullable<ReturnType<typeof resolveTripsMapTooltipItem>>,
  ): string | null => {
    if (item.seriesName === 'Destino') {
      const datum = resolveTripsMapPointDatum(item, destinations);
      const label = datum?.pointLabel?.trim() || String(item.name ?? '').trim();
      return label ? formatTripsMapAddressTooltipHtml(label) : null;
    }

    const routeDatum =
      item.seriesName === 'Rutas' && typeof item.dataIndex === 'number'
        ? (routes[item.dataIndex] ?? null)
        : null;
    const data =
      routeDatum ??
      (item.seriesName === 'Origen'
        ? resolveTripsMapPointDatum(item, origins)
        : (item.data as TripsMapRouteDatum | TripsMapPointDatum | undefined));

    if (!data || !('maneuverCode' in data)) {
      return null;
    }
    if ('coords' in data) {
      return `<strong>${data.maneuverCode}</strong><br/>Ruta operativa`;
    }
    return `<strong>${data.maneuverCode}</strong><br/>Origen: ${data.pointLabel}`;
  };

  const tooltipFormatter = (
    params: CallbackDataParams | CallbackDataParams[],
  ): string | undefined => {
    const item = resolveTripsMapTooltipItem(params);
    if (!item) {
      return undefined;
    }

    if (item.componentType === 'geo') {
      const stateName = item.name != null ? String(item.name) : '';
      return stateName ? (formatStateTooltip(stateName) ?? undefined) : undefined;
    }

    const stateName = item.name != null ? String(item.name) : '';
    if (stateName && isTripsMapGeoRegionTooltip(item)) {
      return formatStateTooltip(stateName) ?? undefined;
    }

    return formatSeriesTooltip(item) ?? undefined;
  };

  return {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      ...TRIPS_MAP_TOOLTIP_BASE,
      formatter: tooltipFormatter,
    },
    geo: {
      map: TRIPS_MAP_GEO_NAME,
      roam: true,
      ...(viewport.boundingCoords
        ? { boundingCoords: viewport.boundingCoords }
        : { center: viewport.center, zoom: viewport.zoom }),
      aspectScale: 0.75,
      layoutCenter: ['50%', '50%'],
      layoutSize: '100%',
      scaleLimit: { min: 0.8, max: 12 },
      tooltip: {
        show: true,
        ...TRIPS_MAP_TOOLTIP_BASE,
        formatter: (params) => {
          const stateName = resolveTripsMapGeoTooltipName(params);
          if (!stateName) {
            return undefined;
          }
          return formatStateTooltip(stateName) ?? undefined;
        },
      },
      label: {
        show: false,
        color: '#475569',
        fontSize: 10,
      },
      itemStyle: {
        areaColor: 'rgba(241, 245, 249, 0.95)',
        borderColor: 'rgba(71, 85, 105, 0.55)',
        borderWidth: 1,
      },
      regions: stateRegions,
      emphasis: {
        label: {
          show: false,
        },
        itemStyle: {
          areaColor: 'rgba(148, 163, 184, 0.16)',
          borderColor: 'rgba(100, 116, 139, 0.42)',
          borderWidth: 1.2,
          shadowBlur: 0,
          shadowColor: 'transparent',
        },
      },
    },
    series: [
      {
        name: 'Rutas',
        type: 'lines',
        coordinateSystem: 'geo',
        zlevel: 1,
        data: routes,
      },
      {
        name: 'Origen',
        type: 'scatter',
        coordinateSystem: 'geo',
        zlevel: 2,
        symbol: 'circle',
        symbolSize: 8,
        itemStyle: {
          color: '#16a34a',
          borderColor: '#ffffff',
          borderWidth: 1,
        },
        data: origins,
      },
      {
        name: 'Destino',
        type: 'scatter',
        coordinateSystem: 'geo',
        zlevel: 4,
        z: 4,
        symbol: 'pin',
        symbolSize: 28,
        itemStyle: {
          color: '#dc2626',
        },
        tooltip: {
          show: true,
          ...TRIPS_MAP_TOOLTIP_BASE,
          formatter: formatDestinationTooltip,
        },
        data: destinations,
      },
    ],
  } as EChartsOption;
}
