import {
  isDollyEquipment,
  isDollyEquipmentType,
} from '@features/fleet/utils/equipment-dolly-convoy.util';
import type { Equipment, EquipmentHitchPosition } from '@shared/models/logistics.models';
import type { EquipmentPersistDraft } from '@shared/utils/fleet/equipment-api-payload';
import { equipmentAssignedToUnit } from '@shared/utils/fleet/equipment-hitch-position';
import {
  hitchPositionForNewEquipmentOnUnit,
  rearTrailerHitchOccupied,
} from '@shared/utils/fleet/equipment-hitch-assignment';
import { resourceIdsEqual } from '@shared/utils/resource-id';

function convoyAwaitingThirdRearTrailer(peers: readonly Equipment[]): boolean {
  const hasDolly = peers.some((e) => isDollyEquipment(e));
  if (!hasDolly) {
    return false;
  }
  const hasLeadTrailer = peers.some(
    (e) => !isDollyEquipment(e) && e.hitchPosition === 'lead',
  );
  const hasRearTrailer = peers.some(rearTrailerHitchOccupied);
  return hasLeadTrailer && !hasRearTrailer;
}

export type EquipmentHitchPersistPlan = {
  equipment: Equipment;
  hitchDraft: EquipmentPersistDraft;
  appHitch: EquipmentHitchPosition | null;
};

export function buildEquipmentHitchPersistPlan(params: {
  equipment: Equipment;
  unitId: string;
  catalog: readonly Equipment[];
}): EquipmentHitchPersistPlan | null {
  const unitId = params.unitId.trim();
  if (!unitId) {
    return null;
  }
  const peers = equipmentAssignedToUnit(params.catalog, unitId).filter(
    (e) => !resourceIdsEqual(e.id, params.equipment.id),
  );
  let appHitch = hitchPositionForNewEquipmentOnUnit(
    params.catalog,
    unitId,
    params.equipment.id,
    params.equipment.type,
  );
  if (
    convoyAwaitingThirdRearTrailer(peers) &&
    !isDollyEquipment(params.equipment) &&
    !isDollyEquipmentType(params.equipment.type)
  ) {
    appHitch = 'rear';
  }
  if (!appHitch) {
    return null;
  }
  const hitchDraft: EquipmentPersistDraft = {
    equipment: {
      unitId,
      hitchPosition: appHitch,
    },
    hitchPeersOnUnit: [
      ...peers,
      { ...params.equipment, unitId, hitchPosition: appHitch },
    ],
  };
  return {
    equipment: params.equipment,
    hitchDraft,
    appHitch,
  };
}