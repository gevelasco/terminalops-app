import type { Equipment, Unit } from '@shared/models/logistics.models';
import type { EquipmentPersistDraft } from '@shared/utils/fleet/equipment-api-payload';
import type { UnitPersistDraft } from '@shared/utils/fleet/unit-api-payload';

/**
 * Marca `sparseFleetMeta` en saves del drawer para no reenviar el blob completo.
 * Si hay mantenimientos locales, incluye solo esas entradas (+ parches de meta).
 */
export function resolveUnitPersistDraft(
  draft: UnitPersistDraft | undefined,
  unitForPersist: Unit,
  hasLocalMaintEntries: boolean,
): UnitPersistDraft | undefined {
  if (hasLocalMaintEntries) {
    return {
      ...draft,
      sparseFleetMeta: true,
      fleetMeta: {
        ...(draft?.fleetMeta ?? {}),
        maintenanceEntries: unitForPersist.fleetMeta?.maintenanceEntries,
      },
    };
  }
  if (!draft || draft.sparseFleetMeta === false) {
    return draft;
  }
  if (draft.fleetMeta !== undefined || draft.unit !== undefined) {
    return { ...draft, sparseFleetMeta: true };
  }
  return draft;
}

/** Igual que unidades: borradores parciales con `sparseFleetMeta`. */
export function resolveEquipmentPersistDraft(
  draft: EquipmentPersistDraft | undefined,
  equipmentForPersist?: Equipment,
  hasLocalMaintEntries = false,
): EquipmentPersistDraft | undefined {
  if (hasLocalMaintEntries && equipmentForPersist) {
    return {
      ...draft,
      sparseFleetMeta: true,
      fleetMeta: {
        ...(draft?.fleetMeta ?? {}),
        maintenanceEntries: equipmentForPersist.fleetMeta?.maintenanceEntries,
      },
    };
  }
  if (!draft || draft.sparseFleetMeta === false) {
    return draft;
  }
  if (draft.fleetMeta !== undefined || draft.equipment !== undefined) {
    return { ...draft, sparseFleetMeta: true };
  }
  return draft;
}
