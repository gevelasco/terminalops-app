import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map, Observable } from 'rxjs';
import { mapApiOperationalCenter } from '@shared/data/operational-center-api-mapper';
import type { OperationalCenter } from '@shared/models/operational-center.models';
import { SessionService } from '../state/session';
import { companyResourceUrl, requireCompanyId } from './api-url';

@Injectable({ providedIn: 'root' })
export class OperationalCentersService {
  private readonly http = inject(HttpClient);
  private readonly session = inject(SessionService);

  getOperationalCentersList(): Observable<OperationalCenter[]> {
    const companyId = requireCompanyId(this.session.companyId());
    return this.http
      .get<Record<string, unknown>[]>(
        companyResourceUrl(companyId, 'operational-centers'),
      )
      .pipe(map((rows) => rows.map((r) => mapApiOperationalCenter(r))));
  }
}
