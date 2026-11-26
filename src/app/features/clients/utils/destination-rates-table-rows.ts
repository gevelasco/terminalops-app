import type { DestinationRate } from '@shared/models/destination-rate.models';
import {
  normalizeDestinationRateScope,
  type DestinationRateScope,
} from '@shared/models/destination-rate-scope';
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
  const fromScope = rate.municipalityName?.trim() ?? '';
  if (fromScope) {
    return fromScope;
  }

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

function stateKeyForTable(
  rate: DestinationRate,
  stateByRateId?: ReadonlyMap<string, string>,
): string {
  return normalizePlaceLabel(
    rate.stateName?.trim() ||
      stateByRateId?.get(rate.id)?.trim() ||
      rate.cityMunicipality?.trim() ||
      '',
  );
}

/** Clave de tipo de maniobra (full ≡ doble articulado). */
export function maneuverDedupeKey(
  price: DestinationRate['prices'][number],
): string {
  const code = (price.operationConfigurationCode ?? '').trim().toLowerCase();
  if (
    code === 'full' ||
    code === 'doble-articulado' ||
    code === 'doble_articulado'
  ) {
    return 'doble-articulado';
  }
  if (code) {
    return code;
  }
  const label = normalizePlaceLabel(maneuverLabel(price));
  if (label.includes('doble articulado') || label === 'full') {
    return 'doble-articulado';
  }
  return label || `cfg:${price.operationConfigurationId}`;
}

function rateScoreForSurvivor(rate: DestinationRate): number {
  let best = 0;
  for (const price of rate.prices) {
    const amount = Number(price.clientCharge);
    if (Number.isFinite(amount) && amount > best) {
      best = amount;
    }
  }
  const coords =
    rate.destinationLatitude != null && rate.destinationLongitude != null
      ? 1
      : 0;
  return best * 10 + coords;
}

/**
 * Scope estado: una tarifa “canónica” por estado (para mapa / click).
 * La tabla luego muestra un row por cada tipo de maniobra.
 */
export function pickStateScopeSurvivorRates(
  rates: readonly DestinationRate[],
  stateByRateId?: ReadonlyMap<string, string>,
): DestinationRate[] {
  const byState = new Map<string, DestinationRate>();
  for (const rate of rates) {
    if (rate.active === false) {
      continue;
    }
    const key = stateKeyForTable(rate, stateByRateId);
    if (!key) {
      continue;
    }
    const existing = byState.get(key);
    if (!existing || rateScoreForSurvivor(rate) > rateScoreForSurvivor(existing)) {
      byState.set(key, rate);
    }
  }
  return [...byState.values()];
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
 * Scope estado: un row por (estado, tipo de maniobra), cobro máximo de ese tipo.
 * Así sencillo + doble articulado + volteo conviven; solo se quitan duplicados del mismo tipo.
 */
function buildStateScopeFlatRows(
  rates: readonly DestinationRate[],
  stateByRateId?: ReadonlyMap<string, string>,
  municipalityByCp?: ReadonlyMap<string, string>,
): FlatRow[] {
  type Cand = {
    rate: DestinationRate;
    price: DestinationRate['prices'][number];
    amount: number;
  };
  const bestByStateManeuver = new Map<string, Cand>();

  for (const rate of rates) {
    if (rate.active === false) {
      continue;
    }
    const stateKey = stateKeyForTable(rate, stateByRateId);
    if (!stateKey) {
      continue;
    }
    for (const price of rate.prices) {
      const amount = Number(price.clientCharge);
      if (!Number.isFinite(amount)) {
        continue;
      }
      const key = `${stateKey}|${maneuverDedupeKey(price)}`;
      const existing = bestByStateManeuver.get(key);
      if (!existing || amount > existing.amount) {
        bestByStateManeuver.set(key, { rate, price, amount });
      }
    }
  }

  const flat: FlatRow[] = [];
  for (const { rate, price } of bestByStateManeuver.values()) {
    const state =
      rate.stateName?.trim() ||
      stateByRateId?.get(rate.id)?.trim() ||
      '';
    flat.push({
      rowKey: `${rate.id}-${price.id || maneuverDedupeKey(price)}`,
      rateId: rate.id,
      state,
      municipality: municipalityLabelForTable(rate, state, municipalityByCp),
      postalCode: rate.postalCode.trim(),
      maneuver: maneuverLabel(price),
      costLabel: costLabel(price.clientCharge),
      etaLabel: formatDestinationRateRoundTripEta(rate),
      active: rate.active,
    });
  }
  return flat;
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

/**
 * Filas de tabla ordenadas alfabéticamente (estado → municipio → CP → maniobra)
 * con rowspan para Estado, Municipio y CP.
 * En scope `state`: un row por tipo de maniobra (máx. cobro si hay duplicados).
 */
export function buildDestinationRateTableRows(
  rates: readonly DestinationRate[],
  stateByRateId?: ReadonlyMap<string, string>,
  municipalityByCp?: ReadonlyMap<string, string>,
  scope?: DestinationRateScope | string | null,
): DestinationRateTableRow[] {
  const normalizedScope = normalizeDestinationRateScope(scope);
  const activeRates = rates.filter((rate) => rate.active !== false);

  const flat: FlatRow[] =
    normalizedScope === 'state'
      ? buildStateScopeFlatRows(activeRates, stateByRateId, municipalityByCp)
      : [];

  if (normalizedScope !== 'state') {
    for (const rate of activeRates) {
      const state =
        rate.stateName?.trim() ||
        stateByRateId?.get(rate.id)?.trim() ||
        '';
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
