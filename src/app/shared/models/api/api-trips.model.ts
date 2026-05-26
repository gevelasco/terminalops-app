import type { TripContainerType, TripLoadType } from '@shared/models/logistics.models';

/** Cuerpo del formulario «Nueva maniobra». */
export interface CreateTripPayload {
  origin: string;
  destination: string;
  operationType: 'sencillo' | 'full' | 'plana';
  loadType: TripLoadType;
  containerType: TripContainerType;
  cargoDescription: string;
  approximateWeightTons: string;
  dieselLiters: string;
  dieselAmount: string;
  casetasAmount: string;
  operatorQuota: string;
  clientCharge: string;
  creditDays: number;
  requiresInvoice: boolean;
  paymentMethod: 'cash' | 'transfer' | 'check';
  operatorId: string;
  unitId: string;
  clientName?: string;
  clientId?: string;
  equipment: string[];
  equipmentIds: string[];
  departureAt: string | null;
  arrivedAt: string | null;
  attachedDocumentFileNames: string[];
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

export interface CancelTripPayload {
  falseManeuver: boolean;
  note?: string;
}
