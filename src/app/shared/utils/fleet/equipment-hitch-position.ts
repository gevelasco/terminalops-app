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
    return '2.do equipo';
  }
  if (e.hitchPosition === 'lead') {
    return total != null && total > 1 ? '1.er equipo' : 'Equipo enganchado';
  }
  if (index != null && total != null) {
    return total <= 1 ? 'Equipo enganchado' : index === 0 ? '1.er equipo' : '2.do equipo';
  }
  return 'Equipo enganchado';
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

/** Borrador API al desenganchar un equipo de la tractora. */
export function equipmentUnhitchPersistDraft(): Pick<Equipment, 'unitId' | 'hitchPosition'> {
  return { unitId: '', hitchPosition: null };
}

/** Borrador API al promover un 2.do equipo a 1.er en el mismo convoy. */
export function equipmentPromoteToLeadPersistDraft(): Pick<Equipment, 'hitchPosition'> {
  return { hitchPosition: 'lead' };
}

/**
 * 2.do equipo que debe pasar a 1.er si se desengancha el equipo delantero de la misma tractora.
 */
export function rearEquipmentToPromoteOnLeadUnhitch(
  catalog: readonly Equipment[],
  equipmentToUnhitch: Equipment,
): Equipment | null {
  const unitId = resourceIdKey(equipmentToUnhitch.unitId);
  if (!unitId || equipmentToUnhitch.hitchPosition === 'rear') {
    return null;
  }
  const onUnit = equipmentAssignedToUnit(catalog, unitId);
  return (
    onUnit.find(
      (e) =>
        e.hitchPosition === 'rear' && !resourceIdsEqual(e.id, equipmentToUnhitch.id),
    ) ?? null
  );
}

export function unhitchingLeadRequiresRearPromotion(
  catalog: readonly Equipment[],
  equipment: Equipment,
): boolean {
  return rearEquipmentToPromoteOnLeadUnhitch(catalog, equipment) != null;
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
