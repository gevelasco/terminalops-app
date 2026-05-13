import { Observable } from 'rxjs';
import { ReportSummaryRow } from '@shared/models/logistics.models';

export abstract class ReportRepository {
  abstract summary(): Observable<ReportSummaryRow[]>;
}
