import type { TripEvaluator } from '@shared/models/trip-evaluation.model';
import type { ReportsFilter, ReportsFleetTabView } from '../models/reports-view.models';
import type { ReportsFilteredBundle } from './reports-bundle-filter';
import { buildFleetChartsView } from './reports-fleet-charts';
import {
  buildFleetOperationalCounts,
  buildFleetStatusKpis,
} from './reports-fleet-status-metrics';

export function buildFleetTabView(
  bundle: ReportsFilteredBundle,
  filter: ReportsFilter,
  evaluator: TripEvaluator,
): ReportsFleetTabView {
  const fleetCounts = buildFleetOperationalCounts(
    bundle.units,
    bundle.equipment,
    bundle.operators,
    bundle.allTrips,
    filter,
  );
  const kpis = buildFleetStatusKpis(fleetCounts);
  const charts = buildFleetChartsView(bundle, filter, evaluator);

  return {
    kpis,
    ...charts,
  };
}
