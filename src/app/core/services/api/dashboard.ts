import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import type { Alert, CriticalAlert } from '@shared/models/logistics.models';
import { SessionService } from '../state/session';
import { companyResourceUrl, requireCompanyId } from './api-url';

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly http = inject(HttpClient);
  private readonly session = inject(SessionService);

  getAlertsList(): Observable<Alert[]> {
    const companyId = requireCompanyId(this.session.companyId());
    return this.http.get<Alert[]>(companyResourceUrl(companyId, 'dashboard/alerts'));
  }

  getCriticalAlertsList(): Observable<CriticalAlert[]> {
    const companyId = requireCompanyId(this.session.companyId());
    return this.http.get<CriticalAlert[]>(
      companyResourceUrl(companyId, 'dashboard/critical-alerts'),
    );
  }
}
