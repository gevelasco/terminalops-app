import { Injectable, inject } from '@angular/core';
import { delay, Observable, of } from 'rxjs';
import { SimulatedDbService } from '@app/sim-db/simulated-db.service';
import { Alert } from '@shared/models/logistics.models';
import { AlertRepository } from './alert.repository';

@Injectable()
export class MockAlertRepository extends AlertRepository {
  private readonly db = inject(SimulatedDbService);

  override list(): Observable<Alert[]> {
    return of(this.db.listAlerts()).pipe(delay(220));
  }
}
