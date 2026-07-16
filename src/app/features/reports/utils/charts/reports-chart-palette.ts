import {
  CHART_MUTED_ACCENT,
  CHART_MUTED_EXPENSE,
  CHART_MUTED_IN_TRANSIT,
  CHART_MUTED_SCHEDULED,
  CHART_SOFTEN_BLEND,
  DASHBOARD_CHART_PRIMARY_FALLBACK,
  dashboardChartPrimary,
  hexToRgb,
  rgbaFromHex,
  softenChartColor,
  STITCH_PALETTE,
} from '@features/dashboard/utils/dashboard-chart-colors';

/**
 * Paleta fintech — alineada al dashboard, tonos apagados.
 * Ciclo categórico: azul (tema) · gris · sage · sand.
 */
export const REPORTS_FINTECH_ACCENT = CHART_MUTED_ACCENT;

/** Neutros de UI — paleta Stitch. */
export const REPORTS_BRAND = {
  text: '#111827',
  textMuted: '#6B7280',
  axis: '#9CA3AF',
  grid: '#E5E7EB',
  surface: '#FFFFFF',
  white: '#FFFFFF',
  /** Mapas / fondos suaves */
  mapFill: '#F9FAFB',
  mapBorder: '#D1D5DB',
  /** @deprecated Alias legacy */
  navy: STITCH_PALETTE[0],
  periwinkle: STITCH_PALETTE[1],
  sky: STITCH_PALETTE[2],
  cream: STITCH_PALETTE[4],
  warmYellow: STITCH_PALETTE[3],
  paleBlueGray: STITCH_PALETTE[3],
  deepTeal: STITCH_PALETTE[0],
  charcoal: STITCH_PALETTE[0],
  sage: STITCH_PALETTE[2],
  blue: STITCH_PALETTE[1],
  mint: STITCH_PALETTE[2],
  charcoalTeal: STITCH_PALETTE[0],
  tealMid: STITCH_PALETTE[1],
  mintStrong: STITCH_PALETTE[2],
} as const;

export const REPORTS_CHART_PALETTE = {
  primary: STITCH_PALETTE[0],
  primaryLight: STITCH_PALETTE[1],
  primarySoft: STITCH_PALETTE[4],
  accent: STITCH_PALETTE[2],
  accentSoft: STITCH_PALETTE[4],
  revenue: STITCH_PALETTE[0],
  expense: STITCH_PALETTE[1],
  expenseDark: STITCH_PALETTE[2],
  margin: STITCH_PALETTE[2],
  marginLight: STITCH_PALETTE[4],
  success: STITCH_PALETTE[1],
  warning: STITCH_PALETTE[3],
  danger: '#991b1b',
  inTransit: STITCH_PALETTE[1],
  scheduled: STITCH_PALETTE[2],
  completed: STITCH_PALETTE[0],
  series: [
    STITCH_PALETTE[0],
    STITCH_PALETTE[1],
    STITCH_PALETTE[2],
    STITCH_PALETTE[3],
    STITCH_PALETTE[4],
  ] as const,
  axis: REPORTS_BRAND.axis,
  axisLabel: REPORTS_BRAND.textMuted,
  grid: REPORTS_BRAND.grid,
  text: REPORTS_BRAND.text,
  textMuted: REPORTS_BRAND.textMuted,
  surface: REPORTS_BRAND.surface,
  gaugeTrack: REPORTS_BRAND.grid,
  tooltipBg: 'rgba(17, 24, 39, 0.92)',
  tooltipText: REPORTS_BRAND.white,
  labelOnFill: REPORTS_BRAND.white,
  labelOnLightFill: REPORTS_BRAND.text,
  labelAccent: REPORTS_FINTECH_ACCENT.sand,
} as const;

/** Alias histórico — preferir REPORTS_CHART_PALETTE. */
export const REPORTS_FINTECH = REPORTS_CHART_PALETTE;

const P = REPORTS_CHART_PALETTE;
const A = REPORTS_FINTECH_ACCENT;

export type ReportsChartColorOptions = {
  primaryColor?: string;
};

/** Color primario Stitch. */
export function reportsChartPrimary(): string {
  return STITCH_PALETTE[0];
}

export function resolveReportsChartPrimary(options?: ReportsChartColorOptions): string {
  return options?.primaryColor ?? STITCH_PALETTE[0];
}

