import type { CreateTripPayload } from '@shared/models/api/api-trips.model';
import type {
  TripClientPaymentMethod,
  TripContainerType,
  TripLoadType,
} from '@shared/models/logistics.models';
import { isTripClientPaymentMethod } from '@shared/catalogs/trip-client-payment-options';
import { isOperationalCenterNewRoute } from '@features/clients/constants/operational-center-new-route';
import { dateTimeLocalValueToIso } from '@features/trips/utils/datetime-local';
import {
  cityMunicipalityLineFromSettlement,
  formatSettlementOptionLabel,
  localityKey,
  normalizeMxPostalCodeDigits,
} from '@features/trips/utils/mx-postal-settlement';
import { maneuverKindFromRouteKm } from '@features/trips/utils/maniobra-route-display';
import { plannedScheduleIsoTriplet } from '@features/trips/utils/planned-schedule-validation';
import {
  parseNonNegativeNumber,
  stripGroupedNumberInput,
} from '@features/trips/utils/parse-non-negative';
import type { MxPostalSettlement } from '@shared/services/mexico-postal-code.service';

export function parseTripsNewDrawerCreditDays(raw: string): number {
  const t = raw.trim();
  if (t === '') {
    return 0;
  }
  const n = Number.parseInt(t, 10);
  if (!Number.isFinite(n) || n < 0) {
    return 0;
  }
  return n;
}

export function normalizeTripsNewDrawerPaymentMethod(
  v: string,
): TripClientPaymentMethod {
  if (isTripClientPaymentMethod(v)) {
    return v;
  }
  return 'cash';
}

export function isPlannedCompletionInPast(
  plannedCompletionAt: string,
  nowMs = Date.now(),
): boolean {
  const t = Date.parse(plannedCompletionAt);
  return Number.isFinite(t) && t < nowMs;
}

function parseRequiredNonNegative(
  raw: string,
  fieldLabel: string,
): { ok: true; value: number } | { ok: false; message: string } {
  const s = stripGroupedNumberInput(raw);
  if (s === '') {
    return { ok: false, message: `El campo «${fieldLabel}» es obligatorio.` };
  }
  const n = parseNonNegativeNumber(raw);
  if (n === null) {
    return {
      ok: false,
      message: `«${fieldLabel}» no tiene un valor numérico válido.`,
    };
  }
  return { ok: true, value: n };
}

function parseOptionalNonNegative(
  raw: string,
  fieldLabel: string,
): { ok: true; value: number } | { ok: false; message: string } {
  const s = stripGroupedNumberInput(raw);
  if (s === '') {
    return { ok: true, value: 0 };
  }
  const n = parseNonNegativeNumber(raw);
  if (n === null) {
    return {
      ok: false,
      message: `«${fieldLabel}» no tiene un valor numérico válido.`,
    };
  }
  return { ok: true, value: n };
}

/** Snapshot plano del formulario «Nueva maniobra» para validar y armar el payload. */
export type TripsNewDrawerSubmitSnapshot = {
  originCp: string;
  destinationCp: string;
  originSettlements: readonly MxPostalSettlement[];
  destinationSettlements: readonly MxPostalSettlement[];
  originLocalityKey: string;
  destinationLocalityKey: string;
  origin: string;
  destination: string;
  includeClientBilling: boolean;
  clientName: string;
  clientId: string;
  unitId: string;
  unitMatchesConfig: boolean;
  unitConfigMismatchMessage: string;
  assignedOperatorId: string;
  operationType: string;
  selectedOperationConfigId: string | undefined;
  selectedOperationConfigName: string | undefined;
  usesMultipleEquipment: boolean;
  equipmentPrimaryId: string;
  equipmentSecondaryId: string;
  equipmentPrimaryLabel: string;
  equipmentSecondaryLabel: string;
  plannedDepartureDateTime: string;
  plannedArrivalDateTime: string;
  plannedCompletionDateTime: string;
  dieselLiters: string;
  dieselAmount: string;
  casetasAmount: string;
  operatorQuota: string;
  perDiemAmount: string;
  clientCharge: string;
  creditDays: string;
  requiresInvoice: boolean;
  paymentMethod: string;
  loadType: TripLoadType;
  containerType: TripContainerType;
  cargoDescription: string;
  approximateWeightTons: string;
  loadDate: string;
  loadPlace: string;
  routeKm: number | null;
  matchedDestinationRateId: string | null;
  originOperationalCenterId: string;
};

