import {
  isCajaSecaEquipment,
  isPlanaEquipment,
} from '@features/fleet/utils/unit-hitched-equipment';
import type { OperationConfigurationResolver } from '@shared/services/operation-configuration-resolver.types';
import type { Equipment, Trip } from '@shared/models/logistics.models';

export const SCHEMA_TRACTO_ASSET = 'maniobra-schema-tracto.png';
export const SCHEMA_RABON_PLATAFORMA_ASSET = 'maniobra-schema-rabon-plataforma.png';
export const SCHEMA_CAMION_PIPA_ASSET = 'maniobra-schema-camion-pipa.png';
export const SCHEMA_MAROMA_VOLTEO_ASSET = 'maniobra-schema-maroma-volteo.png';
export const SCHEMA_REMOLQUE_ASSET = 'maniobra-schema-remolque.png';
export const SCHEMA_CAJA_SECA_ASSET = 'maniobra-schema-caja-seca.png';
export const SCHEMA_ENGANCHE_ASSET = 'maniobra-schema-enganche.png';
export const SCHEMA_PLANA_ASSET = 'maniobra-schema-plana.png';
export const SCHEMA_PIPA_ASSET = 'maniobra-schema-pipa.png';
export const SCHEMA_CORTINA_ASSET = 'maniobra-schema-cortina.png';
export const SCHEMA_GONDOLA_ASSET = 'maniobra-schema-gondola.png';
export const SCHEMA_CAMA_BAJA_ASSET = 'maniobra-schema-cama-baja.png';
export const SCHEMA_TOLVA_ASSET = 'maniobra-schema-tolva.png';
/** @deprecated Usar {@link SCHEMA_PLANA_ASSET} */
export const SCHEMA_PLANA_PRIMERA_ASSET = SCHEMA_PLANA_ASSET;

export type ConvoyTrailerVisual =
  | 'plataforma'
  | 'caja_seca'
  | 'pipa'
  | 'cortina'
  | 'gondola'
  | 'cama_baja'
  | 'tolva'
  | 'remolque';

/** Imagen de la unidad motriz según su tipo de transporte (alta de unidad). */
export function schemaUnitAssetForTransportType(transportType?: string | null): string {
  switch (transportType?.trim()) {
    case 'rabon_plataforma':
      return SCHEMA_RABON_PLATAFORMA_ASSET;
    case 'camion_pipa':
      return SCHEMA_CAMION_PIPA_ASSET;
    case 'maroma_volteo':
      return SCHEMA_MAROMA_VOLTEO_ASSET;
    default:
      return SCHEMA_TRACTO_ASSET;
  }
}

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
  return convoyTrailerVisualFromType(eq.type ?? '');
}

export function convoyTrailerVisualFromType(type: string): ConvoyTrailerVisual {
  const v = type
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  if (v === 'plataforma' || v.includes('plana') || v.includes('flatbed')) {
    return 'plataforma';
  }
  if (isCajaSecaEquipmentType(type)) {
    return 'caja_seca';
  }
  // Refrigerado (reefer): caja cerrada; comparte imagen con caja seca.
  if (v.includes('refrigerado') || v.includes('reefer')) {
    return 'caja_seca';
  }
  if (v === 'pipa' || v.includes('pipa') || v.includes('tanque') || v.includes('tank')) {
    return 'pipa';
  }
  if (v === 'cortina' || v.includes('cortina') || v.includes('lona') || v.includes('curtain')) {
    return 'cortina';
  }
  if (v === 'gondola' || v.includes('gondola') || v.includes('baranda')) {
    return 'gondola';
  }
  if (v === 'cama_baja' || v.includes('cama baja') || v.includes('lowboy')) {
    return 'cama_baja';
  }
  if (v === 'tolva' || v.includes('tolva') || v.includes('hopper')) {
    return 'tolva';
  }
  return 'remolque';
}

export function schemaPrimaryAssetForVisual(visual: ConvoyTrailerVisual): string {
  switch (visual) {
    case 'plataforma':
      return SCHEMA_PLANA_ASSET;
    case 'caja_seca':
      return SCHEMA_CAJA_SECA_ASSET;
    case 'pipa':
      return SCHEMA_PIPA_ASSET;
    case 'cortina':
      return SCHEMA_CORTINA_ASSET;
    case 'gondola':
      return SCHEMA_GONDOLA_ASSET;
    case 'cama_baja':
      return SCHEMA_CAMA_BAJA_ASSET;
    case 'tolva':
      return SCHEMA_TOLVA_ASSET;
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
