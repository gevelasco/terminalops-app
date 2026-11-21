import { isDollyEquipmentType } from '@features/fleet/utils/equipment-dolly-convoy.util';
import type { Equipment, EquipmentHitchPosition } from '@shared/models/logistics.models';
import { resourceIdsEqual } from '@shared/utils/resource-id';

export type ApiEquipmentHitchPosition = 'lead' | 'rear';

/** Posición en app a partir de la respuesta API (sin `middle`). */
export function resolveAppHitchPositionFromApi(
  raw: string | null | undefined,
  type?: string | null,
): EquipmentHitchPosition | undefined {
  if (isDollyEquipmentType(type)) {
    return 'middle';
  }
  const t = raw?.trim();
  if (t === 'middle') {
    return 'middle';
  }
  if (t === 'lead' || t === 'rear') {
    return t;
  }
  return undefined;
}

function peersExcludingSelf(
  peers: readonly Pick<Equipment, 'id' | 'hitchPosition' | 'type'>[] | undefined,
  selfId?: string,
): Pick<Equipment, 'id' | 'hitchPosition' | 'type'>[] {
  if (!peers?.length) {
    return [];
  }
  return peers.filter((e) => !selfId || !resourceIdsEqual(e.id, selfId));
}

function nonDollyTrailers(
  peers: Pick<Equipment, 'hitchPosition' | 'type'>[],
): Pick<Equipment, 'hitchPosition' | 'type'>[] {
  return peers.filter((e) => !isDollyEquipmentType(e.type));
}

/**
 * Serializa posición de enganche al API (solo `lead` | `rear`; `null` = sin slot en wire).
 * Dolly intermedio: `rear` si solo hay 1.er remolque; sin valor wire si lead+rear (convoy triple).
 */
export function mapAppHitchPositionToApiWrite(
  appPosition: EquipmentHitchPosition | null | undefined,
  type: string | null | undefined,
  options?: {
    peersOnUnit?: readonly Pick<Equipment, 'id' | 'hitchPosition' | 'type'>[];
    equipmentId?: string;
  },
): ApiEquipmentHitchPosition | null {
  const dolly = isDollyEquipmentType(type) || appPosition === 'middle';
  if (dolly) {
    const others = nonDollyTrailers(
      peersExcludingSelf(options?.peersOnUnit, options?.equipmentId),
    );
    const hasLead = others.some((e) => e.hitchPosition === 'lead');
    const hasRear = others.some((e) => e.hitchPosition === 'rear');
    if (hasLead && hasRear) {
      return null;
    }
    if (hasLead) {
      return 'rear';
    }
    return 'rear';
  }
  if (!appPosition) {
    return null;
  }
  return appPosition === 'rear' ? 'rear' : 'lead';
}