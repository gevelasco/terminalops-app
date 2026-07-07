import type { EChartsOption } from 'echarts';
import type { ReportsBalanceProfitability } from '@shared/models/api/api-reports-balance.model';
import {
  type ReportsChartColorOptions,
  REPORTS_CHART_PALETTE,
  reportsChartFinancialColors,
  reportsChartAccentLabelStyle,
  reportsChartOnFillLabelStyle,
  reportsChartTooltip,
  resolveReportsChartPrimary,
} from '../reports-chart-palette';
import { formatReportsMoneyMx } from '../reports-chart-axis.util';

const treemapLabelStyle = {
  show: true,
  ...reportsChartOnFillLabelStyle({ fontSize: 11 }),
};

/** Treemap — utilidad del periodo (ingreso vs costos de maniobra). */
export function buildReportsBalanceProfitTreemapOption(
  data: ReportsBalanceProfitability | null | undefined,
  options?: ReportsChartColorOptions,
): EChartsOption {
  const P = REPORTS_CHART_PALETTE;
  const financial = reportsChartFinancialColors(resolveReportsChartPrimary(options));
  const revenue = Math.max(data?.revenue ?? 0, 0);
  const directCost = Math.max(data?.directCost ?? 0, 0);
  const tripExpenses = Math.max(data?.tripExpenses ?? 0, 0);
  const margin = Math.max(data?.margin ?? 0, 0);
  const marginPct = data?.marginPercent;

  const children: {
    name: string;
    value: number;
    itemStyle?: { color: string };
    label?: typeof treemapLabelStyle;
  }[] = [
    {
      name: 'Ingreso pactado',
      value: revenue || 1,
      itemStyle: { color: financial.revenue },
      label: treemapLabelStyle,
    },
    {
      name: 'Costo directo',
      value: directCost || (revenue > 0 ? 0.001 : 1),
      itemStyle: { color: financial.expense },
      label: treemapLabelStyle,
    },
  ];

  if (tripExpenses > 0) {
    children.push({
      name: 'Gastos de maniobra',
      value: tripExpenses,
      itemStyle: { color: P.expenseDark },
      label: treemapLabelStyle,
    });
  }

  if (margin > 0) {
    children.push({
      name: 'Utilidad',
      value: margin,
      itemStyle: { color: financial.margin },
      label: { show: true, ...reportsChartAccentLabelStyle({ fontSize: 11 }) },
    });
  }

  return {
    animationDuration: 480,
    title: {
      text: marginPct == null ? '—' : `${marginPct}%`,
      subtext: 'MARGEN',
      left: '50%',
      top: '46%',
      textAlign: 'center',
      textStyle: {
        fontSize: 17,
        fontWeight: 700,
        color: P.labelAccent,
        textShadowColor: 'rgba(23, 36, 63, 0.35)',
        textShadowBlur: 3,
      },
      subtextStyle: { fontSize: 8, fontWeight: 700, color: P.labelAccent },
    },
    tooltip: {
      ...reportsChartTooltip(),
      formatter: (info) => {
        const p = info as { name?: string; value?: number };
        const name = String(p.name ?? '');
        const value = Number(p.value) || 0;
        return `${name}<br/>${formatReportsMoneyMx(value)}`;
      },
    },
    series: [
      {
        type: 'treemap',
        roam: false,
        nodeClick: false,
        breadcrumb: { show: false },
        left: 0,
        right: 0,
        top: 4,
        bottom: 4,
        label: {
          ...treemapLabelStyle,
          formatter: (p) => {
            const name = String((p as { name?: string }).name ?? '');
            const value = Number((p as { value?: number }).value) || 0;
            return `${name}\n${formatReportsMoneyMx(value, true)}`;
          },
        },
        upperLabel: { show: false },
        itemStyle: {
          borderColor: P.surface,
          borderWidth: 2,
          gapWidth: 2,
        },
        levels: [
          { itemStyle: { borderWidth: 0, gapWidth: 4 } },
          { itemStyle: { borderWidth: 2, gapWidth: 2 } },
        ],
        data: [{ name: 'Periodo', children }],
      },
    ],
  };
}
