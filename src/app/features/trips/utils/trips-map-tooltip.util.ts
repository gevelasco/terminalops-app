import type { CallbackDataParams } from 'echarts/types/dist/shared';

export const TRIPS_MAP_TOOLTIP_BASE = {
  renderMode: 'html' as const,
  confine: false,
  appendToBody: true,
  backgroundColor: 'rgba(255, 255, 255, 0.98)',
  borderColor: 'rgba(148, 163, 184, 0.45)',
  borderWidth: 1,
  padding: [10, 12] as [number, number],
  textStyle: {
    color: '#0f172a',
    fontSize: 12,
  },
  extraCssText:
    'box-shadow:0 8px 24px rgba(15,23,42,0.12);border-radius:8px;backdrop-filter:blur(4px);max-width:min(22rem,calc(100vw - 2rem));white-space:normal;word-break:break-word;overflow-wrap:break-word;',
};

export type TripsMapGeoTooltipParams = {
  componentType: 'geo';
  geoIndex?: number;
  name: string;
};

export function isTripsMapGeoRegionTooltip(
  item: CallbackDataParams | TripsMapGeoTooltipParams,
): boolean {
  if (item.componentType === 'geo') {
    return true;
  }
  const seriesItem = item as CallbackDataParams;
  if (
    seriesItem.seriesType === 'lines' ||
    seriesItem.seriesType === 'scatter' ||
    seriesItem.seriesType === 'map'
  ) {
    return false;
  }
  return Boolean(seriesItem.name) && seriesItem.data == null;
}

export function resolveTripsMapTooltipItem(
  params: CallbackDataParams | CallbackDataParams[],
): CallbackDataParams | null {
  if (Array.isArray(params)) {
    return params[0] ?? null;
  }
  return params;
}

export function resolveTripsMapGeoTooltipName(
  params: TripsMapGeoTooltipParams | TripsMapGeoTooltipParams[],
): string {
  const item = Array.isArray(params) ? params[0] : params;
  return item?.name?.trim() ?? '';
}

export function escapeTripsMapTooltipText(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

export function shortenTripsMapPointLabel(label: string): string {
  const trimmed = label.trim();
  if (!trimmed) {
    return '';
  }
  const separator = ' · ';
  const separatorIndex = trimmed.indexOf(separator);
  if (separatorIndex >= 0) {
    return trimmed.slice(0, separatorIndex).trim();
  }
  return trimmed;
}

export function formatTripsMapAddressTooltipHtml(label: string): string {
  const text = shortenTripsMapPointLabel(label);
  if (!text) {
    return '';
  }
  return `<span style="display:block;font-size:0.8125rem;line-height:1.45;color:#0f172a;white-space:normal;word-break:break-word;overflow-wrap:break-word;">${escapeTripsMapTooltipText(text)}</span>`;
}

export function resolveTripsMapPointDatum<T extends { pointLabel?: string; kind?: string }>(
  params: CallbackDataParams,
  seriesData: readonly T[],
): T | null {
  const raw = params.data;
  if (raw && typeof raw === 'object' && !Array.isArray(raw) && 'pointLabel' in raw) {
    return raw as T;
  }

  const index = params.dataIndex;
  if (typeof index === 'number' && index >= 0 && index < seriesData.length) {
    return seriesData[index] ?? null;
  }

  return null;
}
