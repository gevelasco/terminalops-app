import type {
  CustomSeriesRenderItemAPI,
  CustomSeriesRenderItemParams,
  CustomSeriesRenderItemReturn,
  EChartsOption,
} from 'echarts';
import {
  type ReportsChartColorOptions,
  REPORTS_CHART_PALETTE,
  reportsChartFinancialColors,
  reportsChartOnFillLabelStyle,
  reportsChartTooltip,
  resolveReportsChartPrimary,
} from '../reports-chart-palette';
import { formatReportsMoneyMx } from '../reports-chart-axis.util';

/** Grupo superior — ingresos del periodo. */
export const PERIOD_INCOME_GROUP_LABEL = 'Ingresos';
/** Grupo superior — egresos del periodo. */
export const PERIOD_EXPENSE_GROUP_LABEL = 'Gastos';
/** Cobro confirmado al cliente (maniobras completadas en el periodo). */
export const PERIOD_INCOME_COLLECTED_LABEL = 'Ingreso cobrado';
/** Cartera pendiente de maniobras completadas en el periodo. */
export const PERIOD_INCOME_RECEIVABLE_LABEL = 'Cuentas por cobrar';

export type ReportsPeriodDistributionInput = {
  collectedRevenue: number;
  receivableRevenue: number;
  expensesByRubro: readonly { label: string; amount: number }[];
};

type BandItem = {
  name: string;
  value: number;
  color: string;
};

type LayoutBand = {
  x: number;
  y: number;
  w: number;
  h: number;
  name: string;
  value: number;
  color: string;
  group: string;
  isHeader: boolean;
};

/** [x, y, w, h, name, value, color, group, isHeader] */
type BandDatum = [number, number, number, number, string, number, string, string, 0 | 1];

const HEADER_HEIGHT = 11;
const GROUP_GAP = 2;
const BAND_GAP = 1.5;
const CHART_PAD = 1.5;

function layoutHorizontalGroup(
  groupLabel: string,
  items: BandItem[],
  box: { x: number; y: number; w: number; h: number },
  groupColor: string,
): LayoutBand[] {
  const bands: LayoutBand[] = [
    {
      x: box.x,
      y: box.y,
      w: box.w,
      h: HEADER_HEIGHT,
      name: groupLabel,
      value: items.reduce((sum, item) => sum + item.value, 0),
      color: groupColor,
      group: groupLabel,
      isHeader: true,
    },
  ];

  const contentTop = box.y + HEADER_HEIGHT + GROUP_GAP;
  const contentHeight = Math.max(box.h - HEADER_HEIGHT - GROUP_GAP, 0);
  const total = items.reduce((sum, item) => sum + item.value, 0);

  if (total <= 0 || items.length === 0) {
    return bands;
  }

  const gapTotal = BAND_GAP * Math.max(items.length - 1, 0);
  const usableHeight = Math.max(contentHeight - gapTotal, 0);
  let cursorY = contentTop;

  for (let index = 0; index < items.length; index++) {
    const item = items[index];
    const bandHeight =
      index === items.length - 1
        ? box.y + box.h - cursorY
        : (item.value / total) * usableHeight;

    bands.push({
      x: box.x,
      y: cursorY,
      w: box.w,
      h: Math.max(bandHeight, 0),
      name: item.name,
      value: item.value,
      color: item.color,
      group: groupLabel,
      isHeader: false,
    });

    cursorY += bandHeight + BAND_GAP;
  }

  return bands;
}

function toBandData(bands: LayoutBand[]): BandDatum[] {
  return bands.map((band) => [
    band.x,
    band.y,
    band.w,
    band.h,
    band.name,
    band.value,
    band.color,
    band.group,
    band.isHeader ? 1 : 0,
  ]);
}

function renderPeriodBand(
  params: CustomSeriesRenderItemParams,
  api: CustomSeriesRenderItemAPI,
  surfaceColor: string,
  borderMuted: string,
  labelOnFill: ReturnType<typeof reportsChartOnFillLabelStyle>,
): CustomSeriesRenderItemReturn {
  const x = Number(api.value(0)) || 0;
  const y = Number(api.value(1)) || 0;
  const w = Number(api.value(2)) || 0;
  const h = Number(api.value(3)) || 0;
  const name = String(api.value(4) ?? '');
  const value = Number(api.value(5)) || 0;
  const color = String(api.value(6) ?? '');
  const isHeader = Number(api.value(8)) === 1;

  const origin = api.coord([x, y]);
  const sizeRaw = api.size?.([w, h]);
  const size = Array.isArray(sizeRaw) ? (sizeRaw as [number, number]) : undefined;
  if (!origin || !size || size[0] <= 0 || size[1] <= 0) {
    return null;
  }

  const rectX = origin[0];
  const rectY = origin[1];
  const rectW = size[0];
  const rectH = size[1];

  const children = [
    {
      type: 'rect' as const,
      shape: {
        x: rectX,
        y: rectY,
        width: rectW,
        height: rectH,
        r: isHeader ? 0 : 2,
      },
      style: {
        fill: color,
        stroke: isHeader ? borderMuted : surfaceColor,
        lineWidth: isHeader ? 2 : 1.5,
      },
    },
  ] as NonNullable<Extract<CustomSeriesRenderItemReturn, { type: 'group' }>>['children'];

  if (isHeader) {
    children.push({
      type: 'text' as const,
      style: {
        text: name,
        x: rectX + 8,
        y: rectY + rectH / 2,
        fill: labelOnFill.color,
        fontSize: 11,
        fontWeight: 700,
        align: 'left',
        verticalAlign: 'middle',
        textShadowColor: labelOnFill.textShadowColor,
        textShadowBlur: labelOnFill.textShadowBlur,
      },
    });
  } else if (rectH >= 18 && rectW >= 36) {
    children.push({
      type: 'text' as const,
      style: {
        text: `${name}\n${formatReportsMoneyMx(value, true)}`,
        x: rectX + rectW / 2,
        y: rectY + rectH / 2,
        fill: labelOnFill.color,
        fontSize: 10,
        fontWeight: 600,
        lineHeight: 14,
        align: 'center',
        verticalAlign: 'middle',
        textShadowColor: labelOnFill.textShadowColor,
        textShadowBlur: labelOnFill.textShadowBlur,
      },
    });
  }

  return {
    type: 'group',
    children,
  } as CustomSeriesRenderItemReturn;
}

