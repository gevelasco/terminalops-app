import type { Equipment, Unit } from '@shared/models/logistics.models';
import { fleetUnitIsOnRoute } from '@features/fleet/utils/fleet-operational-status';
import { FLEET_OPERATION_RESOLVER } from '@features/fleet/utils/fleet-operation-resolver';
import {
  isDollyEquipment,
  isDollyEquipmentType,
  pairingRequiresDollyBetween,
} from '@features/fleet/utils/equipment-dolly-convoy.util';
import { unitConvoyFromEquipment } from '@features/fleet/utils/unit-hitched-equipment';
import { formatEquipmentOperationalId } from '@shared/utils/fleet/fleet-id-builders';
import {
  equipmentAssignedToUnit,
  hitchPositionForEquipmentWrite,
  isMiddleTrailerHitch,
} from '@shared/utils/fleet/equipment-hitch-position';
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

function othersOnUnit(
  catalog: readonly Equipment[],
  unitId: string,
  excludeEquipmentId?: string,
): Equipment[] {
  return equipmentAssignedToUnit(catalog, unitId).filter(
    (e) => !resourceIdsEqual(e.id, excludeEquipmentId),
  );
}

function isLeadHitch(e: Equipment): boolean {
  if (isDollyEquipment(e)) {
    return false;
  }
  return e.hitchPosition === 'lead' || (!isRearHitch(e) && !isMiddleTrailerHitch(e));
}

function isRearHitch(e: Equipment): boolean {
  return e.hitchPosition === 'rear';
}

/** Trasero real (no cuenta el dolly aunque la API use `rear`). */
export function rearTrailerHitchOccupied(e: Equipment): boolean {
  return isRearHitch(e) && !isDollyEquipment(e);
}

function convoyHasMiddleDolly(others: readonly Equipment[]): boolean {
  return others.some((e) => isMiddleTrailerHitch(e) || isDollyEquipment(e));
}

function convoyLeadEquipment(others: readonly Equipment[]): Equipment | undefined {
  return others.find(isLeadHitch);
}

/** Si la tractora aún tiene cupo de enganche. */
export function unitHasHitchSlot(
  catalog: readonly Equipment[],
  unitId: string,
  excludeEquipmentId?: string,
): boolean {
  const uid = unitId.trim();
  if (!uid) {
    return false;
  }
  const others = othersOnUnit(catalog, uid, excludeEquipmentId);
  if (others.length >= 3) {
    return false;
  }
  if (others.length === 2) {
    return convoyHasMiddleDolly(others) && !others.some(rearTrailerHitchOccupied);
  }
  return others.length < 2;
}

export type UnitHitchSlot = 'first' | 'second' | 'third' | 'full';

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
  if (others.length >= 3) {
    return 'full';
  }
  if (others.length === 0) {
    return 'first';
  }
  if (others.length === 1) {
    return 'second';
  }
  if (convoyHasMiddleDolly(others) && !others.some(rearTrailerHitchOccupied)) {
    return 'third';
  }
  return 'full';
}

export function resolveAutoSecondTrailerFlag(
  catalog: readonly Equipment[],
  unitId: string,
  excludeEquipmentId: string | undefined,
  equipmentType?: string | null,
): boolean {
  const slot = unitHitchSlotForNewEquipment(catalog, unitId, excludeEquipmentId);
  if (slot === 'first' || slot === 'full') {
    return false;
  }
  if (slot === 'third') {
    return true;
  }
  if (isDollyEquipmentType(equipmentType)) {
    return false;
  }
  const others = othersOnUnit(catalog, unitId.trim(), excludeEquipmentId);
  const lead = convoyLeadEquipment(others);
  if (lead && equipmentType?.trim() && pairingRequiresDollyBetween(lead, { type: equipmentType })) {
    return false;
  }
  return true;
}

export function isSecondTrailerForUnitHitchSlot(slot: UnitHitchSlot): boolean {
  return slot === 'second' || slot === 'third';
}

export function equipmentHitchAddActionLabel(
  catalog: readonly Equipment[],
  unitId: string,
  excludeEquipmentId?: string,
): string {
  const slot = unitHitchSlotForNewEquipment(catalog, unitId, excludeEquipmentId);
  if (slot === 'third') {
    return 'Enganchar 3.er equipo';
  }
  if (slot === 'second') {
    return 'Enganchar siguiente equipo';
  }
  return 'Enganchar 1er equipo';
}

