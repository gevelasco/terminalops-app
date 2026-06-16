export type FleetOverviewEquipmentConvoyType =
  | 'trailer'
  | 'none'
  | 'single'
  | 'full';

export type FleetOverviewAssetStatus =
  | 'available'
  | 'in_use'
  | 'maintenance'
  | 'scheduled';

export type FleetOverviewOperationalStatus =
  | 'in_transit'
  | 'scheduled'
  | 'available'
  | 'maintenance';

export type FleetOverviewTripStatus = 'in_transit' | 'scheduled' | 'completed';

export type FleetOverviewRenewalStatus = 'ok' | 'soon' | 'due' | 'na';

export interface FleetOverviewEquipmentDto {
  equipmentId: number | null;
  type: FleetOverviewEquipmentConvoyType;
  status: FleetOverviewAssetStatus;
}

export interface FleetOverviewHitchedEquipmentDto {
  equipmentId: number;
  operationalCode: string;
  equipmentType: string;
  hitchPosition?: 'lead' | 'rear';
  status: FleetOverviewAssetStatus;
}

export interface FleetOverviewTripDto {
  tripId: number;
  maneuverCode: string;
  clientName: string;
  origin: string;
  destination: string;
  status: FleetOverviewTripStatus;
  plannedDepartureAt?: string;
  plannedArrivalAt?: string;
  plannedCompletionAt?: string;
  departureAt?: string;
  arrivedAt?: string;
  returnAt?: string;
  operationalDistanceKm?: number;
  operatorName?: string;
}

export interface FleetOverviewMaintenanceDto {
  lastMaintenanceDate?: string;
  nextMaintenanceDate?: string;
  kmSinceLastMaintenance?: number;
  tireStatus?: string;
  insuranceStatus?: string;
  inspectionStatus?: string;
  maintenanceRenewal?: FleetOverviewRenewalStatus;
  insuranceRenewal?: FleetOverviewRenewalStatus;
  inspectionRenewal?: FleetOverviewRenewalStatus;
}

export interface FleetOverviewConfigurationDto {
  id: number;
  code: string;
  name: string;
  maxEquipmentCount: number;
}

export interface FleetOverviewItemDto {
  unitId: number;
  unitName: string;
  unitPlate: string;
  equipment: FleetOverviewEquipmentDto;
  hitchedEquipment: FleetOverviewHitchedEquipmentDto[];
  operationalStatus: FleetOverviewOperationalStatus;
  trip?: FleetOverviewTripDto;
  maintenance?: FleetOverviewMaintenanceDto;
  configuration?: FleetOverviewConfigurationDto;
  daysWithoutManeuver?: number;
}

export interface FleetOverviewEquipmentRowDto {
  equipmentId: number;
  unitId: number | null;
  unitName: string | null;
  operationalCode: string;
  brand: string;
  model: string;
  plate: string;
  equipmentType: string;
  operationalStatus: FleetOverviewOperationalStatus;
  maintenance?: FleetOverviewMaintenanceDto;
}

export interface FleetOverviewResponseDto {
  items: FleetOverviewItemDto[];
  equipment: FleetOverviewEquipmentRowDto[];
}
