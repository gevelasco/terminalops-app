import type { Equipment, Unit } from '@shared/models/logistics.models';
import { fleetUnitIsOnRoute } from '@features/fleet/utils/fleet-operational-status';
import { FLEET_OPERATION_RESOLVER } from '@features/fleet/utils/fleet-operation-resolver';
import { unitConvoyFromEquipment } from '@features/fleet/utils/unit-hitched-equipment';
import { formatEquipmentOperationalId } from '@shared/utils/fleet/fleet-id-builders';
import { equipmentAssignedToUnit, hitchPositionForEquipmentWrite } from '@shared/utils/fleet/equipment-hitch-position';
import type { EquipmentHitchPosition } from '@shared/models/logistics.models';
import { resourceIdKey, resourceIdsEqual } from '@shared/utils/resource-id';

/**
 * Solo los tractocamiones llevan remolques/equipos. Unidades sin tipo (legado)
 * se tratan como tractocamión.
 */
export function unitCanHitchEquipment(unit: Pick<Unit, 'transportType'>): boolean {
  const t = unit.transportType?.trim();
  return !t || t === 'tractocamion';
}

export const UNIT_HITCH_NOT_TRACTOR_MESSAGE =
  'Solo las unidades tipo tractocamión pueden llevar remolques o equipos enganchados.';

/** Remolques sin tractora o ya asignados a esta unidad (candidatos para enganchar). */
export function equipmentSelectableForUnitHitch(
  catalog: readonly Equipment[],
  unitId: string,
): Equipment[] {
  const uid = unitId.trim();
  if (!uid) {
    return [];
  }
  return catalog.filter((e) => {
    const assigned = resourceIdKey(e.unitId);
    return !assigned || resourceIdsEqual(e.unitId, uid);
  });
}

/** Si la tractora aún tiene cupo (< 2 equipos), opcionalmente excluyendo un equipo. */
export function unitHasHitchSlot(
  catalog: readonly Equipment[],
  unitId: string,
  excludeEquipmentId?: string,
): boolean {
  const uid = unitId.trim();
  if (!uid) {
    return false;
  }
  const count = equipmentAssignedToUnit(catalog, uid).filter(
    (e) => !resourceIdsEqual(e.id, excludeEquipmentId),
  ).length;
  return count < 2;
}

export type UnitHitchSlot = 'first' | 'second' | 'full';

/** Cupo de enganche disponible en la tractora (excluye un equipo en edición). */
export function unitHitchSlotForNewEquipment(
  catalog: readonly Equipment[],
  unitId: string,
  excludeEquipmentId?: string,
): UnitHitchSlot {
  const uid = unitId.trim();
  if (!uid) {
    return 'first';
  }
  const others = othersOnUnit(catalog, uid, excludeEquipmentId);
  if (others.length >= 2) {
    return 'full';
  }
  if (others.length === 0) {
    return 'first';
  }
  const hasLead = others.some((e) => !isRearHitch(e));
  return hasLead ? 'second' : 'first';
}

export function isSecondTrailerForUnitHitchSlot(slot: UnitHitchSlot): boolean {
  return slot === 'second';
}

export function equipmentHitchAddActionLabel(
  catalog: readonly Equipment[],
  unitId: string,
  excludeEquipmentId?: string,
): string {
  const slot = unitHitchSlotForNewEquipment(catalog, unitId, excludeEquipmentId);
  if (slot === 'second') {
    return 'Enganchar 2do equipo';
  }
  return 'Enganchar 1er equipo';
}

/** Posición API al enganchar según cupo actual de la tractora (fuente de verdad en guardado). */
export function hitchPositionForNewEquipmentOnUnit(
  catalog: readonly Equipment[],
  unitId: string,
  excludeEquipmentId?: string,
): EquipmentHitchPosition | null {
  const uid = unitId.trim();
  if (!uid) {
    return null;
  }
  const slot = unitHitchSlotForNewEquipment(catalog, uid, excludeEquipmentId);
  return hitchPositionForEquipmentWrite(uid, slot === 'second') ?? null;
}

/** Tractoras candidatas al enganchar un equipo (drawer de equipo). */
export function unitsEligibleForEquipmentHitch(
  units: readonly Unit[],
  equipmentCatalog: readonly Equipment[],
  excludeEquipmentId?: string,
): Unit[] {
  return units.filter((unit) =>
    unitEligibleForEquipmentHitch(unit, equipmentCatalog, excludeEquipmentId),
  );
}

