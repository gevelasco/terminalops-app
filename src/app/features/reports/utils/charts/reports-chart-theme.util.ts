import {
  REPORTS_CHART_PALETTE,
  reportsChartActivityAreaPieces,
  reportsChartLegend,
  reportsChartPrimaryGradient,
  reportsChartValueAxis,
} from './reports-chart-palette';
import { formatReportsChartAxisDate, reportsChartAxisInterval } from './reports-chart-axis.util';

/** Estilos de ejes compartidos en gráficas de reportes. */
export const REPORTS_CHART_AXIS = {
  categoryLabel: {
    color: REPORTS_CHART_PALETTE.axisLabel,
    fontSize: 10,
  },
  categoryLabelCompact: {
    color: REPORTS_CHART_PALETTE.axisLabel,
    fontSize: 9,
  },
  hiddenLine: { show: false },
} as const;

export { formatReportsChartAxisDate, reportsChartAxisInterval };

export function reportsFintechCategoryAxis(
  labels: string[],
  options?: { rotate?: number; width?: number; showAllLabels?: boolean },
): {
  type: 'category';
  data: string[];
  axisLine: { show: boolean };
  axisTick: { show: boolean };
  axisLabel: {
    color: string;
    fontSize: number;
    interval: number;
    rotate?: number;
    width?: number;
    overflow?: 'truncate';
  };
} {
  return {
    type: 'category',
    data: labels,
    axisLine: REPORTS_CHART_AXIS.hiddenLine,
    axisTick: REPORTS_CHART_AXIS.hiddenLine,
    axisLabel: {
      ...REPORTS_CHART_AXIS.categoryLabel,
      interval: options?.showAllLabels ? 0 : reportsChartAxisInterval(labels.length),
      ...(options?.rotate != null ? { rotate: options.rotate } : {}),
      ...(options?.width != null ? { width: options.width, overflow: 'truncate' } : {}),
    },
  };
}

export {
  reportsChartActivityAreaPieces,
  reportsChartLegend,
  reportsChartPrimaryGradient,
  reportsChartValueAxis,
};