/** Colores semánticos — siempre comienzan desde color 1. */
export function reportsChartSemanticColors(_primary?: string): {
  primary: string;
  revenue: string;
  expense: string;
  margin: string;
  completed: string;
  inTransit: string;
  scheduled: string;
  warning: string;
  success: string;
} {
  return {
    primary: STITCH_PALETTE[0],
    revenue: STITCH_PALETTE[0],
    expense: STITCH_PALETTE[1],
    margin: STITCH_PALETTE[2],
    completed: STITCH_PALETTE[0],
    inTransit: STITCH_PALETTE[1],
    scheduled: STITCH_PALETTE[2],
    warning: STITCH_PALETTE[3],
    success: STITCH_PALETTE[1],
  };
}

/** Ciclo de paleta: #0F172A · #1D4ED8 · #60A5FA · #E2E8F0 · #F8FAFC. */
export function reportsChartSliceColorAt(index: number, _primary?: string): string {
  const normalized = ((index % STITCH_PALETTE.length) + STITCH_PALETTE.length) % STITCH_PALETTE.length;
  return STITCH_PALETTE[normalized];
}

export function reportsChartRotatingColorAt(index: number, primary?: string): string {
  return reportsChartSliceColorAt(index, primary);
}

export function reportsChartSeriesColors(
  count: number,
  offset = 0,
  primary?: string,
): string[] {
  if (count <= 0) {
    return [reportsChartSliceColorAt(offset, primary)];
  }
  return Array.from({ length: count }, (_, i) =>
    reportsChartSliceColorAt(offset + i, primary),
  );
}

/** @deprecated Prefer reportsChartSeriesColors */
export const reportsFintechSeriesColors = reportsChartSeriesColors;

/** Tab General — todas las gráficas inician en color 1. */
export const REPORTS_GENERAL_CHART_COLOR_OFFSET = {
  destinations: 0,
  operationMix: 0,
  operators: 0,
} as const;

/** Rotación categórica en tab Balance — todas las gráficas inician en color 1. */
export const REPORTS_BALANCE_CHART_COLOR_OFFSET = {
  creditByClient: 0,
  incomeByClient: 0,
  marginByClient: 0,
  expensesByRubro: 0,
} as const;

/** Rotación categórica en tab Maniobras — todas las gráficas inician en color 1. */
export const REPORTS_MANIOBRAS_CHART_COLOR_OFFSET = {
  topOperators: 0,
  topClients: 0,
  topDestinations: 0,
  containerTypeMix: 0,
  cargoWeightByContainer: 0,
} as const;

/** Rotación categórica en tab Flota — todas las gráficas inician en color 1. */
export const REPORTS_FLEET_CHART_COLOR_OFFSET = {
  statusMix: 0,
  topUnitsByKm: 0,
  fleetSpendMix: 0,
} as const;

export function reportsChartFinancialColors(primary?: string): {
  revenue: string;
  expense: string;
  margin: string;
} {
  const sem = reportsChartSemanticColors(primary);
  return {
    revenue: sem.revenue,
    expense: sem.expense,
    margin: sem.margin,
  };
}

/** @deprecated Prefer reportsChartFinancialColors */
export const reportsFintechFinancialColors = reportsChartFinancialColors;

export function reportsChartGaugeTone(pct: number, primary?: string): string {
  const sem = reportsChartSemanticColors(primary);
  if (pct >= 70) {
    return sem.success;
  }
  if (pct >= 40) {
    return sem.warning;
  }
  return sem.primary;
}

/** @deprecated Prefer reportsChartGaugeTone */
export const reportsFintechGaugeTone = reportsChartGaugeTone;

export function reportsChartVerticalGradient(top: string, bottom: string): {
  type: 'linear';
  x: number;
  y: number;
  x2: number;
  y2: number;
  colorStops: { offset: number; color: string }[];
} {
  return {
    type: 'linear',
    x: 0,
    y: 0,
    x2: 0,
    y2: 1,
    colorStops: [
      { offset: 0, color: top },
      { offset: 1, color: bottom },
    ],
  };
}

export function reportsChartPrimaryGradient(primary?: string): ReturnType<
  typeof reportsChartVerticalGradient
> {
  const blue = primary ?? reportsChartPrimary();
  return reportsChartVerticalGradient(blue, rgbaFromHex(blue, 0.35));
}

