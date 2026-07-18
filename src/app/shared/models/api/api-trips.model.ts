import type {
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
 */
export interface CreateTripPayload {
  origin: string;
  destination: string;
  operationType: string;
  loadType: TripLoadType;
  containerType: TripContainerType;
  cargoDescription: string;
  approximateWeightTons: string;
  /** Fecha y hora de carga (ISO 8601). */
  loadDate?: string;
  /** Lugar de carga; alimenta el catálogo por empresa. */
  loadPlace?: string;
  dieselLiters: string;
  dieselAmount: string;
  /** Snapshot MXN/L del fuel-estimate al guardar (inmutable en backend). */
  dieselPricePerLiterAtCreation?: number;
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
  equipment: string[];
  equipmentIds: string[];
  /** Salida planificada (planned_departure_at). */
  plannedDepartureAt: string;
  /** Llegada al cliente (planned_arrival_at). */
  plannedArrivalAt: string;
  /** Fin de maniobra (planned_completion_at). */
  plannedCompletionAt: string;
  attachedDocumentFileNames: string[];
  routeDistanceKm?: number | null;
  /** Ida + vuelta (calculado en backend). */
  isRoundTrip?: boolean;
  maneuverKind?: string;
  originPostalCode?: string;
  originCityMunicipality?: string;
  originLocality?: string;
  destinationPostalCode?: string;
  destinationCityMunicipality?: string;
  destinationLocality?: string;
  operatorLicenseNumber?: string;
  operatorLicenseExpiresLabel?: string;
  tollCalculationMode?: 'auto' | 'manual';
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
  /** ISO 8601; el backend valida que no sea menor al fin planeado ni al real. */
  emptyDeliveryAt: string;
  emptyDeliveryPlace: string;
  /** Obligatoria únicamente al modificar una entrega existente. */
  emptyDeliveryJustification?: string;
}

export interface CancelTripPayload {
  falseManeuver: boolean;
  note?: string;
}
