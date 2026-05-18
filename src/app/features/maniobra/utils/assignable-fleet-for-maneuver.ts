import { equipmentAssignedToUnit, unitConvoyFromEquipment } from '@app/features/fleet/utils/unit-hitched-equipment';
import { formatEquipmentOperationalId } from '@app/sim-db/utils/fleet-id-builders';
import { formatUnitTrailerOperationalId } from '@app/sim-db/utils/unit-label';
import {
  Equipment,
  Trip,
  TripOperationType,
  TripStatus,
  Unit,
} from '@shared/models/logistics.models';
import { EQUIPMENT_OPERATION_TYPE_OPTIONS } from '@app/mock-data/equipment-operation-type-options';

const ACTIVE_MANEUVER_STATUSES: TripStatus[] = ['scheduled', 'in_transit'];

const PICKABLE_UNIT_STATUSES = new Set([
  'available',
  'scheduled',
  'in_use',
]);

export type ManeuverAssignableUnitRow = {
  unit: Unit;
  /** Texto del autocomplete: código — configuración. */
  displayLabel: string;
  operationType: TripOperationType;
  hitchedEquipment: Equipment[];
  equipmentIds: string[];
};

export function busyUnitIdsFromTrips(trips: readonly Trip[]): Set<string> {
  const busy = new Set<string>();
  for (const t of trips) {
    if (ACTIVE_MANEUVER_STATUSES.includes(t.status)) {
      busy.add(t.unitId);
    }
  }
  return busy;
}

export function tripOperationTypeFromConvoyLabel(label: string): TripOperationType {
  const t = label.trim().toLowerCase();
  if (t === 'full') {
    return 'full';
  }
  if (t === 'plana') {
    return 'plana';
  }
  return 'sencillo';
}

export function buildManeuverAssignableUnitRows(
  units: readonly Unit[],
  equipment: readonly Equipment[],
  trips: readonly Trip[],
): ManeuverAssignableUnitRow[] {
  const busy = busyUnitIdsFromTrips(trips);
  return units
    .filter(
      (u) =>
        PICKABLE_UNIT_STATUSES.has(u.status) && !busy.has(u.id),
    )
    .map((unit) => {
      const hitched = equipmentAssignedToUnit([...equipment], unit.id);
      const convoy = unitConvoyFromEquipment(hitched);
      const configLabel =
        convoy.kind === 'none' ? 'Sin enganche' : convoy.label;
      return {
        unit,
        displayLabel: `${formatUnitTrailerOperationalId(unit)} - ${configLabel}`,
        operationType: tripOperationTypeFromConvoyLabel(convoy.label),
        hitchedEquipment: hitched,
        equipmentIds: hitched.map((e) => e.id),
      };
    })
    .sort((a, b) => a.displayLabel.localeCompare(b.displayLabel));
}

/** Etiqueta legible del remolque en payload de maniobra (tipo · año · placa). */
export function formatManeuverEquipmentLabel(e: Equipment): string {
  const typeRaw = (e.type ?? '').trim();
  const typeLabel =
    EQUIPMENT_OPERATION_TYPE_OPTIONS.find((o) => o.value === typeRaw)?.label ??
    typeRaw;
  const year = (e.trailerYear ?? '').trim();
  const plate = (e.plate ?? '').trim();
  const parts = [typeLabel, year, plate].filter(Boolean);
  if (parts.length > 0) {
    return parts.join(' - ');
  }
  return formatEquipmentOperationalId(e);
}

export function equipmentPickableForUnit(
  equipment: readonly Equipment[],
  unitId: string,
): Equipment[] {
  const id = unitId.trim();
  if (!id) {
    return [];
  }
  return equipment
    .filter((e) => (e.unitId ?? '').trim() === id)
    .sort((a, b) => formatManeuverEquipmentLabel(a).localeCompare(formatManeuverEquipmentLabel(b)));
}
