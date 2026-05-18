import { formatTripRouteLabel } from '@shared/utils/trip-route-label';
import type { Trip } from '@shared/models/logistics.models';
import type { ReportsRouteClientProfitRow } from '../models/reports-view.models';
import {
  isTripBillableForReporting,
  tripDirectCost,
  tripKm,
  tripRevenue,
} from './reports-trip-helpers';

function parseWeightTons(raw?: string): number {
  const n = Number(String(raw ?? '').replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function buildRouteClientProfitability(
  trips: readonly Trip[],
): ReportsRouteClientProfitRow[] {
  const map = new Map<
    string,
    {
      client: string;
      route: string;
      maneuvers: number;
      volumeTons: number;
      km: number;
      revenue: number;
      cost: number;
    }
  >();

  for (const t of trips) {
    if (!isTripBillableForReporting(t)) {
      continue;
    }
    const client = t.clientName?.trim() || 'Sin cliente';
    const route = formatTripRouteLabel(t.origin, t.destination);
    const key = `${client}|${route}`;
    const row = map.get(key) ?? {
      client,
      route,
      maneuvers: 0,
      volumeTons: 0,
      km: 0,
      revenue: 0,
      cost: 0,
    };
    row.maneuvers += 1;
    row.volumeTons += parseWeightTons(t.approximateWeightTons);
    row.km += tripKm(t);
    row.revenue += tripRevenue(t);
    row.cost += tripDirectCost(t);
    map.set(key, row);
  }

  return [...map.entries()]
    .map(([key, r]) => {
      const margin = r.revenue - r.cost;
      const marginPct = r.revenue > 0 ? Math.round((margin / r.revenue) * 100) : 0;
      return {
        key,
        client: r.client,
        route: r.route,
        maneuvers: r.maneuvers,
        volumeTons: Math.round(r.volumeTons * 10) / 10,
        km: Math.round(r.km),
        revenue: Math.round(r.revenue),
        cost: Math.round(r.cost),
        margin: Math.round(margin),
        marginPct,
      };
    })
    .sort((a, b) => a.margin - b.margin)
    .slice(0, 12);
}
