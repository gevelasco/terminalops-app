import type { Client, ClientDelivery } from '@shared/models/client.models';
import type { Operator, OperatorOperationalStatus } from '@shared/models/logistics.models';
import { defaultClientPayment } from '@shared/utils/client-defaults';
import {
  EMPTY_EMERGENCY,
  EMPTY_PRIVATE,
  EMPTY_PUBLIC,
} from '@features/operators/utils/operator-payload-defaults';
import type {
  Trip,
  TripContainerSlot,
  TripIncident,
  TripStoredDocument,
  Unit,
  UnitFleetMeta,
  Equipment,
  EquipmentFleetMeta,
} from '@shared/models/logistics.models';
import { normalizeTripContainerType } from '@shared/catalogs/trip-container-type-options';
import { normalizeTripCargoCategory } from '@shared/catalogs/trip-cargo-category-options';
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

function mapApiClientDelivery(
  row: Record<string, unknown>,
  index: number,
): ClientDelivery {
  const postalCode =
    typeof row['postalCode'] === 'string' ? row['postalCode'] : undefined;
  const locality = typeof row['locality'] === 'string' ? row['locality'] : undefined;
  const apiId = resourceIdKey(row['id']);
  return {
    id: apiId || `dlv-${index}-${postalCode ?? ''}-${locality ?? ''}`,
    postalCode,
    cityMunicipality:
      typeof row['cityMunicipality'] === 'string' ? row['cityMunicipality'] : undefined,
    locality,
    settlementConsId:
      typeof row['settlementConsId'] === 'string' ? row['settlementConsId'] : undefined,
    latitude:
      typeof row['latitude'] === 'number' && Number.isFinite(row['latitude'])
        ? row['latitude']
        : undefined,
    longitude:
      typeof row['longitude'] === 'number' && Number.isFinite(row['longitude'])
        ? row['longitude']
        : undefined,
    destinationRateId:
      row['destinationRateId'] != null ? String(row['destinationRateId']) : undefined,
    isUnpricedRoute: Boolean(row['isUnpricedRoute']),
  };
}

function mapApiClientDeliveries(row: Record<string, unknown>): ClientDelivery[] {
  const rawList = row['deliveries'];
  if (Array.isArray(rawList) && rawList.length > 0) {
    return rawList
      .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
      .map((item, index) => mapApiClientDelivery(item, index));
  }
  const singular = row['delivery'];
  if (singular && typeof singular === 'object') {
    return [mapApiClientDelivery(singular as Record<string, unknown>, 0)];
  }
  return [];
}

/** Respuesta API → modelo `Client` del frontend. */
export function mapApiClient(row: Record<string, unknown>): Client {
  const billing = row['billing'] as Record<string, unknown> | undefined;
  const deliveries = mapApiClientDeliveries(row);
  const paymentTerms = (row['paymentTerms'] ?? row['payment']) as
    | Record<string, unknown>
    | undefined;
  const contacts = (row['contacts'] as Record<string, unknown>[] | undefined) ?? [];
  const documents = (row['documents'] as Record<string, unknown>[] | undefined) ?? [];

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
    deliveries,
    delivery: deliveries[0],
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
    documents: documents
      .map((d) => {
        const slot = String(d['slot'] ?? '').trim();
        const fileName = String(d['fileName'] ?? '').trim();
        if (slot !== 'fiscal' || !fileName) {
          return null;
        }
        return {
          id: resourceIdKey(d['id']),
          fileName,
          slot: 'fiscal' as const,
          addedAt: String(d['addedAt'] ?? '').trim() || new Date().toISOString().slice(0, 10),
          hasStoredFile: d['hasStoredFile'] === true,
        };
      })
      .filter((d): d is NonNullable<typeof d> => d != null),
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
    photoDataUrl:
      typeof row['photoDataUrl'] === 'string' ? row['photoDataUrl'] : undefined,
    hasPhoto:
      row['hasPhoto'] === true ||
      (typeof row['photoDataUrl'] === 'string' &&
        row['photoDataUrl'].trim().length > 0),
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
    weeklyPayDay:
      typeof row['weeklyPayDay'] === 'string' && row['weeklyPayDay'].trim()
        ? (row['weeklyPayDay'] as Operator['weeklyPayDay'])
        : undefined,
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
      hasStoredFile: d['hasStoredFile'] === true,
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
    origin: parseOptionalRouteLabel(row['origin']),
    destination: parseOptionalRouteLabel(row['destination']),
    status: row['status'] as Operator['lastManeuver'] extends { status?: infer S }
      ? S
      : never,
    occurredOn: parseOptionalIsoDate(row['occurredOn']),
  };
}

