import type { CompanyMaintenancePolicy } from '@shared/models/company-operational-settings.models';
import type { UnitFleetMeta } from '@shared/models/logistics.models';

/** Tipo de catálogo que marca un servicio completo de motor / mantenimiento programado. */
export const FLEET_MAINTENANCE_KM_RESET_TYPE = 'servicio_completo';

/** Solo el servicio completo reinicia el contador de km desde el último servicio mayor. */
export function fleetMaintenanceResetsKmCounter(typeValue: string | undefined | null): boolean {
  return (typeValue?.trim() ?? '') === FLEET_MAINTENANCE_KM_RESET_TYPE;
}

/** Entrada manual de km acumulados (mantenimiento por km). Vacío = 0. */
export function parseMaintenanceKmCounterInput(raw: string): number | 'invalid' {
  const t = raw.trim().replace(/,/g, '');
  if (t === '') {
    return 0;
  }
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0) {
    return 'invalid';
  }
  return Math.round(n);
}

export function fleetMaintenanceKmRemainingFromCounterInput(
  counterInput: string,
  policy: CompanyMaintenancePolicy | undefined,
): number | null {
  const parsed = parseMaintenanceKmCounterInput(counterInput);
  if (parsed === 'invalid') {
    return null;
  }
  return fleetMaintenanceKmRemainingFromCounter(
    { maintenanceKmCounter: parsed },
    policy,
  );
}

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

export function formatMaintenanceKmRemainingLabel(remaining: number): string {
  return `${formatKmAmount(remaining)} km`;
}

function formatKmAmount(value: number): string {
  return new Intl.NumberFormat('es-MX', { maximumFractionDigits: 0 }).format(value);
}
