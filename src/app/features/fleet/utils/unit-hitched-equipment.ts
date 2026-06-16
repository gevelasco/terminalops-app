import { EQUIPMENT_OPERATION_TYPE_OPTIONS } from '@shared/catalogs/fleet-form-options';
import {
  equipmentAssignedToUnit,
  equipmentHitchPositionDisplayLabel,
} from '@shared/utils/fleet/equipment-hitch-position';
import type { OperationConfigurationResolver } from '@shared/services/operation-configuration-resolver.types';
import type { UnitConvoyDisplay, UnitConvoyKind } from '@shared/utils/operation-configuration-display.utils';
import { Equipment, TripOperationType } from '@shared/models/logistics.models';

export { equipmentAssignedToUnit, equipmentHitchPositionDisplayLabel };

export type { UnitConvoyKind };
export type UnitConvoySummary = UnitConvoyDisplay;

function equipmentOperationValue(e: Equipment): string {
  return (e.type ?? '').trim().toLowerCase();
}

export function isPlanaEquipment(e: Equipment): boolean {
  const v = equipmentOperationValue(e);
  return v === 'plataforma' || v.includes('plana') || v.includes('flatbed');
}

export function isCajaSecaEquipment(e: Equipment): boolean {
  const v = equipmentOperationValue(e);
  return (
    v === 'caja_seca' ||
    v.includes('caja seca') ||
    v.includes('dry van') ||
    v.includes('dry_van')
  );
}

export function equipmentTypeDisplayLabel(e: Equipment): string {
  return equipmentTypeDisplayLabelFromRaw(e.type ?? '');
}

/** Etiqueta de tipo desde valor API o texto de catálogo. */
export function equipmentTypeDisplayLabelFromRaw(typeRaw: string): string {
  const trimmed = typeRaw.trim();
  if (!trimmed) {
    return '—';
  }
  const byValue = EQUIPMENT_OPERATION_TYPE_OPTIONS.find((o) => o.value === trimmed);
  if (byValue) {
    return byValue.label;
  }
  const t = trimmed.toLowerCase();
  const byLabel = EQUIPMENT_OPERATION_TYPE_OPTIONS.find(
    (o) => o.label.trim().toLowerCase() === t,
  );
  return byLabel?.label ?? trimmed;
}

export function unitConvoyFromEquipment(
  list: Equipment[],
  resolver: OperationConfigurationResolver,
): UnitConvoySummary {
  return resolver.resolveConvoyDisplay(list);
}

/** Etiqueta de configuración del convoy (Tracto / Sencillo / Doble articulado), no tipo de remolque. */
export function unitConvoyConfigDisplayLabel(hitchedCount: number): string {
  if (hitchedCount >= 2) {
    return 'Doble articulado';
  }
  if (hitchedCount === 1) {
    return 'Sencillo';
  }
  return 'Tracto';
}

/** Código operativo inferido desde equipos enganchados (sin catálogo remoto). */
export function unitConvoyOperationCodeFromHitched(hitched: readonly Equipment[]): string {
  const n = hitched.length;
  if (n === 0) {
    return '';
  }
  if (n >= 2) {
    return 'full';
  }
  if (isPlanaEquipment(hitched[0]!)) {
    return 'plana';
  }
  return 'sencillo';
}

export function unitConvoyOperationTypeForTable(
  list: Equipment[],
  resolver: OperationConfigurationResolver,
): TripOperationType | null {
  const code = unitConvoyFromEquipment(list, resolver).code;
  return code?.trim() ? code : null;
}

export function convoyOverviewHitchPositionLabel(index: number, total: number): string {
  if (total <= 1) {
    return 'Equipo enganchado';
  }
  return index === 0 ? '1.er equipo' : '2.do equipo';
}
