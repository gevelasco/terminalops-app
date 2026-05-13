import { Injectable } from '@angular/core';
import { delay, Observable, of } from 'rxjs';
import { MOCK_CRITICAL_ALERTS } from '@app/mock-data/mock-critical-alerts';
import { CriticalAlert } from '@shared/models/logistics.models';
import { CriticalAlertRepository } from './critical-alert.repository';

@Injectable()
export class MockCriticalAlertRepository extends CriticalAlertRepository {
  override list(): Observable<CriticalAlert[]> {
    return of([...MOCK_CRITICAL_ALERTS]).pipe(delay(180));
  }
}
