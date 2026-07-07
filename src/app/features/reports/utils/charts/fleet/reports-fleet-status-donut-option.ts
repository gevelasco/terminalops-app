import type { EChartsOption } from 'echarts';
import type { ReportsFleetStatusMixRow } from '@shared/models/api/api-reports-fleet.model';
import {
  type ReportsChartColorOptions,
  REPORTS_FINTECH_ACCENT,
  REPORTS_CHART_PALETTE,
  reportsChartOutsideLabelStyle,
  reportsChartSeriesColors,
  reportsChartTooltip,
  resolveReportsChartPrimary,
} from '../reports-chart-palette';

function fleetStatusColors(primary: string): Record<string, string> {
  return {
    in_transit: REPORTS_FINTECH_ACCENT.sage,
    scheduled: REPORTS_FINTECH_ACCENT.gray,
    available: primary,
    maintenance: REPORTS_FINTECH_ACCENT.sand,
  };
}

/** Donut — distribución del estado operativo actual de unidades. */
export function buildReportsFleetStatusDonutOption(
  rows: readonly ReportsFleetStatusMixRow[],
  colorOffset = 0,
  options?: ReportsChartColorOptions,
): EChartsOption {
  const P = REPORTS_CHART_PALETTE;
  const primary = resolveReportsChartPrimary(options);
  const statusColors = fleetStatusColors(primary);
  const data = rows
    .filter((row) => row.count > 0)
    .map((row) => ({
      name: row.label,
      value: row.count,
      itemStyle: {
        color:
          statusColors[row.status] ?? reportsChartSeriesColors(1, colorOffset, primary)[0],
      },
    }));

  return {
    animationDuration: 480,
    color: reportsChartSeriesColors(Math.max(data.length, 4), colorOffset, primary),
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
        const label = value === 1 ? 'unidad' : 'unidades';
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
