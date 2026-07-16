import type { EChartsOption } from 'echarts';
import type { ReportsBalanceCreditByClient } from '@shared/models/api/api-reports-balance.model';
import { STITCH_PALETTE } from '@features/dashboard/utils/dashboard-chart-colors';
import {
  reportsChartLabelIsLightFill,
  reportsChartOnFillLabelStyle,
  reportsChartTooltip,
  reportsChartValueAxis,
} from '../reports-chart-palette';
import { formatReportsMoneyMx } from '../reports-chart-axis.util';

/** Horizontal Bar — cartera por cliente. */
export function buildReportsBalanceCreditHorizontalBarOption(
  rows: readonly ReportsBalanceCreditByClient[],
): EChartsOption {
  const ordered = [...rows].sort((a, b) => b.amount - a.amount).slice(0, 8);
  const labels = ordered.map((r) => r.clientName);
  const values = ordered.map((r) => r.amount);
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
        const idx = Number((p as { dataIndex?: number }).dataIndex) || 0;
        const row = ordered[idx];
        const value = Number((p as { value?: number }).value) || 0;
        const due = row?.nextDueDate
          ? new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short' }).format(
              new Date(`${row.nextDueDate}T12:00:00`),
            )
          : '—';
        return `${String((p as { name?: string }).name ?? '')}<br/>${formatReportsMoneyMx(value)}<br/>Próximo cobro: ${due}`;
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
              formatter: () => formatReportsMoneyMx(v, true),
            },
          };
        }),
        barMaxWidth: 18,
      },
    ],
  };
}
