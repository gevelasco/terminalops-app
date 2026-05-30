import {
  SCHEMA_ENGANCHE_ASSET,
  SCHEMA_PLANA_PRIMERA_ASSET,
  SCHEMA_PLANA_SEGUNDA_ASSET,
  SCHEMA_REMOLQUE_ASSET,
  SCHEMA_TRACTO_ASSET,
} from '@features/trips/utils/maniobra-schema-convoy-assets';
import { isPlanaEquipment } from '@features/fleet/utils/unit-hitched-equipment';
import type { Equipment } from '@shared/models/logistics.models';

export {
  SCHEMA_ENGANCHE_ASSET,
  SCHEMA_PLANA_PRIMERA_ASSET,
  SCHEMA_PLANA_SEGUNDA_ASSET,
  SCHEMA_REMOLQUE_ASSET,
  SCHEMA_TRACTO_ASSET,
};

export function unitConvoyUsesPlataforma(hitched: readonly Equipment[]): boolean {
  return hitched.some((eq) => isPlanaEquipment(eq));
}

export function unitConvoyIsFull(hitched: readonly Equipment[]): boolean {
  return hitched.length >= 2;
}

export function unitConvoyPrimaryAsset(hitched: readonly Equipment[]): string {
  return unitConvoyUsesPlataforma(hitched)
    ? SCHEMA_PLANA_PRIMERA_ASSET
    : SCHEMA_REMOLQUE_ASSET;
}

export function unitConvoySecondaryAsset(hitched: readonly Equipment[]): string {
  return unitConvoyUsesPlataforma(hitched)
    ? SCHEMA_PLANA_SEGUNDA_ASSET
    : SCHEMA_ENGANCHE_ASSET;
}
