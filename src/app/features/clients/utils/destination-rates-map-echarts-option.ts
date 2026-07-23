import type { EChartsOption } from 'echarts';
import type { DestinationRate } from '@shared/models/destination-rate.models';
import { TRIPS_MAP_GEO_NAME } from '@features/trips/utils/trips-map-echarts-option';
import {
  buildGeoRegionsForStateActivity,
  type MexicoStatesGeoJson,
} from '@features/trips/utils/trips-map-state-activity';
import {
  resolveTripsMapGeoTooltipName,
  TRIPS_MAP_TOOLTIP_BASE,
  type TripsMapGeoTooltipParams,
} from '@features/trips/utils/trips-map-tooltip.util';
import {
  computeDestinationRatesMapViewport,
  countDestinationRatesByState,
} from '@features/clients/utils/destination-rates-map-activity';
import { formatDestinationRatesStateTooltipHtml } from '@features/clients/utils/destination-rates-map-tooltip';

export function buildDestinationRatesMapEchartsOption(
  rates: readonly DestinationRate[],
  geoJson: MexicoStatesGeoJson | null | undefined,
): EChartsOption {
  const destinationCounts = geoJson
    ? countDestinationRatesByState(rates, geoJson)
    : new Map<string, number>();
  const stateRegions = buildGeoRegionsForStateActivity(
    new Map(),
    destinationCounts,
  );
  const viewport = computeDestinationRatesMapViewport(rates, geoJson);

  const formatStateTooltip = (stateName: string): string => {
    const count = destinationCounts.get(stateName) ?? 0;
    if (count <= 0) {
      return '';
    }
    return formatDestinationRatesStateTooltipHtml(stateName, count);
  };

  const geoTooltipFormatter = (
    params: TripsMapGeoTooltipParams | TripsMapGeoTooltipParams[],
  ): string => {
    const stateName = resolveTripsMapGeoTooltipName(params);
    return stateName ? formatStateTooltip(stateName) : '';
  };

  return {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      ...TRIPS_MAP_TOOLTIP_BASE,
      formatter: (params) =>
        geoTooltipFormatter(params as TripsMapGeoTooltipParams),
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
        formatter: (params) =>
          geoTooltipFormatter(params as TripsMapGeoTooltipParams),
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
  };
}
