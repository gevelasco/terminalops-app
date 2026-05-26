import type {
  CompanyMaintenancePolicy,
  MaintenanceDatePeriod,
} from '@shared/models/company-operational-settings.models';
import type {
  EquipmentFleetMeta,
  UnitFleetMeta,
} from '@shared/models/logistics.models';

export type FleetMaintenanceMeta = UnitFleetMeta | EquipmentFleetMeta | undefined;

const DEFAULT_MANUAL_SCHEDULE_MONTHS = 6;

export function maintenanceDatePeriodToMonths(period: MaintenanceDatePeriod): number {
  switch (period) {
    case 'monthly':
      return 1;
    case 'quarterly':
      return 3;
    case 'semiannual':
      return 6;
    case 'annual':
      return 12;
    default:
      return DEFAULT_MANUAL_SCHEDULE_MONTHS;
  }
}

export function resolveMaintenanceContext(
  meta: FleetMaintenanceMeta,
  policy: CompanyMaintenancePolicy,
) {
  const unitKm =
    typeof meta?.maintenanceKmInterval === 'number' &&
    Number.isFinite(meta.maintenanceKmInterval) &&
    meta.maintenanceKmInterval > 0
      ? meta.maintenanceKmInterval
      : null;

  const kmControlActive = policy.kmControlEnabled;
  const kmInterval = unitKm ?? (kmControlActive ? policy.kmIntervalDefault : null);
  const alertByKm = kmControlActive ? true : meta?.maintenanceAlertByKm === true;

  const dateControlActive = policy.dateControlEnabled;
  const scheduleMonths = dateControlActive
    ? maintenanceDatePeriodToMonths(policy.datePeriod ?? 'semiannual')
    : DEFAULT_MANUAL_SCHEDULE_MONTHS;

  return {
    alertByKm,
    kmInterval,
    scheduleMonths,
    kmControlActive,
    dateControlActive,
  };
}

/** Meta efectiva para cálculos (intervalo km y modo alerta). */
export function effectiveFleetMetaForMaintenance(
  meta: FleetMaintenanceMeta,
  policy: CompanyMaintenancePolicy,
): UnitFleetMeta | undefined {
  if (!meta && !policy.kmControlEnabled && !policy.dateControlEnabled) {
    return undefined;
  }
  const ctx = resolveMaintenanceContext(meta, policy);
  return {
    ...(meta ?? {}),
    maintenanceAlertByKm: ctx.alertByKm,
    ...(ctx.kmInterval != null ? { maintenanceKmInterval: ctx.kmInterval } : {}),
  };
}
