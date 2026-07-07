import type { Expense, Trip } from '@shared/models/logistics.models';
import {
  tripDirectCost,
  tripResolvedDirectCost,
} from './reports-trip-helpers';

function trip(overrides: Partial<Trip> = {}): Trip {
  return {
    id: 'trip-1',
    dieselAmount: '1000',
    casetasAmount: '200',
    operatorQuota: '300',
    perDiemAmount: '50',
    ...overrides,
  } as Trip;
}

function expense(overrides: Partial<Expense> = {}): Expense {
  return {
    id: 'exp-1',
    tripId: 'trip-1',
    category: 'Combustible',
    amount: 1000,
    currency: 'MXN',
    incurredAt: '2026-06-25T12:00:00.000Z',
    kind: 'fuel',
    ...overrides,
  } as Expense;
}

describe('tripResolvedDirectCost', () => {
  it('uses programmed trip fields when ledger has no auto expenses', () => {
    expect(tripDirectCost(trip())).toBe(1550);
    expect(tripResolvedDirectCost(trip(), [])).toBe(1550);
  });

  it('uses ledger once when auto expenses exist for the trip', () => {
    const expenses: Expense[] = [
      expense({ id: 'fuel', kind: 'fuel', amount: 1000 }),
      expense({ id: 'tolls', kind: 'tolls', amount: 200 }),
      expense({
        id: 'operator',
        kind: 'operator_payment',
        amount: 300,
      }),
      expense({
        id: 'repair',
        kind: 'repair',
        amount: 5000,
        category: 'Reparación',
      }),
    ];

    expect(tripResolvedDirectCost(trip(), expenses)).toBe(6500);
  });
});
