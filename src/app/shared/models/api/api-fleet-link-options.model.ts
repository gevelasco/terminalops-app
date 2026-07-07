import type { OperatorOperationalStatus } from '@shared/models/logistics.models';

export interface FleetResourceLinkOption {
  id: string;
  operationalCode: string;
  status: string;
  isActive: boolean;
}

export interface OperatorLinkOption {
  id: string;
  name: string;
  status: OperatorOperationalStatus;
  isActive: boolean;
}

export interface FleetResourceLinkOptionsResponse {
  items: FleetResourceLinkOption[];
}

export interface OperatorLinkOptionsResponse {
  items: OperatorLinkOption[];
}

export function mapApiFleetResourceLinkOption(
  row: Record<string, unknown>,
): FleetResourceLinkOption {
  return {
    id: String(row['id'] ?? ''),
    operationalCode: String(row['operationalCode'] ?? '').trim(),
    status: String(row['status'] ?? '').trim(),
    isActive: row['isActive'] !== false,
  };
}

export function mapApiOperatorLinkOption(
  row: Record<string, unknown>,
): OperatorLinkOption {
  return {
    id: String(row['id'] ?? ''),
    name: String(row['name'] ?? '').trim(),
    status: row['status'] as OperatorOperationalStatus,
    isActive: row['isActive'] !== false,
  };
}
