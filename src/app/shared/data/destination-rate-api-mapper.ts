import type {
  DestinationRate,
  DestinationRateEstimatedTimeUnit,
  DestinationRatePrice,
} from '@shared/models/destination-rate.models';
import { resourceIdKey } from '@shared/utils/resource-id';

function parseRateAmount(raw: unknown): number {
  if (typeof raw === 'number') {
    return Number.isFinite(raw) ? raw : 0;
  }
  const t = String(raw ?? '').trim();
  if (!t) {
    return 0;
  }
  const n = Number(t);
  return Number.isFinite(n) ? n : 0;
}

function parseEstimatedTimeUnit(
  raw: unknown,
): DestinationRateEstimatedTimeUnit | undefined {
  const unit = String(raw ?? '').trim();
  if (unit === 'hours' || unit === 'days') {
    return unit;
  }
  return undefined;
}

function parseOptionalNumber(raw: unknown): number | undefined {
  if (raw == null || raw === '') {
    return undefined;
  }
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

function mapApiDestinationRatePrice(row: Record<string, unknown>): DestinationRatePrice {
  return {
    id: resourceIdKey(row['id']),
    operationConfigurationId: resourceIdKey(row['operationConfigurationId']),
    operationConfigurationCode: String(row['operationConfigurationCode'] ?? '').trim() || undefined,
    operationConfigurationName:
      String(row['operationConfigurationName'] ?? '').trim() || undefined,
    clientCharge: parseRateAmount(row['clientCharge']),
    operatorPaymentEstimate: parseRateAmount(row['operatorPaymentEstimate']),
    estimatedTollAmount: parseRateAmount(row['estimatedTollAmount']),
    notes: String(row['notes'] ?? '').trim() || undefined,
    createdAt: row['createdAt'] ? String(row['createdAt']) : undefined,
    updatedAt: row['updatedAt'] ? String(row['updatedAt']) : undefined,
  };
}

export function mapApiDestinationRate(row: Record<string, unknown>): DestinationRate {
  const rawPrices = row['prices'];
  const prices = Array.isArray(rawPrices)
    ? rawPrices.map((p) => mapApiDestinationRatePrice(p as Record<string, unknown>))
    : [];

  return {
    id: resourceIdKey(row['id']),
    companyId: resourceIdKey(row['companyId']),
    originOperationalCenterId: resourceIdKey(row['originOperationalCenterId']),
    originOperationalCenterName:
      String(row['originOperationalCenterName'] ?? '').trim() || undefined,
    originOperationalCenterCode:
      String(row['originOperationalCenterCode'] ?? '').trim() || undefined,
    originPostalCode: String(row['originPostalCode'] ?? '').trim(),
    originCityMunicipality: String(row['originCityMunicipality'] ?? '').trim(),
    originLocality: String(row['originLocality'] ?? '').trim(),
    originLatitude: parseOptionalNumber(row['originLatitude']),
    originLongitude: parseOptionalNumber(row['originLongitude']),
    postalCode: String(row['postalCode'] ?? '').trim(),
    cityMunicipality: String(row['cityMunicipality'] ?? '').trim(),
    locality: String(row['locality'] ?? '').trim(),
    destinationLatitude: parseOptionalNumber(row['destinationLatitude']),
    destinationLongitude: parseOptionalNumber(row['destinationLongitude']),
    routeDistanceKm: parseOptionalNumber(row['routeDistanceKm']),
    operationalDistanceKm: parseOptionalNumber(row['operationalDistanceKm']),
    isRoundTrip: row['isRoundTrip'] !== false,
    distanceCalculatedAt: row['distanceCalculatedAt']
      ? String(row['distanceCalculatedAt'])
      : undefined,
    estimatedArrivalTimeValue: parseOptionalNumber(row['estimatedArrivalTimeValue']),
    estimatedReturnTimeValue: parseOptionalNumber(row['estimatedReturnTimeValue']),
    estimatedTimeUnit: parseEstimatedTimeUnit(row['estimatedTimeUnit']),
    maneuverCount:
      typeof row['maneuverCount'] === 'number' && Number.isFinite(row['maneuverCount'])
        ? row['maneuverCount']
        : undefined,
    prices,
    active: row['active'] !== false,
    notes: String(row['notes'] ?? '').trim() || undefined,
    createdAt: row['createdAt'] ? String(row['createdAt']) : undefined,
    updatedAt: row['updatedAt'] ? String(row['updatedAt']) : undefined,
  };
}
