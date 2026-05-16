import { Observable } from 'rxjs';
import { Operator } from '@shared/models/logistics.models';

export type CreateOperatorPayload = Omit<Operator, 'id'>;

export abstract class OperatorRepository {
  abstract list(): Observable<Operator[]>;
  abstract get(id: string): Observable<Operator | null>;
  abstract create(payload: CreateOperatorPayload): Observable<Operator>;
  abstract update(operator: Operator): Observable<Operator>;
}