function parseOptionalRouteLabel(value: unknown): string | undefined {
  const t = value != null ? String(value).trim() : '';
  if (!t || t === '—') {
    return undefined;
  }
  return t;
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
  const rawHitched = row['equipment'] ?? row['hitchedEquipment'];
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
  const assignedUnit = mapAssignedUnitSummary(row['assignedUnit']);
  const unitId =
    resourceIdKey(row['unitId']) || (assignedUnit?.id ? resourceIdKey(assignedUnit.id) : '');
  return {
    id: resourceIdKey(row['id']),
    unitId,
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
    assignedUnit,
  };
}

function mapAssignedUnitSummary(raw: unknown): Unit | undefined {
  if (!raw || typeof raw !== 'object') {
    return undefined;
  }
  const row = raw as Record<string, unknown>;
  const id = resourceIdKey(row['id']);
  if (!id) {
    return undefined;
  }
  const kmRaw = row['maintenanceKmCounter'];
  const km =
    typeof kmRaw === 'number'
      ? kmRaw
      : kmRaw != null && String(kmRaw).trim() !== ''
        ? Number(kmRaw)
        : undefined;
  const brandName =
    typeof row['trailerBrandName'] === 'string'
      ? row['trailerBrandName'].trim()
      : '';
  return {
    id,
    plate: String(row['plate'] ?? ''),
    capacityKg: 0,
    status: String(row['status'] ?? ''),
    isActive: row['isActive'] !== false,
    name: row['name'] != null ? String(row['name']) : undefined,
    trailerBrandAbbr:
      row['trailerBrandAbbr'] != null
        ? String(row['trailerBrandAbbr'])
        : undefined,
    trailerYear:
      row['trailerYear'] != null ? String(row['trailerYear']) : undefined,
    fleetMeta: {
      trailerBrandName: brandName || undefined,
      odometerKm:
        row['odometerKm'] != null ? String(row['odometerKm']) : undefined,
      maintenanceKmCounter: Number.isFinite(km) ? km : undefined,
    },
  };
}

function mapApiTripIncidentImages(
  raw: unknown,
): NonNullable<TripIncident['images']> {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw
    .map((item) => {
      const row = item as Record<string, unknown>;
      const id = Number(row['id']);
      const fileName = String(row['fileName'] ?? '').trim();
      if (!Number.isFinite(id) || id <= 0 || !fileName) {
        return null;
      }
      return {
        id,
        fileName,
        contentType:
          row['contentType'] == null ? null : String(row['contentType']),
      };
    })
    .filter((img): img is NonNullable<typeof img> => img != null);
}

function mapApiTripIncident(row: Record<string, unknown>): TripIncident {
  return {
    id: resourceIdKey(row['id']),
    description: String(row['description'] ?? ''),
    createdAt: String(row['createdAt'] ?? ''),
    postedBy: String(row['postedBy'] ?? ''),
    postedByLabel: row['postedByLabel'] as string | undefined,
    isIncident: row['isIncident'] === true,
    images: mapApiTripIncidentImages(row['images']),
  };
}

function mapApiTripDocuments(raw: unknown): TripStoredDocument[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw
    .map((item) => {
      const row = item as Record<string, unknown>;
      const id = Number(row['id']);
      const fileName = String(row['fileName'] ?? '').trim();
      const documentKind = String(row['documentKind'] ?? '').trim();
      if (!Number.isFinite(id) || id <= 0 || !fileName || !documentKind) {
        return null;
      }
      return { id, fileName, documentKind };
    })
    .filter((doc): doc is TripStoredDocument => doc != null);
}

function mapTripProgrammer(row: Record<string, unknown>): {
  createdByName?: string;
  createdByUsername?: string;
} {
  const nested = row['createdBy'] ?? row['createdByUser'];
  let nestedName = '';
  let nestedUsername = '';
  if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
    const o = nested as Record<string, unknown>;
    nestedName = String(o['name'] ?? o['fullName'] ?? o['displayName'] ?? '').trim();
    nestedUsername = String(o['username'] ?? '').trim();
  } else if (typeof nested === 'string') {
    nestedName = nested.trim();
  }
  const name = String(
    row['createdByName'] ??
      row['createdByLabel'] ??
      row['createdByUserName'] ??
      row['created_by'] ??
      nestedName,
  ).trim();
  const username = String(row['createdByUsername'] ?? nestedUsername).trim();
  return {
    createdByName: name || undefined,
    createdByUsername: username || undefined,
  };
}

function mapTripUnitFields(row: Record<string, unknown>): {
  unitId: string;
  unitOperationalCode?: string;
} {
  const nested = row['unit'];
  let nestedId = '';
  let nestedCode: string | undefined;
  if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
    const o = nested as Record<string, unknown>;
    nestedId = resourceIdKey(o['id']);
    nestedCode = String(o['unitOperationalCode'] ?? '').trim() || undefined;
  }
  const unitId = resourceIdKey(row['unitId']) || nestedId;
  const unitOperationalCode =
    String(row['unitOperationalCode'] ?? '').trim() || nestedCode || undefined;
  return { unitId, unitOperationalCode };
}

