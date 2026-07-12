import type { ExpenseCalendarItem } from '@core/services/api/expenses';
import { buildDashboardUpcomingPayments } from './dashboard-upcoming-payments.util';

function projectedItem(
  partial: Partial<ExpenseCalendarItem> & {
    projected: NonNullable<ExpenseCalendarItem['projected']>;
  },
): ExpenseCalendarItem {
  return {
    entryType: 'projected',
    sortDate: partial.dateYmd ?? partial.projected.dueDate,
    id: partial.id ?? 'p-1',
    rubroLabel: partial.rubroLabel ?? 'Seguros',
    conceptLabel: partial.conceptLabel ?? 'Póliza',
    amount: partial.amount ?? 1000,
    currency: partial.currency ?? 'MXN',
    dateYmd: partial.dateYmd ?? partial.projected.dueDate,
    statusLabel: 'Pendiente',
    projected: partial.projected,
  };
}

describe('buildDashboardUpcomingPayments', () => {
  const range = {
    today: '2026-07-07',
    to: '2026-07-31',
    fetchFrom: '2025-07-07',
  };

  it('keeps scheduled insurance, gps, verification and operator payments in range', () => {
    const items: ExpenseCalendarItem[] = [
      projectedItem({
        id: 'ins-1',
        amount: 5000,
        dateYmd: '2026-07-15',
        projected: {
          id: 'ins-1',
          source: 'insurance',
          nature: 'scheduled',
          kind: 'insurance',
          rubroLabel: 'Seguros',
          conceptLabel: 'Póliza',
          amount: 5000,
          currency: 'MXN',
          dueDate: '2026-07-15',
          tripId: null,
          relatedUnitId: 1,
          relatedEquipmentId: null,
          relatedOperatorId: null,
          relatedUnitLabel: 'T-101',
          hint: '',
        },
      }),
      projectedItem({
        id: 'op-committed',
        dateYmd: '2026-07-20',
        projected: {
          id: 'op-committed',
          source: 'operator_payment',
          nature: 'committed',
          kind: 'operator_payment',
          rubroLabel: 'Maniobra',
          conceptLabel: 'Pago a operador',
          amount: 2000,
          currency: 'MXN',
          dueDate: '2026-07-20',
          tripId: 1,
          relatedUnitId: null,
          relatedEquipmentId: null,
          relatedOperatorId: 1,
          hint: '',
        },
      }),
    ];

    const rows = buildDashboardUpcomingPayments(items, range);

    expect(rows.length).toBe(1);
    expect(rows[0]?.displayLabel).toBe('Seguro - T-101');
    expect(rows[0]?.dueYmd).toBe('2026-07-15');
    expect(rows[0]?.overdue).toBe(false);
  });

  it('formats gps, insurance equipment and operator labels', () => {
    const items: ExpenseCalendarItem[] = [
      projectedItem({
        id: 'gps-1',
        dateYmd: '2026-07-10',
        projected: {
          id: 'gps-1',
          source: 'gps',
          nature: 'scheduled',
          kind: 'gps',
          rubroLabel: 'GPS',
          conceptLabel: 'Servicio',
          amount: 500,
          currency: 'MXN',
          dueDate: '2026-07-10',
          tripId: null,
          relatedUnitId: 2,
          relatedEquipmentId: null,
          relatedOperatorId: null,
          relatedUnitLabel: 'T-202',
          hint: '',
        },
      }),
      projectedItem({
        id: 'ins-eq',
        dateYmd: '2026-07-12',
        projected: {
          id: 'ins-eq',
          source: 'insurance',
          nature: 'scheduled',
          kind: 'insurance',
          rubroLabel: 'Seguros',
          conceptLabel: 'Póliza',
          amount: 3000,
          currency: 'MXN',
          dueDate: '2026-07-12',
          tripId: null,
          relatedUnitId: null,
          relatedEquipmentId: 5,
          relatedOperatorId: null,
          relatedEquipmentLabel: 'EQ-05',
          hint: '',
        },
      }),
      projectedItem({
        id: 'op-1',
        dateYmd: '2026-07-14',
        projected: {
          id: 'op-1',
          source: 'operator_payment',
          nature: 'scheduled',
          kind: 'operator_payment',
          rubroLabel: 'Maniobra',
          conceptLabel: 'Pago a operador',
          amount: 2000,
          currency: 'MXN',
          dueDate: '2026-07-14',
          tripId: 1,
          relatedUnitId: null,
          relatedEquipmentId: null,
          relatedOperatorId: 3,
          relatedOperatorLabel: 'Juan Pérez',
          hint: '',
        },
      }),
    ];

    const rows = buildDashboardUpcomingPayments(items, range);

    expect(rows.map((row) => row.displayLabel)).toEqual([
      'GPS - T-202',
      'Seguro - EQ-05',
      'Pago - Juan Pérez',
    ]);
  });

  it('includes overdue scheduled payments before today', () => {
    const items: ExpenseCalendarItem[] = [
      projectedItem({
        id: 'gps-overdue',
        dateYmd: '2026-07-01',
        projected: {
          id: 'gps-overdue',
          source: 'gps',
          nature: 'scheduled',
          kind: 'gps',
          rubroLabel: 'GPS',
          conceptLabel: 'Servicio GPS',
          amount: 800,
          currency: 'MXN',
          dueDate: '2026-07-01',
          tripId: null,
          relatedUnitId: 2,
          relatedEquipmentId: null,
          relatedOperatorId: null,
          relatedUnitLabel: 'T-88',
          hint: '',
        },
      }),
    ];

    const rows = buildDashboardUpcomingPayments(items, range);

    expect(rows.length).toBe(1);
    expect(rows[0]?.displayLabel).toBe('GPS - T-88');
    expect(rows[0]?.overdue).toBe(true);
    expect(rows[0]?.dueLabel).toContain('Vencido');
  });

  it('excludes scheduled payments after end of month', () => {
    const items: ExpenseCalendarItem[] = [
      projectedItem({
        id: 'ins-future',
        dateYmd: '2026-08-05',
        projected: {
          id: 'ins-future',
          source: 'insurance',
          nature: 'scheduled',
          kind: 'insurance',
          rubroLabel: 'Seguros',
          conceptLabel: 'Póliza',
          amount: 5000,
          currency: 'MXN',
          dueDate: '2026-08-05',
          tripId: null,
          relatedUnitId: 1,
          relatedEquipmentId: null,
          relatedOperatorId: null,
          hint: '',
        },
      }),
    ];

    const rows = buildDashboardUpcomingPayments(items, range);

    expect(rows.length).toBe(0);
  });
});
