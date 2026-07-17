/**
 * Paleta global de gráficas — ÚNICA fuente de verdad de colores para charts.
 *
 * Toda la app (dashboard, reportes, heatmaps) toma sus colores de aquí.
 * Para probar otra paleta solo cambia estos valores; el orden importa:
 * cada gráfica toma los primeros N colores según su cantidad de series.
 */
export const APP_CHART_PALETTE = [
  // Blues
  '#0F172A',
  '#1D4ED8',
  '#60A5FA',
  '#E2E8F0',
  '#F8FAFC',
  // Neutrals
  // '#0F172A',
  // '#334155',
  // '#94A3B8',
  // '#E2E8F0',
  // '#F8FAFC',
  // Blues2
  // '#0F172A',
  // '#1E40AF',
  // '#93C5FD',
  // '#DBEAFE',
  // '#EFF6FF',
] as const;
