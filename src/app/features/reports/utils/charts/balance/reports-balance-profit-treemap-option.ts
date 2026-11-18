import type { EChartsOption } from 'echarts';
import type { ReportsBalanceProfitability } from '@shared/models/api/api-reports-balance.model';
import { APP_CHART_SEMANTIC } from '@shared/charts/app-chart-palette';
import {
  type ReportsChartColorOptions,
  REPORTS_CHART_PALETTE,
  reportsChartLabelIsLightFill,
  reportsChartOnFillLabelStyle,
  reportsChartSemanticColors,
  reportsChartTooltip,
  resolveReportsChartPrimary,
} from '../reports-chart-palette';
import { formatReportsMoneyMx } from '../reports-chart-axis.util';

const TILE = {
  revenue: APP_CHART_SEMANTIC.revenue,
  directCost: '#4A6278',
  tripExpenses: APP_CHART_SEMANTIC.danger,
  margin: APP_CHART_SEMANTIC.success,
} as const;

function treemapLabelForFill(color: string) {
  const lightFill = reportsChartLabelIsLightFill(color);
  return {
    show: true,
    position: 'inside' as const,
    overflow: 'truncate' as const,
    ...reportsChartOnFillLabelStyle({
      fontSize: 11,
      fontWeight: 600,
      lightFill,
    }),
    formatter: (p: { name?: string; value?: number }) => {
      const name = String(p.name ?? '');
      const value = Number(p.value) || 0;
      if (value <= 0.001) {
        return name;
      }
      return `${name}\n${formatReportsMoneyMx(value, true)}`;
    },
  };
}

function marginCenterColors(marginPct: number | null | undefined): {
  accent: string;
  value: string;
  muted: string;
  ring: string;
} {
  const P = REPORTS_CHART_PALETTE;
  const sem = reportsChartSemanticColors();
  if (marginPct == null) {
    return {
      accent: P.textMuted,
      value: P.textMuted,
      muted: P.axis,
      ring: P.grid,
    };
  }
  if (marginPct < 0) {
    return {
      accent: APP_CHART_SEMANTIC.danger,
      value: APP_CHART_SEMANTIC.danger,
      muted: P.textMuted,
      ring: APP_CHART_SEMANTIC.danger,
    };
  }
  if (marginPct < 15) {
    return {
      accent: sem.warning,
      value: P.text,
      muted: P.textMuted,
      ring: sem.warning,
    };
  }
  return {
    accent: TILE.margin,
    value: P.text,
    muted: P.textMuted,
    ring: TILE.margin,
  };
}

/** Treemap — utilidad del periodo (ingreso vs costos de maniobra). */
export function buildReportsBalanceProfitTreemapOption(
  data: ReportsBalanceProfitability | null | undefined,
  options?: ReportsChartColorOptions,
): EChartsOption {
  const P = REPORTS_CHART_PALETTE;
  const primary = resolveReportsChartPrimary(options);
  const revenue = Math.max(data?.revenue ?? 0, 0);
  const directCost = Math.max(data?.directCost ?? 0, 0);
  const tripExpenses = Math.max(data?.tripExpenses ?? 0, 0);
  const margin = data?.margin ?? 0;
  const marginPct = data?.marginPercent;
  const marginTitle =
    marginPct == null ? 'Margen: —' : `Margen: ${marginPct}%`;

  const children: {
    name: string;
    value: number;
    itemStyle?: { color: string; borderColor?: string };
    label?: Record<string, unknown>;
  }[] = [];

  const pushChild = (name: string, value: number, color: string): void => {
    children.push({
      name,
      value,
      itemStyle: {
        color,
        borderColor: P.surface,
      },
      label: treemapLabelForFill(color),
    });
  };

  pushChild('Ingreso pactado', revenue || 1, primary);
  pushChild(
    'Costo directo',
    directCost || (revenue > 0 ? 0.001 : 1),
    TILE.directCost,
  );

  if (tripExpenses > 0) {
    pushChild('Gastos de maniobra', tripExpenses, TILE.tripExpenses);
  }

  if (margin > 0) {
    pushChild('Utilidad', margin, TILE.margin);
  }

  const center = marginCenterColors(marginPct);

  return {
    animationDuration: 480,
    title: {
      text: marginTitle,
      left: 'center',
      top: 'middle',
      textAlign: 'center',
      textVerticalAlign: 'middle',
      padding: [10, 16, 10, 16],
      backgroundColor: 'rgba(255, 255, 255, 0.98)',
      borderColor: center.ring,
      borderWidth: 2,
      borderRadius: 12,
      textStyle: {
        fontSize: 15,
        fontWeight: 700,
        color: center.value,
        lineHeight: 20,
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
        left: 4,
        right: 4,
        top: 8,
        bottom: 8,
        width: '100%',
        height: '100%',
        squareRatio: 0.52,
        label: { show: false },
        upperLabel: { show: false },
        itemStyle: {
          borderColor: P.surface,
          borderWidth: 3,
          gapWidth: 3,
          borderRadius: 6,
        },
        levels: [
          {
            itemStyle: {
              borderWidth: 0,
              gapWidth: 4,
            },
          },
          {
            itemStyle: {
              borderWidth: 3,
              gapWidth: 3,
              borderRadius: 6,
            },
            colorSaturation: [0.92, 0.72],
            colorAlpha: [1, 0.96],
          },
        ],
        data: [{ name: 'Periodo', children }],
      },
    ],
  };
}