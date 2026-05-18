import { formatEquipmentOperationalId } from '@app/sim-db/utils/fleet-id-builders';
import { labelForUnitId } from '@app/sim-db/utils/unit-label';
import type { Equipment, Expense, Trip, Unit } from '@shared/models/logistics.models';
import { formatTripRouteLabel } from '@shared/utils/trip-route-label';
import type {
  ReportsBarSlice,
  ReportsDonutSlice,
  ReportsFilter,
  ReportsFleetActivityBarRow,
  ReportsFleetIncidentBarRow,
  ReportsFleetMaintTargetCountRow,
} from '../models/reports-view.models';
import type { ReportsFilteredBundle } from './reports-bundle-filter';
import { countBarFillClass, countBarSlices } from './reports-chart-mappers';
import { buildMaintenanceServicedInPeriod } from './reports-fleet-maintenance-serviced';
import { buildFleetOperatorPayments } from './reports-fleet-operator-payments';
import { buildOperationDonut } from './reports-operation-donut';
import { tripKm } from './reports-trip-helpers';

export type ReportsFleetChartsView = Pick<
  import('../models/reports-view.models').ReportsFleetTabView,
  | 'topUnitsByActivity'
  | 'operationDonut'
  | 'topEquipmentByActivity'
  | 'unitsWithIncidents'
  | 'maintenanceServicedInPeriod'
  | 'maintenanceByTargetDonut'
  | 'maintenanceTargetCounts'
  | 'operatorPayments'
  | 'avgManeuversPerUnit'
  | 'unitsWithManeuversInPeriod'
  | 'maneuversPerUnit'
>;

const MAINT_TARGET_COLORS: Record<string, string> = {
  Unidades: '#4f46e5',
  Equipos: '#0ea5e9',
};

function activityBarRows(
  entries: { key: string; label: string; km: number; maneuvers: number }[],
  fillPrefix: string,
  maxRows = 8,
): ReportsFleetActivityBarRow[] {
  const sorted = [...entries]
    .filter((e) => e.km > 0 || e.maneuvers > 0)
    .sort((a, b) => b.km - a.km || b.maneuvers - a.maneuvers)
    .slice(0, maxRows);
  const maxKm = Math.max(1, ...sorted.map((e) => e.km));
  return sorted.map((e, i) => ({
    key: e.key,
    label: e.label,
    km: Math.round(e.km),
    maneuvers: e.maneuvers,
    pct: Math.round((e.km / maxKm) * 100),
    fillClass: countBarFillClass(fillPrefix, i),
  }));
}

function buildTopUnitsByActivity(
  trips: readonly Trip[],
  units: readonly Unit[],
): ReportsFleetActivityBarRow[] {
  const byUnit = new Map<string, { km: number; maneuvers: number }>();
  for (const t of trips) {
    const id = t.unitId?.trim();
    if (!id) {
      continue;
    }
    const row = byUnit.get(id) ?? { km: 0, maneuvers: 0 };
    row.maneuvers += 1;
    row.km += tripKm(t);
    byUnit.set(id, row);
  }
  const entries = [...byUnit.entries()].map(([key, v]) => ({
    key,
    label: labelForUnitId(key, units),
    km: v.km,
    maneuvers: v.maneuvers,
  }));
  return activityBarRows(entries, 'reports-chart-bar__fill--unit');
}

function buildTopEquipmentByActivity(
  trips: readonly Trip[],
  equipment: readonly Equipment[],
): ReportsFleetActivityBarRow[] {
  const byEq = new Map<string, { km: number; maneuvers: number }>();
  for (const t of trips) {
    const unitId = t.unitId?.trim();
    if (!unitId) {
      continue;
    }
    for (const e of equipment) {
      if ((e.unitId ?? '').trim() !== unitId) {
        continue;
      }
      const id = e.id;
      const row = byEq.get(id) ?? { km: 0, maneuvers: 0 };
      row.maneuvers += 1;
      row.km += tripKm(t);
      byEq.set(id, row);
    }
  }
  const entries = [...byEq.entries()].map(([key, v]) => {
    const eq = equipment.find((x) => x.id === key);
    return {
      key,
      label: eq ? formatEquipmentOperationalId(eq) : key,
      km: v.km,
      maneuvers: v.maneuvers,
    };
  });
  return activityBarRows(entries, 'reports-chart-bar__fill--expense');
}

function formatTopRoutes(routes: Map<string, number>, max = 3): string {
  const sorted = [...routes.entries()].sort((a, b) => b[1] - a[1]).slice(0, max);
  if (sorted.length === 0) {
    return '—';
  }
  return sorted.map(([r]) => r).join(' · ');
}

