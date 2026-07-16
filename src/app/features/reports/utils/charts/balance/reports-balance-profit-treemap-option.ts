import type { EChartsOption } from 'echarts';
import type { ReportsBalanceProfitability } from '@shared/models/api/api-reports-balance.model';
import { STITCH_PALETTE } from '@features/dashboard/utils/dashboard-chart-colors';
import {
  type ReportsChartColorOptions,
  REPORTS_CHART_PALETTE,
  reportsChartAccentLabelStyle,
  reportsChartOnFillLabelStyle,
  reportsChartTooltip,
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
  const revenue = Math.max(data?.revenue ?? 0, 0);
  const directCost = Math.max(data?.directCost ?? 0, 0);
  const tripExpenses = Math.max(data?.tripExpenses ?? 0, 0);
  const margin = Math.max(data?.margin ?? 0, 0);
  const marginPct = data?.marginPercent;

  const children: {
    name: string;
    value: number;
    itemStyle?: { color: string };
    label?: Record<string, unknown>;
  }[] = [];

  const pushChild = (
    name: string,
    value: number,
    label: Record<string, unknown>,
  ): void => {
    const color = STITCH_PALETTE[children.length % STITCH_PALETTE.length];
    children.push({ name, value, itemStyle: { color }, label });
  };

  pushChild('Ingreso pactado', revenue || 1, treemapLabelStyle);
  pushChild(
    'Costo directo',
    directCost || (revenue > 0 ? 0.001 : 1),
    treemapLabelStyle,
  );

  if (tripExpenses > 0) {
    pushChild('Gastos de maniobra', tripExpenses, treemapLabelStyle);
  }

  if (margin > 0) {
    pushChild('Utilidad', margin, {
      show: true,
      ...reportsChartAccentLabelStyle({ fontSize: 11 }),
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
