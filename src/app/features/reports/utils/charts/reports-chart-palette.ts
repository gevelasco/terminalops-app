import {
  CHART_MUTED_ACCENT,
  CHART_MUTED_EXPENSE,
  CHART_MUTED_IN_TRANSIT,
  CHART_MUTED_SCHEDULED,
  CHART_SOFTEN_BLEND,
  DASHBOARD_CHART_PRIMARY_FALLBACK,
  dashboardChartPrimary,
  rgbaFromHex,
  softenChartColor,
} from '@features/dashboard/utils/dashboard-chart-colors';

/**
 * Paleta fintech — alineada al dashboard, tonos apagados.
 * Ciclo categórico: azul (tema) · gris · sage · sand.
 */
export const REPORTS_FINTECH_ACCENT = CHART_MUTED_ACCENT;

/** Neutros de UI (slate, como dashboard). */
export const REPORTS_BRAND = {
  text: '#0f172a',
  textMuted: '#64748b',
  axis: '#94a3b8',
  grid: '#e2e8f0',
  surface: '#FFFFFF',
  white: '#FFFFFF',
  /** Mapas / fondos suaves */
  mapFill: '#f8fafc',
  mapBorder: '#cbd5e1',
  /** @deprecated Alias legacy */
  navy: '#0f172a',
  periwinkle: REPORTS_FINTECH_ACCENT.grayMid,
  sky: REPORTS_FINTECH_ACCENT.sage,
  cream: '#f8fafc',
  warmYellow: REPORTS_FINTECH_ACCENT.sand,
  paleBlueGray: '#e2e8f0',
  deepTeal: '#0f172a',
  charcoal: '#0f172a',
  sage: REPORTS_FINTECH_ACCENT.sage,
  blue: DASHBOARD_CHART_PRIMARY_FALLBACK,
  mint: REPORTS_FINTECH_ACCENT.sage,
  charcoalTeal: '#0f172a',
  tealMid: '#0f172a',
  mintStrong: REPORTS_FINTECH_ACCENT.sage,
} as const;

export const REPORTS_CHART_PALETTE = {
  primary: softenChartColor(DASHBOARD_CHART_PRIMARY_FALLBACK),
  primaryLight: REPORTS_FINTECH_ACCENT.grayMid,
  primarySoft: REPORTS_BRAND.mapFill,
  accent: REPORTS_FINTECH_ACCENT.sand,
  accentSoft: REPORTS_BRAND.mapFill,
  revenue: softenChartColor(DASHBOARD_CHART_PRIMARY_FALLBACK),
  expense: CHART_MUTED_EXPENSE,
  expenseDark: REPORTS_FINTECH_ACCENT.grayMid,
  margin: REPORTS_FINTECH_ACCENT.sage,
  marginLight: REPORTS_BRAND.mapFill,
  success: REPORTS_FINTECH_ACCENT.sage,
  warning: REPORTS_FINTECH_ACCENT.sand,
  danger: softenChartColor('#c97a7a'),
  inTransit: CHART_MUTED_IN_TRANSIT,
  scheduled: CHART_MUTED_SCHEDULED,
  completed: softenChartColor(DASHBOARD_CHART_PRIMARY_FALLBACK),
  series: [
    softenChartColor(DASHBOARD_CHART_PRIMARY_FALLBACK),
    CHART_MUTED_ACCENT.gray,
    CHART_MUTED_ACCENT.sage,
    CHART_MUTED_ACCENT.sand,
  ] as const,
  axis: REPORTS_BRAND.axis,
  axisLabel: REPORTS_BRAND.textMuted,
  grid: REPORTS_BRAND.grid,
  text: REPORTS_BRAND.text,
  textMuted: REPORTS_BRAND.textMuted,
  surface: REPORTS_BRAND.surface,
  gaugeTrack: REPORTS_BRAND.grid,
  tooltipBg: 'rgba(15, 23, 42, 0.92)',
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

/** Azul del sidemenu — mismo criterio que dashboard. */
export function reportsChartPrimary(): string {
  return dashboardChartPrimary();
}

export function resolveReportsChartPrimary(options?: ReportsChartColorOptions): string {
  return options?.primaryColor ?? reportsChartPrimary();
}

/** Colores semánticos con azul dinámico del tema. */
export function reportsChartSemanticColors(primary?: string): {
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
  const blue = softenChartColor(primary ?? reportsChartPrimary(), CHART_SOFTEN_BLEND * 0.5);
  return {
    primary: blue,
    revenue: blue,
    expense: A.gray,
    margin: A.sage,
    completed: blue,
    inTransit: A.sage,
    scheduled: A.gray,
    warning: A.sand,
    success: A.sage,
  };
}

/** Ciclo fintech apagado: azul · gris · sage · sand. */
export function reportsChartSliceColorAt(index: number, primary?: string): string {
  const blue = softenChartColor(primary ?? reportsChartPrimary(), CHART_SOFTEN_BLEND * 0.5);
  const cycle = [blue, A.gray, A.sage, A.sand] as const;
  const normalized = ((index % cycle.length) + cycle.length) % cycle.length;
  return cycle[normalized] ?? blue;
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

/**
 * Desplazamiento de paleta en tab General (4 colores rotativos).
 */
export const REPORTS_GENERAL_CHART_COLOR_OFFSET = {
  destinations: 1,
  operationMix: 2,
  operators: 3,
} as const;

/** Rotación categórica en tab Balance. */
export const REPORTS_BALANCE_CHART_COLOR_OFFSET = {
  creditByClient: 0,
  incomeByClient: 1,
  marginByClient: 2,
  expensesByRubro: 3,
} as const;

/** Rotación categórica en tab Maniobras. */
export const REPORTS_MANIOBRAS_CHART_COLOR_OFFSET = {
  topOperators: 0,
  topClients: 1,
  topDestinations: 2,
  containerTypeMix: 3,
  cargoWeightByContainer: 1,
} as const;

/** Rotación categórica en tab Flota. */
export const REPORTS_FLEET_CHART_COLOR_OFFSET = {
  statusMix: 0,
  topUnitsByKm: 1,
  fleetSpendMix: 2,
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

const LIGHT_FILL_COLORS = new Set(
  [A.gray, A.grayMid, REPORTS_BRAND.mapFill, REPORTS_BRAND.grid].map((c) =>
    c.toLowerCase(),
  ),
);

export function reportsChartLabelIsLightFill(color: string | undefined): boolean {
  if (!color) {
    return false;
  }
  return LIGHT_FILL_COLORS.has(color.toLowerCase());
}

export { rgbaFromHex };
