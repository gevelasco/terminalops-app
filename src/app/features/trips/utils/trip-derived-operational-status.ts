import {
  operationalKey,
  operationalKeyEquipment,
  type FleetOperationalKey,
} from '@features/fleet/utils/fleet-unit-table-row';
import { activeTripForUnit } from '@features/fleet/utils/fleet-overview-card';
import type {
  Equipment,
  Operator,
  OperatorOperationalStatus,
  Trip,
  TripStatus,
  Unit,
} from '@shared/models/logistics.models';
import { resourceIdKey, resourceIdsEqual } from '@shared/utils/resource-id';

/** Maniobras que impactan el estado operativo visible en Flota / Operadores. */
export const TRIP_ACTIVE_OPERATIONAL_STATUSES: readonly TripStatus[] = [
  'scheduled',
  'in_transit',
];

const OPERATOR_PROTECTED_STATUSES = new Set<OperatorOperationalStatus>([
  'maintenance',
  'leave',
  'inactive',
  'incapacitated',
]);

function isActiveOperationalTrip(t: Trip): boolean {
  return TRIP_ACTIVE_OPERATIONAL_STATUSES.includes(t.status);
}

/** Unidades con maniobra `in_transit` (legacy `onRoute` en tablas de Flota). */
export function unitsInTransitIds(trips: readonly Trip[]): Set<string> {
  const ids = new Set<string>();
  for (const t of trips) {
    if (t.status !== 'in_transit') {
      continue;
    }
    const id = resourceIdKey(t.unitId);
    if (id) {
      ids.add(id);
    }
  }
  return ids;
}

export function activeTripForOperator(
  operatorId: string | number,
  trips: readonly Trip[],
): Trip | null {
  const id = resourceIdKey(operatorId);
  if (!id) {
    return null;
  }
  const mine = trips.filter(
    (t) => isActiveOperationalTrip(t) && resourceIdsEqual(t.operatorId, id),
  );
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

export function activeTripForEquipment(
  equipmentId: string | number,
  trips: readonly Trip[],
): Trip | null {
  const id = resourceIdKey(equipmentId);
  if (!id) {
    return null;
  }
  const mine = trips.filter((t) => {
    if (!isActiveOperationalTrip(t)) {
      return false;
    }
    const ids = t.equipmentIds ?? [];
    return ids.some((eid) => resourceIdsEqual(eid, id));
  });
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

/** Estado operativo de unidad: trips activos primero; luego fallback DB. */
export function deriveUnitFleetOperationalKey(
  unit: Unit,
  trips: readonly Trip[],
): FleetOperationalKey {
  if ((unit.status ?? '').trim().toLowerCase() === 'maintenance') {
    return 'maintenance';
  }
  const active = activeTripForUnit(unit.id, trips);
  if (active?.status === 'in_transit') {
    return 'on_route';
  }
  if (active?.status === 'scheduled') {
    return 'scheduled';
  }
  return operationalKey(unit, false);
}

/** Estado operativo de equipo: `trip_equipment` o unidad asignada; luego fallback DB. */
export function deriveEquipmentFleetOperationalKey(
  equipment: Equipment,
  trips: readonly Trip[],
): FleetOperationalKey {
  if ((equipment.status ?? '').trim().toLowerCase() === 'maintenance') {
    return 'maintenance';
  }
  let active = activeTripForEquipment(equipment.id, trips);
  if (!active && equipment.unitId) {
    active = activeTripForUnit(equipment.unitId, trips);
  }
  if (active?.status === 'in_transit') {
    return 'in_use';
  }
  if (active?.status === 'scheduled') {
    return 'scheduled';
  }
  return operationalKeyEquipment(equipment, false);
}

/** Estado operativo de operador: trips activos primero; respeta estados protegidos en DB. */
export function deriveOperatorOperationalStatus(
  operator: Operator,
  trips: readonly Trip[],
): OperatorOperationalStatus {
  if (OPERATOR_PROTECTED_STATUSES.has(operator.status)) {
    return operator.status;
  }
  const active = activeTripForOperator(operator.id, trips);
  if (active?.status === 'in_transit') {
    return 'on_route';
  }
  if (active?.status === 'scheduled') {
    return 'scheduled';
  }
  return operator.status;
}
