import type { EChartsOption } from 'echarts';
import type { DashboardOperationMixSlice } from '@shared/models/api/api-dashboard-insights.model';
import {
  REPORTS_CHART_PALETTE,
  reportsChartOnFillLabelStyle,
  reportsChartSeriesColors,
  reportsChartTooltip,
} from '../reports-chart-palette';

type SunburstNode = {
  name: string;
  value?: number;
  children?: SunburstNode[];
  itemStyle?: { color?: string };
};

function operationTypeGroupLabel(
  type: string,
  rows: readonly DashboardOperationMixSlice[],
): string {
  const code = type.trim().toLowerCase();
  if (code === 'full') {
    return 'Doble articulado';
  }
  if (code === 'sencillo') {
    return 'Sencillo';
  }
  return rows[0]?.label?.trim() || type || 'Otros';
}

function sunburstSegmentLabelStyle(
  fontSize: number,
  fontWeight: 400 | 500 | 600 | 700 = 600,
) {
  return {
    show: true,
    rotate: 'radial' as const,
    ...reportsChartOnFillLabelStyle({ fontSize, fontWeight }),
  };
}

/** Sunburst — mix jerárquico con tonos contenidos. */
export function buildReportsGeneralMixSunburstOption(
  slices: readonly DashboardOperationMixSlice[],
  total: number,
  colorOffset = 0,
): EChartsOption {
  const P = REPORTS_CHART_PALETTE;
  const colors = reportsChartSeriesColors(Math.max(slices.length, 4), colorOffset);

  const byType = new Map<string, DashboardOperationMixSlice[]>();
  for (const slice of slices) {
    const key = slice.operationType?.trim() || 'otros';
    const list = byType.get(key) ?? [];
    list.push(slice);
    byType.set(key, list);
  }

  let colorIdx = 0;
  const children: SunburstNode[] = [...byType.entries()].map(([type, rows]) => {
    const parentColor = colors[colorIdx % colors.length] ?? P.primary;
    colorIdx++;
    const typeLabel = operationTypeGroupLabel(type, rows);
    return {
      name: typeLabel,
      itemStyle: { color: parentColor },
      children: rows.map((row, i) => ({
        name: row.label,
        value: row.count,
        itemStyle: {
          color: colors[(colorIdx + i) % colors.length] ?? parentColor,
        },
      })),
    };
  });

  return {
    animationDuration: 480,
    title: {
      text: String(total),
      subtext: 'MANIOBRAS',
      left: '50%',
      top: '46%',
      textAlign: 'center',
      textStyle: { fontSize: 17, fontWeight: 700, color: P.text },
      subtextStyle: { fontSize: 8, fontWeight: 600, color: P.axis },
    },
    tooltip: {
      trigger: 'item',
      ...reportsChartTooltip(),
      formatter: (p) => {
        if (!p || typeof p !== 'object') {
          return '';
        }
        const name = String((p as { name?: string }).name ?? '');
        const value = Number((p as { value?: number }).value) || 0;
        const pct = Number((p as { percent?: number }).percent) || 0;
        return `${name}<br/>${value} · ${pct.toFixed(0)}%`;
      },
    },
    series: [
      {
        type: 'sunburst',
        radius: ['22%', '88%'],
        center: ['50%', '52%'],
        sort: undefined,
        emphasis: { focus: 'ancestor', itemStyle: { opacity: 0.92 } },
        data: children,
        label: {
          minAngle: 8,
          ...sunburstSegmentLabelStyle(10),
        },
        itemStyle: {
          borderRadius: 6,
          borderWidth: 2,
          borderColor: P.surface,
        },
        levels: [
          {},
          {
            r0: '22%',
            r: '52%',
            label: sunburstSegmentLabelStyle(10),
          },
          {
            r0: '52%',
            r: '88%',
            label: sunburstSegmentLabelStyle(9, 500),
          },
        ],
      },
    ],
  };
}
