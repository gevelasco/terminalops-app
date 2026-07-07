import type { CompanyMaintenancePolicy } from '@shared/models/company-operational-settings.models';
import type { UnitFleetMeta } from '@shared/models/logistics.models';

export function parseMaintenanceKmCounter(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
    return value;
  }
  return 0;
}

/** Km restantes = intervalo global − contador de la unidad. */
export function fleetMaintenanceKmRemainingFromCounter(
  meta: UnitFleetMeta | undefined,
  policy: CompanyMaintenancePolicy | undefined,
): number | null {
  if (!policy?.kmControlEnabled || policy.kmIntervalDefault == null) {
    return null;
  }
  const counter = parseMaintenanceKmCounter(meta?.maintenanceKmCounter);
  return Math.max(0, policy.kmIntervalDefault - counter);
}

export function formatMaintenanceKmCounterLabel(meta: UnitFleetMeta | undefined): string {
  const n = parseMaintenanceKmCounter(meta?.maintenanceKmCounter);
  return `${new Intl.NumberFormat('es-MX', { maximumFractionDigits: 0 }).format(n)} km`;
}
