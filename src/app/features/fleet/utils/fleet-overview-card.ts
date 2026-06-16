import {
  fleetMaintenanceKmRemaining,
  fleetOperationalKeyLabel,
  fleetOperationalPillClass,
  nextInsuranceTableDate,
  nextMaintenanceTableDate,
  nextVerificationTableDate,
  type FleetOperationalKey,
  type FleetRenewalBucket,
} from '@features/fleet/utils/fleet-unit-table-row';
import type { Trip, Unit } from '@shared/models/logistics.models';
import { resourceIdKey, resourceIdsEqual } from '@shared/utils/resource-id';

export type FleetOverviewPanelMode = 'maneuver' | 'parked';

/** Usado por otros módulos (p. ej. Operadores); Flota no consume /trips. */
export function activeTripForUnit(
  unitId: string | number,
  trips: readonly Trip[],
): Trip | null {
  const id = resourceIdKey(unitId);
  if (!id) {
    return null;
  }
  const mine = trips.filter((t) => resourceIdsEqual(t.unitId, id));
  const inTransit = mine.find((t) => t.status === 'in_transit');
  if (inTransit) {
    return inTransit;
  }
  const scheduled = mine
    .filter((t) => t.status === 'scheduled')
    .slice()
    .sort((a, b) => a.plannedDepartureAt.localeCompare(b.plannedDepartureAt));
  return scheduled[0] ?? null;
}

/** Sin datos de maniobra en Flota: panel de mantenimiento para todas las unidades. */
export function fleetOverviewPanelMode(
  _operational: FleetOperationalKey,
): FleetOverviewPanelMode {
  return 'parked';
}

export function fleetOverviewStatusPill(
  operational: FleetOperationalKey,
): { className: string; label: string } {
  return {
    className: fleetOperationalPillClass(operational),
    label: fleetOperationalKeyLabel(operational),
  };
}

export function fleetRenewalIconClass(bucket: FleetRenewalBucket): string {
  const base = 'to-table-fleet-icon';
  if (bucket === 'soon') {
    return `${base} ${base}--soon`;
  }
  if (bucket === 'due') {
    return `${base} ${base}--due`;
  }
  return `${base} ${base}--muted`;
}

export function fleetOverviewLastMaintenanceLabel(unit: Unit): string {
  const raw = unit.fleetMeta?.lastMaintenanceDate?.trim();
  if (!raw) {
    return '—';
  }
  const d = new Date(`${raw}T12:00:00`);
  if (Number.isNaN(d.getTime())) {
    return raw;
  }
  return new Intl.DateTimeFormat('es-MX', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(d);
}

export function fleetOverviewNextMaintenanceLabel(unit: Unit): string {
  return nextMaintenanceTableDate(unit.fleetMeta) ?? '—';
}

export function fleetOverviewKmSinceMaintenance(
  unit: Unit,
  completedTripKm: number | null | undefined,
): string {
  if (completedTripKm == null || !Number.isFinite(completedTripKm)) {
    const rem = fleetMaintenanceKmRemaining(unit.fleetMeta, completedTripKm);
    if (rem != null) {
      return `${Math.round(rem).toLocaleString('es-MX')} km restantes`;
    }
    return '—';
  }
  const rawBase = unit.fleetMeta?.maintenanceTripKmAtLastService;
  const baseline =
    typeof rawBase === 'number' && Number.isFinite(rawBase) ? rawBase : 0;
  const traveled = Math.max(0, completedTripKm - baseline);
  return `${Math.round(traveled).toLocaleString('es-MX')} km`;
}

export function fleetOverviewInsuranceNext(unit: Unit): string {
  return nextInsuranceTableDate(unit.fleetMeta) ?? '—';
}

export function fleetOverviewVerificationNext(unit: Unit): string {
  return nextVerificationTableDate(unit.fleetMeta) ?? '—';
}

/** Valor estable (demo) hasta calcular desgaste real. */
export function fleetOverviewTireStatusApprox(unitId: string): string {
  const options = ['Bueno', 'Regular', 'Revisar pronto', 'Desgaste alto'];
  let h = 0;
  for (const ch of unitId) {
    h = (h * 31 + ch.charCodeAt(0)) | 0;
  }
  return options[Math.abs(h) % options.length] ?? options[0]!;
}

export function fleetOverviewSortRank(operational: FleetOperationalKey): number {
  if (operational === 'on_route') {
    return 2;
  }
  if (operational === 'scheduled') {
    return 1;
  }
  if (operational === 'maintenance') {
    return 3;
  }
  if (operational === 'available') {
    return 0;
  }
  return 4;
}

export function unitMatchesOverviewStatusFilter(
  operational: FleetOperationalKey,
  filter: FleetOperationalKey | 'all',
): boolean {
  if (filter === 'all') {
    return true;
  }
  return operational === filter;
}
