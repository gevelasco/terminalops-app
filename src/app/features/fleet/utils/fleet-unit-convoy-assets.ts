import {
  convoyTrailerVisualFromEquipment,
  schemaPrimaryAssetForVisual,
  schemaSecondaryAssetForVisual,
  SCHEMA_CAJA_SECA_ASSET,
  SCHEMA_ENGANCHE_ASSET,
  SCHEMA_PLANA_ASSET,
  SCHEMA_PLANA_PRIMERA_ASSET,
  SCHEMA_REMOLQUE_ASSET,
  SCHEMA_TRACTO_ASSET,
  type ConvoyTrailerVisual,
} from '@features/trips/utils/maniobra-schema-convoy-assets';
import type { Equipment } from '@shared/models/logistics.models';

export {
  SCHEMA_CAJA_SECA_ASSET,
  SCHEMA_ENGANCHE_ASSET,
  SCHEMA_PLANA_ASSET,
  SCHEMA_PLANA_PRIMERA_ASSET,
  SCHEMA_REMOLQUE_ASSET,
  SCHEMA_TRACTO_ASSET,
  type ConvoyTrailerVisual,
};

function hitchedTrailerVisual(hitched: readonly Equipment[]): ConvoyTrailerVisual {
  const lead = hitched[0];
  if (!lead) {
    return 'remolque';
  }
  return convoyTrailerVisualFromEquipment(lead);
}

export function unitConvoyUsesPlataforma(hitched: readonly Equipment[]): boolean {
  return hitchedTrailerVisual(hitched) === 'plataforma';
}

export function unitConvoyUsesCajaSeca(hitched: readonly Equipment[]): boolean {
  return hitchedTrailerVisual(hitched) === 'caja_seca';
}

export function unitConvoyTrailerVisual(hitched: readonly Equipment[]): ConvoyTrailerVisual {
  return hitchedTrailerVisual(hitched);
}

export function unitConvoyIsFull(hitched: readonly Equipment[]): boolean {
  return hitched.length >= 2;
}

export function unitConvoyPrimaryAsset(hitched: readonly Equipment[]): string {
  return schemaPrimaryAssetForVisual(hitchedTrailerVisual(hitched));
}

export function unitConvoySecondaryAsset(hitched: readonly Equipment[]): string {
  return schemaSecondaryAssetForVisual(hitchedTrailerVisual(hitched));
}
