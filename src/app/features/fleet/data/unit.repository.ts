import { Observable } from 'rxjs';
import { Unit, UnitFleetMeta } from '@shared/models/logistics.models';

export interface CreateUnitPayload {
  plate: string;
  type: string;
  capacityKg: number;
  status: string;
  trailerBrandAbbr?: string;
  trailerYear?: string;
  fleetMeta?: UnitFleetMeta;
}

export abstract class UnitRepository {
  abstract list(): Observable<Unit[]>;
  abstract create(payload: CreateUnitPayload): Observable<Unit>;
}
