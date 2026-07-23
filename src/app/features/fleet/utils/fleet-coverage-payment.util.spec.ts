import {
  confirmFleetCoverageSchedulePayment,
  resolveFleetCoverageConfirmDueDate,
  subscribeFleetCoverageExpensesPage,
  type FleetCoverageScheduleRow,
} from '@features/fleet/utils/fleet-coverage-payment.util';
import {
  fleetPaymentDueYmdFromDate,
  lookupFleetCoverageConfirmExpense,
} from '@features/fleet/utils/fleet-coverage-payment.util';

describe('fleet-coverage-payment.util', () => {
  const schedule: FleetCoverageScheduleRow[] = [
    { dueDate: '2026-01-15', canConfirm: false, expenseId: 'e1' },
    { dueDate: '2026-02-15', canConfirm: true, expenseId: 'e2' },
    { dueDate: '2026-03-15', canConfirm: false },
  ];

  it('formats local due ymd from date', () => {
    expect(fleetPaymentDueYmdFromDate(new Date(2026, 6, 3))).toBe('2026-07-03');
  });

  it('resolves confirmable schedule row first', () => {
    expect(
      resolveFleetCoverageConfirmDueDate(schedule, new Date(2026, 0, 1)),
    ).toBe('2026-02-15');
  });

  it('falls back to next date when no confirmable row', () => {
    expect(
      resolveFleetCoverageConfirmDueDate(
        [{ dueDate: '2026-01-15', canConfirm: false }],
        new Date(2026, 5, 10),
      ),
    ).toBe('2026-06-10');
  });

  it('looks up expense for confirmable due date', () => {
    expect(lookupFleetCoverageConfirmExpense(schedule, '2026-02-15')).toEqual({
      ok: true,
      expenseId: 'e2',
    });
    expect(lookupFleetCoverageConfirmExpense(schedule, '2026-01-15')).toEqual({
      ok: false,
      reason: 'blocked',
    });
    expect(lookupFleetCoverageConfirmExpense(schedule, '2026-03-15')).toEqual({
      ok: false,
      reason: 'blocked',
    });
    expect(lookupFleetCoverageConfirmExpense(schedule, '2026-04-15')).toEqual({
      ok: false,
      reason: 'missing_expense',
    });
  });

  it('confirmFleetCoverageSchedulePayment is exported for facades', () => {
    expect(typeof confirmFleetCoverageSchedulePayment).toBe('function');
    expect(typeof subscribeFleetCoverageExpensesPage).toBe('function');
  });
});
