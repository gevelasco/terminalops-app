import { EQUIPMENT_OPERATION_TYPE_OPTIONS } from '@shared/catalogs/fleet-form-options';
import { Equipment, TripOperationType } from '@shared/models/logistics.models';
import { resourceIdKey, resourceIdsEqual } from '@shared/utils/resource-id';

export type UnitConvoyKind = 'none' | 'sencillo' | 'full' | 'plana';

export type UnitConvoySummary = {
  kind: UnitConvoyKind;
  label: string;
  badgeClass: string;
  description: string;
};

/** Equipos (remolques) asignados a una unidad tractora, orden estables. */
export function equipmentAssignedToUnit(
  equipment: Equipment[],
  unitId: unknown,
): Equipment[] {
  const id = resourceIdKey(unitId);
  if (!id) {
    return [];
  }
  return equipment
    .filter((e) => resourceIdsEqual(e.unitId, id))
    .sort((a, b) => resourceIdKey(a.id).localeCompare(resourceIdKey(b.id)));
}

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

/** Configuración operativa según remolques enganchados (0 / 1 / 2+). */
export function unitConvoyFromEquipment(list: Equipment[]): UnitConvoySummary {
  const n = list.length;
  if (n === 0) {
    return {
      kind: 'none',
      label: 'Sin enganche',
      badgeClass: 'to-table-badge--op-unknown',
      description:
        'No hay remolques asignados a esta tractora. Enganche uno para operar sencillo o dos para full.',
    };
  }
  if (n === 1 && isPlanaEquipment(list[0]!)) {
    return {
      kind: 'plana',
      label: 'Plana',
      badgeClass: 'to-table-badge--op-plana',
      description: 'Un remolque tipo plataforma enganchado.',
    };
  }
  if (n === 1) {
    return {
      kind: 'sencillo',
      label: 'Sencillo',
      badgeClass: 'to-table-badge--op-sencillo',
      description: 'Un remolque enganchado (configuración sencillo).',
    };
  }
  return {
    kind: 'full',
    label: 'Full',
    badgeClass: 'to-table-badge--op-full',
    description: `${n} remolques enganchados (configuración full).`,
  };
}

/** Valor para columna «Configuración» en tabla de unidades (`operation-type` cell). */
export function unitConvoyOperationTypeForTable(
  list: Equipment[],
): TripOperationType | null {
  switch (unitConvoyFromEquipment(list).kind) {
    case 'sencillo':
      return 'sencillo';
    case 'full':
      return 'full';
    case 'plana':
      return 'plana';
    default:
      return null;
  }
}

export function hitchPositionLabel(index: number, total: number): string {
  if (total <= 1) {
    return 'Remolque enganchado';
  }
  return index === 0 ? '1.er remolque (delantero)' : '2.º remolque (trasero)';
}

/** Texto de ayuda al asignar un nuevo remolque a una tractora. */
export function newEquipmentHitchHint(
  assignedCount: number,
  unitLabel: string | null,
): string | null {
  if (!unitLabel) {
    return null;
  }
  if (assignedCount === 0) {
    return `Al guardar, este será el primer remolque de ${unitLabel} (convoy sencillo).`;
  }
  if (assignedCount === 1) {
    return `${unitLabel} ya tiene un remolque. Al agregar otro, la convoy pasa a full.`;
  }
  return `${unitLabel} ya tiene ${assignedCount} remolques enganchados (full). Revise si corresponde reasignar.`;
}
