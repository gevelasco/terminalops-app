import type { Trip } from '@shared/models/logistics.models';
import { formatTripRouteLabel } from '@shared/utils/trip-route-label';
import type {
  ReportsDestinationPerformanceRow,
  ReportsManiobrasTabView,
  ReportsKpiCard,
} from '../models/reports-view.models';
import type { ReportsFilteredBundle } from './reports-bundle-filter';
import { countBarSlices } from './reports-chart-mappers';
import { deltaLabel } from './reports-money';
import { buildManiobrasByOperator } from './reports-maniobra-by-operator';
import type { TripEvaluator } from '@shared/models/trip-evaluation.model';
import { buildOperationDonut } from './reports-operation-donut';
import {
  tripCollectedRevenue,
  tripCreditReceivable,
  tripDirectCost,
  tripRevenue,
} from './reports-trip-helpers';

function destinationLabel(t: Trip): string {
  const city = t.destinationCityMunicipality?.trim();
  if (city) {
    return city;
  }
  const dest = t.destination?.trim();
  return dest || 'Sin destino';
}

function countUniqueDestinations(trips: readonly Trip[]): number {
  return new Set(trips.map((t) => destinationLabel(t))).size;
}

function aggregateCountBy(
  trips: readonly Trip[],
  labelFn: (t: Trip) => string,
): { label: string; count: number }[] {
  const map = new Map<string, number>();
  for (const t of trips) {
    const label = labelFn(t);
    map.set(label, (map.get(label) ?? 0) + 1);
  }
  return [...map.entries()].map(([label, count]) => ({ label, count }));
}

function tripBillableRevenue(t: Trip): number {
  return tripCollectedRevenue(t) + tripCreditReceivable(t);
}

function buildIncidentsByRoute(trips: readonly Trip[]) {
  const map = new Map<string, number>();
  for (const t of trips) {
    const incidents = t.incidents ?? [];
    if (incidents.length === 0) {
      continue;
    }
    const route = formatTripRouteLabel(t.origin, t.destination);
    map.set(route, (map.get(route) ?? 0) + incidents.length);
  }
  return countBarSlices(
    [...map.entries()].map(([label, count]) => ({ label, count })),
    'reports-chart-bar__fill--cancelled',
    6,
  );
}

function buildDestinationPerformance(
  trips: readonly Trip[],
): ReportsDestinationPerformanceRow[] {
  const map = new Map<string, { maneuvers: number; revenue: number; cost: number }>();
  for (const t of trips) {
    const label = destinationLabel(t);
    const row = map.get(label) ?? { maneuvers: 0, revenue: 0, cost: 0 };
    row.maneuvers += 1;
    row.revenue += tripBillableRevenue(t) || tripRevenue(t);
    row.cost += tripDirectCost(t);
    map.set(label, row);
  }

  return [...map.entries()]
    .map(([label, v]) => ({
      key: label,
      label,
      maneuvers: v.maneuvers,
      revenue: Math.round(v.revenue),
      cost: Math.round(v.cost),
      margin: Math.round(v.revenue - v.cost),
    }))
    .sort((a, b) => b.margin - a.margin)
    .slice(0, 8);
}

export function buildManiobrasTabView(
  bundle: ReportsFilteredBundle,
  evaluator: TripEvaluator,
): ReportsManiobrasTabView {
  const trips = bundle.trips;
  const completed = trips.filter((t) => t.status === 'completed').length;
  const inTransit = trips.filter((t) => t.status === 'in_transit').length;
  const destinations = countUniqueDestinations(trips);

  const prevTrips = bundle.previousTrips;
  const prevCompleted = prevTrips.filter((t) => t.status === 'completed').length;
  const prevInTransit = prevTrips.filter((t) => t.status === 'in_transit').length;
  const prevDestinations = countUniqueDestinations(prevTrips);

  const kpis: ReportsKpiCard[] = [
    {
      id: 'count',
      title: 'Maniobras',
      titleIcon: 'maniobras',
      value: String(trips.length),
      ...delta(trips.length, prevTrips.length),
    },
    {
      id: 'completed',
      title: 'Completadas',
      titleIcon: 'maniobras',
      value: String(completed),
      legend: trips.length ? `${Math.round((completed / trips.length) * 100)}% del total` : '—',
      legendPlacement: 'beside',
      ...delta(completed, prevCompleted),
    },
    {
      id: 'in-transit',
      title: 'En curso',
      titleIcon: 'maniobras',
      value: String(inTransit),
      legend: trips.length ? `${Math.round((inTransit / trips.length) * 100)}% del total` : '—',
      legendPlacement: 'beside',
      ...delta(inTransit, prevInTransit),
    },
    {
      id: 'destinations',
      title: 'Destinos',
      titleIcon: 'maniobras',
      value: String(destinations),
      legend: 'Ciudades / puntos de destino distintos',
      legendPlacement: 'beside',
      ...delta(destinations, prevDestinations),
    },
  ];

  return {
    kpis,
    destinationSlices: countBarSlices(
      aggregateCountBy(trips, destinationLabel),
      'reports-chart-bar__fill--client',
      10,
    ),
    clientSlices: countBarSlices(
      aggregateCountBy(trips, (t) => t.clientName?.trim() || 'Sin cliente'),
      'reports-chart-bar__fill--expense',
      10,
    ),
    operationDonut: buildOperationDonut(trips, evaluator),
    maneuversByOperator: buildManiobrasByOperator(trips, bundle.operators),
    destinationPerformance: buildDestinationPerformance(trips),
    incidentsByRoute: buildIncidentsByRoute(trips),
  };
}

function delta(current: number, previous: number) {
  const d = deltaLabel(current, previous);
  return { deltaLabel: d.label, deltaTone: d.tone };
}
