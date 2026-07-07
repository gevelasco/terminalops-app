import {
  canConfirmInsurancePayment,
  daysUntilInsurancePayment,
  nextInsurancePaymentDate,
} from './fleet-insurance-payment.util';

describe('fleet-insurance-payment.util', () => {
  const monthlyMeta = {
    insuranceContractDate: '2026-07-02',
    insurancePaymentCadence: 'Mensual',
    insuranceCost: 7500,
  };

  it('computes next monthly payment from contract date', () => {
    const next = nextInsurancePaymentDate(monthlyMeta);
    expect(next?.toISOString().slice(0, 10)).toBe('2026-08-02');
  });

  it('rolls next payment from last payment date', () => {
    const next = nextInsurancePaymentDate({
      ...monthlyMeta,
      insuranceLastPaymentDate: '2026-08-02',
    });
    expect(next?.toISOString().slice(0, 10)).toBe('2026-09-02');
  });

  it('allows confirm within 10 days of due date', () => {
    expect(daysUntilInsurancePayment(monthlyMeta, new Date(2026, 7, 23))).toBe(10);
    expect(canConfirmInsurancePayment(monthlyMeta, new Date(2026, 7, 23))).toBe(true);
  });

  it('blocks confirm when due date is more than 10 days away', () => {
    expect(canConfirmInsurancePayment(monthlyMeta, new Date(2026, 6, 15))).toBe(false);
  });
});
