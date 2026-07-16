import type { EChartsOption } from 'echarts';
import type { ReportsFleetStatusMixRow } from '@shared/models/api/api-reports-fleet.model';
import { STITCH_PALETTE } from '@features/dashboard/utils/dashboard-chart-colors';
import {
  type ReportsChartColorOptions,
  REPORTS_CHART_PALETTE,
  reportsChartOutsideLabelStyle,
  reportsChartTooltip,
} from '../reports-chart-palette';

/** Donut — distribución del estado operativo actual de unidades. */
export function buildReportsFleetStatusDonutOption(
  rows: readonly ReportsFleetStatusMixRow[],
  colorOffset = 0,
  options?: ReportsChartColorOptions,
): EChartsOption {
  const P = REPORTS_CHART_PALETTE;
  const data = rows
    .filter((row) => row.count > 0)
    .map((row, i) => ({
      name: row.label,
      value: row.count,
      itemStyle: {
        color: STITCH_PALETTE[i % STITCH_PALETTE.length],
      },
    }));

  return {
    animationDuration: 480,
    color: [...STITCH_PALETTE],
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
