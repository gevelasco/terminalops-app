import type {
  Client,
  ClientContactPerson,
  ClientDelivery,
  CreateClientPayload,
} from '@shared/models/client.models';
import { clientDeliveries } from '@features/clients/utils/client-deliveries';

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

function deliveryWriteBody(delivery: ClientDelivery): Record<string, unknown> {
  return {
    ...(delivery.postalCode ? { postalCode: delivery.postalCode } : {}),
    ...(delivery.cityMunicipality
      ? { cityMunicipality: delivery.cityMunicipality }
      : {}),
    ...(delivery.locality ? { locality: delivery.locality } : {}),
    ...(delivery.settlementConsId
      ? { settlementConsId: delivery.settlementConsId }
      : {}),
    ...(delivery.latitude != null ? { latitude: delivery.latitude } : {}),
    ...(delivery.longitude != null ? { longitude: delivery.longitude } : {}),
  };
}

export function normalizeDeliveries(list: ClientDelivery[]): ClientDelivery[] {
  return list
    .map((row) => ({
      ...row,
      postalCode: row.postalCode?.trim() || undefined,
      cityMunicipality: row.cityMunicipality?.trim() || undefined,
      locality: row.locality?.trim() || undefined,
      settlementConsId: row.settlementConsId?.trim() || undefined,
    }))
    .filter(
      (row) =>
        (row.postalCode ?? '').length > 0 ||
        (row.cityMunicipality ?? '').trim().length > 0,
    );
}

export function buildClientDeliveryPayload(params: {
  scope?: 'postal_code' | 'municipality' | 'state';
  postalCode: string;
  cityMunicipality: string;
  locality: string;
  settlementConsId: string;
  municipalityName?: string;
  stateName?: string;
  latitude: number | null;
  longitude: number | null;
  destinationRateId?: string | null;
  isUnpricedRoute?: boolean;
}): ClientDelivery | undefined {
  const scope = params.scope ?? 'postal_code';
  const municipalityName = (params.municipalityName ?? '').trim();
  const stateName = (params.stateName ?? '').trim();
  const cityMunicipality =
    params.cityMunicipality.trim() ||
    (scope === 'municipality'
      ? [municipalityName, stateName].filter(Boolean).join(', ')
      : stateName);
  const cp = params.postalCode.trim();

  if (scope === 'postal_code') {
    if (!cp) {
      return undefined;
    }
  } else if (!cityMunicipality) {
    return undefined;
  }

  return {
    ...(cp ? { postalCode: cp } : { postalCode: '' }),
    cityMunicipality: cityMunicipality || undefined,
    locality:
      params.locality.trim() ||
      (scope === 'municipality' ? municipalityName : undefined) ||
      undefined,
    settlementConsId: params.settlementConsId.trim() || undefined,
    latitude: params.latitude ?? undefined,
    longitude: params.longitude ?? undefined,
    ...(params.destinationRateId?.trim()
      ? { destinationRateId: params.destinationRateId.trim() }
      : {}),
    ...(params.isUnpricedRoute ? { isUnpricedRoute: true } : {}),
  };
}

export function validateClientDelivery(params: {
  scope?: 'postal_code' | 'municipality' | 'state';
  postalCode: string;
  cityMunicipality?: string;
  locality: string;
  settlementConsId: string;
  municipalityName?: string;
  stateName?: string;
  latitude: number | null;
  longitude: number | null;
}): string | null {
  const scope = params.scope ?? 'postal_code';
  const municipalityName = (params.municipalityName ?? '').trim();
  const stateName = (params.stateName ?? '').trim();
  const cityMunicipality = (params.cityMunicipality ?? '').trim();

  if (scope === 'postal_code') {
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
    if (!cityMunicipality) {
      return 'Espera a que se complete la ciudad / municipio o revisa el CP.';
    }
  } else if (scope === 'municipality') {
    if (!municipalityName || !stateName) {
      return 'Indica municipio y estado de entrega.';
    }
  } else if (!stateName) {
    return 'Indica el estado de entrega.';
  }

  if (params.latitude == null || params.longitude == null) {
    return scope === 'postal_code'
      ? 'Espera a que se obtengan las coordenadas de entrega o revisa el CP.'
      : 'Espera a que se obtengan las coordenadas del destino.';
  }
  return null;
}

export function formatClientDeliveryCoord(n: number | undefined): string {
  if (n == null || !Number.isFinite(n)) {
    return '—';
  }
  return n.toFixed(6);
}

/** Cuerpo POST/PATCH alineado a CreateClientDto (sin id / agregados / docs). */
export function buildClientApiWriteBody(
  input: Client | CreateClientPayload,
): Record<string, unknown> {
  const client = input as Client;
  const payment = client.payment;
  const deliveryRows = normalizeDeliveries(clientDeliveries(client));
  const deliveryBodies = deliveryRows
    .map((row) => deliveryWriteBody(row))
    .filter((body) => Object.keys(body).length > 0);
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
  const contacts = (client.contacts ?? []).map(({ name, role, phone, email }) => ({
    name,
    ...(role ? { role } : {}),
    ...(phone ? { phone } : {}),
    ...(email ? { email } : {}),
  }));
  const billing = client.billing
    ? {
        ...(client.billing.invoiceLegalName
          ? { invoiceLegalName: client.billing.invoiceLegalName }
          : {}),
        ...(client.billing.taxRegime ? { taxRegime: client.billing.taxRegime } : {}),
        ...(client.billing.fiscalZip ? { fiscalZip: client.billing.fiscalZip } : {}),
        ...(client.billing.cfdiUse ? { cfdiUse: client.billing.cfdiUse } : {}),
        ...(client.billing.billingEmail
          ? { billingEmail: client.billing.billingEmail }
          : {}),
        ...(client.billing.billingPhone
          ? { billingPhone: client.billing.billingPhone }
          : {}),
      }
    : undefined;

  return {
    name: client.name,
    ...(client.rfc ? { rfc: client.rfc } : {}),
    ...(client.relationshipStartedOn
      ? { relationshipStartedOn: client.relationshipStartedOn }
      : {}),
    ...(client.notes ? { notes: client.notes } : {}),
    ...(billing && Object.keys(billing).length > 0 ? { billing } : {}),
    ...(paymentBody ? { payment: paymentBody } : {}),
    ...(contacts.length > 0 ? { contacts } : {}),
    deliveries: deliveryBodies,
  };
}
