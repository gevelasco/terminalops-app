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
  diesel: DashboardDieselSnapshot;
};

export function mapApiDashboardSummary(raw: Record<string, unknown>): DashboardSummary {
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
