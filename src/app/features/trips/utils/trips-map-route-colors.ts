import type { TripMapStatus } from '@shared/models/api/api-trips-map.model';

export const TRIPS_MAP_ROUTE_COLORS: Record<
  TripMapStatus,
  { line: string; effect: string }
> = {
  in_transit: {
    line: '#2563eb',
    effect: '#2563eb',
  },
  scheduled: {
    line: '#ca8a04',
    effect: '#eab308',
  },
};

export function tripsMapRouteColor(status: string): { line: string; effect: string } {
  if (status === 'scheduled') {
    return TRIPS_MAP_ROUTE_COLORS.scheduled;
  }
  return TRIPS_MAP_ROUTE_COLORS.in_transit;
}