export type TripsNewDrawerSubmitResult =
  | { ok: true; payload: CreateTripPayload; completionInPast: boolean }
  | { ok: false; message: string };

/**
 * Valida el formulario de alta y construye `CreateTripPayload`.
 * Sin toasts ni I/O: el componente solo muestra `message` o llama a la API.
 */
export function buildTripsNewDrawerSubmitResult(
  snap: TripsNewDrawerSubmitSnapshot,
  nowMs = Date.now(),
): TripsNewDrawerSubmitResult {
  const oCp = normalizeMxPostalCodeDigits(snap.originCp);
  const dCp = normalizeMxPostalCodeDigits(snap.destinationCp);
  if (oCp.length !== 5 || dCp.length !== 5) {
    return {
      ok: false,
      message:
        'Indica códigos postales de origen y destino (5 dígitos, solo México).',
    };
  }
  if (
    snap.originSettlements.length === 0 ||
    snap.destinationSettlements.length === 0
  ) {
    return {
      ok: false,
      message:
        'No hay datos SEPOMex para uno de los códigos postales; revisa e intenta de nuevo.',
    };
  }
  const okO = snap.originSettlements.some(
    (r) => localityKey(r) === snap.originLocalityKey,
  );
  const okD = snap.destinationSettlements.some(
    (r) => localityKey(r) === snap.destinationLocalityKey,
  );
  if (!okO || !okD) {
    return {
      ok: false,
      message: 'Selecciona la localidad de origen y la de destino.',
    };
  }

  const oKey = snap.originLocalityKey.trim();
  const dKey = snap.destinationLocalityKey.trim();
  const oS = snap.originSettlements.find((r) => localityKey(r) === oKey) ?? null;
  const dS =
    snap.destinationSettlements.find((r) => localityKey(r) === dKey) ?? null;
  if (!oS || !dS) {
    return {
      ok: false,
      message: 'Selecciona la localidad de origen y la de destino.',
    };
  }

  const origin = snap.origin.trim();
  const destination = snap.destination.trim();
  if (!origin || !destination) {
    return {
      ok: false,
      message:
        'No se pudo armar la ruta; espera un momento tras elegir CP y localidad.',
    };
  }

  const includeBilling = snap.includeClientBilling;
  let client: string | undefined;
  if (includeBilling) {
    const c = snap.clientName.trim();
    if (!c) {
      return { ok: false, message: 'Selecciona o escribe un cliente.' };
    }
    client = c;
  }

  const uid = snap.unitId.trim();
  if (!uid) {
    return { ok: false, message: 'Selecciona una unidad.' };
  }
  if (!snap.unitMatchesConfig) {
    return { ok: false, message: snap.unitConfigMismatchMessage };
  }

  const oprId = snap.assignedOperatorId.trim();
  if (!oprId) {
    return { ok: false, message: 'Selecciona un operador disponible.' };
  }

  const op = snap.operationType;
  const eq1 = snap.equipmentPrimaryId.trim();
  const eq2 = snap.equipmentSecondaryId.trim();

  if (snap.usesMultipleEquipment) {
    if (!eq1 || !eq2) {
      const configName = snap.selectedOperationConfigName ?? 'esta configuración';
      return {
        ok: false,
        message: `La unidad elegida no tiene la configuración de equipos requerida para ${configName}.`,
      };
    }
  } else if (!eq1) {
    return {
      ok: false,
      message: 'La unidad elegida no tiene equipo configurado.',
    };
  }

  const plannedSchedule = plannedScheduleIsoTriplet(
    snap.plannedDepartureDateTime,
    snap.plannedArrivalDateTime,
    snap.plannedCompletionDateTime,
  );
  if (!plannedSchedule) {
    return {
      ok: false,
      message:
        'Completa salida, llegada cliente y llegada / fin en orden cronológico.',
    };
  }

  const liters = parseRequiredNonNegative(snap.dieselLiters, 'Diesel (litros)');
  if (!liters.ok) {
    return liters;
  }
  const dieselAmt = parseRequiredNonNegative(snap.dieselAmount, 'Diesel (monto)');
  if (!dieselAmt.ok) {
    return dieselAmt;
  }
  const casetas = parseRequiredNonNegative(snap.casetasAmount, 'Casetas');
  if (!casetas.ok) {
    return casetas;
  }
  const opQuota = parseRequiredNonNegative(snap.operatorQuota, 'Operador');
  if (!opQuota.ok) {
    return opQuota;
  }
  const viaticos = parseOptionalNonNegative(snap.perDiemAmount, 'Viáticos');
  if (!viaticos.ok) {
    return viaticos;
  }

  let cobro = 0;
  if (includeBilling) {
    const parsed = parseRequiredNonNegative(snap.clientCharge, 'Cobro');
    if (!parsed.ok) {
      return parsed;
    }
    cobro = parsed.value;
  }

  const equipmentLabels = snap.usesMultipleEquipment
    ? [snap.equipmentPrimaryLabel, snap.equipmentSecondaryLabel]
    : [snap.equipmentPrimaryLabel];

  const oCpDigits = normalizeMxPostalCodeDigits(snap.originCp);
  const dCpDigits = normalizeMxPostalCodeDigits(snap.destinationCp);
  const kmSnap = snap.routeKm;
  const maneuverKindSnap = maneuverKindFromRouteKm(kmSnap);

  const equipmentIds = snap.usesMultipleEquipment
    ? [eq1, eq2].map((id) => id.trim()).filter(Boolean)
    : [eq1.trim()].filter(Boolean);

  const loadDateIso = dateTimeLocalValueToIso(snap.loadDate);
  const centerId = snap.originOperationalCenterId.trim();

  const payload: CreateTripPayload = {
    operationType: op.trim(),
    ...(snap.selectedOperationConfigId
      ? { operationConfigurationId: snap.selectedOperationConfigId }
      : {}),
    loadType: snap.loadType,
    containerType: snap.containerType,
    cargoDescription: snap.cargoDescription.trim(),
    approximateWeightTons: snap.approximateWeightTons.trim(),
    ...(loadDateIso ? { loadDate: loadDateIso } : {}),
    ...(snap.loadPlace.trim() ? { loadPlace: snap.loadPlace.trim() } : {}),
    dieselLiters: String(liters.value),
    dieselAmount: String(dieselAmt.value),
    casetasAmount: String(casetas.value),
    operatorQuota: String(opQuota.value),
    ...(viaticos.value > 0 ? { perDiemAmount: String(viaticos.value) } : {}),
    clientCharge: String(cobro),
    creditDays: includeBilling
      ? parseTripsNewDrawerCreditDays(snap.creditDays)
      : 0,
    requiresInvoice: includeBilling ? snap.requiresInvoice : false,
    paymentMethod: includeBilling
      ? normalizeTripsNewDrawerPaymentMethod(snap.paymentMethod)
      : 'cash',
    operatorId: oprId,
    unitId: uid,
    clientName: client,
    clientId: includeBilling ? snap.clientId.trim() || undefined : undefined,
    equipment: equipmentLabels,
    equipmentIds,
    plannedDepartureAt: plannedSchedule.plannedDepartureAt,
    plannedArrivalAt: plannedSchedule.plannedArrivalAt,
    plannedCompletionAt: plannedSchedule.plannedCompletionAt,
    routeDistanceKm: kmSnap,
    maneuverKind: maneuverKindSnap,
    originPostalCode: oCpDigits.length === 5 ? oCpDigits : undefined,
    originCityMunicipality: cityMunicipalityLineFromSettlement(oS),
    originLocality: formatSettlementOptionLabel(oS),
    destinationPostalCode: dCpDigits.length === 5 ? dCpDigits : undefined,
    destinationCityMunicipality: cityMunicipalityLineFromSettlement(dS),
    destinationLocality: formatSettlementOptionLabel(dS),
    ...(snap.matchedDestinationRateId
      ? { destinationRateId: snap.matchedDestinationRateId }
      : {}),
    ...(!centerId || isOperationalCenterNewRoute(centerId)
      ? {}
      : { originOperationalCenterId: centerId }),
  };

  return {
    ok: true,
    payload,
    completionInPast: isPlannedCompletionInPast(
      plannedSchedule.plannedCompletionAt,
      nowMs,
    ),
  };
}
