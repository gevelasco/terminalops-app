/** Estado operativo canónico de recurso de flota (espejo backend A7). */
export type FleetStatus =
  | 'available'
  | 'scheduled'
  | 'in_use'
  | 'maintenance'
  | 'inactive';

export type ResolveFleetStatusInput = {
  status: FleetStatus;
  activeTripStatus?: 'scheduled' | 'in_transit';
  isActive: boolean;
  maintenanceFlag?: boolean;
};

export type FleetOverviewOperationalStatus =
  | 'available'
  | 'scheduled'
  | 'in_transit'
  | 'maintenance';
