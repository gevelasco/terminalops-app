import { buildBetaMonthlyBillingEntries } from './account-billing-history.util';
import type { CompanyAccount } from '@core/services/api/company-users';

function account(partial: Partial<CompanyAccount> = {}): CompanyAccount {
  return {
    id: 1,
    name: 'Demo',
    tagline: null,
    logoDataUrl: null,
    subscriptionStatus: 'active',
    subscriptionPlan: 'basic',
    subscriptionEndsAt: null,
    createdAt: '2026-05-15T15:00:00.000Z',
    ...partial,
  };
}

describe('buildBetaMonthlyBillingEntries', () => {
  it('generates one paid $0.00 MXN row per month since account creation', () => {
    const now = new Date('2026-07-30T18:00:00.000Z');
    const rows = buildBetaMonthlyBillingEntries(account(), now);

    expect(rows).toHaveSize(3);
    expect(rows.every((r) => r.status === 'paid')).toBeTrue();
    expect(rows.every((r) => r.amountLabel.includes('$0.00'))).toBeTrue();
    expect(rows.every((r) => r.amountLabel.includes('MXN'))).toBeTrue();
    expect(rows.every((r) => r.statusLabel === 'Pagado')).toBeTrue();
    // Newest first
    expect(rows[0]?.id).toBe('beta-2026-07');
    expect(rows[2]?.id).toBe('beta-2026-05');
  });
});
