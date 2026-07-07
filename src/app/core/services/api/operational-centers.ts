import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map, Observable } from 'rxjs';
import { mapApiOperationalCenter } from '@shared/data/operational-center-api-mapper';
import type { DashboardDieselSnapshot } from '@shared/models/api/api-dashboard-summary.model';
import type { OperationalCentersListResponse } from '@shared/models/api/api-operational-centers-list.model';
import { SessionService } from '../state/session';
import { companyResourceUrl, requireCompanyId } from './api-url';

@Injectable({ providedIn: 'root' })
export class OperationalCentersService {
  private readonly http = inject(HttpClient);
  private readonly session = inject(SessionService);

  getOperationalCentersList(): Observable<OperationalCentersListResponse> {
    const companyId = requireCompanyId(this.session.companyId());
    return this.http
      .get<{
        centers: Record<string, unknown>[];
        dieselReferencePrice: DashboardDieselSnapshot;
      }>(companyResourceUrl(companyId, 'operational-centers'))
      .pipe(
        map((res) => ({
          centers: res.centers.map((r) => mapApiOperationalCenter(r)),
          dieselReferencePrice: res.dieselReferencePrice,
        })),
      );
  }
}
