import type { Equipment } from '@shared/models/logistics.models';
import { formatEquipmentOperationalId } from '@shared/utils/fleet/fleet-id-builders';
import { resourceIdKey, resourceIdsEqual } from '@shared/utils/resource-id';

/** Código operativo a partir del id y el catálogo de equipos cargado en memoria. */
export function labelForEquipmentId(
  equipmentId: string | number,
  equipment: readonly Equipment[],
): string {
  const id = resourceIdKey(equipmentId);
  if (!id) {
    return '—';
  }
  const e = equipment.find((x) => resourceIdsEqual(x.id, id));
  return e ? formatEquipmentOperationalId(e) : id;
}
