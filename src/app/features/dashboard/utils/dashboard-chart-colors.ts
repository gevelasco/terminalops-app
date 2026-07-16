/**
 * Paleta principal — 5 colores ordenados: navy, blue, sky, slate, near-white.
 * Todas las gráficas toman los primeros N colores según su cantidad de series.
 */
export const STITCH_PALETTE = [
  '#0F172A',
  '#1D4ED8',
  '#60A5FA',
  '#E2E8F0',
  '#F8FAFC',
] as const;

export const DASHBOARD_CHART_PRIMARY_FALLBACK = STITCH_PALETTE[0];

/** Acentos — mapeados desde la paleta de 5 colores. */
export const CHART_MUTED_ACCENT = {
  gray: STITCH_PALETTE[2],
  grayMid: STITCH_PALETTE[1],
  sage: STITCH_PALETTE[2],
  sand: STITCH_PALETTE[3],
} as const;

/** Mezcla hacia gris claro para suavizar cualquier tono de gráfica. */
export const CHART_SOFTEN_BLEND = 0.24;

/** En curso / positivo — verde apagado (no saturado). */
export const CHART_MUTED_IN_TRANSIT = CHART_MUTED_ACCENT.sage;

/** Programadas / neutro secundario. */
export const CHART_MUTED_SCHEDULED = CHART_MUTED_ACCENT.gray;

/** Gastos / líneas secundarias. */
export const CHART_MUTED_EXPENSE = CHART_MUTED_ACCENT.grayMid;

/** Contraste para segmentos adicionales — repite ciclo de paleta. */
const DASHBOARD_SLICE_CONTRAST = [
  STITCH_PALETTE[1],
  STITCH_PALETTE[2],
  STITCH_PALETTE[3],
  STITCH_PALETTE[4],
  '#9CA3AF',
  '#4B5563',
] as const;

function rgbStringToHex(rgb: string): string | null {
  const match = rgb.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (!match) {
    return null;
  }
  const r = Number(match[1]);
  const g = Number(match[2]);
  const b = Number(match[3]);
  if (![r, g, b].every((n) => Number.isFinite(n) && n >= 0 && n <= 255)) {
    return null;
  }
  return `#${[r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('')}`;
}

function resolveCssColor(
  property: 'color' | 'backgroundColor',
  cssValue: string,
): string | null {
  if (typeof document === 'undefined') {
    return null;
  }
  const probe = document.createElement('div');
  probe.style.display = 'none';
  if (property === 'color') {
    probe.style.color = cssValue;
  } else {
    probe.style.backgroundColor = cssValue;
  }
  document.documentElement.appendChild(probe);
  const resolved = getComputedStyle(probe)[property];
  probe.remove();
  return rgbStringToHex(resolved);
}

function isUsableChartHex(hex: string | null): hex is string {
  if (!hex) {
    return false;
  }
  const normalized = hex.toLowerCase();
  return normalized !== '#000000' && normalized !== '#000';
}

/**
 * Color primario de gráficas — Stitch #111827.
 */
export function dashboardChartPrimary(): string {
  return STITCH_PALETTE[0];
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const normalized = hex.replace('#', '').trim();
  if (normalized.length !== 6) {
    return null;
  }
  const n = Number.parseInt(normalized, 16);
  if (!Number.isFinite(n)) {
    return null;
  }
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('')}`;
}

/** Mezcla un color sólido hacia el gris claro Stitch (#E5E7EB). */
export function softenChartColor(hex: string, amount = CHART_SOFTEN_BLEND): string {
  const rgb = hexToRgb(hex);
  if (!rgb) {
    return hex;
  }
  const target = { r: 229, g: 231, b: 235 };
  const t = Math.min(1, Math.max(0, amount));
  return rgbToHex(
    Math.round(rgb.r + (target.r - rgb.r) * t),
    Math.round(rgb.g + (target.g - rgb.g) * t),
    Math.round(rgb.b + (target.b - rgb.b) * t),
  );
}

export function rgbaFromHex(hex: string, alpha: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) {
    return hex;
  }
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

export function dashboardChartSliceColors(count: number): string[] {
  if (count <= 0) {
    return [STITCH_PALETTE[0]];
  }
  return Array.from(
    { length: count },
    (_, i) => STITCH_PALETTE[i % STITCH_PALETTE.length],
  );
}

/** Grosor de barra horizontal según cantidad de destinos. */
export function dashboardDestinationBarWidth(destinationCount: number): number {
  if (destinationCount <= 2) {
    return 28;
  }
  if (destinationCount <= 4) {
    return 22;
  }
  if (destinationCount <= 6) {
    return 18;
  }
  return 12;
}
