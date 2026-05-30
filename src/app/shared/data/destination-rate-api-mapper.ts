import type {
  DestinationRate,
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
    postalCode: String(row['postalCode'] ?? '').trim(),
    cityMunicipality: String(row['cityMunicipality'] ?? '').trim(),
    locality: String(row['locality'] ?? '').trim(),
    prices,
    active: row['active'] !== false,
    notes: String(row['notes'] ?? '').trim() || undefined,
    createdAt: row['createdAt'] ? String(row['createdAt']) : undefined,
    updatedAt: row['updatedAt'] ? String(row['updatedAt']) : undefined,
  };
}
