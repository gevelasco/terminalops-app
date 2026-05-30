import type { Equipment } from '@shared/models/logistics.models';
import { formatEquipmentOperationalId } from '@shared/utils/fleet/fleet-id-builders';
import { equipmentAssignedToUnit } from '@shared/utils/fleet/equipment-hitch-position';
import { resourceIdKey, resourceIdsEqual } from '@shared/utils/resource-id';

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

/** Si la tractora aún tiene cupo (< 2 remolques), opcionalmente excluyendo un equipo. */
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

export type EquipmentHitchAssignmentValidation = {
  canSave: boolean;
  /** Permite activar el toggle «segundo remolque». */
  canToggleSecondTrailer: boolean;
  /** Si el toggle debe quedar en off (p. ej. solo hay cupo de primer remolque). */
  forceSecondTrailerOff: boolean;
  /** Mostrar toggle de segundo remolque. */
  showSecondTrailerToggle: boolean;
  blockMessage: string | null;
  infoMessage: string | null;
};

const OK_EMPTY: EquipmentHitchAssignmentValidation = {
  canSave: true,
  canToggleSecondTrailer: false,
  forceSecondTrailerOff: true,
  showSecondTrailerToggle: false,
  blockMessage: null,
  infoMessage: null,
};

function equipmentOperationalLabel(e: Equipment): string {
  const code = formatEquipmentOperationalId(e).trim();
  if (code) {
    return code;
  }
  const id = resourceIdKey(e.id);
  return id || 'remolque';
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
 * Valida asignación de enganche (primer / segundo remolque) según remolques ya en la tractora.
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
  const rearOther = others.find(isRearHitch);
  const leadOther = others.find((e) => !isRearHitch(e));

  if (others.length >= 2) {
    return {
      canSave: false,
      canToggleSecondTrailer: false,
      forceSecondTrailerOff: true,
      showSecondTrailerToggle: false,
      blockMessage:
        `La tractora ${unitLabel} ya está configurada como full (2 remolques enganchados). ` +
        'No es posible agregar otro equipo. Es probable que el remolque que busca ya esté en esa configuración; ' +
        'revise la ficha del equipo o desenganche uno antes de continuar.',
      infoMessage: null,
    };
  }

  if (params.isSecondTrailer) {
    if (others.length === 0) {
      return {
        canSave: false,
        canToggleSecondTrailer: false,
        forceSecondTrailerOff: true,
        showSecondTrailerToggle: false,
        blockMessage: null,
        infoMessage: 'Solo hay opción de configurar este equipo como primer remolque.',
      };
    }
    if (rearOther) {
      const rearLabel = equipmentOperationalLabel(rearOther);
      return {
        canSave: false,
        canToggleSecondTrailer: true,
        forceSecondTrailerOff: false,
        showSecondTrailerToggle: true,
        blockMessage:
          `No es posible agregar este equipo como segundo remolque: el remolque ${rearLabel} ` +
          `ya está configurado como segundo remolque en ${unitLabel}. ` +
          'Si desea continuar, cambie la configuración de ese equipo o desengánchelo de la tractora.',
        infoMessage: null,
      };
    }
    return {
      canSave: true,
      canToggleSecondTrailer: true,
      forceSecondTrailerOff: false,
      showSecondTrailerToggle: true,
      blockMessage: null,
      infoMessage: `${unitLabel} ya tiene un primer remolque. Este equipo se agregará como segundo remolque (configuración full).`,
    };
  }

  // Primer remolque (lead)
  if (others.length === 0) {
    return {
      canSave: true,
      canToggleSecondTrailer: false,
      forceSecondTrailerOff: true,
      showSecondTrailerToggle: false,
      blockMessage: null,
      infoMessage: 'Solo hay opción de configurar este equipo como primer remolque.',
    };
  }

  if (leadOther) {
    const leadLabel = equipmentOperationalLabel(leadOther);
    return {
      canSave: false,
      canToggleSecondTrailer: true,
      forceSecondTrailerOff: false,
      showSecondTrailerToggle: true,
      blockMessage:
        `Ya hay un primer remolque (${leadLabel}) en ${unitLabel}. ` +
        'Active «Segundo remolque (trasero)» si este equipo va detrás, o desenganche el otro remolque.',
      infoMessage: null,
    };
  }

  // Un solo otro y es trasero: este solo puede ser primer remolque
  return {
    canSave: true,
    canToggleSecondTrailer: false,
    forceSecondTrailerOff: true,
    showSecondTrailerToggle: false,
    blockMessage: null,
    infoMessage: `En ${unitLabel} ya hay un segundo remolque configurado; este equipo solo puede engancharse como primer remolque.`,
  };
}
