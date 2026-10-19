import type { Expense } from '@shared/models/logistics.models';
import { buildTenurePaymentSchedule } from './fleet-tenure-schedule.util';

describe('buildTenurePaymentSchedule', () => {
  it('labels installments sequentially beyond 12 (not insurance policy year)', () => {
    const meta = {
      trailerRecurringPaymentDate: '2026-10-26',
      trailerRecurringPaymentCadence: 'Mensual',
      trailerRecurringInstallmentCount: 18,
      trailerRecurringPaymentAmount: 20_000,
    };
    const expenses: Expense[] = Array.from({ length: 15 }, (_, i) => {
      const d = new Date(2026, 9 + i, 26, 12, 0, 0, 0);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return {
        id: String(i + 1),
        tripId: '',
        category: 'Financiamiento - mensual',
        amount: 20_000,
        currency: 'MXN',
        incurredAt: `${y}-${m}-${day}T12:00:00.000Z`,
        kind: 'tenure_payment',
        description: `Cuota de financiamiento (Mensualidad ${(i % 12) + 1}/12)`,
        paidAt: i < 3 ? '2026-11-01T12:00:00.000Z' : null,
      };
    });

    const rows = buildTenurePaymentSchedule({ meta, expenses, today: new Date('2027-01-15') });
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0]?.label).toBe('Mes 1');
    expect(rows[12]?.label).toBe('Mes 13');
    expect(rows[14]?.label).toBe('Mes 15');
  });
});
