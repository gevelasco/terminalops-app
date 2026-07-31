import { buildDashboardWeekResult } from './dashboard-week-result.util';
import type { DashboardOperationalFlowPoint } from '@shared/models/api/api-dashboard-insights.model';

function point(
  date: string,
  revenue: number,
  expenses: number,
): DashboardOperationalFlowPoint {
  return { date, revenue, expenses, trips: 0 };
}

describe('buildDashboardWeekResult', () => {
  it('sums last 7 days and compares with the previous 7', () => {
    const points: DashboardOperationalFlowPoint[] = [];
    for (let day = 1; day <= 14; day += 1) {
      const d = String(day).padStart(2, '0');
      // Days 1–7: margin 100 each → 700
      // Days 8–14: margin 200 each → 1400
      if (day <= 7) {
        points.push(point(`2026-07-${d}`, 150, 50));
      } else {
        points.push(point(`2026-07-${d}`, 250, 50));
      }
    }

    const result = buildDashboardWeekResult(points);

    expect(result.currentRevenue).toBe(1750);
    expect(result.currentExpenses).toBe(350);
    expect(result.currentMargin).toBe(1400);
    expect(result.previousMargin).toBe(700);
    expect(result.weekOverWeekPercent).toBe(100);
  });

  it('returns null wow percent when there is no previous window', () => {
    const points = [
      point('2026-07-01', 100, 40),
      point('2026-07-02', 100, 40),
    ];

    const result = buildDashboardWeekResult(points);

    expect(result.currentMargin).toBe(120);
    expect(result.previousMargin).toBe(0);
    expect(result.weekOverWeekPercent).toBeNull();
  });

  it('returns 0% when both windows are flat at zero', () => {
    const points = Array.from({ length: 14 }, (_, i) => {
      const d = String(i + 1).padStart(2, '0');
      return point(`2026-07-${d}`, 0, 0);
    });

    expect(buildDashboardWeekResult(points).weekOverWeekPercent).toBe(0);
  });

  it('uses absolute previous margin for negative baselines', () => {
    const points: DashboardOperationalFlowPoint[] = [];
    for (let day = 1; day <= 14; day += 1) {
      const d = String(day).padStart(2, '0');
      if (day <= 7) {
        points.push(point(`2026-07-${d}`, 0, 100)); // -700
      } else {
        points.push(point(`2026-07-${d}`, 0, 50)); // -350
      }
    }

    const result = buildDashboardWeekResult(points);
    expect(result.currentMargin).toBe(-350);
    expect(result.previousMargin).toBe(-700);
    expect(result.weekOverWeekPercent).toBe(50);
  });
});