/** @deprecated Prefer reportsChartPrimaryGradient */
export const reportsFintechPrimaryGradient = reportsChartPrimaryGradient;

export function reportsChartLegend(): {
  top: number;
  left: number;
  itemWidth: number;
  itemHeight: number;
  textStyle: { fontSize: number; color: string };
} {
  return {
    top: 0,
    left: 0,
    itemWidth: 14,
    itemHeight: 8,
    textStyle: { fontSize: 11, color: P.axisLabel },
  };
}

export const reportsFintechLegend = reportsChartLegend;

export function reportsChartValueAxis(): {
  type: 'value';
  minInterval?: number;
  splitLine: { lineStyle: { color: string; type: 'dashed' } };
  axisLabel: { color: string; fontSize: number };
} {
  return {
    type: 'value',
    splitLine: { lineStyle: { color: P.grid, type: 'dashed' } },
    axisLabel: { color: P.axis, fontSize: 10 },
  };
}

export const reportsFintechValueAxis = reportsChartValueAxis;

export function reportsChartActivityAreaPieces(
  maxTotal: number,
  primary?: string,
): { lte?: number; gt?: number; color: string }[] {
  const sem = reportsChartSemanticColors(primary);
  return [
    { lte: maxTotal * 0.33, color: rgbaFromHex(sem.scheduled, 0.45) },
    {
      gt: maxTotal * 0.33,
      lte: maxTotal * 0.66,
      color: rgbaFromHex(sem.warning, 0.38),
    },
    { gt: maxTotal * 0.66, color: rgbaFromHex(sem.primary, 0.28) },
  ];
}

export const reportsFintechActivityAreaPieces = reportsChartActivityAreaPieces;

export function reportsChartTooltip(): {
  confine: boolean;
  backgroundColor?: string;
  borderWidth?: number;
  borderColor?: string;
  textStyle?: { color: string; fontSize: number };
} {
  return {
    confine: true,
    backgroundColor: P.tooltipBg,
    borderWidth: 0,
    borderColor: 'transparent',
    textStyle: { color: P.tooltipText, fontSize: 11 },
  };
}

export function reportsChartOutsideLabelStyle(options?: {
  fontSize?: number;
  fontWeight?: 400 | 500 | 600 | 700;
}): {
  color: string;
  fontSize: number;
  fontWeight: 400 | 500 | 600 | 700;
} {
  return {
    color: P.text,
    fontSize: options?.fontSize ?? 11,
    fontWeight: options?.fontWeight ?? 600,
  };
}

export function reportsChartAccentLabelStyle(options?: {
  fontSize?: number;
  fontWeight?: 400 | 500 | 600 | 700;
}): {
  color: string;
  fontSize: number;
  fontWeight: 400 | 500 | 600 | 700;
  textShadowColor: string;
  textShadowBlur: number;
} {
  return {
    color: P.labelAccent,
    fontSize: options?.fontSize ?? 11,
    fontWeight: options?.fontWeight ?? 600,
    textShadowColor: 'rgba(15, 23, 42, 0.2)',
    textShadowBlur: 2,
  };
}

export function reportsChartOnFillLabelStyle(options?: {
  fontSize?: number;
  fontWeight?: 400 | 500 | 600 | 700;
  lightFill?: boolean;
}): {
  color: string;
  fontSize: number;
  fontWeight: 400 | 500 | 600 | 700;
  textShadowColor: string;
  textShadowBlur: number;
} {
  return {
    color: options?.lightFill ? P.labelOnLightFill : P.labelOnFill,
    fontSize: options?.fontSize ?? 11,
    fontWeight: options?.fontWeight ?? 600,
    textShadowColor: 'rgba(15, 23, 42, 0.35)',
    textShadowBlur: 3,
  };
}

export function reportsChartAdaptiveFillLabelColor(
  pick: (params: { name?: string; color?: string }) => string,
): string {
  return pick as unknown as string;
}

function relativeLuminance(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;
  const [rs, gs, bs] = [rgb.r, rgb.g, rgb.b].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

export function reportsChartLabelIsLightFill(color: string | undefined): boolean {
  if (!color) {
    return false;
  }
  return relativeLuminance(color) > 0.35;
}

export { rgbaFromHex };
