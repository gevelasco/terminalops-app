import type {
  FleetEquipmentTableExportRow,
  FleetUnitTableExportRow,
} from '@features/fleet/utils/fleet-export-csv';
import {
  fleetOperationalKeyLabel,
  fleetRenewalBucketLabel,
  type FleetOperationalKey,
  type FleetRenewalBucket,
} from '@features/fleet/utils/fleet-unit-table-row';

function fleetComplianceExportCell(bucket: unknown, next: unknown): string {
  const label = fleetRenewalBucketLabel(bucket as FleetRenewalBucket);
  const nextStr = typeof next === 'string' ? next.trim() : '';
  if (label === '—' && !nextStr) {
    return '—';
  }
  if (nextStr && nextStr !== '—') {
    return `${label} · ${nextStr}`;
  }
  return label;
}

function fleetConfigBadgesExportCell(value: unknown): string {
  if (!Array.isArray(value)) {
    return '—';
  }
  const labels = value
    .filter(
      (item): item is { label: string } =>
        item != null &&
        typeof item === 'object' &&
        typeof (item as { label?: unknown }).label === 'string',
    )
    .map((item) => item.label.trim())
    .filter(Boolean);
  return labels.length ? labels.join(', ') : '—';
}

export function fleetUnitListExportRowFromTableRow(
  row: Record<string, unknown>,
): FleetUnitTableExportRow {
  return {
    brand: String(row['fleetBrand'] ?? ''),
    model: String(row['fleetModel'] ?? ''),
    plate: String(row['fleetPlate'] ?? ''),
    operationalStatus: fleetOperationalKeyLabel(
      row['fleetOperational'] as FleetOperationalKey,
    ),
    maintenance: fleetComplianceExportCell(row['fleetMaint'], row['fleetMaintNext']),
    verification: fleetComplianceExportCell(row['fleetVerif'], row['fleetVerifNext']),
    insurance: fleetComplianceExportCell(row['fleetIns'], row['fleetInsNext']),
    configuration: fleetConfigBadgesExportCell(row['fleetConfigBadges']),
  };
}

export function fleetEquipmentListExportRowFromTableRow(
  row: Record<string, unknown>,
): FleetEquipmentTableExportRow {
  return {
    brand: String(row['fleetBrand'] ?? ''),
    model: String(row['fleetModel'] ?? ''),
    equipmentType: String(row['fleetUnitType'] ?? ''),
    plate: String(row['fleetPlate'] ?? ''),
    operationalStatus: fleetOperationalKeyLabel(
      row['fleetOperational'] as FleetOperationalKey,
    ),
    maintenance: fleetComplianceExportCell(row['fleetMaint'], row['fleetMaintNext']),
    verification: fleetComplianceExportCell(row['fleetVerif'], row['fleetVerifNext']),
    insurance: fleetComplianceExportCell(row['fleetIns'], row['fleetInsNext']),
  };
}
