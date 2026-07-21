import type { Client } from '@shared/models/client.models';
import type { Operator, OperatorOperationalStatus } from '@shared/models/logistics.models';
import { defaultClientPayment } from '@shared/utils/client-defaults';
import {
  EMPTY_EMERGENCY,
  EMPTY_PRIVATE,
  EMPTY_PUBLIC,
} from '@features/operators/utils/operator-payload-defaults';
import type {
  Trip,
  TripIncident,
  Unit,
  UnitFleetMeta,
  Equipment,
  EquipmentFleetMeta,
} from '@shared/models/logistics.models';
import { resourceIdKey } from '@shared/utils/resource-id';
import { normalizeEquipmentHitchPosition } from '@shared/utils/fleet/equipment-hitch-position';
import { normalizeTrailerTenureMode } from '@shared/utils/fleet/trailer-tenure-mode';

function mapFleetMetaTenureMode<T extends { trailerTenureMode?: string }>(
  meta: T | undefined,
): T | undefined {
  if (!meta) {
    return undefined;
  }
  if (meta.trailerTenureMode == null) {
    return meta;
  }
  return {
    ...meta,
    trailerTenureMode: normalizeTrailerTenureMode(meta.trailerTenureMode),
  };
}

/** Respuesta API → modelo `Client` del frontend. */
export function mapApiClient(row: Record<string, unknown>): Client {
  const billing = row['billing'] as Record<string, unknown> | undefined;
  const delivery = row['delivery'] as Record<string, unknown> | undefined;
  const paymentTerms = (row['paymentTerms'] ?? row['payment']) as
    | Record<string, unknown>
    | undefined;
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
    delivery: delivery
      ? {
          postalCode: delivery['postalCode'] as string | undefined,
          cityMunicipality: delivery['cityMunicipality'] as string | undefined,
          locality: delivery['locality'] as string | undefined,
          settlementConsId: delivery['settlementConsId'] as string | undefined,
          latitude:
            typeof delivery['latitude'] === 'number' && Number.isFinite(delivery['latitude'])
              ? delivery['latitude']
              : undefined,
          longitude:
            typeof delivery['longitude'] === 'number' &&
            Number.isFinite(delivery['longitude'])
              ? delivery['longitude']
              : undefined,
          destinationRateId:
            delivery['destinationRateId'] != null
              ? String(delivery['destinationRateId'])
              : undefined,
          isUnpricedRoute: Boolean(delivery['isUnpricedRoute']),
        }
      : undefined,
    payment: paymentTerms
      ? {
          hasCredit: Boolean(paymentTerms['hasCredit']),
          creditDays: paymentTerms['creditDays'] as number | undefined,
          approximateCreditAmount: paymentTerms['approximateCreditAmount'] as
            | string
            | undefined,
          defaultPaymentMethod: paymentTerms['defaultPaymentMethod'] as string | undefined,
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
    commercialHealth: (row['commercialHealth'] as string | undefined) as
      | Client['commercialHealth']
      | undefined,
  };
}

const OPERATOR_OPERATIONAL_STATUSES: readonly OperatorOperationalStatus[] = [
  'available',
  'in_use',
  'scheduled',
  'incapacitated',
  'leave',
  'inactive',
];

function normalizeOperatorOperationalStatus(raw: unknown): OperatorOperationalStatus {
  const s = String(raw ?? '').trim().toLowerCase();
  if (s === 'on_route') {
    return 'in_use';
  }
  if (s === 'maintenance') {
    return 'available';
  }
  if (OPERATOR_OPERATIONAL_STATUSES.includes(s as OperatorOperationalStatus)) {
    return s as OperatorOperationalStatus;
  }
  return 'available';
}

