import type { TripStatus } from '@shared/models/logistics.models';

export type ReportsManiobrasSummary = {
  from: string;
  to: string;
  completedTripsCount: number;
  completedTripsPriorPeriodPercent: number | null;
  tripsInTransit: number;
  tripsScheduledInPeriod: number;
  cancelledTripsCount: number;
  delayedTripsCount: number;
  totalOperationalKm: number;
  avgKmPerTrip: number;
  avgManeuverDurationDays: number;
  uniqueDestinations: number;
};

export type ReportsManiobrasContainerTypeRow = {
  containerType: string;
  label: string;
  tripCount: number;
};

export type ReportsManiobrasCargoWeightRow = {
  containerType: string;
  label: string;
  tripCount: number;
  avgWeightTons: number;
};

export type ReportsManiobrasOperatorRow = {
  operatorName: string;
  completed: number;
  operationalKm: number;
};

export type ReportsManiobrasClientRow = {
  clientName: string;
  tripCount: number;
};

export type ReportsManiobrasDestinationRow = {
  destination: string;
  tripCount: number;
};

export type ReportsManiobrasGeoMapTrip = {
  tripId: number;
  maneuverCode: string;
  status: TripStatus;
  operatorName: string;
  clientName: string;
  durationDays: number | null;
  lat: number | null;
  lng: number | null;
};

export type ReportsManiobrasRecurringIncidentRoute = {
  destination: string;
  incidentCount: number;
  maneuverCodes: string[];
  lastIncidentAt: string | null;
};

export type ReportsManiobrasInsights = {
  recurringIncidentRoutes: ReportsManiobrasRecurringIncidentRoute[];
  topOperators: ReportsManiobrasOperatorRow[];
  topClients: ReportsManiobrasClientRow[];
  topDestinations: ReportsManiobrasDestinationRow[];
  containerTypeMix: ReportsManiobrasContainerTypeRow[];
  cargoWeightByContainer: ReportsManiobrasCargoWeightRow[];
  geoMapTrips: ReportsManiobrasGeoMapTrip[];
};

export type ReportsManiobrasData = {
  summary: ReportsManiobrasSummary;
  insights: ReportsManiobrasInsights;
};

function num(raw: unknown): number {
  return Number(raw ?? 0) || 0;
}

function parseTripStatus(raw: unknown): TripStatus {
  switch (raw) {
    case 'scheduled':
    case 'in_transit':
    case 'completed':
    case 'cancelled':
      return raw;
    default:
      return 'scheduled';
  }
}

function mapSummary(raw: Record<string, unknown>): ReportsManiobrasSummary {
  const prior = raw['completedTripsPriorPeriodPercent'];
  return {
    from: String(raw['from'] ?? ''),
    to: String(raw['to'] ?? ''),
    completedTripsCount: num(raw['completedTripsCount']),
    completedTripsPriorPeriodPercent: prior == null ? null : num(prior),
    tripsInTransit: num(raw['tripsInTransit']),
    tripsScheduledInPeriod: num(raw['tripsScheduledInPeriod']),
    cancelledTripsCount: num(raw['cancelledTripsCount']),
    delayedTripsCount: num(raw['delayedTripsCount']),
    totalOperationalKm: num(raw['totalOperationalKm']),
    avgKmPerTrip: num(raw['avgKmPerTrip']),
    avgManeuverDurationDays: num(raw['avgManeuverDurationDays']),
    uniqueDestinations: num(raw['uniqueDestinations']),
  };
}

export function mapApiReportsManiobras(raw: Record<string, unknown>): ReportsManiobrasData {
  const insightsRaw = (raw['insights'] ?? {}) as Record<string, unknown>;

  const recurringIncidentRoutes = (
    (insightsRaw['recurringIncidentRoutes'] ?? []) as Record<string, unknown>[]
  ).map((row) => ({
    destination: String(row['destination'] ?? 'Sin destino'),
    incidentCount: num(row['incidentCount']),
    maneuverCodes: ((row['maneuverCodes'] ?? []) as unknown[]).map((code) => String(code)),
    lastIncidentAt: row['lastIncidentAt'] ? String(row['lastIncidentAt']) : null,
  }));

  const topOperators = ((insightsRaw['topOperators'] ?? []) as Record<string, unknown>[]).map(
    (row) => ({
      operatorName: String(row['operatorName'] ?? 'Sin operador'),
      completed: num(row['completed']),
      operationalKm: num(row['operationalKm']),
    }),
  );

  const topClients = ((insightsRaw['topClients'] ?? []) as Record<string, unknown>[]).map(
    (row) => ({
      clientName: String(row['clientName'] ?? 'Sin cliente'),
      tripCount: num(row['tripCount']),
    }),
  );

  const topDestinations = (
    (insightsRaw['topDestinations'] ?? []) as Record<string, unknown>[]
  ).map((row) => ({
    destination: String(row['destination'] ?? 'Sin destino'),
    tripCount: num(row['tripCount']),
  }));

  const containerTypeMix = (
    (insightsRaw['containerTypeMix'] ?? []) as Record<string, unknown>[]
  ).map((row) => ({
    containerType: String(row['containerType'] ?? 'na'),
    label: String(row['label'] ?? ''),
    tripCount: num(row['tripCount']),
  }));

  const cargoWeightByContainer = (
    (insightsRaw['cargoWeightByContainer'] ?? []) as Record<string, unknown>[]
  ).map((row) => ({
    containerType: String(row['containerType'] ?? 'na'),
    label: String(row['label'] ?? ''),
    tripCount: num(row['tripCount']),
    avgWeightTons: num(row['avgWeightTons']),
  }));

  const geoMapTrips = ((insightsRaw['geoMapTrips'] ?? []) as Record<string, unknown>[]).map(
    (row) => {
      const durationDays = row['durationDays'];
      const latRaw = row['lat'];
      const lngRaw = row['lng'];
      return {
        tripId: num(row['tripId']),
        maneuverCode: String(row['maneuverCode'] ?? ''),
        status: parseTripStatus(row['status']),
        operatorName: String(row['operatorName'] ?? 'Sin operador'),
        clientName: String(row['clientName'] ?? 'Sin cliente'),
        durationDays: durationDays == null ? null : num(durationDays),
        lat: latRaw == null ? null : num(latRaw),
        lng: lngRaw == null ? null : num(lngRaw),
      };
    },
  );

  return {
    summary: mapSummary((raw['summary'] ?? {}) as Record<string, unknown>),
    insights: {
      recurringIncidentRoutes,
      topOperators,
      topClients,
      topDestinations,
      containerTypeMix,
      cargoWeightByContainer,
      geoMapTrips,
    },
  };
}
