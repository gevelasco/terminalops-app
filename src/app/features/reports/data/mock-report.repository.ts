import { Injectable } from '@angular/core';
import { delay, Observable, of } from 'rxjs';
import { MOCK_REPORT_ROWS } from '@app/mock-data/mock-reports';
import { ReportSummaryRow } from '@shared/models/logistics.models';
import { ReportRepository } from './report.repository';

@Injectable()
export class MockReportRepository extends ReportRepository {
  override summary(): Observable<ReportSummaryRow[]> {
    return of([...MOCK_REPORT_ROWS]).pipe(delay(250));
  }
}
