import type { EChartsOption } from 'echarts';
import type { ReportsManiobrasClientRow } from '@shared/models/api/api-reports-maniobras.model';
import {
  type ReportsChartColorOptions,
  reportsChartLabelIsLightFill,
  reportsChartOnFillLabelStyle,
  reportsChartRotatingColorAt,
  reportsChartTooltip,
  reportsChartValueAxis,
  resolveReportsChartPrimary,
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
  const barColor = reportsChartRotatingColorAt(colorOffset, resolveReportsChartPrimary(options));
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
        data: values,
        barMaxWidth: 18,
        itemStyle: {
          color: barColor,
          borderRadius: [0, 4, 4, 0],
        },
        label: {
          show: values.length <= 6,
          position: 'insideRight',
          ...reportsChartOnFillLabelStyle({
            fontSize: 9,
            lightFill: reportsChartLabelIsLightFill(barColor),
          }),
          formatter: (p) => String(p.value ?? ''),
        },
      },
    ],
  };
}
