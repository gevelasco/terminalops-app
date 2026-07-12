import type { ManiobraListExportRow } from '@features/trips/utils/trips-export-csv';
import type { MxStackedDatetime } from '@shared/utils/format-datetime-mx';
import type { TripStatus } from '@shared/models/logistics.models';
import { maneuverStatusPillLabel } from '@shared/utils/maneuver-status-pill';

function formatStackedMxExport(value: unknown): string {
  if (!value || typeof value !== 'object') {
    return '—';
  }
  const dt = value as MxStackedDatetime;
  if (!dt.date?.trim()) {
    return '—';
  }
  return dt.time?.trim() ? `${dt.date} ${dt.time}` : dt.date;
}

export function maniobraListExportRowFromTableRow(
  row: Record<string, unknown>,
  operationTypeLabel: (op: unknown, row?: Record<string, unknown>) => string,
): ManiobraListExportRow {
  const status = row['status'] as TripStatus;
  const falseManeuver = row['falseManeuver'] === true;
  return {
    code: String(row['code'] ?? ''),
    route: String(row['route'] ?? ''),
    clientName: String(row['clientName'] ?? ''),
    operatorName: String(row['operatorName'] ?? ''),
    unitId: String(row['unitId'] ?? ''),
    status: maneuverStatusPillLabel(status, { falseManeuver }),
    departureAt: formatStackedMxExport(row['departureAt']),
    arrivedAt: formatStackedMxExport(row['arrivedAt']),
    operationType: operationTypeLabel(row['operationType'], row),
    hasIncident: row['hasIncident'] === true ? 'Sí' : 'No',
  };
}
