import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map, Observable } from 'rxjs';
import type { CreateEquipmentPayload } from '@shared/models/api/api-fleet.model';
import type { Equipment } from '@shared/models/logistics.models';
import { normalizeEquipmentFromApi } from '@shared/utils/fleet/normalize-fleet-entities';
import { SessionService } from '../state/session';
import { companyResourceUrl, requireCompanyId } from './api-url';

@Injectable({ providedIn: 'root' })
export class EquipmentService {
  private readonly http = inject(HttpClient);
  private readonly session = inject(SessionService);

  getEquipmentList(): Observable<Equipment[]> {
    const companyId = requireCompanyId(this.session.companyId());
    return this.http
      .get<Equipment[]>(companyResourceUrl(companyId, 'equipment'))
      .pipe(
        map((rows) => (Array.isArray(rows) ? rows : []).map(normalizeEquipmentFromApi)),
      );
  }

  postEquipment(payload: CreateEquipmentPayload): Observable<Equipment> {
    const companyId = requireCompanyId(this.session.companyId());
    return this.http
      .post<Equipment>(companyResourceUrl(companyId, 'equipment'), payload)
      .pipe(map((row) => normalizeEquipmentFromApi(row)));
  }
}
