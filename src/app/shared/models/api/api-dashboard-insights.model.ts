export type DashboardOperationalFlowPoint = {
  date: string;
  trips: number;
  expenses: number;
  revenue: number;
};

export type DashboardTripActivityPoint = {
  date: string;
  completed: number;
  inTransit: number;
  scheduled: number;
};

export type DashboardTopDestination = {
  destination: string;
  tripCount: number;
};

export type DashboardRecentTrip = {
  id: number;
  status: string;
  falseManeuver: boolean;
  operatorName: string;
  destination: string;
  clientCharge: string | null;
};

export type DashboardOperationMixSlice = {
  operationType: string;
  label: string;
  count: number;
};

export type DashboardInsights = {
  operationalFlow: DashboardOperationalFlowPoint[];
  tripActivity: DashboardTripActivityPoint[];
  topDestinations: DashboardTopDestination[];
  recentTrips: DashboardRecentTrip[];
  operationMix: DashboardOperationMixSlice[];
  operationMixTotal: number;
};

export function mapApiDashboardInsights(raw: Record<string, unknown>): DashboardInsights {
  const flow = Array.isArray(raw['operationalFlow']) ? raw['operationalFlow'] : [];
  const activity = Array.isArray(raw['tripActivity']) ? raw['tripActivity'] : [];
  const destinations = Array.isArray(raw['topDestinations']) ? raw['topDestinations'] : [];
  const recent = Array.isArray(raw['recentTrips']) ? raw['recentTrips'] : [];
  const mix = Array.isArray(raw['operationMix']) ? raw['operationMix'] : [];

  return {
    operationalFlow: flow.map((row) => {
      const p = row as Record<string, unknown>;
      return {
        date: String(p['date'] ?? ''),
        trips: Number(p['trips'] ?? 0) || 0,
        expenses: Number(p['expenses'] ?? 0) || 0,
        revenue: Number(p['revenue'] ?? 0) || 0,
      };
    }),
    tripActivity: activity.map((row) => {
      const p = row as Record<string, unknown>;
      return {
        date: String(p['date'] ?? ''),
        completed: Number(p['completed'] ?? 0) || 0,
        inTransit: Number(p['inTransit'] ?? p['in_transit'] ?? 0) || 0,
        scheduled: Number(p['scheduled'] ?? 0) || 0,
      };
    }),
    topDestinations: destinations.map((row) => {
      const p = row as Record<string, unknown>;
      return {
        destination: String(p['destination'] ?? ''),
        tripCount: Number(p['tripCount'] ?? 0) || 0,
      };
    }),
    recentTrips: recent.map((row) => {
      const p = row as Record<string, unknown>;
      return {
        id: Number(p['id'] ?? 0) || 0,
        status: String(p['status'] ?? ''),
        falseManeuver: p['falseManeuver'] === true,
        operatorName: String(p['operatorName'] ?? 'Sin operador'),
        destination: String(p['destination'] ?? ''),
        clientCharge: p['clientCharge'] != null ? String(p['clientCharge']) : null,
      };
    }),
    operationMix: mix.map((row) => {
      const p = row as Record<string, unknown>;
      return {
        operationType: String(p['operationType'] ?? ''),
        label: String(p['label'] ?? ''),
        count: Number(p['count'] ?? 0) || 0,
      };
    }),
    operationMixTotal: Number(raw['operationMixTotal'] ?? 0) || 0,
  };
}
