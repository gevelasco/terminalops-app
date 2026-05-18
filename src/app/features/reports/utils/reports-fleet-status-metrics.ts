import { buildUnitCompletedTripStats } from '@features/fleet/utils/unit-completed-trip-stats';
import {
  fleetMaintenanceRenewal,
  operationalKey,
  operationalKeyEquipment,
  type FleetOperationalKey,
  type FleetRenewalBucket,
} from '@features/fleet/utils/fleet-unit-table-row';
import type {
  Equipment,
  Operator,
  OperatorOperationalStatus,
  Trip,
  Unit,
} from '@shared/models/logistics.models';
import type { ReportsFilter, ReportsKpiCard } from '../models/reports-view.models';

export interface FleetOperationalCounts {
  unitsAvailable: number;
  unitsOnRoute: number;
  unitsMaintenance: number;
  unitsMaintSoon: number;
  equipmentAvailable: number;
  equipmentOnRoute: number;
  equipmentMaintenance: number;
  equipmentMaintSoon: number;
  operatorsAvailable: number;
  operatorsOnCourse: number;
}

function unitsInTransitIds(trips: readonly Trip[]): Set<string> {
  const ids = new Set<string>();
  for (const t of trips) {
    if (t.status === 'in_transit') {
      const id = t.unitId?.trim();
      if (id) {
        ids.add(id);
      }
    }
  }
  return ids;
}

function isMaintSoon(
  bucket: FleetRenewalBucket,
  operational: FleetOperationalKey,
): boolean {
  return operational !== 'maintenance' && (bucket === 'soon' || bucket === 'due');
}

function isOperatorOnCourse(status: OperatorOperationalStatus): boolean {
  return status === 'in_use' || status === 'on_route';
}

function countOperators(operators: readonly Operator[]): {
  available: number;
  onCourse: number;
} {
  let available = 0;
  let onCourse = 0;
  for (const o of operators) {
    if (o.status === 'available') {
      available += 1;
    }
    if (isOperatorOnCourse(o.status)) {
      onCourse += 1;
    }
  }
  return { available, onCourse };
}

function countFleetAssets(
  units: readonly Unit[],
  equipment: readonly Equipment[],
  trips: readonly Trip[],
): Omit<FleetOperationalCounts, 'operatorsAvailable' | 'operatorsOnCourse'> {
  const onRoute = unitsInTransitIds(trips);
  const kmByUnit = buildUnitCompletedTripStats([...trips])
    .completedDistanceKmSumByUnitId;

  const counts = {
    unitsAvailable: 0,
    unitsOnRoute: 0,
    unitsMaintenance: 0,
    unitsMaintSoon: 0,
    equipmentAvailable: 0,
    equipmentOnRoute: 0,
    equipmentMaintenance: 0,
    equipmentMaintSoon: 0,
  };

  for (const u of units) {
    const op = operationalKey(u, onRoute.has(u.id));
    const maint = fleetMaintenanceRenewal(u.fleetMeta, kmByUnit.get(u.id) ?? null);
    switch (op) {
      case 'available':
        counts.unitsAvailable += 1;
        break;
      case 'on_route':
        counts.unitsOnRoute += 1;
        break;
      case 'maintenance':
        counts.unitsMaintenance += 1;
        break;
      default:
        break;
    }
    if (isMaintSoon(maint, op)) {
      counts.unitsMaintSoon += 1;
    }
  }

  for (const e of equipment) {
    const unitId = e.unitId?.trim() ?? '';
    const op = operationalKeyEquipment(e, unitId.length > 0 && onRoute.has(unitId));
    const maint = fleetMaintenanceRenewal(
      e.fleetMeta,
      unitId ? (kmByUnit.get(unitId) ?? null) : null,
    );
    switch (op) {
      case 'available':
        counts.equipmentAvailable += 1;
        break;
      case 'on_route':
        counts.equipmentOnRoute += 1;
        break;
      case 'maintenance':
        counts.equipmentMaintenance += 1;
        break;
      default:
        break;
    }
    if (isMaintSoon(maint, op)) {
      counts.equipmentMaintSoon += 1;
    }
  }

  return counts;
}

function filterUnits(units: readonly Unit[], filter: ReportsFilter): Unit[] {
  const id = filter.unitId?.trim();
  if (!id) {
    return [...units];
  }
  return units.filter((u) => u.id === id);
}

function filterEquipment(
  equipment: readonly Equipment[],
  filter: ReportsFilter,
): Equipment[] {
  const id = filter.unitId?.trim();
  if (!id) {
    return [...equipment];
  }
  return equipment.filter((e) => e.unitId === id);
}

export function buildFleetOperationalCounts(
  units: readonly Unit[],
  equipment: readonly Equipment[],
  operators: readonly Operator[],
  allTrips: readonly Trip[],
  filter: ReportsFilter,
): FleetOperationalCounts {
  const assetCounts = countFleetAssets(
    filterUnits(units, filter),
    filterEquipment(equipment, filter),
    allTrips,
  );
  const opCounts = countOperators(operators);
  return {
    ...assetCounts,
    operatorsAvailable: opCounts.available,
    operatorsOnCourse: opCounts.onCourse,
  };
}

function enCursoBesideLegend(count: number): Pick<
  ReportsKpiCard,
  'legend' | 'legendPlacement'
> {
  if (count <= 0) {
    return {};
  }
  return {
    legend: `${count} en curso`,
    legendPlacement: 'beside',
  };
}

function maintSoonBesideLegend(count: number): Pick<
  ReportsKpiCard,
  'legend' | 'legendPlacement'
> {
  if (count <= 0) {
    return {};
  }
  return {
    legend: `${count} próximas a mantenimiento`,
    legendPlacement: 'beside',
  };
}

export function buildFleetStatusKpis(
  counts: FleetOperationalCounts,
): ReportsKpiCard[] {
  return [
    {
      id: 'units-available',
      title: 'Unidades disponibles',
      titleIcon: 'units',
      value: String(counts.unitsAvailable),
      ...enCursoBesideLegend(counts.unitsOnRoute),
    },
    {
      id: 'units-maintenance',
      title: 'Unidades en mantenimiento',
      titleIcon: 'units',
      value: String(counts.unitsMaintenance),
      ...maintSoonBesideLegend(counts.unitsMaintSoon),
    },
    {
      id: 'equipment-available',
      title: 'Equipos disponibles',
      titleIcon: 'equipment',
      value: String(counts.equipmentAvailable),
      ...enCursoBesideLegend(counts.equipmentOnRoute),
    },
    {
      id: 'equipment-maintenance',
      title: 'Equipos en mantenimiento',
      titleIcon: 'equipment',
      value: String(counts.equipmentMaintenance),
      ...maintSoonBesideLegend(counts.equipmentMaintSoon),
    },
    {
      id: 'operators-available',
      title: 'Operadores disponibles',
      titleIcon: 'operators',
      value: String(counts.operatorsAvailable),
      ...enCursoBesideLegend(counts.operatorsOnCourse),
    },
  ];
}
