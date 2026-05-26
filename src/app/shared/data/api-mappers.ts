import type { Client } from '@shared/models/client.models';
import type { Operator } from '@shared/models/logistics.models';
import { defaultClientPayment } from '@shared/utils/client-defaults';
import {
  EMPTY_EMERGENCY,
  EMPTY_PRIVATE,
  EMPTY_PUBLIC,
} from '@features/operators/utils/operator-payload-defaults';
import type { Trip, Unit, UnitFleetMeta } from '@shared/models/logistics.models';
import { resourceIdKey } from '@shared/utils/resource-id';

/** Respuesta API → modelo `Client` del frontend. */
export function mapApiClient(row: Record<string, unknown>): Client {
  const billing = row['billing'] as Record<string, unknown> | undefined;
  const paymentTerms = row['paymentTerms'] as Record<string, unknown> | undefined;
  const contacts = (row['contacts'] as Record<string, unknown>[] | undefined) ?? [];

  return {
    id: resourceIdKey(row['id']),
    name: String(row['name']),
    rfc: row['rfc'] as string | undefined,
    relationshipStartedOn: row['relationshipStartedOn'] as string | undefined,
    notes: row['notes'] as string | undefined,
    billing: billing
      ? {
          invoiceLegalName: billing['invoiceLegalName'] as string | undefined,
          taxRegime: billing['taxRegime'] as string | undefined,
          fiscalZip: billing['fiscalZip'] as string | undefined,
          cfdiUse: billing['cfdiUse'] as string | undefined,
          billingEmail: billing['billingEmail'] as string | undefined,
          billingPhone: billing['billingPhone'] as string | undefined,
        }
      : undefined,
    payment: paymentTerms
      ? {
          hasCredit: Boolean(paymentTerms['hasCredit']),
          creditDays: paymentTerms['creditDays'] as number | undefined,
          approximateCreditAmount: paymentTerms['approximateCreditAmount'] as
            | string
            | undefined,
          commercialHealth:
            (paymentTerms['commercialHealth'] as Client['payment'] extends { commercialHealth?: infer H }
              ? H
              : 'not_evaluated') ?? 'not_evaluated',
        }
      : defaultClientPayment(),
    contacts: contacts.map((c) => ({
      id: resourceIdKey(c['id']),
      name: String(c['name']),
      role: c['role'] as string | undefined,
      phone: c['phone'] as string | undefined,
      email: c['email'] as string | undefined,
    })),
    maneuverCount:
      typeof row['maneuverCount'] === 'number' && Number.isFinite(row['maneuverCount'])
        ? row['maneuverCount']
        : undefined,
  };
}

export function mapApiOperator(row: Record<string, unknown>): Operator {
  const ec = row['emergencyContact'] as Record<string, unknown> | undefined;
  const pub = row['publicInsurance'] as Record<string, unknown> | undefined;
  const priv = row['privateInsurance'] as Record<string, unknown> | undefined;
  const docs = (row['documents'] as Record<string, unknown>[] | undefined) ?? [];

  return {
    id: resourceIdKey(row['id']),
    name: String(row['name']),
    portalUsername: row['portalUsername'] as string | undefined,
    photoDataUrl: row['photoDataUrl'] as string | undefined,
    birthDate: (row['birthDate'] as string) ?? '',
    curp: (row['curp'] as string) ?? '',
    rfc: (row['rfc'] as string) ?? '',
    licenseNumber: (row['licenseNumber'] as string) ?? '',
    licenseExpiresOn: (row['licenseExpiresOn'] as string) ?? '',
    licenseType: (row['licenseType'] as Operator['licenseType']) ?? 'unspecified',
    licenseEndorsements: (row['licenseEndorsements'] as string) ?? '',
    phone: (row['phone'] as string) ?? '',
    phoneSecondary: (row['phoneSecondary'] as string) ?? '',
    address: (row['address'] as string) ?? '',
    companyHireDate: (row['companyHireDate'] as string) ?? '',
    employmentContractType: (row['employmentContractType'] as string) ?? '',
    status: (row['status'] as Operator['status']) ?? 'available',
    insuranceKind: (row['insuranceKind'] as Operator['insuranceKind']) ?? 'none',
    emergencyContact: {
      ...EMPTY_EMERGENCY,
      ...(ec && {
        name: String(ec['name'] ?? ''),
        relationship: String(ec['relationship'] ?? ''),
        phone: String(ec['phone'] ?? ''),
        email: String(ec['email'] ?? ''),
        authorizedMedicalInfo: Boolean(ec['authorizedMedicalInfo']),
      }),
    },
    publicInsurance: {
      ...EMPTY_PUBLIC,
      ...(pub && {
        nss: String(pub['nss'] ?? ''),
        imssAltaDate: (pub['imssAltaDate'] as string) ?? '',
        infonavit: Boolean(pub['infonavit']),
        infonavitCreditNumber: String(pub['infonavitCreditNumber'] ?? ''),
        fonacot: Boolean(pub['fonacot']),
        fonacotCreditNumber: String(pub['fonacotCreditNumber'] ?? ''),
        notes: String(pub['notes'] ?? ''),
      }),
    },
    privateInsurance: {
      ...EMPTY_PRIVATE,
      ...(priv && {
        carrier: String(priv['carrier'] ?? ''),
        policyNumber: String(priv['policyNumber'] ?? ''),
        validFrom: (priv['validFrom'] as string) ?? '',
        validTo: (priv['validTo'] as string) ?? '',
        premiumAmount: String(priv['premiumAmount'] ?? ''),
        premiumPeriod: (priv['premiumPeriod'] as Operator['privateInsurance']['premiumPeriod']) ?? '',
        deductibleNotes: String(priv['deductibleNotes'] ?? ''),
        planSummary: String(priv['planSummary'] ?? ''),
      }),
    },
    documents: docs.map((d) => ({
      id: resourceIdKey(d['id']),
      fileName: String(d['fileName']),
      slot: d['slot'] as 'operation' | 'insurance',
      addedAt: String(d['addedAt']),
    })),
  };
}

export function mapApiUnit(row: Record<string, unknown>): Unit {
  const fleetMeta = (row['fleetMeta'] ?? row['fleetProfile']) as UnitFleetMeta | undefined;
  const capacity = row['capacityKg'];
  return {
    id: resourceIdKey(row['id']),
    plate: String(row['plate'] ?? ''),
    type: String(row['type'] ?? ''),
    capacityKg: typeof capacity === 'number' ? capacity : Number(capacity) || 0,
    status: String(row['status'] ?? ''),
    serialNumber: row['serialNumber'] as string | undefined,
    name: row['name'] as string | undefined,
    trailerBrandAbbr: row['trailerBrandAbbr'] as string | undefined,
    trailerYear: row['trailerYear'] as string | undefined,
    fleetMeta: fleetMeta ? { ...fleetMeta } : undefined,
  };
}

export function mapApiTrip(row: Record<string, unknown>): Trip {
  const trip = row as unknown as Trip;
  const rawEquipmentIds = row['equipmentIds'];
  return {
    ...trip,
    id: resourceIdKey(trip.id),
    clientId: resourceIdKey(trip.clientId),
    unitId: resourceIdKey(trip.unitId),
    operatorId: resourceIdKey(trip.operatorId),
    equipmentIds: Array.isArray(rawEquipmentIds)
      ? rawEquipmentIds.map((id) => resourceIdKey(id as string | number))
      : trip.equipmentIds,
  };
}
