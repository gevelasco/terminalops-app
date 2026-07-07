import type { Expense, Trip } from '@shared/models/logistics.models';
import {
  buildManiobraSettlementSummary,
  resolveCreditDueUrgency,
} from './maniobra-settlement';

function tripFixture(overrides: Partial<Trip> = {}): Trip {
  return {
    id: 'trip-1',
    maneuverCode: 'CHI-0006',
    status: 'completed',
    hasClientBilling: true,
    clientCharge: '30000',
    dieselAmount: '5989',
    casetasAmount: '3100',
    operatorQuota: '3100',
    ...overrides,
  } as Trip;
}

function expenseFixture(overrides: Partial<Expense> = {}): Expense {
  return {
    id: 'exp-1',
    tripId: 'trip-1',
    category: 'Combustible',
    amount: 5_989,
    currency: 'MXN',
    incurredAt: '2026-06-25T17:07:00.000Z',
    kind: 'fuel',
    ...overrides,
  } as Expense;
}

describe('buildManiobraSettlementSummary', () => {
  it('uses trip programmed costs when ledger has no auto expenses', () => {
    const summary = buildManiobraSettlementSummary(tripFixture(), []);

    expect(summary.spent).toBe(5_989 + 3_100 + 3_100);
    expect(summary.lines.filter((line) => line.source === 'trip').length).toBe(3);
    expect(summary.lines.filter((line) => line.source === 'ledger').length).toBe(0);
  });

  it('does not duplicate diesel, tolls and operator when ledger already has them', () => {
    const expenses: Expense[] = [
      expenseFixture({ id: 'fuel', kind: 'fuel', amount: 5_989, category: 'Combustible' }),
      expenseFixture({
        id: 'tolls',
        kind: 'tolls',
        amount: 3_100,
        category: 'Casetas',
      }),
      expenseFixture({
        id: 'operator',
        kind: 'operator_payment',
        amount: 3_100,
        category: 'Pago a operador',
      }),
      expenseFixture({
        id: 'control',
        kind: 'operational_control',
        amount: 1_500,
        category: 'Control operativo',
      }),
      expenseFixture({
        id: 'per-diem',
        kind: 'per_diem',
        amount: 500,
        category: 'Viáticos',
      }),
    ];

    const summary = buildManiobraSettlementSummary(tripFixture(), expenses);

    expect(summary.lines.filter((line) => line.source === 'trip').length).toBe(0);
    expect(summary.lines.filter((line) => line.source === 'ledger').length).toBe(5);
    expect(summary.spent).toBe(5_989 + 3_100 + 3_100 + 1_500 + 500);
  });

  it('appends diesel liters to combustible expense detail when trip has liters', () => {
    const summary = buildManiobraSettlementSummary(
      tripFixture({ dieselLiters: '312.5' }),
      [
        expenseFixture({
          id: 'fuel',
          kind: 'fuel',
          amount: 5_989,
          category: 'Combustible',
          description: 'Diesel — maniobra CHI-0006',
        }),
      ],
    );

    const fuelLine = summary.lines.find((line) => line.id === 'fuel');
    expect(fuelLine?.detail).toBe('Diesel 312.5 L — maniobra CHI-0006');
  });

  it('formats operational control detail with compact percent label', () => {
    const summary = buildManiobraSettlementSummary(
      tripFixture({ clientCharge: '30000' }),
      [
        expenseFixture({
          id: 'control',
          kind: 'operational_control',
          amount: 1_500,
          category: 'Control operativo',
          description:
            'Control operativo (5% del cobro al cliente) — maniobra CHI-0006',
        }),
      ],
    );

    const controlLine = summary.lines.find((line) => line.id === 'control');
    expect(controlLine?.detail).toBe('Control operativo 5% — maniobra CHI-0006');
  });

  it('shows remaining credit collection days beside credit badge', () => {
    const summary = buildManiobraSettlementSummary(
      tripFixture({
        status: 'completed',
        creditDays: 10,
        returnAt: '2026-06-28T18:00:00.000Z',
      }),
      [],
    );

    expect(summary.paymentStatus).toBe('credit_pending');
    expect(summary.paymentDetail).toMatch(/Quedan \d+ días|Queda 1 día|Vence hoy|Venció hace/);
  });

  it('keeps manual repair expenses without duplicating programmed costs', () => {
    const expenses: Expense[] = [
      expenseFixture({ id: 'fuel', kind: 'fuel', amount: 22_706, category: 'Combustible' }),
      expenseFixture({
        id: 'tolls',
        kind: 'tolls',
        amount: 12_000,
        category: 'Casetas',
      }),
      expenseFixture({
        id: 'operator',
        kind: 'operator_payment',
        amount: 8_000,
        category: 'Pago a operador',
      }),
      expenseFixture({
        id: 'control',
        kind: 'operational_control',
        amount: 4_000,
        category: 'Control operativo',
      }),
      expenseFixture({
        id: 'repair',
        tripId: 'trip-1',
        kind: 'repair',
        amount: 5_000,
        category: 'Reparación',
        description: 'Llanta ponchada',
      }),
    ];

    const summary = buildManiobraSettlementSummary(
      tripFixture({
        maneuverCode: 'SF-0004',
        clientCharge: '80000',
        dieselAmount: '22706',
        casetasAmount: '12000',
        operatorQuota: '8000',
      }),
      expenses,
    );

    expect(summary.lines.filter((line) => line.source === 'trip').length).toBe(0);
    expect(summary.lines.some((line) => line.label === 'Reparación')).toBe(true);
    expect(summary.spent).toBe(22_706 + 12_000 + 8_000 + 4_000 + 5_000);
  });
});

describe('resolveCreditDueUrgency', () => {
  it('returns on_track before due date', () => {
    expect(
      resolveCreditDueUrgency(new Date('2026-07-08T12:00:00'), new Date('2026-07-01T12:00:00')),
    ).toBe('on_track');
  });

  it('returns due_today on due date', () => {
    expect(
      resolveCreditDueUrgency(new Date('2026-07-08T18:00:00'), new Date('2026-07-08T09:00:00')),
    ).toBe('due_today');
  });

  it('returns overdue after due date', () => {
    expect(
      resolveCreditDueUrgency(new Date('2026-07-08T12:00:00'), new Date('2026-07-09T12:00:00')),
    ).toBe('overdue');
  });
});
