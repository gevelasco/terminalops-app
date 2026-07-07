import type { EChartsOption } from 'echarts';
import type { ReportsFleetUnitActivityRow } from '@shared/models/api/api-reports-fleet.model';
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

function formatLiters(value: number): string {
  return `${new Intl.NumberFormat('es-MX', { maximumFractionDigits: 1 }).format(value)} L`;
}

/** Horizontal Bar — unidades con más km operativos completados en el periodo. */
export function buildReportsFleetUnitsHorizontalBarOption(
  rows: readonly ReportsFleetUnitActivityRow[],
  colorOffset = 0,
  options?: ReportsChartColorOptions,
): EChartsOption {
  const ordered = [...rows]
    .sort((a, b) => b.operationalKm - a.operationalKm)
    .slice(0, 8);
  const labels = ordered.map((r) => r.unitLabel);
  const values = ordered.map((r) => r.operationalKm);
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
        const km = Number((p as { value?: number }).value) || 0;
        const trips = row?.completedTrips ?? 0;
        const diesel = row?.dieselLiters ?? 0;
        const tripLabel = trips === 1 ? 'maniobra' : 'maniobras';
        return `${String((p as { name?: string }).name ?? '')}<br/>${formatKm(km)} · ${trips} ${tripLabel} · ${formatLiters(diesel)}`;
      },
    },
    xAxis: {
      ...valueAxis,
      max: Math.ceil(max * 1.12),
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
