/**
 * Paleta global de gráficas — ÚNICA fuente de verdad de colores para charts.
 *
 * Ancla: azul del sidemenu (`#111827`).
 * Compañeros: solo fríos (sky / ice / steel / fog) — sin rosa, lila ni terracota.
 * Contraste vivo: solo el verde positivo.
 *
 * Toda la app (dashboard, reportes, heatmaps) toma sus colores de aquí.
 * El orden importa: cada gráfica categórica toma los primeros N colores.
 */
export const APP_CHART_PALETTE = [
  '#111827', // sidemenu blue (ancla)
  '#6B9BC3', // sky mid
  '#A8C5DC', // ice blue
  '#7E96B0', // dusty steel
  '#7FA9B8', // soft aqua-slate
  '#8FA3B5', // blue-gray mist
  '#9BB0C2', // soft steel fog
  '#B8C4CE', // cool silver
] as const;

/**
 * Roles semánticos — familia fría alineada al sidemenu.
 * Gastos/danger usan slate (no rosa).
 */
export const APP_CHART_SEMANTIC = {
  /** Sidemenu — ingresos / primario / completado. */
  primary: '#111827',
  revenue: '#111827',
  completed: '#111827',
  /** En tránsito / secundario. */
  inTransit: '#6B9BC3',
  scheduled: '#8FA3B5',
  margin: '#7E96B0',
  warning: '#7FA9B8',
  /** Único acento vivo — positivo. */
  success: '#22C55E',
  /** Gastos — slate medio (contrasta con navy, sin rosa). */
  expense: '#5B6E82',
  danger: '#3D4F63',
  /** Wash frío azulado (áreas / fills). */
  softBlend: '#E8EEF5',
} as const;
