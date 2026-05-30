import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map, Observable } from 'rxjs';
import { mapApiUnit } from '@shared/data/api-mappers';
import type { CreateUnitPayload } from '@shared/models/api/api-fleet.model';
import type { Unit } from '@shared/models/logistics.models';
import {
  buildUnitWritePayload,
  type UnitPersistDraft,
} from '@shared/utils/fleet/unit-api-payload';
import { SessionService } from '../state/session';
import { companyResourceUrl, requireCompanyId, resourceByIdUrl } from './api-url';

@Injectable({ providedIn: 'root' })
export class UnitsService {
  private readonly http = inject(HttpClient);
  private readonly session = inject(SessionService);

  getUnitsList(options?: {
    includeFleetTenure?: boolean;
    available?: boolean;
  }): Observable<Unit[]> {
    const companyId = requireCompanyId(this.session.companyId());
    return this.http
      .get<Record<string, unknown>[]>(
        companyResourceUrl(companyId, 'units', {
          includeFleetTenure: options?.includeFleetTenure,
          available: options?.available,
        }),
      )
      .pipe(map((rows) => (Array.isArray(rows) ? rows : []).map((r) => mapApiUnit(r))));
  }

  getUnitById(unitId: string): Observable<Unit> {
    return this.http
      .get<Record<string, unknown>>(resourceByIdUrl('units', unitId))
      .pipe(map((r) => mapApiUnit(r)));
  }

  postUnit(payload: CreateUnitPayload): Observable<Unit> {
    const companyId = requireCompanyId(this.session.companyId());
    return this.http
      .post<Record<string, unknown>>(companyResourceUrl(companyId, 'units'), payload)
      .pipe(map((r) => mapApiUnit(r)));
  }

  patchUnit(unit: Unit, draft?: UnitPersistDraft): Observable<Unit> {
    return this.http
      .patch<Record<string, unknown>>(
        resourceByIdUrl('units', unit.id),
        buildUnitWritePayload(unit, draft),
      )
      .pipe(map((r) => mapApiUnit(r)));
  }
}
