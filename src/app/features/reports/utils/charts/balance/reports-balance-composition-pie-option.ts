import type { EChartsOption } from 'echarts';
import type { ReportsBalanceCompositionSlice } from '@shared/models/api/api-reports-balance.model';
import { STITCH_PALETTE } from '@features/dashboard/utils/dashboard-chart-colors';
import {
  type ReportsChartColorOptions,
  REPORTS_CHART_PALETTE,
  reportsChartOutsideLabelStyle,
  reportsChartSeriesColors,
  reportsChartTooltip,
  resolveReportsChartPrimary,
} from '../reports-chart-palette';
import { formatReportsMoneyMx } from '../reports-chart-axis.util';

function buildCompositionColorMap(_primary: string): Record<string, string> {
  return {
    collected: STITCH_PALETTE[0],
    receivable: STITCH_PALETTE[1],
    expenses: STITCH_PALETTE[2],
    provisions: STITCH_PALETTE[3],
  };
}

/** Pie with padAngle — movimiento financiero del periodo. */
export function buildReportsBalanceCompositionPieOption(
  slices: readonly ReportsBalanceCompositionSlice[],
  options?: ReportsChartColorOptions,
): EChartsOption {
  const P = REPORTS_CHART_PALETTE;
  const primary = resolveReportsChartPrimary(options);
  const colorMap = buildCompositionColorMap(primary);
  const data = slices
    .filter((slice) => slice.amount > 0)
    .map((slice) => ({
      name: slice.label,
      value: slice.amount,
      itemStyle: {
        color: colorMap[slice.key] ?? reportsChartSeriesColors(1, 0, primary)[0],
      },
    }));

  return {
    animationDuration: 480,
    color: reportsChartSeriesColors(Math.max(data.length, 4), 0, primary),
    tooltip: {
      trigger: 'item',
      ...reportsChartTooltip(),
      formatter: (p) => {
        if (!p || typeof p !== 'object') {
          return '';
        }
        const name = String((p as { name?: string }).name ?? '');
        const value = Number((p as { value?: number }).value) || 0;
        const pct = Number((p as { percent?: number }).percent) || 0;
        return `${name}<br/>${formatReportsMoneyMx(value)} · ${pct.toFixed(0)}%`;
      },
    },
    series: [
      {
        type: 'pie',
        radius: ['42%', '72%'],
        center: ['50%', '52%'],
        padAngle: 2,
        itemStyle: {
          borderRadius: 8,
          borderColor: P.surface,
          borderWidth: 2,
        },
        label: {
          ...reportsChartOutsideLabelStyle({ fontSize: 10 }),
          formatter: (p) => {
            const name = String((p as { name?: string }).name ?? '');
            const value = Number((p as { value?: number }).value) || 0;
            const pct = Number((p as { percent?: number }).percent) || 0;
            return `${name}\n${formatReportsMoneyMx(value, true)} · ${pct.toFixed(0)}%`;
          },
        },
        labelLine: {
          length: 8,
          length2: 6,
          lineStyle: { color: P.axis },
        },
        data,
      },
    ],
  };
}