function buildUnitsWithIncidents(
  trips: readonly Trip[],
  units: readonly Unit[],
): ReportsFleetIncidentBarRow[] {
  const byUnit = new Map<
    string,
    { incidents: number; routes: Map<string, number> }
  >();

  for (const t of trips) {
    const id = t.unitId?.trim();
    if (!id) {
      continue;
    }
    const n = t.incidents?.length ?? 0;
    if (n <= 0 && !t.hasIncident) {
      continue;
    }
    const count = n > 0 ? n : 1;
    const route = formatTripRouteLabel(t.origin, t.destination);
    const row = byUnit.get(id) ?? { incidents: 0, routes: new Map() };
    row.incidents += count;
    row.routes.set(route, (row.routes.get(route) ?? 0) + count);
    byUnit.set(id, row);
  }

  const sorted = [...byUnit.entries()]
    .sort((a, b) => b[1].incidents - a[1].incidents)
    .slice(0, 8);
  const total = sorted.reduce((a, [, v]) => a + v.incidents, 0) || 1;

  return sorted.map(([id, v], i) => ({
    key: id,
    label: labelForUnitId(id, units),
    routes: formatTopRoutes(v.routes),
    count: v.incidents,
    pct: Math.round((v.incidents / total) * 100),
    fillClass: countBarFillClass('reports-chart-bar__fill--cancelled', i),
  }));
}

function maintenanceExpenses(expenses: readonly Expense[]): Expense[] {
  return expenses.filter((e) => e.kind === 'maintenance' && e.currency === 'MXN');
}

function buildMaintenanceTargetCounts(
  maint: readonly Expense[],
): ReportsFleetMaintTargetCountRow[] {
  const rows: ReportsFleetMaintTargetCountRow[] = [
      {
        key: 'unit',
        label: 'Unidades',
        count: maint.filter((e) => e.maintenanceTarget === 'unit').length,
        color: MAINT_TARGET_COLORS['Unidades'] ?? '#4f46e5',
      },
      {
        key: 'equipment',
        label: 'Equipos',
        count: maint.filter((e) => e.maintenanceTarget === 'equipment').length,
        color: MAINT_TARGET_COLORS['Equipos'] ?? '#0ea5e9',
      },
    ];
  return rows.filter((r) => r.count > 0);
}

function buildMaintenanceByTargetDonut(
  maint: readonly Expense[],
): ReportsDonutSlice[] {
  const unitAmt = maint
    .filter((e) => e.maintenanceTarget === 'unit')
    .reduce((a, e) => a + e.amount, 0);
  const eqAmt = maint
    .filter((e) => e.maintenanceTarget === 'equipment')
    .reduce((a, e) => a + e.amount, 0);
  const rows = [
    { label: 'Unidades', amount: unitAmt },
    { label: 'Equipos', amount: eqAmt },
  ].filter((r) => r.amount > 0);
  const total = rows.reduce((a, r) => a + r.amount, 0) || 1;
  let assigned = 0;
  return rows.map((r, i) => {
    const pct =
      i === rows.length - 1
        ? Math.max(0, 100 - assigned)
        : Math.round((r.amount / total) * 100);
    assigned += pct;
    return {
      key: r.label,
      label: r.label,
      value: Math.round(r.amount),
      pct,
      color: MAINT_TARGET_COLORS[r.label] ?? '#94a3b8',
    };
  });
}

function buildManeuversPerUnit(
  trips: readonly Trip[],
  units: readonly Unit[],
): ReportsBarSlice[] {
  const byUnit = new Map<string, number>();
  for (const t of trips) {
    const id = t.unitId?.trim();
    if (!id) {
      continue;
    }
    byUnit.set(id, (byUnit.get(id) ?? 0) + 1);
  }
  const rows = [...byUnit.entries()].map(([id, count]) => ({
    label: labelForUnitId(id, units),
    count,
  }));
  return countBarSlices(rows, 'reports-chart-bar__fill--unit', 24);
}

function buildAvgManeuversPerUnit(trips: readonly Trip[]): {
  avg: number;
  unitsWithManeuvers: number;
} {
  const unitIds = new Set<string>();
  for (const t of trips) {
    const id = t.unitId?.trim();
    if (id) {
      unitIds.add(id);
    }
  }
  const n = unitIds.size;
  if (n === 0) {
    return { avg: 0, unitsWithManeuvers: 0 };
  }
  return {
    avg: Math.round((trips.length / n) * 10) / 10,
    unitsWithManeuvers: n,
  };
}

export function buildFleetChartsView(
  bundle: ReportsFilteredBundle,
  filter: ReportsFilter,
): ReportsFleetChartsView {
  const trips = bundle.trips;
  const maint = maintenanceExpenses(bundle.expenses);
  const { avg, unitsWithManeuvers } = buildAvgManeuversPerUnit(trips);
  const maintenanceServicedInPeriod = buildMaintenanceServicedInPeriod(
    bundle,
    filter,
    maint,
  );

  return {
    topUnitsByActivity: buildTopUnitsByActivity(trips, bundle.units),
    operationDonut: buildOperationDonut(trips),
    topEquipmentByActivity: buildTopEquipmentByActivity(trips, bundle.equipment),
    unitsWithIncidents: buildUnitsWithIncidents(trips, bundle.units),
    maintenanceServicedInPeriod,
    maintenanceByTargetDonut: buildMaintenanceByTargetDonut(maint),
    maintenanceTargetCounts: buildMaintenanceTargetCounts(maint),
    operatorPayments: buildFleetOperatorPayments(
      trips,
      bundle.expenses,
      bundle.operators,
    ),
    avgManeuversPerUnit: avg,
    unitsWithManeuversInPeriod: unitsWithManeuvers,
    maneuversPerUnit: buildManeuversPerUnit(trips, bundle.units),
  };
}
