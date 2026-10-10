import {
  clientBalanceCollectionStatus,
  clientBalanceHighlightedPayment,
  emptyClientBalanceSummary,
} from './client-balance-summary';

describe('clientBalanceCollectionStatus', () => {
  it('shows pending maneuver count in red when any payment is overdue', () => {
    const balance = {
      ...emptyClientBalanceSummary(),
      receivable: 84000,
      upcomingPayments: [
        {
          tripId: '1',
          maneuverCode: 'HAP-1',
          dueYmd: '2026-09-21',
          dueLabel: '21 sept 2026',
          amount: 42000,
          badgeVariant: 'danger' as const,
          statusHint: 'Vencido',
        },
        {
          tripId: '2',
          maneuverCode: 'HAP-2',
          dueYmd: '2026-09-25',
          dueLabel: '25 sept 2026',
          amount: 42000,
          badgeVariant: 'danger' as const,
          statusHint: 'Vencido',
        },
      ],
    };

    const status = clientBalanceCollectionStatus(balance, new Date('2026-10-10T12:00:00'));
    expect(status.label).toBe('2 maniobras por cobrar');
    expect(status.variant).toBe('danger');
  });

  it('shows pending maneuver count in warning when due soon', () => {
    const balance = {
      ...emptyClientBalanceSummary(),
      receivable: 46000,
      upcomingPayments: [
        {
          tripId: '1',
          maneuverCode: 'CG-1',
          dueYmd: '2026-10-16',
          dueLabel: '16 oct 2026',
          amount: 46000,
          badgeVariant: 'warning' as const,
          statusHint: 'Vence pronto',
        },
      ],
    };

    const status = clientBalanceCollectionStatus(balance, new Date('2026-10-10T12:00:00'));
    expect(status.label).toBe('1 maniobra por cobrar');
    expect(status.variant).toBe('warning');
  });
});

describe('clientBalanceHighlightedPayment', () => {
  it('puts overdue days in the footer label and keeps the due date on the row', () => {
    const balance = {
      ...emptyClientBalanceSummary(),
      upcomingPayments: [
        {
          tripId: '1',
          maneuverCode: 'HAP-1',
          dueYmd: '2026-09-21',
          dueLabel: '21 sept 2026',
          amount: 42000,
          badgeVariant: 'danger' as const,
          statusHint: 'Vencido',
        },
      ],
    };

    const payment = clientBalanceHighlightedPayment(balance, new Date('2026-10-10T12:00:00'));
    expect(payment.sectionLabel).toBe('Pago vencido 19 días');
    expect(payment.dueLabel).toContain('21');
    expect(payment.overdue).toBe(true);
  });
});
