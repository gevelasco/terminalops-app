import {
  isCajaSecaEquipment,
  isPlanaEquipment,
} from '@features/fleet/utils/unit-hitched-equipment';
import type { OperationConfigurationResolver } from '@shared/services/operation-configuration-resolver.types';
import type { Equipment, Trip } from '@shared/models/logistics.models';

export const SCHEMA_TRACTO_ASSET = 'maniobra-schema-tracto.png';
export const SCHEMA_REMOLQUE_ASSET = 'maniobra-schema-remolque.png';
export const SCHEMA_CAJA_SECA_ASSET = 'maniobra-schema-caja-seca.png';
export const SCHEMA_ENGANCHE_ASSET = 'maniobra-schema-enganche.png';
export const SCHEMA_PLANA_ASSET = 'maniobra-schema-plana.png';
/** @deprecated Usar {@link SCHEMA_PLANA_ASSET} */
export const SCHEMA_PLANA_PRIMERA_ASSET = SCHEMA_PLANA_ASSET;

export type ConvoyTrailerVisual = 'plataforma' | 'caja_seca' | 'remolque';

export function isCajaSecaEquipmentType(type: string): boolean {
  const v = type.trim().toLowerCase();
  return (
    v === 'caja_seca' ||
    v.includes('caja seca') ||
    v.includes('dry van') ||
    v.includes('dry_van')
  );
}

export function convoyTrailerVisualFromEquipment(eq: Equipment): ConvoyTrailerVisual {
  if (isPlanaEquipment(eq)) {
    return 'plataforma';
  }
  if (isCajaSecaEquipment(eq)) {
    return 'caja_seca';
  }
  return 'remolque';
}

export function convoyTrailerVisualFromType(type: string): ConvoyTrailerVisual {
  const v = type.trim().toLowerCase();
  if (v === 'plataforma' || v.includes('plana') || v.includes('flatbed')) {
    return 'plataforma';
  }
  if (isCajaSecaEquipmentType(type)) {
    return 'caja_seca';
  }
  return 'remolque';
}

export function schemaPrimaryAssetForVisual(visual: ConvoyTrailerVisual): string {
  switch (visual) {
    case 'plataforma':
      return SCHEMA_PLANA_ASSET;
    case 'caja_seca':
      return SCHEMA_CAJA_SECA_ASSET;
    default:
      return SCHEMA_REMOLQUE_ASSET;
  }
}

export function schemaSecondaryAssetForVisual(visual: ConvoyTrailerVisual): string {
  return schemaPrimaryAssetForVisual(visual);
}

export function tripSchemaUsesPlataformaConvoy(
  trip: Trip,
  equipmentById: ReadonlyMap<string, Equipment>,
  resolver: OperationConfigurationResolver,
): boolean {
  const ctx = resolver.contextFromTrip(trip);
  if (resolver.resolveSuggestsPlataformaConvoy(ctx)) {
    return true;
  }
  for (const raw of trip.equipment) {
    const id = raw.trim();
    if (!id) {
      continue;
    }
    const eq = equipmentById.get(id);
    if (eq && isPlanaEquipment(eq)) {
      return true;
    }
  }
  return false;
}

function tripTrailerVisual(
  trip: Trip,
  equipmentById: ReadonlyMap<string, Equipment>,
  resolver: OperationConfigurationResolver,
): ConvoyTrailerVisual {
  if (tripSchemaUsesPlataformaConvoy(trip, equipmentById, resolver)) {
    return 'plataforma';
  }
  for (const raw of trip.equipment) {
    const id = raw.trim();
    if (!id) {
      continue;
    }
    const eq = equipmentById.get(id);
    if (eq) {
      return convoyTrailerVisualFromEquipment(eq);
    }
  }
  return 'remolque';
}

function tripSecondaryTrailerVisual(
  trip: Trip,
  equipmentById: ReadonlyMap<string, Equipment>,
  resolver: OperationConfigurationResolver,
): ConvoyTrailerVisual {
  const ids = (trip.equipment ?? []).map((s) => String(s).trim()).filter((s) => s.length > 0);
  if (ids.length >= 2) {
    const eq = equipmentById.get(ids[1]!);
    if (eq) {
      return convoyTrailerVisualFromEquipment(eq);
    }
  }
  return tripTrailerVisual(trip, equipmentById, resolver);
}

export function schemaPrimaryTrailerAsset(
  trip: Trip,
  equipmentById: ReadonlyMap<string, Equipment>,
  resolver: OperationConfigurationResolver,
): string {
  return schemaPrimaryAssetForVisual(tripTrailerVisual(trip, equipmentById, resolver));
}

export function schemaSecondaryTrailerAsset(
  trip: Trip,
  equipmentById: ReadonlyMap<string, Equipment>,
  resolver: OperationConfigurationResolver,
): string {
  return schemaSecondaryAssetForVisual(
    tripSecondaryTrailerVisual(trip, equipmentById, resolver),
  );
}

export function tripTrailerVisualAt(
  trip: Trip,
  index: number,
  equipmentById: ReadonlyMap<string, Equipment>,
  resolver: OperationConfigurationResolver,
): ConvoyTrailerVisual {
  const ids = (trip.equipment ?? []).map((s) => String(s).trim()).filter((s) => s.length > 0);
  const id = ids[index];
  if (id) {
    const eq = equipmentById.get(id);
    if (eq) {
      return convoyTrailerVisualFromEquipment(eq);
    }
  }
  return tripTrailerVisual(trip, equipmentById, resolver);
}

export function schemaTrailerAssetAt(
  trip: Trip,
  index: number,
  equipmentById: ReadonlyMap<string, Equipment>,
  resolver: OperationConfigurationResolver,
): string {
  const visual = tripTrailerVisualAt(trip, index, equipmentById, resolver);
  return index === 0
    ? schemaPrimaryAssetForVisual(visual)
    : schemaSecondaryAssetForVisual(visual);
}

export function tripSchemaTrailerVisual(
  trip: Trip,
  equipmentById: ReadonlyMap<string, Equipment>,
  resolver: OperationConfigurationResolver,
): ConvoyTrailerVisual {
  return tripTrailerVisual(trip, equipmentById, resolver);
}
