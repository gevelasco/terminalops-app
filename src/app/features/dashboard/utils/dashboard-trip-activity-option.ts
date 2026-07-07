import type { EChartsOption } from 'echarts';
import type { DashboardTripActivityPoint } from '@shared/models/api/api-dashboard-insights.model';
import {
  CHART_MUTED_EXPENSE,
  CHART_MUTED_IN_TRANSIT,
  CHART_MUTED_SCHEDULED,
  dashboardChartPrimary,
  rgbaFromHex,
} from '@features/dashboard/utils/dashboard-chart-colors';

function formatFlowAxisLabel(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map((v) => Number(v));
  if (!y || !m || !d) {
    return dateKey;
  }
  const dt = new Date(y, m - 1, d);
  const day = new Intl.DateTimeFormat('es-MX', { day: '2-digit' }).format(dt);
  const month = new Intl.DateTimeFormat('es-MX', { month: 'short' })
    .format(dt)
    .replace('.', '')
    .toUpperCase();
  return `${day} ${month}`;
}

export function buildDashboardTripActivityOption(
  points: readonly DashboardTripActivityPoint[],
  options?: { primaryColor?: string },
): EChartsOption {
  const primary = options?.primaryColor ?? dashboardChartPrimary();
  const labels = points.map((p) => formatFlowAxisLabel(p.date));
  const completedValues = points.map((p) => p.completed);
  const inTransitValues = points.map((p) => p.inTransit);
  const scheduledValues = points.map((p) => p.scheduled);

  return {
    animationDuration: 480,
    color: [primary, CHART_MUTED_IN_TRANSIT, CHART_MUTED_SCHEDULED],
    grid: { left: 8, right: 12, top: 36, bottom: 4, containLabel: true },
    legend: {
      top: 0,
      left: 0,
      itemWidth: 14,
      itemHeight: 8,
      textStyle: { fontSize: 11, color: '#64748b' },
    },
    tooltip: {
      trigger: 'axis',
      confine: true,
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: labels,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        color: '#94a3b8',
        fontSize: 10,
        interval: Math.max(0, Math.floor(labels.length / 6) - 1),
      },
    },
    yAxis: {
      type: 'value',
      minInterval: 1,
      splitLine: { lineStyle: { color: '#e2e8f0', type: 'dashed' } },
      axisLabel: { color: '#94a3b8', fontSize: 10 },
    },
    series: [
      {
        name: 'Completadas',
        type: 'line',
        smooth: 0.35,
        showSymbol: false,
        data: completedValues,
        lineStyle: { width: 2.5, color: primary },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: rgbaFromHex(primary, 0.14) },
              { offset: 1, color: rgbaFromHex(primary, 0.02) },
            ],
          },
        },
      },
      {
        name: 'En curso',
        type: 'line',
        smooth: 0.35,
        showSymbol: false,
        data: inTransitValues,
        lineStyle: { width: 2, color: CHART_MUTED_IN_TRANSIT },
      },
      {
        name: 'Programadas',
        type: 'line',
        smooth: 0.35,
        showSymbol: false,
        data: scheduledValues,
        lineStyle: { width: 2, type: 'dashed', color: CHART_MUTED_SCHEDULED },
      },
    ],
  };
}
