import type { DestinationRate } from '@shared/models/destination-rate.models';
import {
  normalizeDestinationRateScope,
  type DestinationRateScope,
} from '@shared/models/destination-rate-scope';
import {
  buildDestinationRateTableRows,
  type DestinationRateTableRow,
} from '@features/clients/utils/destination-rates-table-rows';

export type DestinationRateCatalogExportRow = {
  state: string;
  municipality: string;
  locality: string;
  postalCode: string;
  maneuverType: string;
  price: string;
  eta: string;
};

function csvCell(value: string): string {
  const t = value.replace(/"/g, '""');
  return /[",\n\r]/.test(t) ? `"${t}"` : t;
}

/**
 * Filas de export alineadas a la tabla del catálogo (incluye dedupe por scope estado).
 */
export function buildDestinationRateCatalogExportRows(
  rates: readonly DestinationRate[],
  stateByRateId?: ReadonlyMap<string, string>,
  scope?: DestinationRateScope | string | null,
): DestinationRateCatalogExportRow[] {
  const tableRows = buildDestinationRateTableRows(
    rates,
    stateByRateId,
    undefined,
    scope,
  );
  return tableRows.map((row) => tableRowToExportRow(row));
}

function tableRowToExportRow(
  row: DestinationRateTableRow,
): DestinationRateCatalogExportRow {
  return {
    state: row.state,
    municipality: row.municipality === '—' ? '' : row.municipality,
    locality: '',
    postalCode: row.postalCode,
    maneuverType: row.maneuver === '—' ? '' : row.maneuver,
    price: row.costLabel === '—' ? '' : row.costLabel,
    eta: row.etaLabel === '—' ? '' : row.etaLabel,
  };
}

/** Columnas del CSV según la política (igual que la tabla). */
export function destinationRateCatalogCsvHeaders(
  scope?: DestinationRateScope | string | null,
): string[] {
  const normalized = normalizeDestinationRateScope(scope);
  if (normalized === 'state') {
    return ['Estado', 'Maniobra', 'Cobro Cliente', 'ETA'];
  }
  if (normalized === 'municipality') {
    return ['Estado', 'Municipio', 'Maniobra', 'Cobro Cliente', 'ETA'];
  }
  return ['Estado', 'Municipio', 'CP', 'Maniobra', 'Cobro Cliente', 'ETA'];
}

function csvCellsForScope(
  row: DestinationRateCatalogExportRow,
  scope?: DestinationRateScope | string | null,
): string[] {
  const normalized = normalizeDestinationRateScope(scope);
  if (normalized === 'state') {
    return [row.state, row.maneuverType, row.price, row.eta];
  }
  if (normalized === 'municipality') {
    return [row.state, row.municipality, row.maneuverType, row.price, row.eta];
  }
  return [
    row.state,
    row.municipality,
    row.postalCode,
    row.maneuverType,
    row.price,
    row.eta,
  ];
}

export function buildDestinationRatesCatalogCsv(
  rows: readonly DestinationRateCatalogExportRow[],
  scope?: DestinationRateScope | string | null,
): string {
  const headers = destinationRateCatalogCsvHeaders(scope);
  const lines = [headers.map(csvCell).join(',')];
  for (const row of rows) {
    lines.push(
      csvCellsForScope(row, scope)
        .map((v) => csvCell(String(v)))
        .join(','),
    );
  }
  return `\uFEFF${lines.join('\n')}`;
}

export function downloadDestinationRatesCatalogCsv(
  content: string,
  filename: string,
): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
