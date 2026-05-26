import { isPlanaEquipment } from '@features/fleet/utils/unit-hitched-equipment';
import type { Equipment, Trip } from '@shared/models/logistics.models';

export const SCHEMA_TRACTO_ASSET = 'maniobra-schema-tracto.png';
export const SCHEMA_REMOLQUE_ASSET = 'maniobra-schema-remolque.png';
export const SCHEMA_ENGANCHE_ASSET = 'maniobra-schema-enganche.png';
export const SCHEMA_PLANA_PRIMERA_ASSET = 'maniobra-schema-plana-primera.png';
export const SCHEMA_PLANA_SEGUNDA_ASSET = 'maniobra-schema-plana-segunda.png';

export function tripSchemaUsesPlataformaConvoy(
  trip: Trip,
  equipmentById: ReadonlyMap<string, Equipment>,
): boolean {
  if (trip.operationType === 'plana') {
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

export function schemaPrimaryTrailerAsset(
  trip: Trip,
  equipmentById: ReadonlyMap<string, Equipment>,
): string {
  return tripSchemaUsesPlataformaConvoy(trip, equipmentById)
    ? SCHEMA_PLANA_PRIMERA_ASSET
    : SCHEMA_REMOLQUE_ASSET;
}

/** Full: enganche combo estándar o segunda plataforma según tipo de equipo. */
export function schemaSecondaryTrailerAsset(
  trip: Trip,
  equipmentById: ReadonlyMap<string, Equipment>,
): string {
  return tripSchemaUsesPlataformaConvoy(trip, equipmentById)
    ? SCHEMA_PLANA_SEGUNDA_ASSET
    : SCHEMA_ENGANCHE_ASSET;
}
