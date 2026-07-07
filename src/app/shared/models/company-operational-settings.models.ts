/** Periodo estándar para próximo mantenimiento por calendario (empresa). */
export type MaintenanceDatePeriod = 'monthly' | 'quarterly' | 'semiannual' | 'annual';

/** Modo de política de mantenimiento a nivel empresa (excluyentes). */
export type CompanyMaintenancePolicyMode = 'none' | 'km' | 'date';

export interface CompanyMaintenancePolicy {
  kmControlEnabled: boolean;
  kmIntervalDefault: number | null;
  dateControlEnabled: boolean;
  datePeriod: MaintenanceDatePeriod | null;
}

export interface CompanyOperationalCenter {
  operationalCenterName?: string;
  operationalCenterPostalCode?: string;
  operationalCenterCityMunicipality?: string;
  operationalCenterLocality?: string;
  operationalCenterSettlementConsId?: string;
  operationalCenterLatitude?: number;
  operationalCenterLongitude?: number;
}

export interface CompanyOperationalSettings extends CompanyOperationalCenter {
  operationalAnalysisEnabled: boolean;
  operationalAnalysisChangedAt?: string;
  tripAssistPrefillEnabled: boolean;
  tripAssistPrefillChangedAt?: string;
  tripAutoMaintenanceProvisionPercent: number;
  dieselControlEnabled: boolean;
  dieselControlChangedAt?: string;
  maintenanceKmControlEnabled: boolean;
  maintenanceKmIntervalDefault?: number;
  maintenanceKmControlChangedAt?: string;
  maintenanceDateControlEnabled: boolean;
  maintenanceDatePeriodDefault?: MaintenanceDatePeriod;
  maintenanceDateControlChangedAt?: string;
}

export const MAINTENANCE_DATE_PERIOD_OPTIONS: readonly {
  value: MaintenanceDatePeriod;
  label: string;
}[] = [
  { value: 'monthly', label: 'Mensual' },
  { value: 'quarterly', label: 'Trimestral' },
  { value: 'semiannual', label: 'Semestral' },
  { value: 'annual', label: 'Anual' },
] as const;

export function maintenanceDatePeriodLabel(
  period: MaintenanceDatePeriod | null | undefined,
): string {
  return (
    MAINTENANCE_DATE_PERIOD_OPTIONS.find((o) => o.value === period)?.label ?? '—'
  );
}

export function companyMaintenancePolicyModeFromSession(input: {
  maintenanceKmControlEnabled?: boolean;
  maintenanceKmIntervalDefault?: number | null;
  maintenanceDateControlEnabled?: boolean;
  maintenanceDatePeriodDefault?: MaintenanceDatePeriod | null;
}): CompanyMaintenancePolicyMode {
  const policy = companyMaintenancePolicyFromSession(input);
  if (policy.kmControlEnabled) {
    return 'km';
  }
  if (policy.dateControlEnabled) {
    return 'date';
  }
  return 'none';
}

export function companyMaintenancePolicyFromSession(input: {
  maintenanceKmControlEnabled?: boolean;
  maintenanceKmIntervalDefault?: number | null;
  maintenanceDateControlEnabled?: boolean;
  maintenanceDatePeriodDefault?: MaintenanceDatePeriod | null;
}): CompanyMaintenancePolicy {
  const kmDefault = input.maintenanceKmIntervalDefault;
  const kmInterval =
    typeof kmDefault === 'number' && Number.isFinite(kmDefault) && kmDefault > 0
      ? kmDefault
      : null;
  return {
    kmControlEnabled: input.maintenanceKmControlEnabled === true && kmInterval != null,
    kmIntervalDefault: kmInterval,
    dateControlEnabled:
      input.maintenanceDateControlEnabled === true &&
      input.maintenanceDatePeriodDefault != null,
    datePeriod: input.maintenanceDatePeriodDefault ?? null,
  };
}