export function unitEligibleForEquipmentHitch(
  unit: Unit,
  equipmentCatalog: readonly Equipment[],
  excludeEquipmentId?: string,
): boolean {
  if (!unitCanHitchEquipment(unit)) {
    return false;
  }
  if (fleetUnitIsOnRoute(unit)) {
    return false;
  }
  const hitched = equipmentAssignedToUnit(equipmentCatalog, unit.id).filter(
    (e) => !resourceIdsEqual(e.id, excludeEquipmentId),
  );
  if (hitched.length === 0) {
    return true;
  }
  if (hitched.length !== 1) {
    return false;
  }
  const convoy = unitConvoyFromEquipment(hitched, FLEET_OPERATION_RESOLVER);
  return convoy.kind === 'single' || convoy.kind === 'plataforma';
}

export type EquipmentHitchAssignmentValidation = {
  canSave: boolean;
  blockMessage: string | null;
  infoMessage: string | null;
};

const OK_EMPTY: EquipmentHitchAssignmentValidation = {
  canSave: true,
  blockMessage: null,
  infoMessage: null,
};

function equipmentOperationalLabel(e: Equipment): string {
  const code = formatEquipmentOperationalId(e).trim();
  if (code) {
    return code;
  }
  const id = resourceIdKey(e.id);
  return id || 'equipo';
}

function isRearHitch(e: Equipment): boolean {
  return e.hitchPosition === 'rear';
}

function othersOnUnit(
  catalog: readonly Equipment[],
  unitId: string,
  excludeEquipmentId?: string,
): Equipment[] {
  return equipmentAssignedToUnit(catalog, unitId).filter(
    (e) => !resourceIdsEqual(e.id, excludeEquipmentId),
  );
}

/**
 * Valida asignación de enganche (1.er / 2.do equipo) según equipos ya en la tractora.
 * La posición la define el cupo: sin equipos → 1.er; con uno → 2.do.
 */
export function validateEquipmentHitchAssignment(params: {
  unitId: string | undefined;
  catalog: readonly Equipment[];
  excludeEquipmentId?: string;
  isSecondTrailer: boolean;
  unitLabel?: string | null;
}): EquipmentHitchAssignmentValidation {
  const uid = params.unitId?.trim();
  if (!uid) {
    return OK_EMPTY;
  }

  const unitLabel = params.unitLabel?.trim() || 'esta tractora';
  const others = othersOnUnit(params.catalog, uid, params.excludeEquipmentId);
  const slot = unitHitchSlotForNewEquipment(
    params.catalog,
    uid,
    params.excludeEquipmentId,
  );
  const rearOther = others.find(isRearHitch);
  const leadOther = others.find((e) => !isRearHitch(e));

  if (slot === 'full') {
    return {
      canSave: false,
      blockMessage:
        `La tractora ${unitLabel} ya está configurada como doble articulado (2 equipos enganchados). ` +
        'No es posible agregar otro equipo. Revise la ficha del equipo o desenganche uno antes de continuar.',
      infoMessage: null,
    };
  }

  if (slot === 'first' && params.isSecondTrailer) {
    return {
      canSave: false,
      blockMessage:
        `${unitLabel} no tiene equipos enganchados. Debe enganchar primero un 1er equipo.`,
      infoMessage: null,
    };
  }

  if (slot === 'second' && !params.isSecondTrailer) {
    const leadLabel = leadOther ? equipmentOperationalLabel(leadOther) : 'un equipo';
    return {
      canSave: false,
      blockMessage:
        `${unitLabel} ya tiene un 1er equipo enganchado (${leadLabel}). ` +
        'Solo puede enganchar un 2do equipo.',
      infoMessage: null,
    };
  }

  if (params.isSecondTrailer) {
    if (rearOther) {
      const rearLabel = equipmentOperationalLabel(rearOther);
      return {
        canSave: false,
        blockMessage:
          `No es posible agregar este equipo como 2do equipo: ${rearLabel} ` +
          `ya está configurado como 2do equipo en ${unitLabel}. ` +
          'Cambie la configuración de ese equipo o desengánchelo de la tractora.',
        infoMessage: null,
      };
    }
    return {
      canSave: true,
      blockMessage: null,
      infoMessage: `${unitLabel} ya tiene un 1er equipo. Este equipo se enganchará como 2do equipo (doble articulado).`,
    };
  }

  // 1.er equipo
  if (leadOther) {
    const leadLabel = equipmentOperationalLabel(leadOther);
    return {
      canSave: false,
      blockMessage:
        `${unitLabel} ya tiene un 1er equipo enganchado (${leadLabel}). ` +
        'Solo puede enganchar un 2do equipo.',
      infoMessage: null,
    };
  }

  if (rearOther) {
    return {
      canSave: true,
      blockMessage: null,
      infoMessage: `En ${unitLabel} ya hay un 2do equipo configurado; este equipo solo puede engancharse como 1er equipo.`,
    };
  }

  return {
    canSave: true,
    blockMessage: null,
    infoMessage: 'Este equipo se enganchará como 1er equipo.',
  };
}
