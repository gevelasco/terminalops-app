import { of } from 'rxjs';
import type { ExpensesService } from '@core/services/api/expenses';
import type { Expense } from '@shared/models/logistics.models';
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

  it('loads every ledger page so early installments are not dropped', () => {
    const items = [{ id: '1' }, { id: '2' }] as Expense[];
    const getAllExpenses = jasmine
      .createSpy('getAllExpenses')
      .and.returnValue(of(items));
    const setItems = jasmine.createSpy('setItems');

    subscribeFleetCoverageExpensesPage({
      expensesApi: { getAllExpenses } as unknown as ExpensesService,
      scope: { resource: 'equipment', equipmentId: '7' },
      kind: 'tenure_payment',
      bounds: { from: '2026-08-26', to: '2028-06-26' },
      requestId: 1,
      isCurrentRequest: () => true,
      setItems,
    });

    expect(getAllExpenses).toHaveBeenCalledWith({
      from: '2026-08-26',
      to: '2028-06-26',
      kind: 'tenure_payment',
      relatedEquipmentId: '7',
    });
    expect(setItems).toHaveBeenCalledWith(items);
  });
});
