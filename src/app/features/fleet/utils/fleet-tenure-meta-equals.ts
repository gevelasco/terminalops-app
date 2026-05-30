import type { EquipmentFleetMeta, UnitFleetMeta } from '@shared/models/logistics.models';

type TenureMeta = UnitFleetMeta | EquipmentFleetMeta;

function tenureSnapshot(meta: TenureMeta | undefined): string {
  if (!meta) {
    return '';
  }
  return JSON.stringify({
    trailerTenureMode: meta.trailerTenureMode ?? null,
    trailerCommercialValue: meta.trailerCommercialValue ?? null,
    trailerRecurringPaymentAmount: meta.trailerRecurringPaymentAmount ?? null,
    trailerRecurringPaymentDate: meta.trailerRecurringPaymentDate ?? null,
    trailerRecurringInstallmentCount: meta.trailerRecurringInstallmentCount ?? null,
    trailerManagementOwnerPayout: meta.trailerManagementOwnerPayout ?? null,
  });
}

export function fleetTenureMetaEquals(
  a: TenureMeta | undefined,
  b: TenureMeta | undefined,
): boolean {
  return tenureSnapshot(a) === tenureSnapshot(b);
}
