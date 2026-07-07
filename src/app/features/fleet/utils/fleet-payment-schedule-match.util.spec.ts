import type { Expense } from '@shared/models/logistics.models';
import {
  expenseCoverageInstallmentIndex,
  fleetCycleIsPaid,
  fleetPaymentExpenseForCycle,
} from './fleet-payment-schedule-match.util';

function expense(id: string, description: string, incurredAt: string): Expense {
  return {
    id,
    tripId: '',
    category: 'Póliza - mensual',
    amount: 8500,
    currency: 'MXN',
    incurredAt,
    kind: 'insurance',
    description,
    insuranceTarget: 'unit',
    relatedUnitId: '1',
  };
}

describe('fleet-payment-schedule-match.util', () => {
  it('parses installment index from coverage description', () => {
    expect(
      expenseCoverageInstallmentIndex('Pago de póliza · POL (Mensualidad 2/12)'),
    ).toBe(2);
  });

  it('matches expenses by installment instead of sharing one same-day payment', () => {
    const expenses = [
      expense(
        '1',
        'Pago de póliza · POL (Mensualidad 1/12)',
        '2026-07-05T18:00:00.000Z',
      ),
      expense(
        '2',
        'Pago de póliza · POL (Mensualidad 2/12)',
        '2026-07-05T18:00:00.000Z',
      ),
    ];

    expect(
      fleetPaymentExpenseForCycle('2026-06-01', '2026-07-01', expenses, 1)?.id,
    ).toBe('1');
    expect(
      fleetPaymentExpenseForCycle('2026-07-01', '2026-07-01', expenses, 2)?.id,
    ).toBe('2');
  });

  it('does not mark a cycle paid from lastPaymentDate without a matching expense', () => {
    expect(
      fleetCycleIsPaid('2026-07-01', '2026-07-01', undefined),
    ).toBe(false);
    expect(
      fleetCycleIsPaid(
        '2026-06-01',
        '2026-07-01',
        { id: '1' } as Expense,
      ),
    ).toBe(true);
  });
});
