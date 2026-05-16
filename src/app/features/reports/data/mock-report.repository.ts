import { Injectable, inject } from '@angular/core';
import { delay, Observable, of } from 'rxjs';
import { SimulatedDbService } from '@app/sim-db/simulated-db.service';
import { ReportSummaryRow } from '@shared/models/logistics.models';
import { ReportRepository } from './report.repository';

@Injectable()
export class MockReportRepository extends ReportRepository {
  private readonly db = inject(SimulatedDbService);

  override summary(): Observable<ReportSummaryRow[]> {
    return of(this.db.listReportSummaryRows()).pipe(delay(250));
  }
}