export function mapApiOperator(row: Record<string, unknown>): Operator {
  const ec = row['emergencyContact'] as Record<string, unknown> | undefined;
  const pub = row['publicInsurance'] as Record<string, unknown> | undefined;
  const priv = row['privateInsurance'] as Record<string, unknown> | undefined;
  const docs = (row['documents'] as Record<string, unknown>[] | undefined) ?? [];

  return {
    id: resourceIdKey(row['id']),
    name: String(row['name']),
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
    paymentSchedule:
      (row['paymentSchedule'] as Operator['paymentSchedule']) ?? 'maneuver',
    paymentMethod:
      typeof row['paymentMethod'] === 'string'
        ? row['paymentMethod']
        : undefined,
    status: normalizeOperatorOperationalStatus(row['status']),
    isActive: row['isActive'] !== false,
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
    maneuverCount:
      typeof row['maneuverCount'] === 'number' && Number.isFinite(row['maneuverCount'])
        ? row['maneuverCount']
        : undefined,
    lastManeuver: mapApiOperatorLastManeuver(row['lastManeuver']),
    nextPayDueOn: parseOptionalIsoDate(row['nextPayDueOn']),
    nextPayDueVariant: parseOperatorPayDueVariant(row['nextPayDueVariant']),
    owedAmount:
      typeof row['owedAmount'] === 'number' && Number.isFinite(row['owedAmount'])
        ? row['owedAmount']
        : undefined,
  };
}

function mapApiOperatorLastManeuver(
  value: unknown,
): Operator['lastManeuver'] {
  if (value == null || typeof value !== 'object') {
    return undefined;
  }
  const row = value as Record<string, unknown>;
  const code = String(row['maneuverCode'] ?? '').trim();
  if (!code) {
    return undefined;
  }
  return {
    tripId: row['tripId'] != null ? resourceIdKey(row['tripId']) : undefined,
    maneuverCode: code,
    originCityMunicipality:
      row['originCityMunicipality'] != null
        ? String(row['originCityMunicipality']).trim() || undefined
        : undefined,
    destinationCityMunicipality:
      row['destinationCityMunicipality'] != null
        ? String(row['destinationCityMunicipality']).trim() || undefined
        : undefined,
    status: row['status'] as Operator['lastManeuver'] extends { status?: infer S }
      ? S
      : never,
    occurredOn: parseOptionalIsoDate(row['occurredOn']),
  };
}

function parseOptionalIsoDate(value: unknown): string | undefined {
  const t = value != null ? String(value).trim() : '';
  return t || undefined;
}

function parseOperatorPayDueVariant(
  value: unknown,
): Operator['nextPayDueVariant'] {
  if (value === 'success' || value === 'warning' || value === 'danger') {
    return value;
  }
  return undefined;
}

export function mapApiUnit(row: Record<string, unknown>): Unit {
  const fleetMetaRaw = (row['fleetMeta'] ?? row['fleetProfile']) as UnitFleetMeta | undefined;
  const fleetMeta = mapFleetMetaTenureMode(fleetMetaRaw ? { ...fleetMetaRaw } : undefined);
  const capacity = row['capacityKg'];
  const unitId = resourceIdKey(row['id']);
  const rawHitched = row['equipment'];
  const hitchedEquipment = Array.isArray(rawHitched)
    ? rawHitched.map((item) => {
        const ref = item as Record<string, unknown>;
        return mapApiEquipment({
          ...ref,
          unitId: ref['unitId'] ?? unitId,
        });
      })
    : undefined;
  return {
    id: unitId,
    plate: String(row['plate'] ?? ''),
    transportType: row['transportType'] as string | undefined,
    capacityKg: typeof capacity === 'number' ? capacity : Number(capacity) || 0,
    status: String(row['status'] ?? ''),
    isActive: row['isActive'] !== false,
    serialNumber: row['serialNumber'] as string | undefined,
    motorNumber: row['motorNumber'] as string | undefined,
    capacityTons:
      row['capacityTons'] != null ? Number(row['capacityTons']) : undefined,
    name: row['name'] as string | undefined,
    trailerBrandAbbr: row['trailerBrandAbbr'] as string | undefined,
    trailerYear: row['trailerYear'] as string | undefined,
    fleetMeta,
    hitchedEquipment,
  };
}

export function mapApiEquipment(row: Record<string, unknown>): Equipment {
  const metaRaw = (row['fleetMeta'] ?? row['fleetProfile']) as EquipmentFleetMeta | undefined;
  const fleetMeta = mapFleetMetaTenureMode(metaRaw ? { ...metaRaw } : undefined);
  return {
    id: resourceIdKey(row['id']),
    unitId: resourceIdKey(row['unitId']),
    hitchPosition: normalizeEquipmentHitchPosition(
      row['hitchPosition'] as string | undefined,
    ),
    name: String(row['name'] ?? ''),
    serialNumber: String(row['serialNumber'] ?? ''),
    lastServiceDate: String(row['lastServiceDate'] ?? ''),
    plate: row['plate'] as string | undefined,
    type: row['type'] as string | undefined,
    status: row['status'] as string | undefined,
    isActive: row['isActive'] !== false,
    trailerBrandAbbr: row['trailerBrandAbbr'] as string | undefined,
    trailerYear: row['trailerYear'] as string | undefined,
    fleetMeta,
  };
}

