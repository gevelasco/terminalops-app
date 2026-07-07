import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import type { CompanyOperationalSettings } from '@shared/models/company-operational-settings.models';
import type { DashboardDieselSnapshot } from '@shared/models/api/api-dashboard-summary.model';
import { environment } from '../../../../environments/environment';

export type CompanyProfile = CompanyOperationalSettings & {
  id: number;
  name: string;
};

export type PatchCompanyOperationalSettings = Partial<
  Omit<CompanyOperationalSettings, 'operationalAnalysisChangedAt'>
>;

@Injectable({ providedIn: 'root' })
export class CompaniesService {
  private readonly http = inject(HttpClient);

  getCompany(publicCompanyId: string | number): Observable<CompanyProfile> {
    return this.http.get<CompanyProfile>(
      `${environment.apiUrl}/companies/${publicCompanyId}`,
    );
  }

  updateOperationalSettings(
    publicCompanyId: string | number,
    payload: PatchCompanyOperationalSettings,
  ): Observable<CompanyProfile> {
    return this.http.patch<CompanyProfile>(
      `${environment.apiUrl}/companies/${publicCompanyId}/settings/operational`,
      payload,
    );
  }

  updateDieselReferencePrice(
    publicCompanyId: string | number,
    pricePerLiter: number,
  ): Observable<DashboardDieselSnapshot> {
    return this.http.patch<DashboardDieselSnapshot>(
      `${environment.apiUrl}/companies/${publicCompanyId}/settings/diesel-reference-price`,
      { pricePerLiter },
    );
  }
}
