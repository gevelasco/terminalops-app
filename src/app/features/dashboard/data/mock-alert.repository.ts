import { Injectable } from '@angular/core';
import { delay, Observable, of } from 'rxjs';
import { MOCK_ALERTS } from '@app/mock-data/mock-alerts';
import { Alert } from '@shared/models/logistics.models';
import { AlertRepository } from './alert.repository';

@Injectable()
export class MockAlertRepository extends AlertRepository {
  override list(): Observable<Alert[]> {
    return of([...MOCK_ALERTS]).pipe(delay(220));
  }
}
