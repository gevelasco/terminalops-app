import type { Equipment, Unit } from '@shared/models/logistics.models';
import type { TripStatus } from '@shared/models/logistics.models';
import { resolveUnitOperationalKey } from '@shared/utils/fleet/fleet-status.resolver';

export function fleetOperationalKeyFromUnit(
  unit: Unit,
  activeTripStatus?: TripStatus,
): ReturnType<typeof resolveUnitOperationalKey> {
  return resolveUnitOperationalKey({
    persistedStatus: unit.status,
    isActive: unit.isActive !== false,
    activeTripStatus,
  });
}

/** @deprecated Use resolveUnitOperationalKey from fleet-status.resolver. */
export function fleetOperationalKeyFromEquipment(
  equipment: Equipment,
  activeTripStatus?: TripStatus,
): ReturnType<typeof resolveUnitOperationalKey> {
  return resolveUnitOperationalKey({
    persistedStatus: equipment.status,
    isActive: equipment.isActive !== false,
    activeTripStatus,
  });
}

export function fleetUnitIsOnRoute(unit: Unit | null | undefined): boolean {
  if (!unit) {
    return false;
  }
  return fleetOperationalKeyFromUnit(unit) === 'on_route';
}

export function fleetUnitIdIsOnRoute(
  unitId: string | null | undefined,
  catalog: readonly Unit[],
): boolean {
  const id = unitId?.trim();
  if (!id) {
    return false;
  }
  return fleetUnitIsOnRoute(catalog.find((u) => u.id === id));
}

export function unitsOnRouteIds(units: readonly Unit[]): Set<string> {
  const ids = new Set<string>();
  for (const u of units) {
    if (fleetOperationalKeyFromUnit(u) === 'on_route') {
      ids.add(u.id);
    }
  }
  return ids;
}
