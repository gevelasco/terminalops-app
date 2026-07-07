import type { EChartsOption } from 'echarts';
import type { DashboardTripActivityPoint } from '@shared/models/api/api-dashboard-insights.model';
import {
  type ReportsChartColorOptions,
  REPORTS_CHART_PALETTE,
  reportsChartLegend,
  reportsChartSemanticColors,
  reportsChartTooltip,
  reportsChartValueAxis,
  resolveReportsChartPrimary,
  rgbaFromHex,
} from '../reports-chart-palette';
import {
  formatReportsChartAxisDate,
  reportsChartAxisInterval,
  reportsFintechCategoryAxis,
} from '../reports-chart-theme.util';

/** Basic Line — actividad diaria del periodo (series sólidas, sin área). */
export function buildReportsGeneralActivityAreaOption(
  points: readonly DashboardTripActivityPoint[],
  options?: ReportsChartColorOptions,
): EChartsOption {
  const labels = points.map((p) => formatReportsChartAxisDate(p.date));
  const valueAxis = reportsChartValueAxis();
  const P = REPORTS_CHART_PALETTE;
  const sem = reportsChartSemanticColors(resolveReportsChartPrimary(options));
  const primary = sem.completed;

  return {
    animationDuration: 520,
    color: [sem.completed, sem.inTransit, sem.scheduled],
    grid: { left: 8, right: 12, top: 36, bottom: 4, containLabel: true },
    legend: reportsChartLegend(),
    tooltip: { trigger: 'axis', ...reportsChartTooltip() },
    xAxis: {
      ...reportsFintechCategoryAxis(labels),
      boundaryGap: false,
      axisLabel: {
        color: P.axis,
        fontSize: 10,
        interval: reportsChartAxisInterval(labels.length),
      },
    },
    yAxis: { ...valueAxis, minInterval: 1 },
    series: [
      {
        name: 'Completadas',
        type: 'line',
        smooth: 0.35,
        showSymbol: false,
        data: points.map((p) => p.completed),
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
        data: points.map((p) => p.inTransit),
        lineStyle: { width: 2, color: sem.inTransit },
      },
      {
        name: 'Programadas',
        type: 'line',
        smooth: 0.35,
        showSymbol: false,
        data: points.map((p) => p.scheduled),
        lineStyle: { width: 2, type: 'dashed', color: sem.scheduled },
      },
    ],
  };
}
