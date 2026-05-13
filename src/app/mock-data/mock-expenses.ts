import { Expense } from '@shared/models/logistics.models';

export const MOCK_EXPENSES: Expense[] = [
  {
    id: 'ex1',
    tripId: 't1',
    category: 'Fuel',
    amount: 4250.5,
    currency: 'MXN',
    incurredAt: '2026-05-09T12:00:00Z',
  },
  {
    id: 'ex2',
    tripId: 't1',
    category: 'Tolls',
    amount: 890,
    currency: 'MXN',
    incurredAt: '2026-05-09T15:20:00Z',
  },
];
