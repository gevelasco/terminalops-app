import {
  isPlanaEquipment,
  isPortacontenedorEquipment,
} from '@features/fleet/utils/unit-hitched-equipment';
import type { Equipment } from '@shared/models/logistics.models';

export const EQUIPMENT_TYPE_DOLLY = 'dolly';

export function isDollyEquipmentType(type?: string | null): boolean {
  const v = (type ?? '').trim().toLowerCase();
  return v === EQUIPMENT_TYPE_DOLLY || v.includes('dolly') || v.includes('convertidor');
}

export function isDollyEquipment(e: Pick<Equipment, 'type' | 'hitchPosition'>): boolean {
  return e.hitchPosition === 'middle' || isDollyEquipmentType(e.type);
}

/** Chasis o plataforma: doble del mismo tipo requiere dolly entre ambos. */
export function equipmentRequiresDollyBetweenTrailers(
  e: Pick<Equipment, 'type'>,
): boolean {
  return isPortacontenedorEquipment(e as Equipment) || isPlanaEquipment(e as Equipment);
}

export function pairingRequiresDollyBetween(
  lead: Pick<Equipment, 'type'>,
  next: Pick<Equipment, 'type'>,
): boolean {
  if (isDollyEquipmentType(next.type) || isDollyEquipmentType(lead.type)) {
    return false;
  }
  return (
    equipmentRequiresDollyBetweenTrailers(lead) &&
    equipmentRequiresDollyBetweenTrailers(next)
  );
}