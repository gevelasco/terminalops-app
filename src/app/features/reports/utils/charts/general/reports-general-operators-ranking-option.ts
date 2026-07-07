import type { EChartsOption } from 'echarts';
import type { ReportsManiobrasOperatorRow } from '@shared/models/api/api-reports-maniobras.model';
import {
  type ReportsChartColorOptions,
  REPORTS_CHART_PALETTE,
  reportsChartLegend,
  reportsChartRotatingColorAt,
  reportsChartTooltip,
  reportsChartValueAxis,
  resolveReportsChartPrimary,
} from '../reports-chart-palette';

function formatKm(value: number): string {
  return `${new Intl.NumberFormat('es-MX', { maximumFractionDigits: 1 }).format(value)} km`;
}

function formatKmPerTrip(km: number, completed: number): string {
  if (completed <= 0) {
    return '—';
  }
  const avg = km / completed;
  return `${new Intl.NumberFormat('es-MX', { maximumFractionDigits: 1 }).format(avg)} km/maniobra`;
}

/** Barras agrupadas — productividad (maniobras) y rendimiento (km operados). */
export function buildReportsGeneralOperatorsRankingOption(
  rows: readonly ReportsManiobrasOperatorRow[],
  colorOffset = 0,
  options?: ReportsChartColorOptions,
): EChartsOption {
  const P = REPORTS_CHART_PALETTE;
  const primary = resolveReportsChartPrimary(options);
  const productivityColor = reportsChartRotatingColorAt(colorOffset, primary);
  const performanceColor = reportsChartRotatingColorAt(colorOffset + 1, primary);
  const valueAxis = reportsChartValueAxis();

  const ordered = [...rows]
    .filter((row) => row.operatorName.trim().toLowerCase() !== 'sin operador')
    .sort((a, b) => b.completed - a.completed || b.operationalKm - a.operationalKm)
    .slice(0, 6);

  const labels = ordered.map((row) => row.operatorName);
  const completedValues = ordered.map((row) => row.completed);
  const kmValues = ordered.map((row) => row.operationalKm);
  const maxCompleted = Math.max(...completedValues, 1);
  const maxKm = Math.max(...kmValues, 1);

  return {
    animationDuration: 460,
    color: [productivityColor, performanceColor],
    grid: { left: 4, right: 12, top: 32, bottom: 18, containLabel: true },
    legend: {
      ...reportsChartLegend(),
      top: 0,
      itemWidth: 10,
      itemHeight: 8,
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow', shadowStyle: { color: 'rgba(30,41,59,0.06)' } },
      ...reportsChartTooltip(),
      formatter: (params) => {
        if (!Array.isArray(params) || params.length === 0) {
          return '';
        }
        const title = String(params[0]?.name ?? '');
        const idx = Number(params[0]?.dataIndex) || 0;
        const row = ordered[idx];
        const lines = params.map((p) => {
          const seriesName = String((p as { seriesName?: string }).seriesName ?? '');
          const value = Number((p as { value?: number }).value) || 0;
          if (seriesName === 'Km operados') {
            return `${seriesName}: ${formatKm(value)}`;
          }
          const label = value === 1 ? 'maniobra' : 'maniobras';
          return `${seriesName}: ${value} ${label}`;
        });
        if (row) {
          lines.push(`Promedio: ${formatKmPerTrip(row.operationalKm, row.completed)}`);
        }
        return [title, ...lines].join('<br/>');
      },
    },
    xAxis: [
      {
        ...valueAxis,
        position: 'bottom',
        max: Math.ceil(maxCompleted * 1.12),
        minInterval: 1,
        axisLine: { show: false },
        axisTick: { show: false },
        name: 'Maniobras',
        nameLocation: 'end',
        nameGap: 6,
        nameTextStyle: { color: P.axis, fontSize: 9, fontWeight: 600 },
      },
      {
        ...valueAxis,
        position: 'top',
        max: Math.ceil(maxKm * 1.12),
        axisLine: { show: false },
        axisTick: { show: false },
        name: 'Km',
        nameLocation: 'end',
        nameGap: 6,
        nameTextStyle: { color: P.axis, fontSize: 9, fontWeight: 600 },
        axisLabel: {
          ...valueAxis.axisLabel,
          formatter: (value: number) =>
            new Intl.NumberFormat('es-MX', { notation: 'compact', maximumFractionDigits: 1 }).format(
              value,
            ),
        },
      },
    ],
    yAxis: {
      type: 'category',
      data: labels,
      inverse: true,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        color: P.axisLabel,
        fontSize: 10,
        fontWeight: 600,
        width: 72,
        overflow: 'truncate',
      },
    },
    series: [
      {
        name: 'Maniobras',
        type: 'bar',
        xAxisIndex: 0,
        data: completedValues,
        barMaxWidth: 9,
        barGap: '20%',
        itemStyle: {
          color: productivityColor,
          borderRadius: [0, 3, 3, 0],
        },
      },
      {
        name: 'Km operados',
        type: 'bar',
        xAxisIndex: 1,
        data: kmValues,
        barMaxWidth: 9,
        itemStyle: {
          color: performanceColor,
          borderRadius: [0, 3, 3, 0],
        },
      },
    ],
  };
}
