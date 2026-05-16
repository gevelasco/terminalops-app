import { Observable } from 'rxjs';
import { Equipment, EquipmentFleetMeta } from '@shared/models/logistics.models';

export interface CreateEquipmentPayload {
  /** Opcional hasta enganchar a una unidad tractora. */
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

export abstract class EquipmentRepository {
  abstract list(): Observable<Equipment[]>;
  abstract create(payload: CreateEquipmentPayload): Observable<Equipment>;
}
