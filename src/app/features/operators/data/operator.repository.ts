import { Observable } from 'rxjs';
import { Operator } from '@shared/models/logistics.models';

export abstract class OperatorRepository {
  abstract list(): Observable<Operator[]>;
}