function mapApiTripContainers(raw: unknown): TripContainerSlot[] | undefined {
  if (!Array.isArray(raw) || raw.length === 0) {
    return undefined;
  }
  const out: TripContainerSlot[] = [];
  for (const row of raw) {
    const o = row as Record<string, unknown>;
    const slot = Number(o['slot']);
    if (!Number.isFinite(slot) || slot < 1) {
      continue;
    }
    out.push({
      slot,
      containerType: normalizeTripContainerType(String(o['containerType'] ?? 'na')),
      containerNumber: String(o['containerNumber'] ?? '').trim() || null,
    });
  }
  out.sort((a, b) => a.slot - b.slot);
  return out.length > 0 ? out : undefined;
}

export function mapApiTrip(row: Record<string, unknown>): Trip {
  const trip = row as unknown as Trip;
  const rawEquipmentIds = row['equipmentIds'];
  const rawIncidents = row['incidents'];
  const incidents = Array.isArray(rawIncidents)
    ? rawIncidents.map((inc) => mapApiTripIncident(inc as Record<string, unknown>))
    : trip.incidents;
  const { unitId, unitOperationalCode } = mapTripUnitFields(row);
  const mapped: Trip = {
    ...trip,
    id: resourceIdKey(trip.id),
    clientId: resourceIdKey(trip.clientId),
    unitId,
    operatorId: resourceIdKey(trip.operatorId),
    operationConfigurationId: row['operationConfigurationId']
      ? resourceIdKey(row['operationConfigurationId'])
      : trip.operationConfigurationId,
    operationConfigurationName:
      String(row['operationConfigurationName'] ?? '').trim() || null,
    operationConfigurationMaxEquipmentCount:
      typeof row['operationConfigurationMaxEquipmentCount'] === 'number'
        ? row['operationConfigurationMaxEquipmentCount']
        : Number.isFinite(Number(row['operationConfigurationMaxEquipmentCount']))
          ? Number(row['operationConfigurationMaxEquipmentCount'])
          : null,
    operatorName: String(row['operatorName'] ?? '').trim() || undefined,
    unitOperationalCode,
    unitPlate: String(row['unitPlate'] ?? '').trim() || null,
    equipmentPlates: Array.isArray(row['equipmentPlates'])
      ? (row['equipmentPlates'] as unknown[]).map((p) => String(p ?? '').trim())
      : undefined,
    operatorLicenseNumber:
      String(row['operatorLicenseNumber'] ?? '').trim() || null,
    operatorLicenseExpiresOn:
      String(row['operatorLicenseExpiresOn'] ?? '').trim() || null,
    createdAt: String(row['createdAt'] ?? trip.createdAt ?? ''),
    ...mapTripProgrammer(row),
    completedAt:
      String(row['completedAt'] ?? trip.completedAt ?? '').trim() || null,
    plannedDepartureAt: String(row['plannedDepartureAt'] ?? trip.plannedDepartureAt ?? ''),
    plannedArrivalAt: String(row['plannedArrivalAt'] ?? trip.plannedArrivalAt ?? ''),
    plannedCompletionAt: String(row['plannedCompletionAt'] ?? trip.plannedCompletionAt ?? ''),
    cargoCategory: normalizeTripCargoCategory(
      String(row['cargoCategory'] ?? trip.cargoCategory ?? 'material'),
    ),
    containerNumber:
      String(row['containerNumber'] ?? trip.containerNumber ?? '').trim() || null,
    containers: mapApiTripContainers(row['containers']),
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
    destinationRateSummary:
      String(row['destinationRateSummary'] ?? '').trim() || null,
    originOperationalCenterId:
      row['originOperationalCenterId'] != null
        ? resourceIdKey(row['originOperationalCenterId'] as string | number)
        : (trip.originOperationalCenterId ?? null),
    originOperationalCenterLabel:
      String(row['originOperationalCenterLabel'] ?? '').trim() || null,
    equipmentIds: Array.isArray(rawEquipmentIds)
      ? rawEquipmentIds.map((id) => resourceIdKey(id as string | number))
      : trip.equipmentIds,
    incidents,
    hasIncident:
      row['hasIncident'] === true ||
      (incidents ?? []).some((inc) => inc.isIncident === true),
    tripDocuments: mapApiTripDocuments(row['tripDocuments']),
  };
  // Drop legacy API keys if still present on the wire.
  const ghost = mapped as Trip & Record<string, unknown>;
  for (const key of [
    'origin',
    'destination',
    'unit',
    'operator',
    'operationalDistanceKm',
    'isRoundTrip',
    'dieselPricePerLiterAtCreation',
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
