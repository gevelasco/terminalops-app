import type { EChartsOption } from 'echarts';
import type { ReportsBalanceMarginByClient } from '@shared/models/api/api-reports-balance.model';
import { STITCH_PALETTE } from '@features/dashboard/utils/dashboard-chart-colors';
import {
  reportsChartLabelIsLightFill,
  reportsChartOnFillLabelStyle,
  reportsChartTooltip,
  reportsChartValueAxis,
} from '../reports-chart-palette';
import { formatReportsMoneyMx } from '../reports-chart-axis.util';

/** Horizontal Bar — utilidad por cliente (ingreso − costo de maniobra). */
export function buildReportsBalanceMarginHorizontalBarOption(
  rows: readonly ReportsBalanceMarginByClient[],
): EChartsOption {
  const ordered = [...rows]
    .filter((r) => r.margin !== 0 || r.revenue > 0)
    .sort((a, b) => b.margin - a.margin)
    .slice(0, 8);
  const labels = ordered.map((r) => r.clientName);
  const values = ordered.map((r) => r.margin);
  const maxAbs = Math.max(...values.map((v) => Math.abs(v)), 1);
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
        if (!row) {
          return '';
        }
        const pct =
          row.marginPercent == null ? '—' : `${row.marginPercent.toFixed(1)}%`;
        return `${row.clientName}<br/>Utilidad: ${formatReportsMoneyMx(row.margin)}<br/>Ingreso: ${formatReportsMoneyMx(row.revenue)}<br/>Costo: ${formatReportsMoneyMx(row.cost)}<br/>Margen: ${pct}`;
      },
    },
    xAxis: {
      ...valueAxis,
      min: values.some((v) => v < 0) ? -Math.ceil(maxAbs * 1.12) : 0,
      max: Math.ceil(maxAbs * 1.12),
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
          const c = v < 0 ? valueAxis.axisLabel.color : STITCH_PALETTE[i % STITCH_PALETTE.length];
          return {
            value: v,
            itemStyle: {
              color: c,
              borderRadius: v < 0 ? [4, 0, 0, 4] : [0, 4, 4, 0],
            },
            label: {
              show: values.length <= 6,
              position: 'insideRight' as const,
              ...reportsChartOnFillLabelStyle({
                fontSize: 9,
                lightFill: reportsChartLabelIsLightFill(c as string),
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
