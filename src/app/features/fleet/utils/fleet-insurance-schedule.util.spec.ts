import type { Expense } from '@shared/models/logistics.models';
import {
  buildInsurancePaymentSchedule,
  compactInsurancePaymentSchedule,
  insurancePaymentCompliance,
  insuranceSchedulePeriodCount,
  isAnnualInsuranceCadence,
  showInsurancePaymentSchedule,
} from './fleet-insurance-schedule.util';

const monthlyMeta = {
  insuranceContractDate: '2026-01-15',
  insurancePaymentCadence: 'Mensual',
  insuranceCost: 8500,
};

function expense(ymd: string, id = '1', installment?: number): Expense {
  const period =
    installment != null
      ? `(Mensualidad ${installment}/12)`
      : `(${monthlyMeta.insurancePaymentCadence})`;
  return {
    id,
    tripId: '',
    category: 'AXA',
    amount: 8500,
    currency: 'MXN',
    incurredAt: `${ymd}T12:00:00.000Z`,
    kind: 'insurance',
    description: `Pago de póliza · POL-1 ${period}`,
    insuranceTarget: 'unit',
    relatedUnitId: '7',
  };
}

describe('fleet-insurance-schedule.util', () => {
  it('returns 12 monthly and 4 quarterly periods', () => {
    expect(insuranceSchedulePeriodCount('Mensual')).toBe(12);
    expect(insuranceSchedulePeriodCount('monthly')).toBe(12);
    expect(insuranceSchedulePeriodCount('Trimestral')).toBe(4);
    expect(insuranceSchedulePeriodCount('quarterly')).toBe(4);
    expect(insuranceSchedulePeriodCount('Anual')).toBe(0);
    expect(isAnnualInsuranceCadence('Anual')).toBe(true);
    expect(showInsurancePaymentSchedule('Mensual')).toBe(true);
    expect(showInsurancePaymentSchedule('Anual')).toBe(false);
  });

  it('builds 12 monthly due dates for the current policy year', () => {
    const rows = buildInsurancePaymentSchedule({
      meta: monthlyMeta,
      expenses: [],
      today: new Date(2026, 4, 20),
    });

    expect(rows.length).toBe(12);
    expect(rows[0]?.dueDate).toBe('2026-01-15');
    expect(rows[4]?.dueDate).toBe('2026-05-15');
    expect(rows[11]?.dueDate).toBe('2026-12-15');
  });

  it('marks paid cycles and links expense records', () => {
    const rows = buildInsurancePaymentSchedule({
      meta: monthlyMeta,
      expenses: [
        expense('2026-01-15', 'e1'),
        expense('2026-02-15', 'e2'),
        expense('2026-03-15', 'e3'),
        expense('2026-04-15', 'e4'),
        expense('2026-05-15', 'e5'),
      ],
      today: new Date(2026, 4, 20),
    });

    expect(rows[4]?.status).toBe('paid');
    expect(rows[4]?.expenseId).toBe('e5');
    expect(rows[4]?.paidAmount).toBe(8500);
    expect(rows[5]?.status).toBe('overdue');
  });

  it('enables confirm on the next unpaid due cycle within payment window', () => {
    const rows = buildInsurancePaymentSchedule({
      meta: {
        ...monthlyMeta,
        insuranceContractDate: '2026-06-01',
      },
      expenses: [expense('2026-06-01')],
      today: new Date(2026, 5, 25),
    });

    const mes2 = rows[1];
    expect(mes2?.dueDate).toBe('2026-07-01');
    expect(mes2?.status).toBe('due');
    expect(mes2?.canConfirm).toBe(true);
  });

  it('enables confirm only on the next unpaid overdue cycle', () => {
    const rows = buildInsurancePaymentSchedule({
      meta: monthlyMeta,
      expenses: [
        expense('2026-01-15'),
        expense('2026-02-15'),
        expense('2026-03-15'),
        expense('2026-04-15'),
        expense('2026-05-15'),
      ],
      today: new Date(2026, 5, 20),
    });

    const confirmable = rows.filter((row) => row.canConfirm);
    expect(confirmable.length).toBe(1);
    expect(confirmable[0]?.dueDate).toBe('2026-06-15');
    expect(confirmable[0]?.status).toBe('overdue');
  });

  it('keeps status unchanged when an older payment is removed from expenses', () => {
    const paidThroughMay = [
      expense('2026-01-15'),
      expense('2026-03-15'),
      expense('2026-04-15'),
      expense('2026-05-15'),
    ];

    const rows = buildInsurancePaymentSchedule({
      meta: monthlyMeta,
      expenses: paidThroughMay,
      today: new Date(2026, 4, 10),
    });

    expect(rows[4]?.status).toBe('paid');
    expect(rows[1]?.status).toBe('overdue');
    expect(rows.filter((row) => row.canConfirm)[0]?.dueDate).toBe('2026-02-15');
  });

  it('compacts schedule to paid rows, next unpaid due cycle, and one trailing preview', () => {
    const rows = buildInsurancePaymentSchedule({
      meta: {
        ...monthlyMeta,
        insuranceContractDate: '2026-06-01',
      },
      expenses: [expense('2026-06-01')],
      today: new Date(2026, 5, 25),
    });

    const compact = compactInsurancePaymentSchedule(rows);

    expect(compact.map((row) => row.label)).toEqual(['Mes 1', 'Mes 2', 'Mes 3']);
    expect(compact[1]?.status).toBe('due');
    expect(compact[2]?.status).toBe('future');
  });

  it('shows only one future pending when the next unpaid cycle is not yet due', () => {
    const rows = buildInsurancePaymentSchedule({
      meta: {
        ...monthlyMeta,
        insuranceContractDate: '2026-07-02',
      },
      expenses: [expense('2026-07-02')],
      today: new Date(2026, 6, 5),
    });

    const compact = compactInsurancePaymentSchedule(rows);

    expect(compact.map((row) => row.label)).toEqual(['Mes 1', 'Mes 2']);
    expect(compact[1]?.status).toBe('future');
  });

  it('shows only one future pending after multiple paid cycles', () => {
    const rows = buildInsurancePaymentSchedule({
      meta: {
        ...monthlyMeta,
        insuranceContractDate: '2026-06-01',
      },
      expenses: [expense('2026-06-01'), expense('2026-07-01', 'e2')],
      today: new Date(2026, 6, 5),
    });

    const compact = compactInsurancePaymentSchedule(rows);

    expect(compact.map((row) => row.label)).toEqual(['Mes 1', 'Mes 2', 'Mes 3']);
    expect(compact[2]?.status).toBe('future');
    expect(compact.length).toBe(3);
  });

  it('shows only the last paid cycles when the policy year is fully paid', () => {
    const rows = buildInsurancePaymentSchedule({
      meta: monthlyMeta,
      expenses: Array.from({ length: 12 }, (_, i) => {
        const month = String(i + 1).padStart(2, '0');
        return expense(`2026-${month}-15`, `e${i + 1}`);
      }),
      today: new Date(2026, 11, 20),
    });

    const compact = compactInsurancePaymentSchedule(rows);

    expect(compact.map((row) => row.label)).toEqual(['Mes 10', 'Mes 11', 'Mes 12']);
    expect(compact.every((row) => row.status === 'paid')).toBe(true);
  });

  it('does not mark paid when meta has lastPaymentDate but expense was removed', () => {
    const rows = buildInsurancePaymentSchedule({
      meta: {
        ...monthlyMeta,
        insuranceContractDate: '2026-06-01',
        insuranceLastPaymentDate: '2026-07-01',
      },
      expenses: [expense('2026-07-05', 'e1', 1)],
      today: new Date(2026, 6, 5),
    });

    expect(rows[0]?.status).toBe('paid');
    expect(rows[1]?.status).toBe('overdue');
    expect(rows[1]?.canConfirm).toBe(true);
  });

  it('reports overdue compliance when an earlier cycle is unpaid even if the next is soon', () => {
    const meta = {
      insurancePolicyNumber: 'POL-1',
      insuranceContractDate: '2026-06-12',
      insurancePaymentCadence: 'Mensual',
      insuranceCost: 8500,
    };

    const compliance = insurancePaymentCompliance(meta, {
      expenses: [],
      today: new Date(2026, 6, 6),
    });

    expect(compliance?.bucket).toBe('due');
    expect(compliance?.daysUntil).toBeLessThan(0);
  });

  it('reports soon compliance only when the first unpaid cycle is within the window', () => {
    const meta = {
      insurancePolicyNumber: 'POL-1',
      insuranceContractDate: '2026-06-01',
      insurancePaymentCadence: 'Mensual',
      insuranceCost: 8500,
    };

    const compliance = insurancePaymentCompliance(meta, {
      expenses: [expense('2026-06-01')],
      today: new Date(2026, 5, 25),
    });

    expect(compliance?.bucket).toBe('soon');
    expect(compliance?.daysUntil).toBe(6);
  });
});