/**
 * Distribución del periodo — bandas horizontales por grupo (Gastos | Ingresos).
 * Layout fijo: cada concepto ocupa una franja de ancho completo dentro de su bloque.
 */
export function buildReportsGeneralFlowTreemapOption(
  data: ReportsPeriodDistributionInput,
  options?: ReportsChartColorOptions,
): EChartsOption {
  const primary = resolveReportsChartPrimary(options);
  const financial = reportsChartFinancialColors(primary);
  const P = REPORTS_CHART_PALETTE;
  const incomeColor = financial.revenue;
  const expenseColor = financial.expense;
  const borderMuted = 'rgba(15, 23, 42, 0.14)';
  const labelOnFill = reportsChartOnFillLabelStyle({ fontSize: 10, fontWeight: 600 });

  const incomeItems: BandItem[] = [];
  if (data.collectedRevenue > 0) {
    incomeItems.push({
      name: PERIOD_INCOME_COLLECTED_LABEL,
      value: data.collectedRevenue,
      color: incomeColor,
    });
  }
  if (data.receivableRevenue > 0) {
    incomeItems.push({
      name: PERIOD_INCOME_RECEIVABLE_LABEL,
      value: data.receivableRevenue,
      color: incomeColor,
    });
  }

  const expenseItems: BandItem[] = data.expensesByRubro
    .filter((row) => row.amount > 0)
    .map((row) => ({
      name: row.label,
      value: row.amount,
      color: expenseColor,
    }));

  const hasExpenses = expenseItems.length > 0;
  const hasIncome = incomeItems.length > 0;
  const innerTop = CHART_PAD;
  const innerHeight = 100 - CHART_PAD * 2;
  const halfWidth = (100 - CHART_PAD * 3) / 2;

  const layoutBands: LayoutBand[] = [];

  if (hasExpenses && hasIncome) {
    layoutBands.push(
      ...layoutHorizontalGroup(
        PERIOD_EXPENSE_GROUP_LABEL,
        expenseItems,
        { x: CHART_PAD, y: innerTop, w: halfWidth, h: innerHeight },
        expenseColor,
      ),
      ...layoutHorizontalGroup(
        PERIOD_INCOME_GROUP_LABEL,
        incomeItems,
        { x: CHART_PAD * 2 + halfWidth, y: innerTop, w: halfWidth, h: innerHeight },
        incomeColor,
      ),
    );
  } else if (hasExpenses) {
    layoutBands.push(
      ...layoutHorizontalGroup(
        PERIOD_EXPENSE_GROUP_LABEL,
        expenseItems,
        { x: CHART_PAD, y: innerTop, w: 100 - CHART_PAD * 2, h: innerHeight },
        expenseColor,
      ),
    );
  } else if (hasIncome) {
    layoutBands.push(
      ...layoutHorizontalGroup(
        PERIOD_INCOME_GROUP_LABEL,
        incomeItems,
        { x: CHART_PAD, y: innerTop, w: 100 - CHART_PAD * 2, h: innerHeight },
        incomeColor,
      ),
    );
  } else {
    layoutBands.push(
      ...layoutHorizontalGroup(
        PERIOD_EXPENSE_GROUP_LABEL,
        [{ name: 'Sin movimiento en el periodo', value: 1, color: P.expense }],
        { x: CHART_PAD, y: innerTop, w: 100 - CHART_PAD * 2, h: innerHeight },
        P.expense,
      ),
    );
  }

  const bandData = toBandData(layoutBands);

  return {
    animationDuration: 480,
    grid: { left: 0, right: 0, top: 0, bottom: 0, containLabel: false },
    xAxis: { type: 'value', min: 0, max: 100, show: false },
    yAxis: { type: 'value', min: 0, max: 100, show: false, inverse: true },
    tooltip: {
      ...reportsChartTooltip(),
      formatter: (info) => {
        const row = info as { data?: BandDatum; value?: number | BandDatum };
        const datum = Array.isArray(row.data) ? row.data : undefined;
        if (!datum) {
          return '';
        }
        const isHeader = datum[8] === 1;
        const group = datum[7];
        const name = datum[4];
        const value = datum[5];
        if (isHeader) {
          return `${group}<br/>Total: ${formatReportsMoneyMx(value)}`;
        }
        return `${group} · ${name}<br/>${formatReportsMoneyMx(value)}`;
      },
    },
    series: [
      {
        type: 'custom',
        coordinateSystem: 'cartesian2d',
        silent: false,
        animationDuration: 480,
        dimensions: ['x', 'y', 'w', 'h', 'name', 'value', 'color', 'group', 'isHeader'],
        encode: { tooltip: [4, 5] },
        data: bandData,
        renderItem: (params, api) =>
          renderPeriodBand(params, api, P.surface, borderMuted, labelOnFill),
      },
    ],
  };
}
