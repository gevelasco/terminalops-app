import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import type { FleetOverviewResponseDto } from '@shared/models/api/fleet-overview.model';
import type { FleetCatalogResponseDto } from '@shared/models/api/fleet-catalog.model';
import { SessionService } from '../state/session';
import { companyResourceUrl, requireCompanyId } from './api-url';

@Injectable({ providedIn: 'root' })
export class FleetApiService {
  private readonly http = inject(HttpClient);
  private readonly session = inject(SessionService);

  getFleetOverview(): Observable<FleetOverviewResponseDto> {
    const companyId = requireCompanyId(this.session.companyId());
    return this.http.get<FleetOverviewResponseDto>(
      companyResourceUrl(companyId, 'fleet/overview'),
    );
  }

  getFleetOverviewForTripIds(tripIds: readonly number[]): Observable<FleetOverviewResponseDto> {
    const companyId = requireCompanyId(this.session.companyId());
    const ids = [...new Set(tripIds.filter((id) => Number.isFinite(id) && id > 0))];
    return this.http.get<FleetOverviewResponseDto>(
      companyResourceUrl(companyId, 'fleet/overview'),
      { params: { tripIds: ids.join(',') } },
    );
  }

  getFleetCatalog(): Observable<FleetCatalogResponseDto> {
    const companyId = requireCompanyId(this.session.companyId());
    return this.http.get<FleetCatalogResponseDto>(
      companyResourceUrl(companyId, 'fleet/catalog'),
    );
  }
}
