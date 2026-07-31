import type { DashboardOperationalFlowPoint } from '@shared/models/api/api-dashboard-insights.model';

export type DashboardWeekResult = {
  currentMargin: number;
  currentRevenue: number;
  currentExpenses: number;
  previousMargin: number;
  /** Variación % del margen vs los 7 días previos; `null` si no es calculable. */
  weekOverWeekPercent: number | null;
};

function sumFlow(
  points: readonly DashboardOperationalFlowPoint[],
): { revenue: number; expenses: number; margin: number } {
  let revenue = 0;
  let expenses = 0;
  for (const point of points) {
    revenue += point.revenue;
    expenses += point.expenses;
  }
  return { revenue, expenses, margin: revenue - expenses };
}

function weekOverWeekPercent(current: number, previous: number): number | null {
  if (previous === 0) {
    return current === 0 ? 0 : null;
  }
  return Math.round(((current - previous) / Math.abs(previous)) * 100);
}

/**
 * Margen (ingresos − gastos) de los últimos 7 días del flujo operativo,
 * comparado con los 7 días previos.
 */
export function buildDashboardWeekResult(
  points: readonly DashboardOperationalFlowPoint[],
): DashboardWeekResult {
  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));
  const currentPoints = sorted.slice(-7);
  const previousPoints = sorted.slice(-14, -7);

  const current = sumFlow(currentPoints);
  const previous = sumFlow(previousPoints);

  return {
    currentMargin: current.margin,
    currentRevenue: current.revenue,
    currentExpenses: current.expenses,
    previousMargin: previous.margin,
    weekOverWeekPercent:
      previousPoints.length === 0
        ? null
        : weekOverWeekPercent(current.margin, previous.margin),
  };
}
