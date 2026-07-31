import {
  APP_CHART_PALETTE,
  APP_CHART_SEMANTIC,
} from '@shared/charts/app-chart-palette';

/**
 * Alias de la paleta global (`@shared/charts/app-chart-palette`).
 * Edita los colores allá; toda la app los toma de ese único objeto.
 */
export const STITCH_PALETTE = APP_CHART_PALETTE;

export const DASHBOARD_CHART_PRIMARY_FALLBACK = APP_CHART_SEMANTIC.primary;

/** Acentos semánticos para series fijas (actividad, flujo, etc.). */
export const CHART_MUTED_ACCENT = {
  gray: APP_CHART_SEMANTIC.scheduled,
  grayMid: APP_CHART_SEMANTIC.expense,
  sage: APP_CHART_SEMANTIC.inTransit,
  sand: APP_CHART_SEMANTIC.warning,
} as const;

/** Mezcla hacia softBlend (wash azul claro) para fills/áreas. */
export const CHART_SOFTEN_BLEND = 0.28;

/** En curso / positivo. */
export const CHART_MUTED_IN_TRANSIT = APP_CHART_SEMANTIC.inTransit;

/** Programadas / neutro secundario. */
export const CHART_MUTED_SCHEDULED = APP_CHART_SEMANTIC.scheduled;

/** Gastos / líneas secundarias. */
export const CHART_MUTED_EXPENSE = APP_CHART_SEMANTIC.expense;

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

/** Color primario de gráficas (harbor navy). */
export function dashboardChartPrimary(): string {
  return APP_CHART_SEMANTIC.primary;
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

/** Mezcla un color sólido hacia el softBlend de la paleta. */
export function softenChartColor(hex: string, amount = CHART_SOFTEN_BLEND): string {
  const rgb = hexToRgb(hex);
  if (!rgb) {
    return hex;
  }
  const target = hexToRgb(APP_CHART_SEMANTIC.softBlend) ?? {
    r: 230,
    g: 238,
    b: 242,
  };
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

export { APP_CHART_SEMANTIC, resolveCssColor, isUsableChartHex };
