import {
  operationalKey,
  operationalKeyEquipment,
  type FleetOperationalKey,
} from '@features/fleet/utils/fleet-unit-table-row';
import type { Equipment, Unit } from '@shared/models/logistics.models';

/** Estado operativo de unidad desde DB (sync backend). */
export function fleetOperationalKeyFromUnit(unit: Unit): FleetOperationalKey {
  const s = (unit.status ?? '').trim().toLowerCase();
  switch (s) {
    case 'in_use':
      return 'on_route';
    case 'scheduled':
      return 'scheduled';
    case 'maintenance':
      return 'maintenance';
    case 'available':
      return 'available';
    default:
      return operationalKey(unit, false);
  }
}

/** Estado operativo de equipo desde DB (sync backend). */
export function fleetOperationalKeyFromEquipment(
  equipment: Equipment,
): FleetOperationalKey {
  const s = (equipment.status ?? '').trim().toLowerCase();
  switch (s) {
    case 'in_use':
      return 'on_route';
    case 'scheduled':
      return 'scheduled';
    case 'maintenance':
      return 'maintenance';
    case 'available':
      return 'available';
    default:
      return operationalKeyEquipment(equipment, false);
  }
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
