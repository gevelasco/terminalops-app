export type DashboardDailyExpenseRubro = {
  rubro: string;
  label: string;
  amount: number;
  count: number;
};

export type DashboardDailyPeriodDistribution = {
  collectedRevenue: number;
  receivableRevenue: number;
  expensesByRubro: DashboardDailyExpenseRubro[];
};

export type DashboardDailyResult = {
  revenue: number;
  expenses: number;
  margin: number;
  completedTripsCount: number;
  expensesCount: number;
  periodDistribution: DashboardDailyPeriodDistribution;
};

export type DashboardDieselSnapshot = {
  enabled: boolean;
  pricePerLiter: number | null;
  suggestedPricePerLiter: number | null;
  source: 'company' | 'suggested' | null;
  updatedAt: string | null;
};

export type DashboardSummary = {
  asOf: string;
  operationalDate: string;
  tripsInTransit: number;
  tripsInTransitDestinations: number;
  unitsAvailable: number;
  equipmentAvailable: number;
  tripsScheduled: number;
  tripsScheduledWeekOverWeekPercent: number | null;
  nextScheduledDepartureAt: string | null;
  dailyResult: DashboardDailyResult;
  diesel: DashboardDieselSnapshot;
};

function mapDailyExpenseRubro(raw: Record<string, unknown>): DashboardDailyExpenseRubro {
  return {
    rubro: String(raw['rubro'] ?? ''),
    label: String(raw['label'] ?? ''),
    amount: Number(raw['amount'] ?? 0) || 0,
    count: Number(raw['count'] ?? 0) || 0,
  };
}

function mapDailyPeriodDistribution(
  raw: Record<string, unknown> | undefined,
): DashboardDailyPeriodDistribution {
  const rows = (raw?.['expensesByRubro'] ?? []) as Record<string, unknown>[];
  return {
    collectedRevenue: Number(raw?.['collectedRevenue'] ?? 0) || 0,
    receivableRevenue: Number(raw?.['receivableRevenue'] ?? 0) || 0,
    expensesByRubro: rows.map(mapDailyExpenseRubro),
  };
}

export function mapApiDashboardSummary(raw: Record<string, unknown>): DashboardSummary {
  const daily = (raw['dailyResult'] ?? {}) as Record<string, unknown>;
  const diesel = (raw['diesel'] ?? {}) as Record<string, unknown>;
  const weekPct = raw['tripsScheduledWeekOverWeekPercent'];
  return {
    asOf: String(raw['asOf'] ?? ''),
    operationalDate: String(raw['operationalDate'] ?? ''),
    tripsInTransit: Number(raw['tripsInTransit'] ?? 0) || 0,
    tripsInTransitDestinations: Number(raw['tripsInTransitDestinations'] ?? 0) || 0,
    unitsAvailable: Number(raw['unitsAvailable'] ?? 0) || 0,
    equipmentAvailable: Number(raw['equipmentAvailable'] ?? 0) || 0,
    tripsScheduled: Number(raw['tripsScheduled'] ?? 0) || 0,
    tripsScheduledWeekOverWeekPercent:
      weekPct == null ? null : Number(weekPct) || 0,
    nextScheduledDepartureAt:
      raw['nextScheduledDepartureAt'] != null
        ? String(raw['nextScheduledDepartureAt'])
        : null,
    dailyResult: {
      revenue: Number(daily['revenue'] ?? 0) || 0,
      expenses: Number(daily['expenses'] ?? 0) || 0,
      margin: Number(daily['margin'] ?? 0) || 0,
      completedTripsCount: Number(daily['completedTripsCount'] ?? 0) || 0,
      expensesCount: Number(daily['expensesCount'] ?? 0) || 0,
      periodDistribution: mapDailyPeriodDistribution(
        daily['periodDistribution'] as Record<string, unknown> | undefined,
      ),
    },
    diesel: {
      enabled: diesel['enabled'] === true,
      pricePerLiter:
        diesel['pricePerLiter'] != null ? Number(diesel['pricePerLiter']) : null,
      suggestedPricePerLiter:
        diesel['suggestedPricePerLiter'] != null
          ? Number(diesel['suggestedPricePerLiter'])
          : null,
      source:
        diesel['source'] === 'company' || diesel['source'] === 'suggested'
          ? diesel['source']
          : null,
      updatedAt: diesel['updatedAt'] != null ? String(diesel['updatedAt']) : null,
    },
  };
}
