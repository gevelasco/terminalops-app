import type { Expense, Unit } from '@shared/models/logistics.models';
import {
  companyMaintenancePolicyFromSession,
  type CompanyMaintenancePolicy,
} from '@shared/models/company-operational-settings.models';
import {
  buildFleetEquipmentTableRow,
  buildFleetUnitTableRow,
  fleetInsuranceRenewal,
  fleetMaintenanceRenewal,
  nextInsuranceTableDate,
  nextMaintenanceTableDate,
  nextMaintenanceTableLabel,
} from './fleet-unit-table-row';

const staleLastPaymentMeta = {
  insurancePolicyNumber: '0005323322',
  insuranceCarrierName: 'Qualitas',
  insuranceContractDate: '2026-01-24',
  insuranceLastPaymentDate: '2026-01-24',
  insurancePaymentCadence: 'Mensual',
  insuranceCost: 6824.41,
};

function insuranceExpense(
  ymd: string,
  id: string,
  options: { installment: number; paid: boolean; unitId?: string },
): Expense {
  return {
    id,
    tripId: '',
    category: 'Qualitas',
    amount: 6824.41,
    currency: 'MXN',
    incurredAt: `${ymd}T12:00:00.000Z`,
    kind: 'insurance',
    description: `Pago de póliza · 0005323322 (Mensualidad ${options.installment}/12)`,
    relatedUnitId: options.unitId ?? 'u-1',
    paidAt: options.paid ? `${ymd}T18:00:00.000Z` : null,
  };
}

function paidThroughAugustExpenses(unitId = 'u-1'): Expense[] {
  return [
    insuranceExpense('2026-01-24', '1', { installment: 1, paid: true, unitId }),
    insuranceExpense('2026-02-24', '2', { installment: 2, paid: true, unitId }),
    insuranceExpense('2026-03-24', '3', { installment: 3, paid: true, unitId }),
    insuranceExpense('2026-04-24', '4', { installment: 4, paid: true, unitId }),
    insuranceExpense('2026-05-24', '5', { installment: 5, paid: true, unitId }),
    insuranceExpense('2026-06-24', '6', { installment: 6, paid: true, unitId }),
    insuranceExpense('2026-07-24', '7', { installment: 7, paid: true, unitId }),
    insuranceExpense('2026-08-24', '8', { installment: 8, paid: true, unitId }),
    insuranceExpense('2026-09-24', '9', { installment: 9, paid: false, unitId }),
  ];
}

describe('fleet insurance renewal from ledger', () => {
  const today = new Date(2026, 7, 28);

  it('marks overdue from stale lastPaymentDate when ledger is missing', () => {
    expect(fleetInsuranceRenewal(staleLastPaymentMeta, undefined, today)).toBe('due');
  });

  it('uses paid ledger cycles instead of lastPaymentDate', () => {
    expect(
      fleetInsuranceRenewal(staleLastPaymentMeta, paidThroughAugustExpenses(), today),
    ).toBe('ok');
  });

  it('shows the next unpaid ledger due date in the table', () => {
    expect(
      nextInsuranceTableDate(staleLastPaymentMeta, paidThroughAugustExpenses()),
    ).toMatch(/24\s+sep/i);
  });

  it('builds the units table row from the ledger', () => {
    const unit: Unit = {
      id: 'u-1',
      plate: '98BL2L',
      capacityKg: 0,
      status: 'available',
      name: 'FRE-2012-98BL2L',
      fleetMeta: staleLastPaymentMeta,
    };
    const row = buildFleetUnitTableRow(unit, {
      onRoute: false,
      insuranceExpenses: paidThroughAugustExpenses(),
      today,
    });
    expect(row['fleetIns']).toBe('ok');
    expect(String(row['fleetInsNext'])).toMatch(/24\s+sep/i);
  });
});

describe('fleet maintenance policy exclusivity', () => {
  const kmPolicy: CompanyMaintenancePolicy = {
    kmControlEnabled: true,
    kmIntervalDefault: 100_000,
    dateControlEnabled: false,
    datePeriod: null,
  };
  const datePolicy: CompanyMaintenancePolicy = {
    kmControlEnabled: false,
    kmIntervalDefault: null,
    dateControlEnabled: true,
    datePeriod: 'semiannual',
  };
  const meta = {
    lastMaintenanceDate: '2026-03-13',
    maintenanceKmCounter: 0,
  };

  it('does not invent a calendar due date when the company uses km', () => {
    expect(nextMaintenanceTableDate(meta, kmPolicy)).toBeNull();
    expect(nextMaintenanceTableLabel(meta, kmPolicy)).toBe('100,000 km');
    expect(fleetMaintenanceRenewal(meta, kmPolicy)).toBe('ok');
  });

  it('uses the calendar cycle only when the company uses dates', () => {
    expect(nextMaintenanceTableDate(meta, datePolicy)).toMatch(/13\s+sep/i);
    expect(fleetMaintenanceRenewal(meta, datePolicy)).not.toBe('ok');
  });

  it('does not evaluate dates when no maintenance policy is set', () => {
    expect(nextMaintenanceTableDate(meta)).toBeNull();
    expect(fleetMaintenanceRenewal(meta)).toBe('na');
  });

  it('ignores leftover date settings when the session is km-only', () => {
    const policy = companyMaintenancePolicyFromSession({
      maintenanceKmControlEnabled: true,
      maintenanceKmIntervalDefault: 100_000,
      maintenanceDateControlEnabled: true,
      maintenanceDatePeriodDefault: 'semiannual',
    });
    expect(policy.kmControlEnabled).toBe(true);
    expect(policy.dateControlEnabled).toBe(false);
    expect(nextMaintenanceTableDate(meta, policy)).toBeNull();
    expect(nextMaintenanceTableLabel(meta, policy)).toBe('100,000 km');
    expect(fleetMaintenanceRenewal(meta, policy)).toBe('ok');
  });

  it('builds unit rows with remaining km instead of a date', () => {
    const unit: Unit = {
      id: 'u-1',
      plate: '98BL2L',
      capacityKg: 0,
      status: 'available',
      name: 'FRE-2012-98BL2L',
      fleetMeta: meta,
    };
    const row = buildFleetUnitTableRow(unit, { onRoute: false, policy: kmPolicy });
    expect(row['fleetMaint']).toBe('ok');
    expect(row['fleetMaintNext']).toBe('100,000 km');
  });

  it('shows remaining of interval after km have accumulated', () => {
    const unit: Unit = {
      id: 'u-1',
      plate: '98BL2L',
      capacityKg: 0,
      status: 'available',
      name: 'FRE-2012-98BL2L',
      fleetMeta: { lastMaintenanceDate: '2026-03-13', maintenanceKmCounter: 25_000 },
    };
    const row = buildFleetUnitTableRow(unit, { onRoute: false, policy: kmPolicy });
    expect(row['fleetMaint']).toBe('ok');
    expect(row['fleetMaintNext']).toBe('75,000 km');
  });
});
