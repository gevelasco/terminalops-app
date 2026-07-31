import { buildDashboardCompletedToday } from './dashboard-completed-today.util';
import type { DashboardTripActivityPoint } from '@shared/models/api/api-dashboard-insights.model';

function point(date: string, completed: number): DashboardTripActivityPoint {
  return { date, completed, inTransit: 0, scheduled: 0 };
}

describe('buildDashboardCompletedToday', () => {
  it('reads today, yesterday and rolling 7-day total', () => {
    const points = [
      point('2026-07-24', 1),
      point('2026-07-25', 2),
      point('2026-07-26', 3),
      point('2026-07-27', 4),
      point('2026-07-28', 5),
      point('2026-07-29', 10),
      point('2026-07-30', 20),
    ];

    const result = buildDashboardCompletedToday(points, '2026-07-30');

    expect(result.today).toBe(20);
    expect(result.yesterday).toBe(10);
    expect(result.vsYesterdayPercent).toBe(100);
    expect(result.weekTotal).toBe(45);
  });

  it('returns 0% when today and yesterday are both zero', () => {
    const result = buildDashboardCompletedToday(
      [point('2026-07-29', 0), point('2026-07-30', 0)],
      '2026-07-30',
    );
    expect(result.vsYesterdayPercent).toBe(0);
  });

  it('returns null percent when yesterday was zero and today is not', () => {
    const result = buildDashboardCompletedToday(
      [point('2026-07-29', 0), point('2026-07-30', 4)],
      '2026-07-30',
    );
    expect(result.vsYesterdayPercent).toBeNull();
  });
});
