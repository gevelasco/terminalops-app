import { ensureAppEchartsModules } from '@shared/charts/app-echarts-modules';

/** @deprecated Usar ensureAppEchartsModules. Mantenido por compatibilidad con dashboard. */
export function ensureDashboardEchartsModules() {
  return ensureAppEchartsModules();
}
