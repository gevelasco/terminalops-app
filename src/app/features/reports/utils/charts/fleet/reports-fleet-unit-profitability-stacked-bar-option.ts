import type { EChartsOption } from 'echarts';
import type { ReportsFleetUnitProfitabilityRow } from '@shared/models/api/api-reports-fleet.model';
import {
  type ReportsChartColorOptions,
  REPORTS_CHART_PALETTE,
  reportsChartFinancialColors,
  reportsChartLegend,
  reportsChartTooltip,
  reportsChartValueAxis,
  resolveReportsChartPrimary,
} from '../reports-chart-palette';
import { formatReportsMoneyMx } from '../reports-chart-axis.util';

const COST_SERIES = [
  { key: 'diesel' as const, name: 'Diésel' },
  { key: 'operator' as const, name: 'Operador' },
  { key: 'tolls' as const, name: 'Casetas' },
  { key: 'maintenance' as const, name: 'Mantenimiento' },
  { key: 'tires' as const, name: 'Llantas' },
];

/** Barras apiladas — ingreso desglosado en costos y utilidad real por unidad. */
export function buildReportsFleetUnitProfitabilityStackedBarOption(
  rows: readonly ReportsFleetUnitProfitabilityRow[],
  options?: ReportsChartColorOptions,
): EChartsOption {
  const P = REPORTS_CHART_PALETTE;
  const financial = reportsChartFinancialColors(resolveReportsChartPrimary(options));
  const valueAxis = reportsChartValueAxis();

  const ordered = [...rows]
    .filter(
      (row) =>
        row.revenue > 0 ||
        row.netMargin !== 0 ||
        row.diesel > 0 ||
        row.operator > 0 ||
        row.tolls > 0 ||
        row.maintenance > 0 ||
        row.tires > 0,
    )
    .sort((a, b) => b.netMargin - a.netMargin || b.revenue - a.revenue)
    .slice(0, 8);

  const labels = ordered.map((row) => row.unitLabel);
  const maxTotal = Math.max(
    ...ordered.map((row) =>
      Math.max(
        row.revenue,
        row.diesel + row.operator + row.tolls + row.maintenance + row.tires,
        0,
      ),
    ),
    1,
  );

  const costColors = [
    financial.expense,
    P.expenseDark,
    P.warning,
    REPORTS_CHART_PALETTE.primaryLight,
    P.axis,
  ];

  const costSeries = COST_SERIES.map((series, index) => ({
    name: series.name,
    type: 'bar' as const,
    stack: 'unit',
    barMaxWidth: 18,
    itemStyle: {
      color: costColors[index % costColors.length],
      borderRadius: index === COST_SERIES.length - 1 ? [0, 0, 0, 0] : 0,
    },
    data: ordered.map((row) => row[series.key]),
  }));

  return {
    animationDuration: 480,
    color: [...costColors, financial.margin, financial.revenue],
    grid: { left: 8, right: 16, top: 36, bottom: 8, containLabel: true },
    legend: {
      ...reportsChartLegend(),
      top: 0,
      itemWidth: 10,
      itemHeight: 8,
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow', shadowStyle: { color: 'rgba(30,41,59,0.06)' } },
      ...reportsChartTooltip(),
      formatter: (params) => {
        if (!Array.isArray(params) || params.length === 0) {
          return '';
        }
        const idx = Number(params[0]?.dataIndex) || 0;
        const row = ordered[idx];
        if (!row) {
          return '';
        }
        const lines = [
          String(params[0]?.name ?? ''),
          `Ingreso generado: ${formatReportsMoneyMx(row.revenue)}`,
          `Diésel: ${formatReportsMoneyMx(row.diesel)}`,
          `Operador: ${formatReportsMoneyMx(row.operator)}`,
          `Casetas: ${formatReportsMoneyMx(row.tolls)}`,
          `Mantenimiento: ${formatReportsMoneyMx(row.maintenance)}`,
          `Llantas: ${formatReportsMoneyMx(row.tires)}`,
          `Utilidad real: ${formatReportsMoneyMx(row.netMargin)}`,
        ];
        if (row.marginPercent != null) {
          lines.push(`Margen: ${row.marginPercent}%`);
        }
        return lines.join('<br/>');
      },
    },
    xAxis: {
      ...valueAxis,
      max: Math.ceil(maxTotal * 1.08),
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        ...valueAxis.axisLabel,
        formatter: (value: number) => formatReportsMoneyMx(value, true),
      },
    },
    yAxis: {
      type: 'category',
      data: labels,
      inverse: true,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        color: P.axisLabel,
        fontSize: 10,
        fontWeight: 600,
        width: 88,
        overflow: 'truncate',
      },
    },
    series: [
      ...costSeries,
      {
        name: 'Utilidad real',
        type: 'bar',
        stack: 'unit',
        barMaxWidth: 18,
        data: ordered.map((row) => ({
          value: row.netMargin,
          itemStyle: {
            color: row.netMargin >= 0 ? financial.margin : P.danger,
            borderRadius: [0, 4, 4, 0],
          },
        })),
      },
    ],
  };
}
