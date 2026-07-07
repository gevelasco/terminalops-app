import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { forkJoin, map, Observable } from 'rxjs';
import {
  DashboardInsights,
  mapApiDashboardInsights,
} from '@shared/models/api/api-dashboard-insights.model';
import {
  DashboardSummary,
  mapApiDashboardSummary,
} from '@shared/models/api/api-dashboard-summary.model';
import { SessionService } from '../state/session';
import { companyResourceUrl, requireCompanyId } from './api-url';

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly http = inject(HttpClient);
  private readonly session = inject(SessionService);

  getSummary(): Observable<DashboardSummary> {
    const companyId = requireCompanyId(this.session.companyId());
    return this.http
      .get<Record<string, unknown>>(companyResourceUrl(companyId, 'dashboard/summary'))
      .pipe(map((raw) => mapApiDashboardSummary(raw)));
  }

  getInsights(): Observable<DashboardInsights> {
    const companyId = requireCompanyId(this.session.companyId());
    return this.http
      .get<Record<string, unknown>>(companyResourceUrl(companyId, 'dashboard/insights'))
      .pipe(map((raw) => mapApiDashboardInsights(raw)));
  }

  getPageData(): Observable<{ summary: DashboardSummary; insights: DashboardInsights }> {
    return forkJoin({
      summary: this.getSummary(),
      insights: this.getInsights(),
    });
  }
}
