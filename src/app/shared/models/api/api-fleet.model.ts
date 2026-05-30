import type {
  EquipmentFleetMeta,
  EquipmentHitchPosition,
  UnitFleetMeta,
} from '@shared/models/logistics.models';

export interface CreateUnitPayload {
  plate: string;
  capacityKg: number;
  status: string;
  trailerBrandAbbr?: string;
  trailerYear?: string;
  serialNumber?: string;
  name?: string;
  fleetMeta?: UnitFleetMeta;
}

export interface CreateEquipmentPayload {
  /** `null` en PATCH desengancha la tractora. */
  unitId?: string | null;
  hitchPosition?: EquipmentHitchPosition | null;
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
