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

export function equipmentTypeDisplayLabel(e: Equipment): string {
  const typeRaw = (e.type ?? '').trim();
  if (!typeRaw) {
    return '—';
  }
  const byValue = EQUIPMENT_OPERATION_TYPE_OPTIONS.find((o) => o.value === typeRaw);
  if (byValue) {
    return byValue.label;
  }
  const t = typeRaw.toLowerCase();
  const byLabel = EQUIPMENT_OPERATION_TYPE_OPTIONS.find(
    (o) => o.label.trim().toLowerCase() === t,
  );
  return byLabel?.label ?? typeRaw;
}

export function unitConvoyFromEquipment(
  list: Equipment[],
  resolver: OperationConfigurationResolver,
): UnitConvoySummary {
  return resolver.resolveConvoyDisplay(list);
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
    return 'Remolque enganchado';
  }
  return index === 0 ? '1.er remolque (delantero)' : '2.º remolque (trasero)';
}
