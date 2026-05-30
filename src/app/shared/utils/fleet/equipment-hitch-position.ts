import type { Equipment, EquipmentHitchPosition } from '@shared/models/logistics.models';
import { resourceIdKey, resourceIdsEqual } from '@shared/utils/resource-id';

/** Orden convoy: delantero (`lead`) antes que trasero (`rear`). */
export function compareEquipmentHitchPosition(a: Equipment, b: Equipment): number {
  const rank = (e: Equipment): number => (e.hitchPosition === 'rear' ? 1 : 0);
  const d = rank(a) - rank(b);
  if (d !== 0) {
    return d;
  }
  return resourceIdKey(a.id).localeCompare(resourceIdKey(b.id));
}

export function sortEquipmentByHitchPosition(list: readonly Equipment[]): Equipment[] {
  return [...list].sort(compareEquipmentHitchPosition);
}

export function normalizeEquipmentHitchPosition(
  raw: string | null | undefined,
): EquipmentHitchPosition | undefined {
  const t = raw?.trim();
  if (t === 'lead' || t === 'rear') {
    return t;
  }
  return undefined;
}

/** Etiqueta de posición para listados y esquema de convoy. */
export function equipmentHitchPositionDisplayLabel(
  e: Equipment,
  index?: number,
  total?: number,
): string {
  if (e.hitchPosition === 'rear') {
    return '2.º remolque (trasero)';
  }
  if (e.hitchPosition === 'lead') {
    return total != null && total > 1 ? '1.er remolque (delantero)' : 'Remolque enganchado';
  }
  if (index != null && total != null) {
    return total <= 1 ? 'Remolque enganchado' : index === 0 ? '1.er remolque (delantero)' : '2.º remolque (trasero)';
  }
  return 'Remolque enganchado';
}

/** Valor API al guardar según tractora y toggle de segundo remolque. */
export function hitchPositionForEquipmentWrite(
  unitId: string | undefined,
  isSecondTrailer: boolean,
): EquipmentHitchPosition | null | undefined {
  const uid = unitId?.trim();
  if (!uid) {
    return null;
  }
  return isSecondTrailer ? 'rear' : 'lead';
}

export function isSecondTrailerHitch(e: Equipment): boolean {
  return e.hitchPosition === 'rear';
}

/** Equipos enganchados a una tractora, ordenados para convoy/esquema. */
export function equipmentAssignedToUnit(
  equipment: readonly Equipment[],
  unitId: unknown,
): Equipment[] {
  const id = resourceIdKey(unitId);
  if (!id) {
    return [];
  }
  return sortEquipmentByHitchPosition(
    equipment.filter((e) => resourceIdsEqual(e.unitId, id)),
  );
}
