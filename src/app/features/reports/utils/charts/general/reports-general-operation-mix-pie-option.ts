import type { EChartsOption } from 'echarts';
import type { DashboardOperationMixSlice } from '@shared/models/api/api-dashboard-insights.model';
import {
  type ReportsChartColorOptions,
  REPORTS_CHART_PALETTE,
  reportsChartOutsideLabelStyle,
  reportsChartSeriesColors,
  reportsChartTooltip,
  resolveReportsChartPrimary,
} from '../reports-chart-palette';

/** Donut — configuración de maniobras (mismo estilo que movimiento del periodo en Balance). */
export function buildReportsGeneralOperationMixPieOption(
  slices: readonly DashboardOperationMixSlice[],
  colorOffset = 0,
  options?: ReportsChartColorOptions,
): EChartsOption {
  const P = REPORTS_CHART_PALETTE;
  const primary = resolveReportsChartPrimary(options);
  const colors = reportsChartSeriesColors(Math.max(slices.length, 4), colorOffset, primary);
  const data = slices
    .filter((slice) => slice.count > 0)
    .map((slice, index) => ({
      name: slice.label?.trim() || slice.operationType || 'Sin tipo',
      value: slice.count,
      itemStyle: {
        color: colors[index % colors.length],
      },
    }));

  const total = data.reduce((sum, item) => sum + item.value, 0);

  return {
    animationDuration: 480,
    color: colors,
    title: total
      ? {
          text: String(total),
          subtext: 'MANIOBRAS',
          left: '50%',
          top: '46%',
          textAlign: 'center',
          textStyle: { fontSize: 17, fontWeight: 700, color: P.text },
          subtextStyle: { fontSize: 8, fontWeight: 600, color: P.axis },
        }
      : undefined,
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
        return `${name}<br/>${value} · ${pct.toFixed(0)}%`;
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
            const pct = Number((p as { percent?: number }).percent) || 0;
            return `${name}\n${pct.toFixed(0)}%`;
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
