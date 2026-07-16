import type { EChartsOption } from 'echarts';
import type { ReportsBalanceMarginByClient } from '@shared/models/api/api-reports-balance.model';
import { STITCH_PALETTE } from '@features/dashboard/utils/dashboard-chart-colors';
import {
  type ReportsChartColorOptions,
  reportsChartLegend,
  reportsChartTooltip,
  reportsChartValueAxis,
} from '../reports-chart-palette';
import { formatReportsMoneyMx } from '../reports-chart-axis.util';

/**
 * Barras horizontales agrupadas — rendimiento por cliente:
 * cuánto se invierte (costo), cuánto ingresa y el margen resultante.
 */
export function buildReportsBalanceClientPerformanceOption(
  rows: readonly ReportsBalanceMarginByClient[],
  options?: ReportsChartColorOptions,
): EChartsOption {
  const ordered = [...rows]
    .filter((r) => r.revenue > 0 || r.cost > 0 || r.margin !== 0)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 8);
  const labels = ordered.map((r) => r.clientName);
  const colors = { revenue: STITCH_PALETTE[0], expense: STITCH_PALETTE[1], margin: STITCH_PALETTE[2] };
  const valueAxis = reportsChartValueAxis();

  return {
    animationDuration: 460,
    grid: { left: 4, right: 12, top: 26, bottom: 4, containLabel: true },
    legend: reportsChartLegend(),
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow', shadowStyle: { color: 'rgba(23, 36, 63, 0.06)' } },
      ...reportsChartTooltip(),
      formatter: (params) => {
        const list = Array.isArray(params) ? params : [params];
        const idx = Number((list[0] as { dataIndex?: number })?.dataIndex) || 0;
        const row = ordered[idx];
        if (!row) {
          return '';
        }
        const pct = row.marginPercent == null ? '—' : `${row.marginPercent.toFixed(1)}%`;
        return `${row.clientName}<br/>Inversión: ${formatReportsMoneyMx(row.cost)}<br/>Ingreso: ${formatReportsMoneyMx(row.revenue)}<br/>Margen: ${formatReportsMoneyMx(row.margin)} · ${pct}`;
      },
    },
    xAxis: {
      ...valueAxis,
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
        name: 'Inversión',
        type: 'bar',
        data: ordered.map((r) => r.cost),
        barMaxWidth: 12,
        itemStyle: { color: colors.expense, borderRadius: [0, 3, 3, 0] },
      },
      {
        name: 'Ingreso',
        type: 'bar',
        data: ordered.map((r) => r.revenue),
        barMaxWidth: 12,
        itemStyle: { color: colors.revenue, borderRadius: [0, 3, 3, 0] },
      },
      {
        name: 'Margen',
        type: 'bar',
        data: ordered.map((r) => r.margin),
        barMaxWidth: 12,
        itemStyle: { color: colors.margin, borderRadius: [0, 3, 3, 0] },
      },
    ],
  };
}
