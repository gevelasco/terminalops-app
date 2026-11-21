import type { DestinationRate } from '@shared/models/destination-rate.models';
import { formatDestinationRateRoundTripDriveTime } from '@features/clients/utils/destination-rate-estimated-time';
import { cityMunicipalityNeedsEnrichment } from '@features/clients/utils/destination-rates-map-activity';
import { formatMxn } from '@features/reports/utils/reports-money';
import { operationConfigUserFacingLabel } from '@shared/utils/operation-configuration-display.utils';

export type DestinationRateTableRow = {
  /** Una fila por precio; varias filas pueden compartir el mismo rateId. */
  rowKey: string;
  rateId: string;
  state: string;
  municipality: string;
  postalCode: string;
  maneuver: string;
  costLabel: string;
  etaLabel: string;
  active: boolean;
  /** Índice de esta fila en la tabla (0-based). */
  rowIndex: number;
  /** rowspan para Estado; 0 = celda omitida (cubierta por merge). */
  stateRowSpan: number;
  /** Primera fila del merge de Estado. */
  stateSpanStart: number;
  /** rowspan para Municipio; 0 = celda omitida. */
  municipalityRowSpan: number;
  municipalitySpanStart: number;
  /** rowspan para CP; 0 = celda omitida. */
  postalCodeRowSpan: number;
  postalCodeSpanStart: number;
};

function normalizePlaceLabel(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim();
}

/**
 * Municipio para tabla: nunca muestra el nombre del estado como municipio
 * (caso Zippopotam / datos incompletos). Prefiere override SEPOMEX por CP.
 */
export function municipalityLabelForTable(
  rate: DestinationRate,
  stateName: string,
  municipalityByCp?: ReadonlyMap<string, string>,
): string {
  const cp = rate.postalCode.trim();
  const enriched = municipalityByCp?.get(cp)?.trim() ?? '';
  if (enriched && !cityMunicipalityNeedsEnrichment(enriched, stateName)) {
    return enriched;
  }

  const raw = rate.cityMunicipality.trim();
  const state = stateName.trim();

  if (!raw || cityMunicipalityNeedsEnrichment(raw, state)) {
    return '—';
  }

  if (state) {
    const suffix = `, ${state}`;
    if (raw.toLowerCase().endsWith(suffix.toLowerCase())) {
      const withoutState = raw.slice(0, raw.length - suffix.length).trim();
      if (
        withoutState &&
        normalizePlaceLabel(withoutState) !== normalizePlaceLabel(state)
      ) {
        return withoutState;
      }
    }
  }

  const comma = raw.lastIndexOf(',');
  if (comma > 0) {
    const before = raw.slice(0, comma).trim();
    if (before && normalizePlaceLabel(before) !== normalizePlaceLabel(state)) {
      return before;
    }
  }

  if (normalizePlaceLabel(raw) === normalizePlaceLabel(state)) {
    return '—';
  }
  return raw;
}

function maneuverLabel(price: DestinationRate['prices'][number]): string {
  return operationConfigUserFacingLabel(
    price.operationConfigurationName,
    price.operationConfigurationCode,
  );
}

function costLabel(amount: number): string {
  if (!Number.isFinite(amount)) {
    return '—';
  }
  return formatMxn(amount);
}

/** ETA redondo: ida + regreso (horas). */
export function formatDestinationRateRoundTripEta(
  rate: Pick<
    DestinationRate,
    'estimatedArrivalTimeValue' | 'estimatedReturnTimeValue'
  >,
): string {
  return formatDestinationRateRoundTripDriveTime(rate);
}

type FlatRow = Omit<
  DestinationRateTableRow,
  | 'rowIndex'
  | 'stateRowSpan'
  | 'stateSpanStart'
  | 'municipalityRowSpan'
  | 'municipalitySpanStart'
  | 'postalCodeRowSpan'
  | 'postalCodeSpanStart'
>;

/**
 * Filas de tabla ordenadas alfabéticamente (estado → municipio → CP → maniobra)
 * con rowspan para Estado, Municipio y CP.
 */
