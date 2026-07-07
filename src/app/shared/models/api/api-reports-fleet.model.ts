export type ReportsFleetOperationalStatus =
  | 'in_transit'
  | 'scheduled'
  | 'available'
  | 'maintenance';

export type ReportsFleetRenewalStatus = 'ok' | 'soon' | 'due' | 'na';

export type ReportsFleetSummary = {
  from: string;
  to: string;
  totalOperationalKm: number;
  totalDieselLiters: number;
  totalDieselAmount: number;
  maintenanceEventsInPeriod: number;
  maintenanceSpendInPeriod: number;
  avgDaysWithoutOperation: number;
};

export type ReportsFleetStatusMixRow = {
  status: ReportsFleetOperationalStatus;
  label: string;
  count: number;
};

export type ReportsFleetUnitActivityRow = {
  unitLabel: string;
  completedTrips: number;
  operationalKm: number;
  dieselLiters: number;
};

export type ReportsFleetMaintenanceEventRow = {
  assetLabel: string;
  assetKind: 'unit' | 'equipment';
  entryDate: string | null;
  entryType: string;
  status: string;
  cost: number;
};

export type ReportsFleetComplianceUnitRow = {
  unitCode: string;
  unitId: number;
  maintenanceRenewal: ReportsFleetRenewalStatus;
  maintenanceNext: string | null;
  verificationRenewal: ReportsFleetRenewalStatus;
  verificationNext: string | null;
  insuranceRenewal: ReportsFleetRenewalStatus;
  insuranceNext: string | null;
};

export type ReportsFleetTireWearRow = {
  unitCode: string;
  tripCount: number;
  operationalKm: number;
  avgWeightTons: number;
  tireWearMxn: number;
  tireCpkMxn: number;
  tireLifeUsedPercent: number;
};

export type ReportsFleetUnitProfitabilityRow = {
  unitLabel: string;
  revenue: number;
  diesel: number;
  operator: number;
  tolls: number;
  maintenance: number;
  tires: number;
  netMargin: number;
  marginPercent: number | null;
};

export type ReportsFleetInsights = {
  statusMix: ReportsFleetStatusMixRow[];
  topUnitsByKm: ReportsFleetUnitActivityRow[];
  maintenanceEvents: ReportsFleetMaintenanceEventRow[];
  complianceUnits: ReportsFleetComplianceUnitRow[];
  tireWearByUnit: ReportsFleetTireWearRow[];
  unitProfitability: ReportsFleetUnitProfitabilityRow[];
};

export type ReportsFleetData = {
  summary: ReportsFleetSummary;
  insights: ReportsFleetInsights;
};

function num(raw: unknown): number {
  return Number(raw ?? 0) || 0;
}

function parseOperationalStatus(raw: unknown): ReportsFleetOperationalStatus {
  switch (raw) {
    case 'in_transit':
    case 'scheduled':
    case 'available':
    case 'maintenance':
      return raw;
    default:
      return 'available';
  }
}

function parseRenewalStatus(raw: unknown): ReportsFleetRenewalStatus {
  switch (raw) {
    case 'ok':
    case 'soon':
    case 'due':
    case 'na':
      return raw;
    default:
      return 'na';
  }
}

function parseAssetKind(raw: unknown): 'unit' | 'equipment' {
  return raw === 'equipment' ? 'equipment' : 'unit';
}

export function mapApiReportsFleet(raw: Record<string, unknown>): ReportsFleetData {
  const summaryRaw = (raw['summary'] ?? {}) as Record<string, unknown>;
  const insightsRaw = (raw['insights'] ?? {}) as Record<string, unknown>;

  const statusMix = ((insightsRaw['statusMix'] ?? []) as Record<string, unknown>[]).map(
    (row) => ({
      status: parseOperationalStatus(row['status']),
      label: String(row['label'] ?? ''),
      count: num(row['count']),
    }),
  );

  const topUnitsByKm = (
    (insightsRaw['topUnitsByKm'] ?? []) as Record<string, unknown>[]
  ).map((row) => ({
    unitLabel: String(row['unitLabel'] ?? ''),
    completedTrips: num(row['completedTrips']),
    operationalKm: num(row['operationalKm']),
    dieselLiters: num(row['dieselLiters']),
  }));

  const maintenanceEvents = (
    (insightsRaw['maintenanceEvents'] ?? []) as Record<string, unknown>[]
  ).map((row) => ({
    assetLabel: String(row['assetLabel'] ?? ''),
    assetKind: parseAssetKind(row['assetKind']),
    entryDate: row['entryDate'] != null ? String(row['entryDate']) : null,
    entryType: String(row['entryType'] ?? ''),
    status: String(row['status'] ?? 'Registrado'),
    cost: num(row['cost']),
  }));

  const complianceUnits = (
    (insightsRaw['complianceUnits'] ?? []) as Record<string, unknown>[]
  ).map((row) => ({
    unitCode: String(row['unitCode'] ?? ''),
    unitId: num(row['unitId']),
    maintenanceRenewal: parseRenewalStatus(row['maintenanceRenewal']),
    maintenanceNext: row['maintenanceNext'] != null ? String(row['maintenanceNext']) : null,
    verificationRenewal: parseRenewalStatus(row['verificationRenewal']),
    verificationNext:
      row['verificationNext'] != null ? String(row['verificationNext']) : null,
    insuranceRenewal: parseRenewalStatus(row['insuranceRenewal']),
    insuranceNext: row['insuranceNext'] != null ? String(row['insuranceNext']) : null,
  }));

  const tireWearByUnit = (
    (insightsRaw['tireWearByUnit'] ?? []) as Record<string, unknown>[]
  ).map((row) => ({
    unitCode: String(row['unitCode'] ?? ''),
    tripCount: num(row['tripCount']),
    operationalKm: num(row['operationalKm']),
    avgWeightTons: num(row['avgWeightTons']),
    tireWearMxn: num(row['tireWearMxn']),
    tireCpkMxn: num(row['tireCpkMxn']),
    tireLifeUsedPercent: num(row['tireLifeUsedPercent']),
  }));

  const unitProfitability = (
    (insightsRaw['unitProfitability'] ?? []) as Record<string, unknown>[]
  ).map((row) => ({
    unitLabel: String(row['unitLabel'] ?? '—'),
    revenue: num(row['revenue']),
    diesel: num(row['diesel']),
    operator: num(row['operator']),
    tolls: num(row['tolls']),
    maintenance: num(row['maintenance']),
    tires: num(row['tires']),
    netMargin: num(row['netMargin']),
    marginPercent: row['marginPercent'] == null ? null : num(row['marginPercent']),
  }));

  return {
    summary: {
      from: String(summaryRaw['from'] ?? ''),
      to: String(summaryRaw['to'] ?? ''),
      totalOperationalKm: num(summaryRaw['totalOperationalKm']),
      totalDieselLiters: num(summaryRaw['totalDieselLiters']),
      totalDieselAmount: num(summaryRaw['totalDieselAmount']),
      maintenanceEventsInPeriod: num(summaryRaw['maintenanceEventsInPeriod']),
      maintenanceSpendInPeriod: num(summaryRaw['maintenanceSpendInPeriod']),
      avgDaysWithoutOperation: num(
        summaryRaw['avgDaysWithoutOperation'] ?? summaryRaw['avgDaysWithoutManeuver'],
      ),
    },
    insights: {
      statusMix,
      topUnitsByKm,
      maintenanceEvents,
      complianceUnits,
      tireWearByUnit,
      unitProfitability,
    },
  };
}
