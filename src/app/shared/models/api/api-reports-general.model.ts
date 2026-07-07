import {
  mapApiDashboardInsights,
  type DashboardInsights,
} from './api-dashboard-insights.model';
import type { ReportsManiobrasOperatorRow } from './api-reports-maniobras.model';

export type ReportsGeneralSummary = {
  from: string;
  to: string;
  completedTripsCount: number;
  completedTripsPriorPeriodPercent: number | null;
  completedTripsDailyAvg: number;
  revenue: number;
  avgRevenuePerTrip: number;
  expenses: number;
  expensesCount: number;
  margin: number;
  tripsInTransit: number;
  tripsScheduledInPeriod: number;
  unitsUsed: number;
};

export type ReportsGeneralExpenseRubro = {
  rubro: string;
  label: string;
  amount: number;
  count: number;
};

export type ReportsGeneralPeriodDistribution = {
  collectedRevenue: number;
  receivableRevenue: number;
  expensesByRubro: ReportsGeneralExpenseRubro[];
};

export type ReportsGeneralInsights = Pick<
  DashboardInsights,
  'tripActivity' | 'operationalFlow' | 'topDestinations' | 'operationMix' | 'operationMixTotal'
> & {
  periodDistribution: ReportsGeneralPeriodDistribution;
  topOperators: ReportsManiobrasOperatorRow[];
};

export type ReportsGeneralData = {
  summary: ReportsGeneralSummary;
  insights: ReportsGeneralInsights;
};

function mapSummary(raw: Record<string, unknown>): ReportsGeneralSummary {
  const pct = raw['completedTripsPriorPeriodPercent'];
  return {
    from: String(raw['from'] ?? ''),
    to: String(raw['to'] ?? ''),
    completedTripsCount: Number(raw['completedTripsCount'] ?? 0) || 0,
    completedTripsPriorPeriodPercent:
      pct == null ? null : Number(pct) || 0,
    completedTripsDailyAvg: Number(raw['completedTripsDailyAvg'] ?? 0) || 0,
    revenue: Number(raw['revenue'] ?? 0) || 0,
    avgRevenuePerTrip: Number(raw['avgRevenuePerTrip'] ?? 0) || 0,
    expenses: Number(raw['expenses'] ?? 0) || 0,
    expensesCount: Number(raw['expensesCount'] ?? 0) || 0,
    margin: Number(raw['margin'] ?? 0) || 0,
    tripsInTransit: Number(raw['tripsInTransit'] ?? 0) || 0,
    tripsScheduledInPeriod: Number(raw['tripsScheduledInPeriod'] ?? 0) || 0,
    unitsUsed: Number(raw['unitsUsed'] ?? 0) || 0,
  };
}

function mapExpenseRubro(raw: Record<string, unknown>): ReportsGeneralExpenseRubro {
  return {
    rubro: String(raw['rubro'] ?? ''),
    label: String(raw['label'] ?? ''),
    amount: Number(raw['amount'] ?? 0) || 0,
    count: Number(raw['count'] ?? 0) || 0,
  };
}

function mapPeriodDistribution(
  raw: Record<string, unknown> | undefined,
): ReportsGeneralPeriodDistribution {
  const rows = (raw?.['expensesByRubro'] ?? []) as Record<string, unknown>[];
  return {
    collectedRevenue: Number(raw?.['collectedRevenue'] ?? 0) || 0,
    receivableRevenue: Number(raw?.['receivableRevenue'] ?? 0) || 0,
    expensesByRubro: rows.map(mapExpenseRubro),
  };
}

export function mapApiReportsGeneral(raw: Record<string, unknown>): ReportsGeneralData {
  const insightsRaw = (raw['insights'] ?? {}) as Record<string, unknown>;
  const mappedInsights = mapApiDashboardInsights({
    ...insightsRaw,
    recentTrips: [],
  });

  const topOperators = ((insightsRaw['topOperators'] ?? []) as Record<string, unknown>[]).map(
    (row) => ({
      operatorName: String(row['operatorName'] ?? 'Sin operador'),
      completed: Number(row['completed'] ?? 0) || 0,
      operationalKm: Number(row['operationalKm'] ?? 0) || 0,
    }),
  );

  return {
    summary: mapSummary((raw['summary'] ?? {}) as Record<string, unknown>),
    insights: {
      tripActivity: mappedInsights.tripActivity,
      operationalFlow: mappedInsights.operationalFlow,
      topDestinations: mappedInsights.topDestinations,
      operationMix: mappedInsights.operationMix,
      operationMixTotal: mappedInsights.operationMixTotal,
      periodDistribution: mapPeriodDistribution(
        insightsRaw['periodDistribution'] as Record<string, unknown> | undefined,
      ),
      topOperators,
    },
  };
}
