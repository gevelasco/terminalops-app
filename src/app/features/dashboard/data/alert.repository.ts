import { Observable } from 'rxjs';
import { Alert } from '@shared/models/logistics.models';

export abstract class AlertRepository {
  abstract list(): Observable<Alert[]>;
}
