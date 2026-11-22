import type { EChartsOption } from 'echarts';
import type { DashboardTopDestination } from '@shared/models/api/api-dashboard-insights.model';
import {
  dashboardChartPrimary,
  rgbaFromHex,
  softenChartColor,
} from '@features/dashboard/utils/dashboard-chart-colors';

const TOP_N = 3;
const BAR_MAX_WIDTH = 40;

function formatCountAxis(value: number): string {
  const n = Number(value);
  if (!Number.isFinite(n)) {
    return '';
  }
  if (n >= 1000) {
    const k = n / 1000;
    return Number.isInteger(k) ? `${k}k` : `${k.toFixed(1).replace(/\.0$/, '')}k`;
  }
  return String(n);
}

function shortDestinationLabel(name: string, maxLen = 14): string {
  const t = name.trim();
  if (t.length <= maxLen) {
    return t;
  }
  return `${t.slice(0, maxLen - 1)}…`;
}

/** Barras secundarias: mismo navy, más tenue (sin degradado). */
function mutedBarColor(primary: string): string {
  return softenChartColor(primary, 0.52);
}

export function buildDashboardTopDestinationsOption(
  rows: readonly DashboardTopDestination[],
  options?: { primaryColor?: string },
): EChartsOption {
  const barColor = options?.primaryColor ?? dashboardChartPrimary();
  const top = [...rows]
    .filter((r) => r.tripCount > 0 && r.destination.trim())
    .sort((a, b) => b.tripCount - a.tripCount)
    .slice(0, TOP_N);

  const labels = top.map((r) => shortDestinationLabel(r.destination));
  const values = top.map((r) => r.tripCount);
  const maxValue = Math.max(...values, 1);
  const leaderIndex = values.length > 0 ? 0 : -1;
  const barTopRadius = 6;
  const barMuted = mutedBarColor(barColor);

  const seriesData = values.map((count, index) => {
    const isLeader = index === leaderIndex;
    return {
      value: count,
      itemStyle: {
        color: isLeader ? barColor : barMuted,
        borderRadius: [barTopRadius, barTopRadius, 0, 0],
      },
      emphasis: {
        itemStyle: {
          color: isLeader ? barColor : softenChartColor(barColor, 0.4),
          borderRadius: [barTopRadius, barTopRadius, 0, 0],
        },
      },
    };
  });

  return {
    animationDuration: 480,
    color: [barColor],
    grid: { left: 8, right: 8, top: 16, bottom: 28, containLabel: true },
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'shadow',
        shadowStyle: { color: rgbaFromHex(barColor, 0.06) },
      },
      confine: true,
      backgroundColor: barColor,
      borderColor: barColor,
      borderWidth: 0,
      padding: [8, 12],
      textStyle: {
        color: '#ffffff',
        fontSize: 12,
        fontWeight: 600,
      },
      extraCssText:
        'border-radius: 10px; box-shadow: 0 6px 18px rgba(17, 24, 39, 0.22);',
      formatter: (params) => {
        const p = Array.isArray(params) ? params[0] : params;
        if (!p || typeof p !== 'object' || !('dataIndex' in p)) {
          return '';
        }
        const index = Number((p as { dataIndex?: number }).dataIndex);
        const row = top[index];
        if (!row) {
          return '';
        }
        const count = Number((p as { value?: number }).value) || 0;
        const label = count === 1 ? 'maniobra' : 'maniobras';
        return `${row.destination}\n${count} ${label}`;
      },
    },
    xAxis: {
      type: 'category',
      data: labels,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        color: '#64748b',
        fontSize: 10,
        fontWeight: 600,
        interval: 0,
        width: 72,
        overflow: 'truncate',
      },
    },
    yAxis: {
      type: 'value',
      min: 0,
      max: Math.ceil(maxValue * 1.15),
      splitLine: {
        show: true,
        lineStyle: {
          type: 'dashed',
          color: '#e2e8f0',
          width: 1,
        },
      },
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        color: '#94a3b8',
        fontSize: 10,
        formatter: (value) => formatCountAxis(Number(value)),
      },
    },
    series: [
      {
        type: 'bar',
        data: seriesData,
        barMaxWidth: BAR_MAX_WIDTH,
        barCategoryGap: '38%',
        itemStyle: {
          borderRadius: [barTopRadius, barTopRadius, 0, 0],
        },
        emphasis: {
          focus: 'self',
        },
      },
    ],
  };
}