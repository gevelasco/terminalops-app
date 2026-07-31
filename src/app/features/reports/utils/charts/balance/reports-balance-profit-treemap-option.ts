import type { EChartsOption } from 'echarts';
import type { ReportsBalanceProfitability } from '@shared/models/api/api-reports-balance.model';
import { STITCH_PALETTE } from '@features/dashboard/utils/dashboard-chart-colors';
import {
  type ReportsChartColorOptions,
  REPORTS_CHART_PALETTE,
  reportsChartLabelIsLightFill,
  reportsChartOnFillLabelStyle,
  reportsChartTooltip,
} from '../reports-chart-palette';
import { formatReportsMoneyMx } from '../reports-chart-axis.util';

function treemapLabelForFill(color: string) {
  return {
    show: true,
    ...reportsChartOnFillLabelStyle({
      fontSize: 11,
      lightFill: reportsChartLabelIsLightFill(color),
    }),
  };
}

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

  const pushChild = (name: string, value: number): void => {
    const color = STITCH_PALETTE[children.length % STITCH_PALETTE.length];
    children.push({
      name,
      value,
      itemStyle: { color },
      label: treemapLabelForFill(color),
    });
  };

  pushChild('Ingreso pactado', revenue || 1);
  pushChild('Costo directo', directCost || (revenue > 0 ? 0.001 : 1));

  if (tripExpenses > 0) {
    pushChild('Gastos de maniobra', tripExpenses);
  }

  if (margin > 0) {
    pushChild('Utilidad', margin);
  }

  return {
    animationDuration: 480,
    title: {
      text: marginPct == null ? '—' : `${marginPct}%`,
      subtext: 'MARGEN',
      left: '50%',
      top: '44%',
      textAlign: 'center',
      // Pastilla del color del sidemenu: contraste fijo sobre tiles claros/oscuros.
      backgroundColor: 'rgba(17, 24, 39, 0.92)',
      borderRadius: 12,
      padding: [10, 16, 8, 16],
      textStyle: {
        fontSize: 18,
        fontWeight: 700,
        color: '#FFFFFF',
        textShadowColor: 'transparent',
        textShadowBlur: 0,
      },
      subtextStyle: {
        fontSize: 9,
        fontWeight: 700,
        color: 'rgba(255, 255, 255, 0.72)',
        textShadowColor: 'transparent',
        textShadowBlur: 0,
      },
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
          show: true,
          ...reportsChartOnFillLabelStyle({ fontSize: 11, lightFill: true }),
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
