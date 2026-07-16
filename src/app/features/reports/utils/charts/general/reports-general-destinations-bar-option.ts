import type { EChartsOption } from 'echarts';
import type { DashboardTopDestination } from '@shared/models/api/api-dashboard-insights.model';
import { STITCH_PALETTE } from '@features/dashboard/utils/dashboard-chart-colors';
import {
  reportsChartLabelIsLightFill,
  reportsChartOnFillLabelStyle,
  reportsChartTooltip,
  reportsChartValueAxis,
} from '../reports-chart-palette';
import { reportsFintechCategoryAxis } from '../reports-chart-theme.util';

/** Basic Bar — destinos con más maniobras completadas en el periodo. */
export function buildReportsGeneralDestinationsBarOption(
  rows: readonly DashboardTopDestination[],
): EChartsOption {
  const ordered = [...rows].sort((a, b) => b.tripCount - a.tripCount).slice(0, 8);
  const labels = ordered.map((r) => r.destination);
  const values = ordered.map((r) => r.tripCount);
  const max = Math.max(...values, 1);
  const valueAxis = reportsChartValueAxis();

  return {
    animationDuration: 460,
    grid: { left: 8, right: 8, top: 12, bottom: 4, containLabel: true },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow', shadowStyle: { color: 'rgba(30,41,59,0.06)' } },
      ...reportsChartTooltip(),
      formatter: (params) => {
        const p = Array.isArray(params) ? params[0] : params;
        if (!p || typeof p !== 'object' || !('name' in p)) {
          return '';
        }
        const count = Number((p as { value?: number }).value) || 0;
        const label = count === 1 ? 'maniobra' : 'maniobras';
        return `${String((p as { name?: string }).name ?? '')}<br/>${count} ${label}`;
      },
    },
    xAxis: reportsFintechCategoryAxis(labels, {
      rotate: labels.length > 4 ? 28 : 0,
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
        data: values.map((v, i) => {
          const c = STITCH_PALETTE[i % STITCH_PALETTE.length];
          return {
            value: v,
            itemStyle: { color: c, borderRadius: [4, 4, 0, 0] },
            label: {
              show: true,
              position: 'insideTop' as const,
              padding: [4, 0, 0, 0],
              ...reportsChartOnFillLabelStyle({
                fontSize: 10,
                lightFill: reportsChartLabelIsLightFill(c),
              }),
              formatter: () => String(v),
            },
          };
        }),
        barMaxWidth: 40,
      },
    ],
  };
}
