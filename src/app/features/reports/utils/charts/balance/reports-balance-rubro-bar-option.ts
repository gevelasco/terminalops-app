import type { EChartsOption } from 'echarts';
import type { ReportsBalanceExpenseRubro } from '@shared/models/api/api-reports-balance.model';
import {
  type ReportsChartColorOptions,
  reportsChartLabelIsLightFill,
  reportsChartOnFillLabelStyle,
  reportsChartSeriesColors,
  reportsChartTooltip,
  reportsChartValueAxis,
  resolveReportsChartPrimary,
} from '../reports-chart-palette';
import { reportsFintechCategoryAxis } from '../reports-chart-theme.util';
import { formatReportsMoneyMx } from '../reports-chart-axis.util';

/** Basic Bar — gastos por rubro. */
export function buildReportsBalanceRubroBarOption(
  rows: readonly ReportsBalanceExpenseRubro[],
  colorOffset = 0,
  options?: ReportsChartColorOptions,
): EChartsOption {
  const ordered = [...rows].sort((a, b) => b.amount - a.amount).slice(0, 8);
  const labels = ordered.map((r) => r.label);
  const values = ordered.map((r) => r.amount);
  const max = Math.max(...values, 1);
  const primary = resolveReportsChartPrimary(options);
  const colors = reportsChartSeriesColors(Math.max(values.length, 1), colorOffset, primary);
  const valueAxis = reportsChartValueAxis();

  return {
    animationDuration: 460,
    color: colors,
    grid: { left: 8, right: 8, top: 12, bottom: 4, containLabel: true },
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
        const value = Number((p as { value?: number }).value) || 0;
        const count = row?.count ?? 0;
        const label = count === 1 ? 'gasto' : 'gastos';
        return `${String((p as { name?: string }).name ?? '')}<br/>${formatReportsMoneyMx(value)} · ${count} ${label}`;
      },
    },
    xAxis: reportsFintechCategoryAxis(labels, {
      rotate: labels.length > 4 ? 24 : 0,
      width: 72,
      showAllLabels: true,
    }),
    yAxis: {
      ...valueAxis,
      max: Math.ceil(max * 1.12),
      axisLine: { show: false },
      axisTick: { show: false },
    },
    series: [
      {
        type: 'bar',
        data: values.map((value, i) => ({
          value,
          itemStyle: {
            color: colors[i % colors.length],
            borderRadius: [4, 4, 0, 0],
          },
          label: {
            show: true,
            position: 'insideTop',
            padding: [4, 0, 0, 0],
            ...reportsChartOnFillLabelStyle({
              fontSize: 9,
              lightFill: reportsChartLabelIsLightFill(colors[i % colors.length]),
            }),
            formatter: () => formatReportsMoneyMx(value, true),
          },
        })),
        barMaxWidth: 40,
      },
    ],
  };
}
