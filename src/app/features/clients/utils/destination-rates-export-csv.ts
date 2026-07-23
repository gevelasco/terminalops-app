import type { DestinationRate } from '@shared/models/destination-rate.models';
import { formatGroupedNumber } from '@shared/utils/format-grouped-number';

export type DestinationRateCatalogExportRow = {
  state: string;
  municipality: string;
  locality: string;
  postalCode: string;
  maneuverType: string;
  price: string;
};

function csvCell(value: string): string {
  const t = value.replace(/"/g, '""');
  return /[",\n\r]/.test(t) ? `"${t}"` : t;
}

function priceTypeLabel(price: DestinationRate['prices'][number]): string {
  return (
    price.operationConfigurationName?.trim() ||
    price.operationConfigurationCode?.trim() ||
    'Maniobra'
  );
}

function municipalityLabel(rate: DestinationRate, stateName: string): string {
  const raw = rate.cityMunicipality.trim();
  if (!raw) {
    return '';
  }
  const state = stateName.trim();
  if (state) {
    const suffix = `, ${state}`;
    if (raw.toLowerCase().endsWith(suffix.toLowerCase())) {
      return raw.slice(0, raw.length - suffix.length).trim();
    }
  }
  const comma = raw.lastIndexOf(',');
  if (comma > 0) {
    return raw.slice(0, comma).trim();
  }
  return raw;
}

/**
 * Una fila por tipo de maniobra / precio.
 * `stateByRateId` aporta el estado MX resuelto por coordenadas.
 */
export function buildDestinationRateCatalogExportRows(
  rates: readonly DestinationRate[],
  stateByRateId?: ReadonlyMap<string, string>,
): DestinationRateCatalogExportRow[] {
  const rows: DestinationRateCatalogExportRow[] = [];
  const sorted = [...rates].sort((a, b) => {
    const stateA = stateByRateId?.get(a.id) ?? '';
    const stateB = stateByRateId?.get(b.id) ?? '';
    const byState = stateA.localeCompare(stateB, 'es');
    if (byState !== 0) {
      return byState;
    }
    const byCp = a.postalCode.localeCompare(b.postalCode, 'es');
    if (byCp !== 0) {
      return byCp;
    }
    return a.locality.localeCompare(b.locality, 'es', { sensitivity: 'base' });
  });

  for (const rate of sorted) {
    const state = stateByRateId?.get(rate.id)?.trim() ?? '';
    const municipality = municipalityLabel(rate, state);
    const locality = rate.locality.trim();
    const postalCode = rate.postalCode.trim();
    const prices = rate.prices;
    if (prices.length === 0) {
      rows.push({
        state,
        municipality,
        locality,
        postalCode,
        maneuverType: '',
        price: '',
      });
      continue;
    }

    for (const price of prices) {
      rows.push({
        state,
        municipality,
        locality,
        postalCode,
        maneuverType: priceTypeLabel(price),
        price: Number.isFinite(price.clientCharge)
          ? formatGroupedNumber(price.clientCharge, { maxFractionDigits: 2 })
          : '',
      });
    }
  }

  return rows;
}

export function buildDestinationRatesCatalogCsv(
  rows: readonly DestinationRateCatalogExportRow[],
): string {
  const headers = [
    'Estado',
    'Municipio',
    'Colonia',
    'CP',
    'Tipo de maniobra',
    'Precio',
  ];
  const lines = [headers.map(csvCell).join(',')];
  for (const row of rows) {
    lines.push(
      [
        row.state,
        row.municipality,
        row.locality,
        row.postalCode,
        row.maneuverType,
        row.price,
      ]
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
