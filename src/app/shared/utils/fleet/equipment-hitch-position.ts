import { isDollyEquipment } from '@features/fleet/utils/equipment-dolly-convoy.util';
import type { Equipment, EquipmentHitchPosition } from '@shared/models/logistics.models';
import { resourceIdKey, resourceIdsEqual } from '@shared/utils/resource-id';

function hitchPositionRank(e: Equipment): number {
  if (isDollyEquipment(e)) {
    return 1;
  }
  if (e.hitchPosition === 'rear') {
    return 2;
  }
  if (e.hitchPosition === 'middle') {
    return 1;
  }
  return 0;
}

/** Orden convoy: delantero → dolly → trasero. */
export function compareEquipmentHitchPosition(a: Equipment, b: Equipment): number {
  const d = hitchPositionRank(a) - hitchPositionRank(b);
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
  if (t === 'lead' || t === 'middle' || t === 'rear') {
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
    return total != null && total > 2 ? '3.er equipo' : '2.do equipo';
  }
  if (e.hitchPosition === 'middle') {
    return 'Dolly (intermedio)';
  }
  if (e.hitchPosition === 'lead') {
    return total != null && total > 1 ? '1.er equipo' : '1.er remolque';
  }
  if (index != null && total != null) {
    if (total <= 1) {
      return 'Equipo enganchado';
    }
    if (total === 2) {
      return index === 0 ? '1.er equipo' : '2.do equipo';
    }
    return index === 0 ? '1.er equipo' : index === 1 ? 'Equipo intermedio' : '3.er equipo';
  }
  return 'Equipo enganchado';
}

/** Valor API al guardar según tractora y posición deseada. */
export function hitchPositionForEquipmentWrite(
  unitId: string | undefined,
  position: EquipmentHitchPosition | null | undefined,
): EquipmentHitchPosition | null | undefined {
  const uid = unitId?.trim();
  if (!uid) {
    return null;
  }
  if (!position) {
    return 'lead';
  }
  return position;
}

/** @deprecated Usar {@link hitchPositionForEquipmentWrite} con posición explícita. */
export function hitchPositionForLegacySecondTrailerFlag(
  unitId: string | undefined,
  isSecondTrailer: boolean,
): EquipmentHitchPosition | null | undefined {
  return hitchPositionForEquipmentWrite(unitId, isSecondTrailer ? 'rear' : 'lead');
}

/** Borrador API al desenganchar un equipo de la tractora. */
export function equipmentUnhitchPersistDraft(): Pick<Equipment, 'unitId' | 'hitchPosition'> {
  return { unitId: '', hitchPosition: null };
}

/** Borrador API al promover un 2.do equipo a 1.er en el mismo convoy. */
export function equipmentPromoteToLeadPersistDraft(): Pick<Equipment, 'hitchPosition'> {
  return { hitchPosition: 'lead' };
}

/** Borrador API al promover trasero a intermedio (p. ej. al quitar dolly). */
export function equipmentPromoteToMiddlePersistDraft(): Pick<Equipment, 'hitchPosition'> {
  return { hitchPosition: 'middle' };
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
  if (equipmentToUnhitch.hitchPosition === 'middle') {
    return null;
  }
  const onUnit = equipmentAssignedToUnit(catalog, unitId);
  const rearOnly = onUnit.filter(
    (e) =>
      e.hitchPosition === 'rear' && !resourceIdsEqual(e.id, equipmentToUnhitch.id),
  );
  if (rearOnly.length === 1 && onUnit.length === 2) {
    return rearOnly[0]!;
  }
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

export function isMiddleTrailerHitch(e: Equipment): boolean {
  return e.hitchPosition === 'middle';
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
    equipment.filter(
      (e) =>
        resourceIdsEqual(e.unitId, id) || resourceIdsEqual(e.assignedUnit?.id, id),
    ),
  );
}