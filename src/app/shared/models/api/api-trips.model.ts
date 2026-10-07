import type {
  TripCargoCategory,
  TripClientPaymentMethod,
  TripContainerType,
  TripLoadType,
} from '@shared/models/logistics.models';

/**
 * Cuerpo del formulario «Nueva maniobra».
 *
 * Contrato obligatorio (lifecycle): el cliente MUST enviar plannedDepartureAt,
 * plannedArrivalAt y plannedCompletionAt. Sin ellos el backend rechaza la creación.
 * Los campos programmedAt y scheduledAt fueron eliminados del dominio.
 *
 * No enviar: origin/destination, license snapshots, isRoundTrip, toll mode,
 * dieselPricePerLiterAtCreation, config/operator/unit snapshots, operationalDistanceKm.
 * Km operativos = routeDistanceKm × 2 (siempre roundtrip).
 */
export interface CreateTripPayload {
  operationType: string;
  loadType: TripLoadType;
  cargoCategory: TripCargoCategory;
  containerType: TripContainerType;
  containerNumber?: string;
  containers?: Array<{
    slot: number;
    containerType: TripContainerType;
    containerNumber?: string;
  }>;
  cargoDescription: string;
  approximateWeightTons: string;
  /** Fecha y hora de carga (ISO 8601). */
  loadDate?: string;
  /** Lugar de carga; alimenta el catálogo por empresa. */
  loadPlace?: string;
  dieselLiters: string;
  dieselAmount: string;
  casetasAmount: string;
  operatorQuota: string;
  /** Viáticos del operador; omitir o 0 si no aplica. */
  perDiemAmount?: string;
  clientCharge: string;
  creditDays: number;
  requiresInvoice: boolean;
  paymentMethod: TripClientPaymentMethod;
  operatorId: string;
  unitId: string;
  clientName?: string;
  clientId?: string;
  equipmentIds: string[];
  /** Salida planificada (planned_departure_at). */
  plannedDepartureAt: string;
  /** Cita cliente (planned_arrival_at). */
  plannedArrivalAt: string;
  /** Llegada origen (planned_completion_at). */
  plannedCompletionAt: string;
  routeDistanceKm?: number | null;
  maneuverKind?: string;
  originPostalCode?: string;
  originCityMunicipality?: string;
  originLocality?: string;
  destinationPostalCode?: string;
  destinationCityMunicipality?: string;
  destinationLocality?: string;
  destinationRateId?: string;
  originOperationalCenterId?: string;
}

/** PATCH /trips/:id — fechas editables mientras la maniobra está programada. */
export interface TripLoadInfoPayload {
  plannedDepartureAt: string;
  plannedArrivalAt: string;
  plannedCompletionAt: string;
  /** ISO 8601. */
  loadDate?: string;
  loadPlace?: string;
  /** Obligatoria al actualizar fechas de una maniobra programada. */
  plannedDatesJustification: string;
}

/** PATCH /trips/:id — registro o actualización de la entrega de vacío. */
export interface TripEmptyDeliveryPayload {
  /** ISO 8601; el backend valida que no sea menor a la llegada origen planeada ni a la real. */
  emptyDeliveryAt: string;
  emptyDeliveryPlace: string;
  /** Obligatoria únicamente al modificar una entrega existente. */
  emptyDeliveryJustification?: string;
}

export interface CancelTripPayload {
  falseManeuver: boolean;
  note?: string;
}
