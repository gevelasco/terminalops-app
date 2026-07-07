import type { EChartsOption } from 'echarts';
import { TRIPS_MAP_GEO_NAME } from '@features/trips/utils/trips-map-echarts-option';
import {
  findMexicoStateForPoint,
  type MexicoStatesGeoJson,
} from '@features/trips/utils/trips-map-state-activity';
import { TRIPS_MAP_TOOLTIP_BASE } from '@features/trips/utils/trips-map-tooltip.util';
import type { ReportsManiobrasGeoMapTrip } from '@shared/models/api/api-reports-maniobras.model';
import {
  REPORTS_BRAND,
  REPORTS_CHART_PALETTE,
  reportsChartTooltip,
  rgbaFromHex,
} from '../reports-chart-palette';

type GeoViewport = {
  boundingCoords?: [[number, number], [number, number]];
  center: [number, number];
  zoom: number;
};

const MEXICO_DEFAULT_VIEW: GeoViewport = {
  center: [-102, 24],
  zoom: 1.15,
};

function isPlottableGeoTrip(trip: ReportsManiobrasGeoMapTrip): boolean {
  return trip.lat != null && trip.lng != null && Number.isFinite(trip.lat) && Number.isFinite(trip.lng);
}

export function reportsManiobrasPlottableGeoTrips(
  trips: readonly ReportsManiobrasGeoMapTrip[],
): ReportsManiobrasGeoMapTrip[] {
  return trips.filter(isPlottableGeoTrip);
}

function countDestinationPointsByState(
  trips: readonly ReportsManiobrasGeoMapTrip[],
  geoJson: MexicoStatesGeoJson,
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const trip of trips) {
    if (!isPlottableGeoTrip(trip)) {
      continue;
    }
    const stateName = findMexicoStateForPoint(trip.lng!, trip.lat!, geoJson.features);
    if (!stateName) {
      continue;
    }
    counts.set(stateName, (counts.get(stateName) ?? 0) + 1);
  }
  return counts;
}

function buildReportsGeoRegionStyle(intensity: number): {
  itemStyle: {
    areaColor: string;
    borderColor: string;
    borderWidth: number;
    shadowBlur: number;
    shadowColor: string;
  };
  emphasis: {
    itemStyle: {
      areaColor: string;
      borderColor: string;
      borderWidth: number;
      shadowBlur: number;
      shadowColor: string;
    };
  };
} {
  const areaAlpha = 0.14 + intensity * 0.52;
  const borderAlpha = 0.42 + intensity * 0.48;
  const itemStyle = {
    areaColor: rgbaFromHex(REPORTS_BRAND.navy, areaAlpha),
    borderColor: rgbaFromHex(REPORTS_BRAND.periwinkle, borderAlpha),
    borderWidth: Number((1 + intensity * 0.65).toFixed(2)),
    shadowBlur: Math.round(intensity * 8),
    shadowColor: rgbaFromHex(REPORTS_BRAND.navy, 0.18),
  };
  return {
    itemStyle,
    emphasis: {
      itemStyle: {
        areaColor: rgbaFromHex(REPORTS_BRAND.periwinkle, areaAlpha + 0.1),
        borderColor: rgbaFromHex(REPORTS_BRAND.navy, 0.72),
        borderWidth: Number((1.2 + intensity * 0.5).toFixed(2)),
        shadowBlur: Math.round(intensity * 10 + 4),
        shadowColor: rgbaFromHex(REPORTS_BRAND.navy, 0.24),
      },
    },
  };
}

function computeGeoTripsViewport(trips: readonly ReportsManiobrasGeoMapTrip[]): GeoViewport {
  const coords = trips.filter(isPlottableGeoTrip);
  if (coords.length === 0) {
    return MEXICO_DEFAULT_VIEW;
  }

  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;

  for (const trip of coords) {
    const lng = trip.lng!;
    const lat = trip.lat!;
    minLng = Math.min(minLng, lng);
    minLat = Math.min(minLat, lat);
    maxLng = Math.max(maxLng, lng);
    maxLat = Math.max(maxLat, lat);
  }

  const spanLng = Math.max(maxLng - minLng, 0.35);
  const spanLat = Math.max(maxLat - minLat, 0.35);
  const padLng = Math.max(spanLng * 0.22, 0.45);
  const padLat = Math.max(spanLat * 0.22, 0.35);

  return {
    boundingCoords: [
      [minLng - padLng, maxLat + padLat],
      [maxLng + padLng, minLat - padLat],
    ],
    center: [(minLng + maxLng) / 2, (minLat + maxLat) / 2],
    zoom: 1,
  };
}

/** Geo choropleth + scatter — densidad de destinos por estado. */
export function buildReportsManiobrasGeoMapOption(
  trips: readonly ReportsManiobrasGeoMapTrip[],
  geoJson: MexicoStatesGeoJson | null,
): EChartsOption {
  if (!geoJson) {
    return { backgroundColor: 'transparent' };
  }

  const plottableTrips = reportsManiobrasPlottableGeoTrips(trips);
  const stateCounts = countDestinationPointsByState(plottableTrips, geoJson);
  const maxCount = Math.max(0, ...stateCounts.values());
  const regions = [...stateCounts.entries()].map(([name, count]) => {
    const intensity = maxCount > 0 ? count / maxCount : 0;
    return { name, ...buildReportsGeoRegionStyle(intensity) };
  });

  const scatterData = plottableTrips.map((trip) => ({
      name: trip.maneuverCode,
      value: [trip.lng!, trip.lat!] as [number, number],
      trip,
    }));

  const viewport = computeGeoTripsViewport(plottableTrips);
  const P = REPORTS_CHART_PALETTE;

  return {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      ...reportsChartTooltip(),
      ...TRIPS_MAP_TOOLTIP_BASE,
      formatter: (params) => {
        if (!params || typeof params !== 'object') {
          return '';
        }
        const name = 'name' in params ? String(params.name ?? '') : '';
        if ('seriesType' in params && params.seriesType === 'scatter') {
          const data = 'data' in params ? params.data : undefined;
          const trip =
            data && typeof data === 'object' && 'trip' in data
              ? (data as { trip?: ReportsManiobrasGeoMapTrip }).trip
              : undefined;
          if (trip?.maneuverCode) {
            return `${trip.maneuverCode}<br/>${trip.clientName}`;
          }
          return 'Destino georreferenciado';
        }
        const count = stateCounts.get(name) ?? 0;
        if (!name || count <= 0) {
          return name || '';
        }
        const label = count === 1 ? 'maniobra' : 'maniobras';
        return `${name}<br/>${count} ${label} en el periodo`;
      },
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
      label: { show: false },
      itemStyle: {
        areaColor: rgbaFromHex(REPORTS_BRAND.cream, 0.92),
        borderColor: rgbaFromHex(REPORTS_BRAND.navy, 0.22),
        borderWidth: 1,
      },
      regions,
      emphasis: {
        label: { show: false },
        itemStyle: {
          areaColor: rgbaFromHex(REPORTS_BRAND.sky, 0.22),
          borderColor: rgbaFromHex(REPORTS_BRAND.navy, 0.45),
          borderWidth: 1.2,
        },
      },
    },
    series: [
      {
        name: 'Destinos',
        type: 'scatter',
        coordinateSystem: 'geo',
        zlevel: 2,
        symbol: 'circle',
        symbolSize: 7,
        itemStyle: {
          color: P.inTransit,
          borderColor: P.surface,
          borderWidth: 1,
        },
        data: scatterData,
      },
    ],
  } as EChartsOption;
}
