import {
  parseEstimatedTimeValueInput,
  validateDestinationRateEstimatedTimesInput,
} from '@features/clients/utils/destination-rate-estimated-time';
import type {
  CreateDestinationRatePayload,
  DestinationRate,
  DestinationRatePriceDraft,
  DestinationRatePriceInput,
} from '@shared/models/destination-rate.models';
import { normalizeMxPostalCodeDigits } from '@features/trips/utils/mx-postal-settlement';

export function parseRateMoneyInput(raw: string): number | undefined {
  const t = raw.trim().replace(/[^\d.-]/g, '');
  if (t === '') {
    return undefined;
  }
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
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
    clientCharge: String(p.clientCharge),
    operatorPaymentEstimate: String(p.operatorPaymentEstimate),
    estimatedTollAmount: String(p.estimatedTollAmount),
    notes: p.notes ?? '',
  }));
}

export function validateDestinationRateForm(params: {
  originOperationalCenterId: string;
  postalCode: string;
  cityMunicipality: string;
  locality: string;
  priceDrafts: readonly DestinationRatePriceDraft[];
  estimatedArrivalTimeValue?: string;
  estimatedReturnTimeValue?: string;
  estimatedTimeUnit?: string;
}): string | null {
  if (!params.originOperationalCenterId.trim()) {
    return 'Selecciona el centro operativo de origen.';
  }
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
  if (params.priceDrafts.length === 0) {
    return 'Agrega al menos un tipo de maniobra con tarifa.';
  }

  const used = new Set<string>();
  for (const row of params.priceDrafts) {
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

    const charge = parseRateMoneyInput(row.clientCharge);
    const operator = parseRateMoneyInput(row.operatorPaymentEstimate);
    const toll = parseRateMoneyInput(row.estimatedTollAmount);
    if (charge === undefined || operator === undefined || toll === undefined) {
      return 'Revisa cobro, pago operador y casetas aprox. en cada fila.';
    }
  }
  return validateDestinationRateEstimatedTimesInput({
    arrivalRaw: params.estimatedArrivalTimeValue ?? '',
    returnRaw: params.estimatedReturnTimeValue ?? '',
    unit: params.estimatedTimeUnit ?? '',
  });
}

function appendEstimatedTimesToPayload(
  payload: CreateDestinationRatePayload,
  params: {
    estimatedArrivalTimeValue: string;
    estimatedReturnTimeValue: string;
    estimatedTimeUnit: string;
    forUpdate: boolean;
  },
): CreateDestinationRatePayload {
  const arrivalRaw = params.estimatedArrivalTimeValue.trim();
  const returnRaw = params.estimatedReturnTimeValue.trim();
  const unit = params.estimatedTimeUnit.trim();
  if (!arrivalRaw && !returnRaw && !unit) {
    if (params.forUpdate) {
      return {
        ...payload,
        estimatedArrivalTimeValue: null,
        estimatedReturnTimeValue: null,
        estimatedTimeUnit: null,
      };
    }
    return payload;
  }
  const arrival = parseEstimatedTimeValueInput(arrivalRaw);
  const returnValue = parseEstimatedTimeValueInput(returnRaw);
  if (!arrival || !returnValue || (unit !== 'hours' && unit !== 'days')) {
    return payload;
  }
  return {
    ...payload,
    estimatedArrivalTimeValue: arrival,
    estimatedReturnTimeValue: returnValue,
    estimatedTimeUnit: unit,
  };
}

export function buildDestinationRatePricesPayload(
  priceDrafts: readonly DestinationRatePriceDraft[],
): DestinationRatePriceInput[] {
  return priceDrafts.map((row) => ({
    ...(row.operationConfigurationId.trim()
      ? { operationConfigurationId: row.operationConfigurationId.trim() }
      : { operationConfigurationName: row.operationConfigurationName.trim() }),
    clientCharge: parseRateMoneyInput(row.clientCharge) ?? 0,
    operatorPaymentEstimate: parseRateMoneyInput(row.operatorPaymentEstimate) ?? 0,
    estimatedTollAmount: parseRateMoneyInput(row.estimatedTollAmount) ?? 0,
    notes: row.notes.trim() || undefined,
  }));
}

export function buildCreateDestinationRatePayload(params: {
  originOperationalCenterId: string;
  postalCode: string;
  cityMunicipality: string;
  locality: string;
  priceDrafts: readonly DestinationRatePriceDraft[];
  routeDistanceKm?: number | null;
  destinationLatitude?: number | null;
  destinationLongitude?: number | null;
  active: boolean;
  notes: string;
  estimatedArrivalTimeValue?: string;
  estimatedReturnTimeValue?: string;
  estimatedTimeUnit?: string;
  forUpdate?: boolean;
}): CreateDestinationRatePayload {
  const base: CreateDestinationRatePayload = {
    originOperationalCenterId: params.originOperationalCenterId.trim(),
    postalCode: normalizeMxPostalCodeDigits(params.postalCode),
    cityMunicipality: params.cityMunicipality.trim(),
    locality: params.locality.trim(),
    prices: buildDestinationRatePricesPayload(params.priceDrafts),
    ...(params.routeDistanceKm != null && params.routeDistanceKm > 0
      ? { routeDistanceKm: params.routeDistanceKm, isRoundTrip: true }
      : {}),
    ...(params.destinationLatitude != null && params.destinationLongitude != null
      ? {
          destinationLatitude: params.destinationLatitude,
          destinationLongitude: params.destinationLongitude,
        }
      : {}),
    active: params.active,
    notes: params.notes.trim() || undefined,
  };
  return appendEstimatedTimesToPayload(base, {
    estimatedArrivalTimeValue: params.estimatedArrivalTimeValue ?? '',
    estimatedReturnTimeValue: params.estimatedReturnTimeValue ?? '',
    estimatedTimeUnit: params.estimatedTimeUnit ?? '',
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
