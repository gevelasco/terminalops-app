/**
 * Azul acento del sidemenu (ítem activo / `--palette-primary` en tema oscuro).
 * No usar `--shell-bg`: ese es el fondo oscuro del rail, no el azul.
 */
export const DASHBOARD_CHART_PRIMARY_FALLBACK = '#748498';

/** Acentos apagados — sobrios y profesionales. */
export const CHART_MUTED_ACCENT = {
  gray: '#a8b0bd',
  grayMid: '#b8bec8',
  sage: '#8fa89a',
  sand: '#b8aa92',
} as const;

/** Mezcla hacia gris claro para suavizar cualquier tono de gráfica. */
export const CHART_SOFTEN_BLEND = 0.24;

/** En curso / positivo — verde apagado (no saturado). */
export const CHART_MUTED_IN_TRANSIT = CHART_MUTED_ACCENT.sage;

/** Programadas / neutro secundario. */
export const CHART_MUTED_SCHEDULED = CHART_MUTED_ACCENT.gray;

/** Gastos / líneas secundarias. */
export const CHART_MUTED_EXPENSE = CHART_MUTED_ACCENT.grayMid;

/** Grises de contraste para segmentos adicionales en dona. */
const DASHBOARD_SLICE_CONTRAST = [
  CHART_MUTED_ACCENT.grayMid,
  '#c8ced6',
  CHART_MUTED_ACCENT.gray,
  '#d4d9e0',
  '#98a2ae',
  '#e2e6eb',
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
 * Azul del sidemenu: `var(--palette-primary, #748498)`.
 * En tema claro `--palette-primary` puede ser negro; entonces usa `--to-color-derived`.
 */
export function dashboardChartPrimary(): string {
  if (typeof document === 'undefined') {
    return softenChartColor(DASHBOARD_CHART_PRIMARY_FALLBACK);
  }

  const palette = resolveCssColor('color', 'var(--palette-primary, #748498)');
  if (isUsableChartHex(palette)) {
    return softenChartColor(palette);
  }

  const derived = resolveCssColor('color', 'var(--to-color-derived, #748498)');
  if (isUsableChartHex(derived)) {
    return softenChartColor(derived);
  }

  const activeNavBg = document.querySelector(
    '[data-shell-sidebar] .shell-nav-link--active',
  );
  if (activeNavBg) {
    const fromNav = rgbStringToHex(getComputedStyle(activeNavBg).backgroundColor);
    if (isUsableChartHex(fromNav)) {
      return softenChartColor(fromNav);
    }
  }

  return softenChartColor(DASHBOARD_CHART_PRIMARY_FALLBACK);
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

/** Mezcla un color sólido hacia un gris claro neutro. */
export function softenChartColor(hex: string, amount = CHART_SOFTEN_BLEND): string {
  const rgb = hexToRgb(hex);
  if (!rgb) {
    return hex;
  }
  const target = { r: 236, g: 239, b: 243 };
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
    return [dashboardChartPrimary()];
  }
  const primary = dashboardChartPrimary();
  const cycle = [
    primary,
    CHART_MUTED_ACCENT.gray,
    CHART_MUTED_ACCENT.sage,
    CHART_MUTED_ACCENT.sand,
  ] as const;
  return Array.from({ length: count }, (_, i) => cycle[i % cycle.length] ?? primary);
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
