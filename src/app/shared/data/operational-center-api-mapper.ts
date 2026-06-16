import type { OperationalCenter } from '@shared/models/operational-center.models';
import { resourceIdKey } from '@shared/utils/resource-id';

function parseCoord(raw: unknown): number | undefined {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return raw;
  }
  const t = String(raw ?? '').trim();
  if (!t) {
    return undefined;
  }
  const n = Number(t);
  return Number.isFinite(n) ? n : undefined;
}

export function mapApiOperationalCenter(
  row: Record<string, unknown>,
): OperationalCenter {
  return {
    id: resourceIdKey(row['id']),
    companyId: resourceIdKey(row['companyId']),
    name: String(row['name'] ?? '').trim() || 'Centro operativo',
    code: String(row['code'] ?? '').trim() || 'MAIN',
    postalCode: String(row['postalCode'] ?? '').trim() || undefined,
    cityMunicipality: String(row['cityMunicipality'] ?? '').trim() || undefined,
    locality: String(row['locality'] ?? '').trim() || undefined,
    settlementConsId: String(row['settlementConsId'] ?? '').trim() || undefined,
    latitude: parseCoord(row['latitude']),
    longitude: parseCoord(row['longitude']),
    isDefault: row['isDefault'] === true,
    createdAt: row['createdAt'] ? String(row['createdAt']) : undefined,
    updatedAt: row['updatedAt'] ? String(row['updatedAt']) : undefined,
  };
}
