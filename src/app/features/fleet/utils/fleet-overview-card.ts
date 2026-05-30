import {
  fleetMaintenanceKmRemaining,
  fleetOperationalKeyLabel,
  fleetOperationalPillClass,
  nextInsuranceTableDate,
  nextMaintenanceTableDate,
  nextVerificationTableDate,
  operationalKey,
  type FleetOperationalKey,
  type FleetRenewalBucket,
} from '@features/fleet/utils/fleet-unit-table-row';
import {
  approximateManeuverDaysLabel,
  approximateManeuverKmLabel,
  maneuverTimeProgress,
} from '@features/trips/utils/maniobra-schema-eta';
import {
  schemaOperationalStatusClass,
  schemaOperationalStatusLabel,
} from '@features/trips/utils/maniobra-schema-operational-status';
import { formatTripIsoOneLine } from '@features/trips/utils/maniobra-trip-schema-timeline';
import type { Trip, Unit } from '@shared/models/logistics.models';
import { resourceIdKey, resourceIdsEqual } from '@shared/utils/resource-id';
import { formatStackedMx } from '@shared/utils/format-datetime-mx';
import { formatTripRouteLabel } from '@shared/utils/trip-route-label';

export type FleetOverviewPanelMode = 'maneuver' | 'parked';

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
    .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
  return scheduled[0] ?? null;
}

export function fleetOverviewPanelMode(
  operational: FleetOperationalKey,
  trip: Trip | null,
): FleetOverviewPanelMode {
  if (trip?.status === 'in_transit' || trip?.status === 'scheduled') {
    return 'maneuver';
  }
  if (operational === 'on_route' && trip) {
    return 'maneuver';
  }
  return 'parked';
}

export function fleetOverviewStatusPill(
  trip: Trip | null,
  operational: FleetOperationalKey,
): { className: string; label: string } {
  if (trip?.status === 'scheduled') {
    return {
      className: fleetOperationalPillClass('scheduled'),
      label: fleetOperationalKeyLabel('scheduled'),
    };
  }
  if (trip?.status === 'in_transit') {
    return {
      className: schemaOperationalStatusClass(trip),
      label: schemaOperationalStatusLabel(trip),
    };
  }
  return {
    className: fleetOperationalPillClass(operational),
    label: fleetOperationalKeyLabel(operational),
  };
}

export function fleetOverviewDepartureLine(trip: Trip): string {
  const dep = formatStackedMx(trip.departureAt);
  if (dep) {
    return `${dep.date} · ${dep.time}`;
  }
  const sch = formatStackedMx(trip.scheduledAt);
  if (sch) {
    return `Salida prevista: ${sch.date} · ${sch.time}`;
  }
  return '—';
}

export function fleetOverviewRouteLabel(trip: Trip): string {
  return formatTripRouteLabel(trip.origin, trip.destination);
}

export function fleetOverviewArrivalLine(trip: Trip): string {
  return formatTripIsoOneLine(trip.arrivedAt);
}

export function fleetOverviewReturnLine(trip: Trip): string {
  return formatTripIsoOneLine(trip.returnAt);
}

export function fleetOverviewEtaDays(trip: Trip): string {
  return approximateManeuverDaysLabel(trip);
}

export function fleetOverviewEtaKm(trip: Trip): string {
  return approximateManeuverKmLabel(trip);
}

export function fleetOverviewProgress(trip: Trip) {
  return maneuverTimeProgress(trip);
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

export function fleetOverviewSortRank(
  operational: FleetOperationalKey,
  trip: Trip | null = null,
): number {
  if (trip?.status === 'in_transit' || operational === 'on_route') {
    return 2;
  }
  if (trip?.status === 'scheduled' || operational === 'scheduled') {
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
  trip: Trip | null,
  filter: FleetOperationalKey | 'all',
): boolean {
  if (filter === 'all') {
    return true;
  }
  if (filter === 'on_route') {
    return trip?.status === 'in_transit' || operational === 'on_route';
  }
  if (filter === 'scheduled') {
    return trip?.status === 'scheduled' || operational === 'scheduled';
  }
  return operational === filter;
}
