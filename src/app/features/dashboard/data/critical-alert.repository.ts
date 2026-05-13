import { Observable } from 'rxjs';
import { CriticalAlert } from '@shared/models/logistics.models';

export abstract class CriticalAlertRepository {
  abstract list(): Observable<CriticalAlert[]>;
}
