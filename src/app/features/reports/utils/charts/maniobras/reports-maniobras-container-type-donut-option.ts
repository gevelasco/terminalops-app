import type { EChartsOption } from 'echarts';
import type { ReportsManiobrasContainerTypeRow } from '@shared/models/api/api-reports-maniobras.model';
import {
  type ReportsChartColorOptions,
  REPORTS_CHART_PALETTE,
  reportsChartOutsideLabelStyle,
  reportsChartSeriesColors,
  reportsChartTooltip,
  resolveReportsChartPrimary,
} from '../reports-chart-palette';

/** Donut — mix de tipos de contenedor en maniobras completadas. */
export function buildReportsManiobrasContainerTypeDonutOption(
  rows: readonly ReportsManiobrasContainerTypeRow[],
  colorOffset = 0,
  options?: ReportsChartColorOptions,
): EChartsOption {
  const P = REPORTS_CHART_PALETTE;
  const primary = resolveReportsChartPrimary(options);
  const seriesColors = reportsChartSeriesColors(Math.max(rows.length, 4), colorOffset, primary);
  const data = rows
    .filter((row) => row.tripCount > 0)
    .map((row, index) => ({
      name: row.label,
      value: row.tripCount,
      itemStyle: {
        color: seriesColors[index % seriesColors.length],
      },
    }));

  return {
    animationDuration: 480,
    color: seriesColors,
    tooltip: {
      trigger: 'item',
      ...reportsChartTooltip(),
      formatter: (p) => {
        if (!p || typeof p !== 'object') {
          return '';
        }
        const name = String((p as { name?: string }).name ?? '');
        const value = Number((p as { value?: number }).value) || 0;
        const pct = Number((p as { percent?: number }).percent) || 0;
        const label = value === 1 ? 'maniobra' : 'maniobras';
        return `${name}<br/>${value} ${label} · ${pct.toFixed(0)}%`;
      },
    },
    series: [
      {
        type: 'pie',
        radius: ['42%', '72%'],
        center: ['50%', '52%'],
        padAngle: 2,
        itemStyle: {
          borderRadius: 8,
          borderColor: P.surface,
          borderWidth: 2,
        },
        label: {
          ...reportsChartOutsideLabelStyle({ fontSize: 10 }),
          formatter: (p) => {
            const name = String((p as { name?: string }).name ?? '');
            const pct = Number((p as { percent?: number }).percent) || 0;
            return `${name}\n${pct.toFixed(0)}%`;
          },
        },
        labelLine: {
          length: 8,
          length2: 6,
          lineStyle: { color: P.axis },
        },
        data,
      },
    ],
  };
}
