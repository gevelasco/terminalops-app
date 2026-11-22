import type { ClientBalanceOverviewItem } from '@core/services/api/clients';
import { buildDashboardClientTransactions } from './dashboard-client-transactions.util';

describe('buildDashboardClientTransactions', () => {
  const range = { from: '2026-10-22', to: '2026-11-20', today: '2026-11-20' };

  it('agrupa vencidos, próximos y cobros confirmados en el periodo', () => {
    const items: ClientBalanceOverviewItem[] = [
      {
        clientId: 'c1',
        name: 'Logística Norte',
        commercialHealth: 'good_standing',
        summary: {
          hasTrips: true,
          completedCount: 2,
          receivable: 5000,
          nextDueYmd: '2026-11-05',
          upcomingPayments: [
            {
              tripId: 't1',
              maneuverCode: 'M-101',
              dueYmd: '2026-11-05',
              dueLabel: '5 nov',
              amount: 3000,
              badgeVariant: 'danger',
              statusHint: 'Vencido',
            },
            {
              tripId: 't2',
              maneuverCode: 'M-202',
              dueYmd: '2026-11-25',
              dueLabel: '25 nov',
              amount: 2000,
              badgeVariant: 'warning',
              statusHint: 'Vence pronto',
            },
          ],
        },
      },
    ];
    const dailyActivity = [
      {
        date: '2026-11-10',
        incomeCount: 1,
        expenseCount: 0,
        receivableCount: 0,
        payableCount: 0,
        events: [{ kind: 'income' as const, label: 'Acme SA', amount: 12000 }],
      },
    ];
    const rows = buildDashboardClientTransactions(items, dailyActivity, range);
    expect(rows.length).toBe(3);
    expect(rows[0]?.kind).toBe('overdue');
    expect(rows[0]?.statusLabel).toContain('día');
    expect(rows[1]?.kind).toBe('upcoming');
    expect(rows[2]?.kind).toBe('collected');
    expect(rows[2]?.statusLabel).toBe('Confirmado');
  });
});