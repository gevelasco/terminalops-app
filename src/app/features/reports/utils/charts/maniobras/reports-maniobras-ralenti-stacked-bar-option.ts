import type { EChartsOption } from 'echarts';
import type { ReportsManiobrasRalentiByClient } from '@shared/models/api/api-reports-maniobras.model';
import { STITCH_PALETTE } from '@features/dashboard/utils/dashboard-chart-colors';
import {
  type ReportsChartColorOptions,
  reportsChartLegend,
  reportsChartTooltip,
  reportsChartValueAxis,
} from '../reports-chart-palette';

function formatHours(value: number): string {
  return `${new Intl.NumberFormat('es-MX', { maximumFractionDigits: 1 }).format(value)} h`;
}

/** Barras apiladas — ralenti por cliente (salida→cliente + cliente→regreso). */
export function buildReportsManiobrasRalentiStackedBarOption(
  rows: readonly ReportsManiobrasRalentiByClient[],
  _colorOffset = 0,
  _options?: ReportsChartColorOptions,
): EChartsOption {
  const ordered = [...rows]
    .filter((row) => row.totalHours > 0)
    .sort((a, b) => b.totalHours - a.totalHours)
    .slice(0, 8);
  const labels = ordered.map((row) => row.clientName);
  const max = Math.max(...ordered.map((row) => row.totalHours), 1);
  const valueAxis = reportsChartValueAxis();
  const outboundColor = STITCH_PALETTE[0];
  const returnColor = STITCH_PALETTE[2 % STITCH_PALETTE.length];

  return {
    animationDuration: 460,
    color: [outboundColor, returnColor],
    grid: { left: 4, right: 12, top: 28, bottom: 4, containLabel: true },
    legend: {
      ...reportsChartLegend(),
      top: 0,
      itemWidth: 10,
      itemHeight: 8,
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow', shadowStyle: { color: 'rgba(23, 36, 63, 0.06)' } },
      ...reportsChartTooltip(),
      formatter: (params) => {
        const list = Array.isArray(params) ? params : [params];
        if (list.length === 0) {
          return '';
        }
        const name = String((list[0] as { name?: string }).name ?? '');
        const lines = list.map((p) => {
          const item = p as { seriesName?: string; value?: number };
          return `${item.seriesName ?? ''}: ${formatHours(Number(item.value) || 0)}`;
        });
        return `${name}<br/>${lines.join('<br/>')}`;
      },
    },
    xAxis: {
      ...valueAxis,
      max: Math.ceil(max * 1.12 * 10) / 10,
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
        name: 'Salida → cliente',
        type: 'bar',
        stack: 'ralenti',
        barMaxWidth: 18,
        itemStyle: { color: outboundColor, borderRadius: [0, 0, 0, 0] },
        data: ordered.map((row) => row.salidaClienteHours),
      },
      {
        name: 'Cliente → regreso',
        type: 'bar',
        stack: 'ralenti',
        barMaxWidth: 18,
        itemStyle: { color: returnColor, borderRadius: [0, 4, 4, 0] },
        data: ordered.map((row) => row.clienteRegresoHours),
      },
    ],
  };
}
