import { activeTripForUnit } from '@features/fleet/utils/fleet-overview-card';
import type {
  Equipment,
  Operator,
  Trip,
  TripStatus,
  Unit,
} from '@shared/models/logistics.models';
import { resourceIdKey, resourceIdsEqual } from '@shared/utils/resource-id';
import type { FleetOperationalKey } from '@features/fleet/utils/fleet-unit-table-row';
import {
  resolveOperatorOperationalStatus as resolveOperatorStatus,
  resolveUnitOperationalKey,
  TRIP_FLEET_ACTIVE_STATUSES,
} from '@shared/utils/fleet/fleet-status.resolver';

export { TRIP_FLEET_ACTIVE_STATUSES as TRIP_ACTIVE_OPERATIONAL_STATUSES };

function isActiveOperationalTrip(t: Trip): boolean {
  return TRIP_FLEET_ACTIVE_STATUSES.includes(t.status);
}

/** Unidades con maniobra `in_transit`. */
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

export function deriveUnitFleetOperationalKey(
  unit: Unit,
  trips: readonly Trip[],
): FleetOperationalKey {
  const active = activeTripForUnit(unit.id, trips);
  return resolveUnitOperationalKey({
    persistedStatus: unit.status,
    isActive: unit.isActive !== false,
    activeTripStatus: active?.status,
  });
}

export function deriveEquipmentFleetOperationalKey(
  equipment: Equipment,
  trips: readonly Trip[],
): FleetOperationalKey {
  let active = activeTripForEquipment(equipment.id, trips);
  if (!active && equipment.unitId) {
    active = activeTripForUnit(equipment.unitId, trips);
  }
  return resolveUnitOperationalKey({
    persistedStatus: equipment.status,
    isActive: equipment.isActive !== false,
    activeTripStatus: active?.status,
  });
}

export function deriveOperatorOperationalStatus(
  operator: Operator,
  trips: readonly Trip[],
): Operator['status'] {
  const active = activeTripForOperator(operator.id, trips);
  return resolveOperatorStatus({
    status: operator.status,
    isActive: operator.isActive !== false,
    activeTripStatus: active?.status,
  });
}