/** Posición API al enganchar según cupo y tipo del equipo nuevo. */
export function hitchPositionForNewEquipmentOnUnit(
  catalog: readonly Equipment[],
  unitId: string,
  excludeEquipmentId?: string,
  equipmentType?: string | null,
): EquipmentHitchPosition | null {
  const uid = unitId.trim();
  if (!uid) {
    return null;
  }
  const others = othersOnUnit(catalog, uid, excludeEquipmentId);
  const slot = unitHitchSlotForNewEquipment(catalog, uid, excludeEquipmentId);
  if (slot === 'first') {
    return hitchPositionForEquipmentWrite(uid, 'lead') ?? null;
  }
  if (isDollyEquipmentType(equipmentType)) {
    return hitchPositionForEquipmentWrite(uid, 'middle') ?? null;
  }
  if (slot === 'third') {
    return hitchPositionForEquipmentWrite(uid, 'rear') ?? null;
  }
  if (slot === 'second') {
    const lead = convoyLeadEquipment(others);
    if (
      lead &&
      equipmentType?.trim() &&
      pairingRequiresDollyBetween(lead, { type: equipmentType })
    ) {
      return null;
    }
    return hitchPositionForEquipmentWrite(uid, 'rear') ?? null;
  }
  return null;
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
  if (hitched.length === 1) {
    const convoy = unitConvoyFromEquipment(hitched, FLEET_OPERATION_RESOLVER);
    if (convoy.kind === 'single' || convoy.kind === 'plataforma') {
      return true;
    }
    return convoyLeadEquipment(hitched) != null;
  }
  if (
    hitched.length === 2 &&
    convoyHasMiddleDolly(hitched) &&
    !hitched.some(rearTrailerHitchOccupied)
  ) {
    return true;
  }
  return false;
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

function equipmentTypeOrEmpty(type?: string | null): string {
  return type?.trim() ?? '';
}

/**
 * Valida asignación de enganche según equipos en la tractora y tipo del equipo nuevo.
 */
export function validateEquipmentHitchAssignment(params: {
  unitId: string | undefined;
  catalog: readonly Equipment[];
  excludeEquipmentId?: string;
  isSecondTrailer: boolean;
  unitLabel?: string | null;
  equipmentType?: string | null;
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
  const typeRaw = equipmentTypeOrEmpty(params.equipmentType);
  const addingDolly = isDollyEquipmentType(typeRaw);
  const leadOther = convoyLeadEquipment(others);
  const middleOther = others.find(
    (e) => isMiddleTrailerHitch(e) || isDollyEquipment(e),
  );
  const rearOther = others.find(isRearHitch);

  if (slot === 'full') {
    const count = others.length;
    return {
      canSave: false,
      blockMessage:
        count >= 3
          ? `La tractora ${unitLabel} ya tiene el convoy completo (hasta 3 equipos con dolly intermedio). ` +
            'Desenganche un equipo antes de continuar.'
          : `La tractora ${unitLabel} ya está configurada como doble articulado (2 equipos enganchados). ` +
            'No es posible agregar otro equipo. Revise la ficha del equipo o desenganche uno antes de continuar.',
      infoMessage: null,
    };
  }

  if (addingDolly) {
    if (slot === 'first') {
      return {
        canSave: false,
        blockMessage:
          'El dolly solo puede engancharse entre dos equipos. Enganche primero el 1.er chasis o plataforma.',
        infoMessage: null,
      };
    }
    if (slot === 'third') {
      return {
        canSave: false,
        blockMessage: `${unitLabel} ya tiene dolly intermedio; el siguiente cupo es el 3.er equipo (trasero).`,
        infoMessage: null,
      };
    }
    if (middleOther) {
      return {
        canSave: false,
        blockMessage: `${unitLabel} ya tiene un dolly enganchado (${equipmentOperationalLabel(middleOther)}).`,
        infoMessage: null,
      };
    }
    if (params.isSecondTrailer) {
      return {
        canSave: false,
        blockMessage: 'El dolly no puede engancharse como 2.do o 3.er equipo trasero; va en posición intermedia.',
        infoMessage: null,
      };
    }
    return {
      canSave: true,
      blockMessage: null,
      infoMessage: `Este dolly se enganchará entre el 1.er equipo y el siguiente remolque en ${unitLabel}.`,
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

  if (slot === 'second' && !params.isSecondTrailer && !addingDolly) {
    const leadLabel = leadOther ? equipmentOperationalLabel(leadOther) : 'un equipo';
    return {
      canSave: false,
      blockMessage:
        `${unitLabel} ya tiene un 1.er equipo enganchado (${leadLabel}). ` +
        'Seleccione enganchar como siguiente equipo o agregue un dolly si aplica.',
      infoMessage: null,
    };
  }

  if (
    slot === 'second' &&
    params.isSecondTrailer &&
    leadOther &&
    typeRaw &&
    pairingRequiresDollyBetween(leadOther, { type: typeRaw })
  ) {
    const leadLabel = equipmentOperationalLabel(leadOther);
    return {
      canSave: false,
      blockMessage:
        `No puede enganchar un segundo chasis o plataforma (${typeRaw}) detrás de ${leadLabel} ` +
        'sin un dolly intermedio. Enganche primero un equipo tipo Dolly (convertidor) y después el 2.º remolque.',
      infoMessage: null,
    };
  }

  if (slot === 'third' && !params.isSecondTrailer) {
    return {
      canSave: false,
      blockMessage:
        `${unitLabel} ya tiene 1.er equipo y dolly. Debe enganchar el 3.er equipo (trasero).`,
      infoMessage: null,
    };
  }

  if (params.isSecondTrailer) {
    if (rearOther) {
      const rearLabel = equipmentOperationalLabel(rearOther);
      return {
        canSave: false,
        blockMessage:
          `No es posible agregar este equipo como remolque trasero: ${rearLabel} ` +
          `ya está configurado detrás en ${unitLabel}.`,
        infoMessage: null,
      };
    }
    if (slot === 'third') {
      return {
        canSave: true,
        blockMessage: null,
        infoMessage: `${unitLabel} tiene dolly intermedio. Este equipo se enganchará como 3.er remolque.`,
      };
    }
    return {
      canSave: true,
      blockMessage: null,
      infoMessage: `${unitLabel} ya tiene un 1.er equipo. Este equipo se enganchará como 2do remolque (doble articulado).`,
    };
  }

  if (leadOther && slot === 'second') {
    const leadLabel = equipmentOperationalLabel(leadOther);
    return {
      canSave: false,
      blockMessage:
        `${unitLabel} ya tiene un 1.er equipo enganchado (${leadLabel}). ` +
        'Solo puede enganchar un siguiente equipo.',
      infoMessage: null,
    };
  }

  if (rearOther) {
    return {
      canSave: true,
      blockMessage: null,
      infoMessage: `En ${unitLabel} ya hay un remolque trasero; este equipo solo puede engancharse como 1.er equipo.`,
    };
  }

  return {
    canSave: true,
    blockMessage: null,
    infoMessage: 'Este equipo se enganchará como 1.er equipo.',
  };
}