import type {
  EquipmentFleetMeta,
  EquipmentHitchPosition,
  UnitFleetMeta,
} from '@shared/models/logistics.models';

export interface CreateUnitPayload {
  plate: string;
  transportType?: string;
  capacityKg: number;
  isActive?: boolean;
  trailerBrandAbbr?: string;
  trailerYear?: string;
  serialNumber?: string;
  motorNumber?: string;
  capacityTons?: number;
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
  isActive?: boolean;
  trailerBrandAbbr?: string;
  trailerYear?: string;
  fleetMeta?: EquipmentFleetMeta;
}
