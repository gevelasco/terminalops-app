import type { OperationConfiguration } from '@shared/models/operation-configuration.models';
import { resourceIdKey } from '@shared/utils/resource-id';

export function mapApiOperationConfiguration(
  row: Record<string, unknown>,
): OperationConfiguration {
  return {
    id: resourceIdKey(row['id']),
    companyId: resourceIdKey(row['companyId']),
    code: String(row['code'] ?? '').trim(),
    name: String(row['name'] ?? '').trim(),
    maxEquipmentCount: Number(row['maxEquipmentCount'] ?? 1) || 1,
    version: Number(row['version'] ?? 1) || 1,
    active: row['active'] !== false,
    createdAt: row['createdAt'] ? String(row['createdAt']) : undefined,
    updatedAt: row['updatedAt'] ? String(row['updatedAt']) : undefined,
  };
}
