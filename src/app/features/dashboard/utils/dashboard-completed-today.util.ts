import type { DashboardTripActivityPoint } from '@shared/models/api/api-dashboard-insights.model';

export type DashboardCompletedToday = {
  today: number;
  yesterday: number;
  /** Variación % vs ayer; `null` si no es calculable. */
  vsYesterdayPercent: number | null;
  weekTotal: number;
};

function dayCount(
  byDate: Map<string, number>,
  ymd: string,
): number {
  return byDate.get(ymd) ?? 0;
}

function shiftYmd(ymd: string, days: number): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
  if (!match) {
    return null;
  }
  const date = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]) + days,
    12,
    0,
    0,
    0,
  );
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function percentChange(current: number, previous: number): number | null {
  if (previous === 0) {
    return current === 0 ? 0 : null;
  }
  return Math.round(((current - previous) / Math.abs(previous)) * 100);
}

/**
 * Completadas del día operativo, vs ayer, y total de los últimos 7 días
 * a partir de la serie `tripActivity`.
 */
export function buildDashboardCompletedToday(
  points: readonly DashboardTripActivityPoint[],
  todayYmd: string,
): DashboardCompletedToday {
  const byDate = new Map<string, number>();
  for (const point of points) {
    byDate.set(point.date, point.completed);
  }

  const today = dayCount(byDate, todayYmd);
  const yesterdayYmd = shiftYmd(todayYmd, -1);
  const yesterday = yesterdayYmd ? dayCount(byDate, yesterdayYmd) : 0;

  let weekTotal = 0;
  for (let offset = 0; offset < 7; offset += 1) {
    const ymd = shiftYmd(todayYmd, -offset);
    if (ymd) {
      weekTotal += dayCount(byDate, ymd);
    }
  }

  return {
    today,
    yesterday,
    vsYesterdayPercent: yesterdayYmd ? percentChange(today, yesterday) : null,
    weekTotal,
  };
}
