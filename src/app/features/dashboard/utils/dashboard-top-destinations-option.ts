import type { EChartsOption } from 'echarts';
import type { DashboardTopDestination } from '@shared/models/api/api-dashboard-insights.model';
import {
  dashboardChartPrimary,
  dashboardDestinationBarWidth,
} from '@features/dashboard/utils/dashboard-chart-colors';

export function buildDashboardTopDestinationsOption(
  rows: readonly DashboardTopDestination[],
  options?: { primaryColor?: string },
): EChartsOption {
  const barColor = options?.primaryColor ?? dashboardChartPrimary();
  const ordered = [...rows].sort((a, b) => a.tripCount - b.tripCount);
  const labels = ordered.map((r) => r.destination);
  const values = ordered.map((r) => r.tripCount);
  const max = Math.max(...values, 1);
  const barWidth = dashboardDestinationBarWidth(labels.length);

  return {
    animationDuration: 420,
    color: [barColor],
    grid: { left: 4, right: 56, top: 8, bottom: 4, containLabel: true },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      confine: true,
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
    xAxis: {
      type: 'value',
      max: Math.ceil(max * 1.08),
      splitLine: { show: false },
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { show: false },
    },
    yAxis: {
      type: 'category',
      data: labels,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        color: '#334155',
        fontSize: 10,
        width: 148,
        overflow: 'truncate',
        lineHeight: 13,
      },
    },
    series: [
      {
        type: 'bar',
        data: values,
        barWidth,
        itemStyle: {
          color: barColor,
          borderRadius: [0, 4, 4, 0],
        },
        label: {
          show: true,
          position: 'right',
          color: '#64748b',
          fontSize: 10,
          formatter: (p) => {
            const n = Number(p.value) || 0;
            return n === 1 ? '1 maniobra' : `${n} maniobras`;
          },
        },
      },
    ],
  };
}
