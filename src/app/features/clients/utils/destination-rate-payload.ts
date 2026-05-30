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
  postalCode: string;
  cityMunicipality: string;
  locality: string;
  priceDrafts: readonly DestinationRatePriceDraft[];
}): string | null {
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
  return null;
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
  postalCode: string;
  cityMunicipality: string;
  locality: string;
  priceDrafts: readonly DestinationRatePriceDraft[];
  active: boolean;
  notes: string;
}): CreateDestinationRatePayload {
  return {
    postalCode: normalizeMxPostalCodeDigits(params.postalCode),
    cityMunicipality: params.cityMunicipality.trim(),
    locality: params.locality.trim(),
    prices: buildDestinationRatePricesPayload(params.priceDrafts),
    active: params.active,
    notes: params.notes.trim() || undefined,
  };
}
