import { Injectable, inject } from '@angular/core';
import { delay, Observable, of } from 'rxjs';
import { SimulatedDbService } from '@app/sim-db/simulated-db.service';
import { CriticalAlert } from '@shared/models/logistics.models';
import { CriticalAlertRepository } from './critical-alert.repository';

@Injectable()
export class MockCriticalAlertRepository extends CriticalAlertRepository {
  private readonly db = inject(SimulatedDbService);

  override list(): Observable<CriticalAlert[]> {
    return of(this.db.listCriticalAlerts()).pipe(delay(180));
  }
}
