import { Observable } from 'rxjs';
import { Equipment } from '@shared/models/logistics.models';

export interface CreateEquipmentPayload {
  unitId: string;
  name: string;
  serialNumber: string;
  lastServiceDate: string;
  axleConfiguration?: string;
}

export abstract class EquipmentRepository {
  abstract list(): Observable<Equipment[]>;
  abstract create(payload: CreateEquipmentPayload): Observable<Equipment>;
}
