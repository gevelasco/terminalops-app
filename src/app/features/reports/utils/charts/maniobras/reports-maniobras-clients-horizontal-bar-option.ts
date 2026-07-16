import type { EChartsOption } from 'echarts';
import type { ReportsManiobrasClientRow } from '@shared/models/api/api-reports-maniobras.model';
import { STITCH_PALETTE } from '@features/dashboard/utils/dashboard-chart-colors';
import {
  type ReportsChartColorOptions,
  reportsChartLabelIsLightFill,
  reportsChartOnFillLabelStyle,
  reportsChartTooltip,
  reportsChartValueAxis,
} from '../reports-chart-palette';

/** Horizontal Bar — clientes con más maniobras completadas en el periodo. */
export function buildReportsManiobrasClientsHorizontalBarOption(
  rows: readonly ReportsManiobrasClientRow[],
  colorOffset = 0,
  options?: ReportsChartColorOptions,
): EChartsOption {
  const ordered = [...rows].sort((a, b) => b.tripCount - a.tripCount).slice(0, 8);
  const labels = ordered.map((r) => r.clientName);
  const values = ordered.map((r) => r.tripCount);
  const max = Math.max(...values, 1);
  const valueAxis = reportsChartValueAxis();

  return {
    animationDuration: 460,
    grid: { left: 4, right: 12, top: 8, bottom: 4, containLabel: true },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow', shadowStyle: { color: 'rgba(23, 36, 63, 0.06)' } },
      ...reportsChartTooltip(),
      formatter: (params) => {
        const p = Array.isArray(params) ? params[0] : params;
        if (!p || typeof p !== 'object' || !('name' in p)) {
          return '';
        }
        const count = Number((p as { value?: number }).value) || 0;
        const label = count === 1 ? 'maniobra' : 'maniobras';
        return `${String((p as { name?: string }).name ?? '')}<br/>${count} ${label}`;
      },
    },
    xAxis: {
      ...valueAxis,
      max: Math.ceil(max * 1.12),
      minInterval: 1,
      axisLine: { show: false },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'category',
      data: labels,
      inverse: true,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        color: valueAxis.axisLabel.color,
        fontSize: 10,
        width: 96,
        overflow: 'truncate',
      },
    },
    series: [
      {
        type: 'bar',
        data: values.map((v, i) => {
          const c = STITCH_PALETTE[i % STITCH_PALETTE.length];
          return {
            value: v,
            itemStyle: { color: c, borderRadius: [0, 4, 4, 0] },
            label: {
              show: values.length <= 6,
              position: 'insideRight' as const,
              ...reportsChartOnFillLabelStyle({
                fontSize: 9,
                lightFill: reportsChartLabelIsLightFill(c),
              }),
              formatter: () => String(v),
            },
          };
        }),
        barMaxWidth: 18,
      },
    ],
  };
}