export function buildDestinationRateTableRows(
  rates: readonly DestinationRate[],
  stateByRateId?: ReadonlyMap<string, string>,
  municipalityByCp?: ReadonlyMap<string, string>,
): DestinationRateTableRow[] {
  const flat: FlatRow[] = [];

  for (const rate of rates) {
    const state = stateByRateId?.get(rate.id)?.trim() ?? '';
    const municipality = municipalityLabelForTable(
      rate,
      state,
      municipalityByCp,
    );
    const postalCode = rate.postalCode.trim();
    const etaLabel = formatDestinationRateRoundTripEta(rate);
    const prices = rate.prices;
    if (prices.length === 0) {
      flat.push({
        rowKey: `${rate.id}-empty`,
        rateId: rate.id,
        state,
        municipality,
        postalCode,
        maneuver: '—',
        costLabel: '—',
        etaLabel,
        active: rate.active,
      });
      continue;
    }
    for (const price of prices) {
      flat.push({
        rowKey: `${rate.id}-${price.id || maneuverLabel(price)}`,
        rateId: rate.id,
        state,
        municipality,
        postalCode,
        maneuver: maneuverLabel(price),
        costLabel: costLabel(price.clientCharge),
        etaLabel,
        active: rate.active,
      });
    }
  }

  flat.sort((a, b) => {
    const byState = a.state.localeCompare(b.state, 'es', { sensitivity: 'base' });
    if (byState !== 0) {
      return byState;
    }
    const byMun = a.municipality.localeCompare(b.municipality, 'es', {
      sensitivity: 'base',
    });
    if (byMun !== 0) {
      return byMun;
    }
    const byCp = a.postalCode.localeCompare(b.postalCode, 'es');
    if (byCp !== 0) {
      return byCp;
    }
    return a.maneuver.localeCompare(b.maneuver, 'es', { sensitivity: 'base' });
  });

  return applyMergedRowSpans(flat);
}

function applyMergedRowSpans(flat: readonly FlatRow[]): DestinationRateTableRow[] {
  const n = flat.length;
  const stateSpan = new Array<number>(n).fill(1);
  const munSpan = new Array<number>(n).fill(1);
  const cpSpan = new Array<number>(n).fill(1);
  const stateStart = new Array<number>(n).fill(0);
  const munStart = new Array<number>(n).fill(0);
  const cpStart = new Array<number>(n).fill(0);

  let i = 0;
  while (i < n) {
    let j = i + 1;
    while (j < n && flat[j]!.state === flat[i]!.state) {
      j += 1;
    }
    stateSpan[i] = j - i;
    for (let k = i; k < j; k += 1) {
      stateStart[k] = i;
      if (k > i) {
        stateSpan[k] = 0;
      }
    }

    let m = i;
    while (m < j) {
      let p = m + 1;
      while (p < j && flat[p]!.municipality === flat[m]!.municipality) {
        p += 1;
      }
      munSpan[m] = p - m;
      for (let k = m; k < p; k += 1) {
        munStart[k] = m;
        if (k > m) {
          munSpan[k] = 0;
        }
      }

      let c = m;
      while (c < p) {
        let d = c + 1;
        while (d < p && flat[d]!.postalCode === flat[c]!.postalCode) {
          d += 1;
        }
        cpSpan[c] = d - c;
        for (let k = c; k < d; k += 1) {
          cpStart[k] = c;
          if (k > c) {
            cpSpan[k] = 0;
          }
        }
        c = d;
      }
      m = p;
    }
    i = j;
  }

  return flat.map((row, idx) => ({
    ...row,
    rowIndex: idx,
    stateRowSpan: stateSpan[idx]!,
    stateSpanStart: stateStart[idx]!,
    municipalityRowSpan: munSpan[idx]!,
    municipalitySpanStart: munStart[idx]!,
    postalCodeRowSpan: cpSpan[idx]!,
    postalCodeSpanStart: cpStart[idx]!,
  }));
}
