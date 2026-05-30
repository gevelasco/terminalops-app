import type { Client, ClientCommercialHealth, ClientContactPerson, ClientDelivery } from '@shared/models/client.models';

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

export function commercialHealthFromUnknown(
  v: string | undefined,
): ClientCommercialHealth {
  if (
    v === 'good_standing' ||
    v === 'watch_list' ||
    v === 'restricted' ||
    v === 'not_evaluated'
  ) {
    return v;
  }
  return 'not_evaluated';
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
