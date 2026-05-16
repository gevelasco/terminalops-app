import { Observable } from 'rxjs';
import { Trip, TripContainerType, TripLoadType } from '@shared/models/logistics.models';

/** Datos del formulario «Nueva maniobra» (costos y cobro preparados para API futura). */
export interface CreateTripPayload {
  origin: string;
  destination: string;
  operationType: 'sencillo' | 'full' | 'plana';
  loadType: TripLoadType;
  containerType: TripContainerType;
  approximateWeightTons: string;
  dieselLiters: string;
  dieselAmount: string;
  casetasAmount: string;
  operatorQuota: string;
  clientCharge: string;
  /** Días de crédito pactados con el cliente. */
  creditDays: number;
  requiresInvoice: boolean;
  paymentMethod: 'cash' | 'transfer' | 'check';
  /** Operador disponible asignado a la maniobra. */
  operatorId: string;
  unitId: string;
  /** Opcional; si falta, el mock usa un valor por defecto. */
  clientName?: string;
  /** Id de catálogo; si falta, el mock resuelve por `clientName` o `cli-internal`. */
  clientId?: string;
  /** Etiquetas de equipo(s) asignados (1 en sencillo/plana; 2 obligatorios en full). */
  equipment: string[];
  /** Fecha/hora programada de salida (ISO); `null` si no aplica. */
  departureAt: string | null;
  /** Fecha/hora estimada de llegada (ISO); `null` si no aplica. */
  arrivedAt: string | null;
  /** Nombres de archivos adjuntos (PDF/imagen); el binario iría a storage en API real. */
  attachedDocumentFileNames: string[];
  /** Distancia OSRM (km) al guardar; `null` si no se pudo calcular. */
  routeDistanceKm?: number | null;
  maneuverKind?: string;
  originPostalCode?: string;
  originCityMunicipality?: string;
  originLocality?: string;
  destinationPostalCode?: string;
  destinationCityMunicipality?: string;
  destinationLocality?: string;
  operatorLicenseNumber?: string;
  operatorLicenseExpiresLabel?: string;
}

/** Cómo registrar la baja de una maniobra en curso / programada. */
export interface CancelManiobraPayload {
  /** `true`: no se ejecuta el viaje pero el cobro pactado se mantiene; exige `note`. */
  falseManeuver: boolean;
  /** Obligatorio si `falseManeuver`; opcional si es cancelación operativa estándar. */
  note?: string;
}

export abstract class ManiobraRepository {
  abstract list(): Observable<Trip[]>;

  abstract get(id: string): Observable<Trip | undefined>;

  abstract create(payload: CreateTripPayload): Observable<Trip>;

  /** Agrega un incidente con marca de tiempo del momento del registro. */
  abstract addIncident(
    tripId: string,
    description: string,
    postedBy: string,
  ): Observable<Trip>;

  /** Marca la maniobra como cancelada (si aún aplica). */
  abstract cancelManiobra(
    tripId: string,
    payload: CancelManiobraPayload,
  ): Observable<Trip>;
}
