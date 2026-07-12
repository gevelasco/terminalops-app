import type { OperatorTableExportRow } from '@features/operators/utils/operators-export-csv';
import { operatorOperationalStatusLabel } from '@shared/catalogs/operator-form-options';
import type { OperatorOperationalStatus } from '@shared/models/logistics.models';

export function operatorListExportRowFromTableRow(
  row: Record<string, unknown>,
): OperatorTableExportRow {
  const status = row['operationalStatus'];
  return {
    name: String(row['name'] ?? ''),
    licenseNumber: String(row['licenseNumber'] ?? ''),
    licenseExpiresOn: String(row['licenseExpiresOn'] ?? ''),
    operationalStatus:
      typeof status === 'string' && status
        ? operatorOperationalStatusLabel(status as OperatorOperationalStatus)
        : '—',
    coverageKind: String(row['coverageKind'] ?? ''),
    maneuverCount: String(row['maneuverCount'] ?? ''),
  };
}
