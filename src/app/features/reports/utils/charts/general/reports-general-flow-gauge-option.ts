import type { EChartsOption } from 'echarts';
import {
  type ReportsChartColorOptions,
  REPORTS_CHART_PALETTE,
  reportsChartGaugeTone,
  resolveReportsChartPrimary,
} from '../reports-chart-palette';

/** Ring Gauge — ejecución operativa del periodo (staff). */
export function buildReportsGeneralFlowGaugeOption(
  completed: number,
  scheduled: number,
  options?: ReportsChartColorOptions,
): EChartsOption {
  const P = REPORTS_CHART_PALETTE;
  const primary = resolveReportsChartPrimary(options);
  const denominator = Math.max(completed + scheduled, 1);
  const pct = Math.round((completed / denominator) * 1000) / 10;
  const tone = reportsChartGaugeTone(pct, primary);

  return {
    animationDuration: 520,
    series: [
      {
        type: 'gauge',
        startAngle: 90,
        endAngle: -270,
        radius: '88%',
        center: ['50%', '54%'],
        pointer: { show: false },
        progress: {
          show: true,
          overlap: false,
          roundCap: true,
          clip: false,
          itemStyle: { color: tone },
        },
        axisLine: {
          lineStyle: {
            width: 14,
            color: [[1, P.gaugeTrack]],
          },
        },
        splitLine: { show: false },
        axisTick: { show: false },
        axisLabel: { show: false },
        title: {
          fontSize: 11,
          fontWeight: 600,
          color: P.axisLabel,
          offsetCenter: [0, '28%'],
        },
        detail: {
          valueAnimation: true,
          fontSize: 21,
          fontWeight: 700,
          color: P.text,
          offsetCenter: [0, '-4%'],
          formatter: '{value}%',
        },
        data: [{ value: pct, name: 'Completadas vs programadas' }],
      },
    ],
  };
}
