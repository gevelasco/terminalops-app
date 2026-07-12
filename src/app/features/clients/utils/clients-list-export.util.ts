import type { ClientTableExportRow } from '@features/clients/utils/clients-export-csv';
import { clientCommercialHealthLabel } from '@shared/catalogs/client-form-options';

export function clientListExportRowFromTableRow(
  row: Record<string, unknown>,
): ClientTableExportRow {
  const name = String(row['name'] ?? '');
  const health = row['commercialHealth'];
  const healthLabel =
    typeof health === 'string' && health.trim()
      ? clientCommercialHealthLabel(health)
      : '';
  const clientCell =
    healthLabel && healthLabel !== '—' ? `${name} · ${healthLabel}` : name;

  return {
    client: clientCell,
    rfc: String(row['rfc'] ?? ''),
    relationshipStartedOn: String(row['relationshipLabel'] ?? ''),
    creditDays: String(row['creditDaysLabel'] ?? ''),
    creditVolume: String(row['creditVolumeLabel'] ?? ''),
    maneuverCount: String(row['maneuverCount'] ?? ''),
  };
}
