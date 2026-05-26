import type { EquipmentFleetMeta, UnitFleetMeta } from '@shared/models/logistics.models';

export interface CreateUnitPayload {
  plate: string;
  type: string;
  capacityKg: number;
  status: string;
  trailerBrandAbbr?: string;
  trailerYear?: string;
  serialNumber?: string;
  name?: string;
  fleetMeta?: UnitFleetMeta;
}

export interface CreateEquipmentPayload {
  unitId?: string;
  name: string;
  serialNumber: string;
  lastServiceDate: string;
  plate?: string;
  type?: string;
  status?: string;
  trailerBrandAbbr?: string;
  trailerYear?: string;
  fleetMeta?: EquipmentFleetMeta;
}