function mapApiTripIncident(row: Record<string, unknown>): TripIncident {
  return {
    id: resourceIdKey(row['id']),
    description: String(row['description'] ?? ''),
    createdAt: String(row['createdAt'] ?? ''),
    postedBy: String(row['postedBy'] ?? ''),
    postedByLabel: row['postedByLabel'] as string | undefined,
    isIncident: row['isIncident'] === true,
  };
}

export function mapApiTrip(row: Record<string, unknown>): Trip {
  const trip = row as unknown as Trip;
  const rawEquipmentIds = row['equipmentIds'];
  const rawIncidents = row['incidents'];
  const incidents = Array.isArray(rawIncidents)
    ? rawIncidents.map((inc) => mapApiTripIncident(inc as Record<string, unknown>))
    : trip.incidents;
  const mapped: Trip = {
    ...trip,
    id: resourceIdKey(trip.id),
    clientId: resourceIdKey(trip.clientId),
    unitId: resourceIdKey(trip.unitId),
    operatorId: resourceIdKey(trip.operatorId),
    operationConfigurationId: row['operationConfigurationId']
      ? resourceIdKey(row['operationConfigurationId'])
      : trip.operationConfigurationId,
    operatorName: String(row['operatorName'] ?? '').trim() || undefined,
    unitOperationalCode: String(row['unitOperationalCode'] ?? '').trim() || undefined,
    createdAt: String(row['createdAt'] ?? trip.createdAt ?? ''),
    plannedDepartureAt: String(row['plannedDepartureAt'] ?? trip.plannedDepartureAt ?? ''),
    plannedArrivalAt: String(row['plannedArrivalAt'] ?? trip.plannedArrivalAt ?? ''),
    plannedCompletionAt: String(row['plannedCompletionAt'] ?? trip.plannedCompletionAt ?? ''),
    loadDate: String(row['loadDate'] ?? trip.loadDate ?? '').trim() || undefined,
    loadPlace: String(row['loadPlace'] ?? trip.loadPlace ?? '').trim() || undefined,
    emptyDeliveryAt:
      String(row['emptyDeliveryAt'] ?? trip.emptyDeliveryAt ?? '').trim() || undefined,
    emptyDeliveryPlace:
      String(row['emptyDeliveryPlace'] ?? trip.emptyDeliveryPlace ?? '').trim() || undefined,
    destinationRateId:
      row['destinationRateId'] != null
        ? resourceIdKey(row['destinationRateId'] as string | number)
        : (trip.destinationRateId ?? null),
    originOperationalCenterId:
      row['originOperationalCenterId'] != null
        ? resourceIdKey(row['originOperationalCenterId'] as string | number)
        : (trip.originOperationalCenterId ?? null),
    equipmentIds: Array.isArray(rawEquipmentIds)
      ? rawEquipmentIds.map((id) => resourceIdKey(id as string | number))
      : trip.equipmentIds,
    incidents,
    hasIncident: (incidents ?? []).some((inc) => inc.isIncident === true),
  };
  // Drop legacy API keys if still present on the wire.
  const ghost = mapped as Trip & Record<string, unknown>;
  for (const key of [
    'origin',
    'destination',
    'operationalDistanceKm',
    'isRoundTrip',
    'dieselPricePerLiterAtCreation',
    'operatorLicenseNumber',
    'operatorLicenseExpiresLabel',
    'operatorNameSnapshot',
    'unitOperationalCodeSnapshot',
    'operationConfigurationNameSnapshot',
    'operationConfigurationVersionSnapshot',
    'operationConfigurationMaxEquipmentCountSnapshot',
    'originOperationalCenterNameSnapshot',
    'originOperationalCenterCodeSnapshot',
    'openIncidentCount',
    'delayPhase',
    'isDelayed',
  ] as const) {
    delete ghost[key];
  }
  return mapped;
}
