import type { EChartsOption } from 'echarts';
import type { ReportsManiobrasOperatorRow } from '@shared/models/api/api-reports-maniobras.model';
import {
  type ReportsChartColorOptions,
  reportsChartLabelIsLightFill,
  reportsChartOnFillLabelStyle,
  reportsChartRotatingColorAt,
  reportsChartTooltip,
  reportsChartValueAxis,
  resolveReportsChartPrimary,
} from '../reports-chart-palette';

function formatKm(value: number): string {
  return `${new Intl.NumberFormat('es-MX', { maximumFractionDigits: 1 }).format(value)} km`;
}

/** Horizontal Bar — operadores con más maniobras completadas. */
export function buildReportsManiobrasOperatorsHorizontalBarOption(
  rows: readonly ReportsManiobrasOperatorRow[],
  colorOffset = 0,
  options?: ReportsChartColorOptions,
): EChartsOption {
  const ordered = [...rows]
    .filter((r) => r.operatorName.trim().toLowerCase() !== 'sin operador')
    .sort((a, b) => b.completed - a.completed)
    .slice(0, 8);
  const labels = ordered.map((r) => r.operatorName);
  const values = ordered.map((r) => r.completed);
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
        const idx = Number((p as { dataIndex?: number }).dataIndex) || 0;
        const row = ordered[idx];
        const count = Number((p as { value?: number }).value) || 0;
        const label = count === 1 ? 'maniobra' : 'maniobras';
        const km = row?.operationalKm ?? 0;
        return `${String((p as { name?: string }).name ?? '')}<br/>${count} ${label} · ${formatKm(km)}`;
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
