import type { EChartsOption } from 'echarts';
import type { DashboardOperationalFlowPoint } from '@shared/models/api/api-dashboard-insights.model';
import {
  CHART_MUTED_EXPENSE,
  dashboardChartPrimary,
  rgbaFromHex,
} from '@features/dashboard/utils/dashboard-chart-colors';

const EXPENSES_COLOR = CHART_MUTED_EXPENSE;

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

function formatMoneyMx(value: number): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    maximumFractionDigits: 0,
  }).format(value);
}

export function buildDashboardOperationalFlowOption(
  points: readonly DashboardOperationalFlowPoint[],
  options?: { showExpenses?: boolean; primaryColor?: string },
): EChartsOption {
  const showExpenses = options?.showExpenses !== false;
  const primary = options?.primaryColor ?? dashboardChartPrimary();
  const labels = points.map((p) => formatFlowAxisLabel(p.date));
  const revenueValues = points.map((p) => p.revenue);
  const expenseValues = points.map((p) => p.expenses);

  const moneyAxisLabel = (v: number) =>
    new Intl.NumberFormat('es-MX', {
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(v);

  const series: EChartsOption['series'] = [
    {
      name: 'Ingresos',
      type: 'line',
      smooth: 0.35,
      showSymbol: false,
      yAxisIndex: 0,
      data: revenueValues,
      lineStyle: { width: 2.5, color: primary },
      areaStyle: {
        color: {
          type: 'linear',
          x: 0,
          y: 0,
          x2: 0,
          y2: 1,
            colorStops: [
              { offset: 0, color: rgbaFromHex(primary, 0.16) },
              { offset: 1, color: rgbaFromHex(primary, 0.02) },
            ],
        },
      },
    },
  ];

  if (showExpenses) {
    series.push({
      name: 'Gastos',
      type: 'line',
      smooth: 0.35,
      showSymbol: false,
      yAxisIndex: 0,
      data: expenseValues,
      lineStyle: { width: 2, type: 'dashed', color: EXPENSES_COLOR },
    });
  }

  return {
    animationDuration: 480,
    color: [primary, EXPENSES_COLOR],
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
      formatter: (params) => {
        if (!Array.isArray(params) || params.length === 0) {
          return '';
        }
        const title = String(params[0]?.name ?? '');
        const lines = params.map((p) => {
          const n = Number((p as { value?: number }).value) || 0;
          const seriesName = String((p as { seriesName?: string }).seriesName ?? '');
          return `${seriesName}: ${formatMoneyMx(n)}`;
        });
        return [title, ...lines].join('<br/>');
      },
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
      splitLine: { lineStyle: { color: '#e2e8f0', type: 'dashed' } },
      axisLabel: {
        color: '#94a3b8',
        fontSize: 10,
        formatter: moneyAxisLabel,
      },
    },
    series,
  };
}
