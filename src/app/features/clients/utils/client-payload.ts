import type {
  Client,
  ClientContactPerson,
  ClientDelivery,
  ClientPaymentTerms,
  CreateClientPayload,
} from '@shared/models/client.models';

export function parseOptionalInt(raw: string): number | undefined {
  const t = raw.trim();
  if (t === '') {
    return undefined;
  }
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : undefined;
}

export function yesNoToBool(v: string): boolean {
  return v === 'yes' || v === 'true' || v === '1';
}

export function boolToYesNo(v: boolean): string {
  return v ? 'yes' : 'no';
}

export function normalizeContacts(list: ClientContactPerson[]): ClientContactPerson[] {
  return list
    .map((c) => ({
      ...c,
      name: c.name.trim(),
      role: c.role?.trim() || undefined,
      phone: c.phone?.trim() || undefined,
      email: c.email?.trim() || undefined,
    }))
    .filter((c) => c.name.length > 0);
}

export function buildClientDeliveryPayload(params: {
  postalCode: string;
  cityMunicipality: string;
  locality: string;
  settlementConsId: string;
  latitude: number | null;
  longitude: number | null;
}): ClientDelivery | undefined {
  const cp = params.postalCode.trim();
  if (!cp) {
    return undefined;
  }
  return {
    postalCode: cp,
    cityMunicipality: params.cityMunicipality.trim() || undefined,
    locality: params.locality.trim() || undefined,
    settlementConsId: params.settlementConsId.trim() || undefined,
    latitude: params.latitude ?? undefined,
    longitude: params.longitude ?? undefined,
  };
}

export function validateClientDelivery(params: {
  postalCode: string;
  locality: string;
  settlementConsId: string;
  latitude: number | null;
  longitude: number | null;
}): string | null {
  const cp = params.postalCode.trim();
  if (!cp) {
    return null;
  }
  if (cp.length !== 5) {
    return 'El código postal de entrega debe tener 5 dígitos.';
  }
  if (!params.settlementConsId.trim() && !params.locality.trim()) {
    return 'Elige la localidad de entrega.';
  }
  if (params.latitude == null || params.longitude == null) {
    return 'Espera a que se obtengan las coordenadas de entrega o revisa el CP.';
  }
  return null;
}

export function formatClientDeliveryCoord(n: number | undefined): string {
  if (n == null || !Number.isFinite(n)) {
    return '—';
  }
  return n.toFixed(6);
}

/** Cuerpo POST/PATCH: lectura como `paymentTerms`; escritura como `payment`. */
export function buildClientApiWriteBody(
  input: Client | CreateClientPayload,
): Record<string, unknown> {
  const {
    payment,
    maneuverCount: _maneuverCount,
    commercialHealth: _commercialHealth,
    delivery,
    ...rest
  } = input as Client;
  const paymentBody = payment
    ? {
        hasCredit: payment.hasCredit,
        ...(payment.creditDays != null ? { creditDays: payment.creditDays } : {}),
        ...(payment.approximateCreditAmount
          ? { approximateCreditAmount: payment.approximateCreditAmount }
          : {}),
        ...(payment.defaultPaymentMethod
          ? { defaultPaymentMethod: payment.defaultPaymentMethod }
          : {}),
      }
    : undefined;
  const deliveryBody = delivery
    ? {
        postalCode: delivery.postalCode,
        cityMunicipality: delivery.cityMunicipality,
        locality: delivery.locality,
        settlementConsId: delivery.settlementConsId,
        latitude: delivery.latitude,
        longitude: delivery.longitude,
      }
    : undefined;
  return {
    ...rest,
    ...(paymentBody ? { payment: paymentBody } : {}),
    ...(deliveryBody ? { delivery: deliveryBody } : {}),
  };
}

export function clientCreditDaysTableCell(
  payment: ClientPaymentTerms | undefined,
): string {
  if (!payment?.hasCredit) {
    return '0';
  }
  const days = payment.creditDays;
  return days != null && days > 0 ? String(days) : '0';
}

function formatEsMxGroupedNumber(n: number): string {
  return new Intl.NumberFormat('es-MX', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  }).format(n);
}

export function formatClientCreditVolumeDisplay(raw: string): string {
  const t = raw.trim();
  if (!t) {
    return '0';
  }

  const normalized = t.replace(/\s/g, '').replace(/,/g, '');
  if (/^\d+(\.\d+)?$/.test(normalized)) {
    const n = Number(normalized);
    if (Number.isFinite(n)) {
      return formatEsMxGroupedNumber(n);
    }
  }

  const match = t.match(/^([\d,\s.]+)\s*(.*)$/);
  if (match?.[1]) {
    const numPart = match[1].replace(/\s/g, '').replace(/,/g, '');
    if (/^\d+(\.\d+)?$/.test(numPart)) {
      const n = Number(numPart);
      if (Number.isFinite(n)) {
        const suffix = match[2]?.trim();
        const formatted = formatEsMxGroupedNumber(n);
        return suffix ? `${formatted} ${suffix}` : formatted;
      }
    }
  }

  return t;
}

export function clientCreditVolumeTableCell(
  payment: ClientPaymentTerms | undefined,
): string {
  if (!payment?.hasCredit) {
    return '0';
  }
  const volume = payment.approximateCreditAmount?.trim();
  if (!volume) {
    return '0';
  }
  return formatClientCreditVolumeDisplay(volume);
}
