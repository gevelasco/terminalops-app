/**
 * Catálogo de estilos ECharts para reportes.
 * Paleta visual: `reports-chart-palette.ts` (Navy · Periwinkle · Sky · Cream).
 * Cada tipo debe usarse como máximo en una tab para evitar repetición visual.
 */
export type ReportsChartTypeId =
  | 'areaPieces'
  | 'basicBar'
  | 'treemapSpend'
  | 'ringGauge'
  | 'sunburstRounded'
  | 'piePadAngle'
  | 'geoChoropleth'
  | 'multiLine'
  | 'horizontalBar'
  | 'donutPie';

export type ReportsTabChartAssignment = Partial<
  Record<ReportsChartTypeId, readonly ('balance' | 'maniobras' | 'fleet')[]>
>;

export const REPORTS_CHART_TYPE_REGISTRY: Record<
  ReportsChartTypeId,
  {
    label: string;
    echartsFamily: string;
    assignedTabs: readonly ('balance' | 'maniobras' | 'fleet')[];
    notes?: string;
  }
> = {
  areaPieces: {
    label: 'Basic Line',
    echartsFamily: 'line',
    assignedTabs: ['maniobras'],
    notes: 'Actividad diaria del periodo (multi-serie)',
  },
  basicBar: {
    label: 'Basic Bar',
    echartsFamily: 'bar',
    assignedTabs: ['maniobras'],
    notes: 'Top destinos (barras verticales)',
  },
  treemapSpend: {
    label: 'Treemap (spend breakdown)',
    echartsFamily: 'treemap',
    assignedTabs: ['balance'],
    notes: 'Balance: utilidad del periodo',
  },
  ringGauge: {
    label: 'Ring Gauge',
    echartsFamily: 'gauge',
    assignedTabs: [],
    notes: 'Reservado',
  },
  sunburstRounded: {
    label: 'Sunburst with Rounded Corners',
    echartsFamily: 'sunburst',
    assignedTabs: [],
    notes: 'Reservado',
  },
  piePadAngle: {
    label: 'Pie with padAngle',
    echartsFamily: 'pie',
    assignedTabs: ['balance'],
    notes: 'Balance: movimiento del periodo',
  },
  geoChoropleth: {
    label: 'Geo Choropleth / Scatter',
    echartsFamily: 'map + scatter',
    assignedTabs: ['maniobras'],
    notes: 'Reservado: densidad geográfica de destinos',
  },
  multiLine: {
    label: 'Multi Line',
    echartsFamily: 'line',
    assignedTabs: [],
    notes: 'Series temporales detalladas (sin asignar)',
  },
  horizontalBar: {
    label: 'Horizontal Bar',
    echartsFamily: 'bar',
    assignedTabs: ['balance', 'maniobras'],
    notes: 'Balance: cartera por cliente · Maniobras: rankings',
  },
  donutPie: {
    label: 'Donut Pie',
    echartsFamily: 'pie',
    assignedTabs: ['fleet'],
    notes: 'Reservado: estado de flota',
  },
};

export function reportsChartTypesForTab(
  tab: 'balance' | 'maniobras' | 'fleet',
): ReportsChartTypeId[] {
  return (Object.entries(REPORTS_CHART_TYPE_REGISTRY) as [
    ReportsChartTypeId,
    (typeof REPORTS_CHART_TYPE_REGISTRY)[ReportsChartTypeId],
  ][])
    .filter(([, meta]) => meta.assignedTabs.includes(tab))
    .map(([id]) => id);
}
