import type { EChartsOption } from 'echarts';
import type { ReportsManiobrasCargoWeightRow } from '@shared/models/api/api-reports-maniobras.model';
import { STITCH_PALETTE } from '@features/dashboard/utils/dashboard-chart-colors';
import {
  reportsChartLabelIsLightFill,
  reportsChartOnFillLabelStyle,
  reportsChartTooltip,
  reportsChartValueAxis,
} from '../reports-chart-palette';
import { reportsFintechCategoryAxis } from '../reports-chart-theme.util';

function formatTons(value: number): string {
  return `${new Intl.NumberFormat('es-MX', { maximumFractionDigits: 2 }).format(value)} t`;
}

/** Basic Bar — peso promedio de carga (ton) por tipo de contenedor. */
export function buildReportsManiobrasCargoWeightBarOption(
  rows: readonly ReportsManiobrasCargoWeightRow[],
): EChartsOption {
  const ordered = [...rows]
    .filter((row) => row.avgWeightTons > 0)
    .sort((a, b) => b.avgWeightTons - a.avgWeightTons);
  const labels = ordered.map((row) => row.label);
  const values = ordered.map((row) => row.avgWeightTons);
  const max = Math.max(...values, 0.1);
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
        const idx = Number((p as { dataIndex?: number }).dataIndex) || 0;
        const row = ordered[idx];
        const tons = Number((p as { value?: number }).value) || 0;
        const count = row?.tripCount ?? 0;
        const tripLabel = count === 1 ? 'maniobra' : 'maniobras';
        return `${String((p as { name?: string }).name ?? '')}<br/>${formatTons(tons)} promedio · ${count} ${tripLabel}`;
      },
    },
    xAxis: reportsFintechCategoryAxis(labels, {
      rotate: labels.length > 3 ? 24 : 0,
      width: 88,
      showAllLabels: true,
    }),
    yAxis: {
      ...valueAxis,
      max: Math.ceil(max * 1.12 * 10) / 10,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        ...valueAxis.axisLabel,
        formatter: (v: number) => formatTons(Number(v) || 0),
      },
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
              formatter: () => formatTons(v),
            },
          };
        }),
        barMaxWidth: 40,
      },
    ],
  };
}
