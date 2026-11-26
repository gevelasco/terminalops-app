import {
  parseEstimatedTimeValueInput,
  validateDestinationRateEstimatedTimesInput,
} from '@features/clients/utils/destination-rate-estimated-time';
import { parseDestinationRateAxleCount } from '@features/clients/utils/destination-rate-axle-count.util';
import { routeWaypointsPersistPayload } from '@features/clients/utils/destination-rate-route-waypoints.util';
import type {
  CreateDestinationRatePayload,
  DestinationRate,
  DestinationRatePriceDraft,
  DestinationRatePriceInput,
  DestinationRateRouteWaypoint,
  DestinationRateRouteTollPlaza,
} from '@shared/models/destination-rate.models';
import { normalizeMxPostalCodeDigits } from '@features/trips/utils/mx-postal-settlement';
import { formatMoneyInputValue } from '@shared/utils/format-grouped-number';

export function parseRateMoneyInput(raw: string): number | undefined {
  const t = raw.trim().replace(/[^\d.-]/g, '');
  if (t === '') {
    return undefined;
  }
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

/** Vacío cuenta como 0; texto inválido o negativo queda `undefined`. */
export function moneyInputToAmount(raw: string): number | undefined {
  if (raw.trim() === '') {
    return 0;
  }
  return parseRateMoneyInput(raw);
}

export function destinationRatePriceManeuverKey(
  row: Pick<DestinationRatePriceDraft, 'operationConfigurationId' | 'operationConfigurationName'>,
): string {
  return (
    row.operationConfigurationId.trim() ||
    row.operationConfigurationName.trim().toLowerCase()
  );
}

export function fillEmptyRateMoneyFields(
  row: DestinationRatePriceDraft,
): { ok: true; row: DestinationRatePriceDraft } | { ok: false; message: string } {
  const clientCharge = moneyInputToAmount(row.clientCharge);
  const operatorPaymentEstimate = moneyInputToAmount(row.operatorPaymentEstimate);
  const estimatedTollAmount = moneyInputToAmount(row.estimatedTollAmount);
  const perDiemAmount = moneyInputToAmount(row.perDiemAmount);
  if (
    clientCharge === undefined ||
    operatorPaymentEstimate === undefined ||
    estimatedTollAmount === undefined ||
    perDiemAmount === undefined
  ) {
    return { ok: false, message: 'Revisa tarifa, operador, casetas y viáticos.' };
  }
  return {
    ok: true,
    row: {
      ...row,
      clientCharge: formatMoneyInputValue(clientCharge),
      operatorPaymentEstimate: formatMoneyInputValue(operatorPaymentEstimate),
      estimatedTollAmount: formatMoneyInputValue(estimatedTollAmount),
      perDiemAmount: formatMoneyInputValue(perDiemAmount),
    },
  };
}

export function canAppendDestinationRatePriceRow(
  rows: readonly DestinationRatePriceDraft[],
): boolean {
  const last = rows[rows.length - 1];
  return last != null && destinationRatePriceManeuverKey(last).length > 0;
}

export function appendDestinationRatePriceInputRow(
  rows: readonly DestinationRatePriceDraft[],
): { ok: true; rows: DestinationRatePriceDraft[] } | { ok: false; message: string } {
  if (!canAppendDestinationRatePriceRow(rows)) {
    return { ok: false, message: 'Indica el tipo de maniobra.' };
  }
  const last = rows[rows.length - 1]!;
  const filled = fillEmptyRateMoneyFields(last);
  if (!filled.ok) {
    return filled;
  }
  return {
    ok: true,
    rows: [...rows.slice(0, -1), filled.row, createEmptyPriceDraft()],
  };
}

export function destinationRatePriceDraftsForSave(
  priceDrafts: readonly DestinationRatePriceDraft[],
): DestinationRatePriceDraft[] {
  return priceDrafts.filter((row) => destinationRatePriceManeuverKey(row).length > 0);
}

export function createEmptyPriceDraft(
  rowKey = `dr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
): DestinationRatePriceDraft {
  return {
    rowKey,
    operationConfigurationId: '',
    operationConfigurationName: '',
    clientCharge: '',
    operatorPaymentEstimate: '',
    estimatedTollAmount: '',
    axleCount: '5',
    perDiemAmount: '',
    notes: '',
  };
}

export function priceDraftsFromRate(rate: DestinationRate): DestinationRatePriceDraft[] {
  if (rate.prices.length === 0) {
    return [createEmptyPriceDraft()];
  }
  return rate.prices.map((p) => ({
    rowKey: p.id,
    operationConfigurationId: p.operationConfigurationId,
    operationConfigurationName: p.operationConfigurationName ?? '',
    clientCharge: formatMoneyInputValue(p.clientCharge),
    operatorPaymentEstimate: formatMoneyInputValue(p.operatorPaymentEstimate),
    estimatedTollAmount: formatMoneyInputValue(p.estimatedTollAmount),
    axleCount:
      p.axleCount != null && p.axleCount >= 2 ? String(Math.round(p.axleCount)) : '5',
    perDiemAmount: formatMoneyInputValue(p.perDiemAmount ?? 0),
    notes: p.notes ?? '',
  }));
}

/** Filas guardadas + renglón vacío al final para capturar otro tipo. */
export function priceDraftsForEditorFromRate(
  rate: DestinationRate,
): DestinationRatePriceDraft[] {
  const rows = priceDraftsFromRate(rate);
  const last = rows[rows.length - 1];
  if (last != null && destinationRatePriceManeuverKey(last).length === 0) {
    return rows;
  }
  return [...rows, createEmptyPriceDraft()];
}

export function validateDestinationRateForm(params: {
  originOperationalCenterId: string;
  postalCode: string;
  cityMunicipality: string;
  locality: string;
  municipalityName?: string;
  stateName?: string;
  scope?: 'postal_code' | 'municipality' | 'state';
  priceDrafts: readonly DestinationRatePriceDraft[];
  estimatedArrivalTimeValue?: string;
  estimatedReturnTimeValue?: string;
}): string | null {
  if (!params.originOperationalCenterId.trim()) {
    return 'Selecciona el centro operativo de origen.';
  }
  const scope = params.scope ?? 'postal_code';
  if (scope === 'postal_code') {
    const cp = normalizeMxPostalCodeDigits(params.postalCode);
    if (cp.length !== 5) {
      return 'El código postal debe tener 5 dígitos.';
    }
    if (!params.locality.trim()) {
      return 'Selecciona o confirma la localidad del destino.';
    }
    if (!params.cityMunicipality.trim()) {
      return 'La ciudad o municipio es obligatoria.';
    }
  } else if (scope === 'municipality') {
    if (!(params.municipalityName ?? '').trim() || !(params.stateName ?? '').trim()) {
      return 'Indica municipio y estado del destino.';
    }
  } else if (!(params.stateName ?? '').trim()) {
    return 'Indica el estado del destino.';
  }
  const priceDrafts = destinationRatePriceDraftsForSave(params.priceDrafts);
  if (priceDrafts.length === 0) {
    return 'Agrega al menos un tipo de maniobra con tarifa.';
  }

  const used = new Set<string>();
  for (const row of priceDrafts) {
    const configKey =
      row.operationConfigurationId.trim() ||
      row.operationConfigurationName.trim().toLowerCase();
    if (!configKey) {
      return 'Indica el tipo de maniobra en cada fila.';
    }
    if (used.has(configKey)) {
      return 'No repitas el mismo tipo de maniobra en la tarifa.';
    }
    used.add(configKey);

    const charge = moneyInputToAmount(row.clientCharge);
    const operator = moneyInputToAmount(row.operatorPaymentEstimate);
    const toll = moneyInputToAmount(row.estimatedTollAmount);
    const perDiem = moneyInputToAmount(row.perDiemAmount);
    if (
      charge === undefined ||
      operator === undefined ||
      toll === undefined ||
      perDiem === undefined
    ) {
      return 'Revisa tarifa, operador, casetas y viáticos en cada fila.';
    }
  }
  return validateDestinationRateEstimatedTimesInput({
    arrivalRaw: params.estimatedArrivalTimeValue ?? '',
    returnRaw: params.estimatedReturnTimeValue ?? '',
  });
}

function appendEstimatedTimesToPayload(
  payload: CreateDestinationRatePayload,
  params: {
    estimatedArrivalTimeValue: string;
    estimatedReturnTimeValue: string;
    forUpdate: boolean;
  },
): CreateDestinationRatePayload {
  const arrivalRaw = params.estimatedArrivalTimeValue.trim();
  const returnRaw = params.estimatedReturnTimeValue.trim();
  if (!arrivalRaw && !returnRaw) {
    if (params.forUpdate) {
      return {
        ...payload,
        estimatedArrivalTimeValue: null,
        estimatedReturnTimeValue: null,
      };
    }
    return payload;
  }
  const arrival = parseEstimatedTimeValueInput(arrivalRaw);
  const returnValue = parseEstimatedTimeValueInput(returnRaw);
  if (!arrival || !returnValue) {
    return payload;
  }
  return {
    ...payload,
    estimatedArrivalTimeValue: arrival,
    estimatedReturnTimeValue: returnValue,
  };
}

export function buildDestinationRatePricesPayload(
  priceDrafts: readonly DestinationRatePriceDraft[],
): DestinationRatePriceInput[] {
  return destinationRatePriceDraftsForSave(priceDrafts).map((row) => ({
    ...(row.operationConfigurationId.trim()
      ? { operationConfigurationId: row.operationConfigurationId.trim() }
      : { operationConfigurationName: row.operationConfigurationName.trim() }),
    clientCharge: parseRateMoneyInput(row.clientCharge) ?? 0,
    operatorPaymentEstimate: parseRateMoneyInput(row.operatorPaymentEstimate) ?? 0,
    estimatedTollAmount: parseRateMoneyInput(row.estimatedTollAmount) ?? 0,
    axleCount: parseDestinationRateAxleCount(row.axleCount),
    perDiemAmount: parseRateMoneyInput(row.perDiemAmount) ?? 0,
    notes: row.notes.trim() || undefined,
  }));
}

export function buildCreateDestinationRatePayload(params: {
  originOperationalCenterId: string;
  postalCode: string;
  cityMunicipality: string;
  locality: string;
  municipalityName?: string;
  stateName?: string;
  priceDrafts: readonly DestinationRatePriceDraft[];
  routeDistanceKm?: number | null;
  destinationLatitude?: number | null;
  destinationLongitude?: number | null;
  active: boolean;
  notes?: string;
  estimatedArrivalTimeValue?: string;
  estimatedReturnTimeValue?: string;
  forUpdate?: boolean;
  routeWaypoints?: readonly DestinationRateRouteWaypoint[];
  routeTollPlazas?: readonly DestinationRateRouteTollPlaza[];
}): CreateDestinationRatePayload {
  const municipalityName = (params.municipalityName ?? '').trim();
  const stateName = (params.stateName ?? '').trim();
  const cityMunicipality =
    params.cityMunicipality.trim() ||
    [municipalityName, stateName].filter(Boolean).join(', ') ||
    stateName;
  const postal = normalizeMxPostalCodeDigits(params.postalCode);
  const base: CreateDestinationRatePayload = {
    originOperationalCenterId: params.originOperationalCenterId.trim(),
    ...(postal.length === 5 ? { postalCode: postal } : { postalCode: '' }),
    cityMunicipality,
    locality: params.locality.trim(),
    ...(municipalityName ? { municipalityName } : {}),
    ...(stateName ? { stateName } : {}),
    prices: buildDestinationRatePricesPayload(params.priceDrafts),
    ...(params.routeDistanceKm != null && params.routeDistanceKm > 0
      ? { routeDistanceKm: params.routeDistanceKm }
      : {}),
    ...(params.destinationLatitude != null && params.destinationLongitude != null
      ? {
          destinationLatitude: params.destinationLatitude,
          destinationLongitude: params.destinationLongitude,
        }
      : {}),
    active: params.active,
    notes: params.notes?.trim() || undefined,
    ...(params.routeWaypoints !== undefined
      ? { routeWaypoints: routeWaypointsPersistPayload(params.routeWaypoints) }
      : {}),
    ...(params.routeTollPlazas != null && params.routeTollPlazas.length > 0
      ? { routeTollPlazas: [...params.routeTollPlazas] }
      : {}),
  };
  return appendEstimatedTimesToPayload(base, {
    estimatedArrivalTimeValue: params.estimatedArrivalTimeValue ?? '',
    estimatedReturnTimeValue: params.estimatedReturnTimeValue ?? '',
    forUpdate: params.forUpdate === true,
  });
}

export function formatDestinationRateRouteSummary(rate: Pick<
  DestinationRate,
  | 'originLocality'
  | 'originOperationalCenterName'
  | 'locality'
  | 'postalCode'
>): string {
  const origin =
    rate.originLocality.trim() ||
    rate.originOperationalCenterName?.trim() ||
    'Origen';
  const dest = rate.locality.trim() || rate.postalCode.trim() || 'Destino';
  return `${origin} → ${dest}`;
}
