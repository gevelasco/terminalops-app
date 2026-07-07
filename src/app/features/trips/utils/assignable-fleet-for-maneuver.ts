import {
  equipmentTypeDisplayLabel,
  unitConvoyConfigDisplayLabel,
  unitConvoyOperationCodeFromHitched,
} from '@app/features/fleet/utils/unit-hitched-equipment';
import {
  equipmentAssignedToUnit,
  sortEquipmentByHitchPosition,
} from '@shared/utils/fleet/equipment-hitch-position';
import { formatEquipmentOperationalId } from '@shared/utils/fleet/fleet-id-builders';
import { formatUnitTrailerOperationalId } from '@shared/utils/fleet/unit-label';
import {
  Equipment,
  Trip,
  TripOperationType,
  TripStatus,
  Unit,
} from '@shared/models/logistics.models';
import { resourceIdKey, resourceIdsEqual } from '@shared/utils/resource-id';
import { isFleetResourceActive } from '@shared/utils/fleet-resource-active';

const ACTIVE_MANEUVER_STATUSES: TripStatus[] = ['scheduled', 'in_transit'];

const PICKABLE_UNIT_STATUSES = new Set([
  'available',
  'scheduled',
  'in_use',
]);

export type ManeuverAssignableUnitRow = {
  unit: Unit;
  displayLabel: string;
  operationType: TripOperationType;
  hitchedEquipment: Equipment[];
  equipmentIds: string[];
};

/** Equipos enganchados activos de una unidad (catálogo embebido en listado de unidades). */
export function unitHitchedEquipment(unit: Unit): Equipment[] {
  const nested = unit.hitchedEquipment ?? [];
  return sortEquipmentByHitchPosition(nested.filter((e) => isFleetResourceActive(e)));
}

/** Equipos enganchados con metadatos completos (catálogo de equipos + fallback embebido en unidad). */
export function resolveUnitHitchedEquipment(
  unit: Unit | undefined,
  equipmentCatalog: readonly Equipment[],
): Equipment[] {
  if (!unit) {
    return [];
  }
  const fromCatalog = equipmentAssignedToUnit(equipmentCatalog, unit.id).filter((e) =>
    isFleetResourceActive(e),
  );
  if (fromCatalog.length > 0) {
    return fromCatalog;
  }
  return unitHitchedEquipment(unit);
}

/** Código operativo del convoy enganchado a la unidad (`sencillo`, `full`, `plana`, …). */
export function unitManeuverOperationCode(unit: Unit): string {
  return unitConvoyOperationCodeFromHitched(unitHitchedEquipment(unit));
}

/** La unidad debe coincidir con la configuración elegida en el formulario. */
export function unitMatchesManeuverOperationCode(
  unit: Unit,
  maneuverOperationCode: string,
): boolean {
  const unitCode = unitManeuverOperationCode(unit).trim().toLowerCase();
  const maneuverCode = maneuverOperationCode.trim().toLowerCase();
  if (!unitCode || !maneuverCode) {
    return false;
  }
  return unitCode === maneuverCode;
}

export function busyUnitIdsFromTrips(trips: readonly Trip[]): Set<string> {
  const busy = new Set<string>();
  for (const t of trips) {
    if (ACTIVE_MANEUVER_STATUSES.includes(t.status)) {
      busy.add(t.unitId);
    }
  }
  return busy;
}

export function buildManeuverAssignableUnitRows(
  units: readonly Unit[],
  trips: readonly Trip[],
): ManeuverAssignableUnitRow[] {
  const busy = busyUnitIdsFromTrips(trips);
  return units
    .filter(
      (u) =>
        isFleetResourceActive(u) &&
        PICKABLE_UNIT_STATUSES.has(u.status) &&
        !busy.has(u.id),
    )
    .map((unit) => {
      const hitched = unitHitchedEquipment(unit);
      const configLabel = unitConvoyConfigDisplayLabel(hitched.length);
      return {
        unit,
        displayLabel: `${formatUnitTrailerOperationalId(unit)} - ${configLabel}`,
        operationType: unitConvoyOperationCodeFromHitched(hitched) as TripOperationType,
        hitchedEquipment: hitched,
        equipmentIds: hitched.map((e) => e.id),
      };
    })
    .filter((row) => row.hitchedEquipment.length > 0)
    .sort((a, b) => a.displayLabel.localeCompare(b.displayLabel));
}

export function formatManeuverEquipmentLabel(e: Equipment): string {
  const operationalId = formatEquipmentOperationalId(e).trim();
  const typeLabel = equipmentTypeDisplayLabel(e);
  const hasType = typeLabel !== '—';
  if (hasType && operationalId) {
    return `${typeLabel} - ${operationalId}`;
  }
  if (operationalId) {
    return operationalId;
  }
  if (hasType) {
    return typeLabel;
  }
  const year = (e.trailerYear ?? '').trim();
  const plate = (e.plate ?? '').trim();
  const parts = [year, plate].filter(Boolean);
  if (parts.length > 0) {
    return parts.join(' - ');
  }
  return formatEquipmentOperationalId(e);
}

export function equipmentPickableForUnit(
  equipment: readonly Equipment[],
  unitId: string,
): Equipment[] {
  const id = resourceIdKey(unitId);
  if (!id) {
    return [];
  }
  return equipment
    .filter((e) => resourceIdsEqual(e.unitId, id))
    .sort((a, b) => formatManeuverEquipmentLabel(a).localeCompare(formatManeuverEquipmentLabel(b)));
}
