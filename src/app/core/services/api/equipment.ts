import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map, Observable } from 'rxjs';
import type { CreateEquipmentPayload } from '@shared/models/api/api-fleet.model';
import type { Equipment } from '@shared/models/logistics.models';
import {
  buildEquipmentWritePayload,
  type EquipmentPersistDraft,
} from '@shared/utils/fleet/equipment-api-payload';
import { normalizeEquipmentFromApi } from '@shared/utils/fleet/normalize-fleet-entities';
import { SessionService } from '../state/session';
import { companyResourceUrl, requireCompanyId, resourceByIdUrl } from './api-url';

@Injectable({ providedIn: 'root' })
export class EquipmentService {
  private readonly http = inject(HttpClient);
  private readonly session = inject(SessionService);

  getEquipmentList(options?: { includeFleetTenure?: boolean }): Observable<Equipment[]> {
    const companyId = requireCompanyId(this.session.companyId());
    return this.http
      .get<Equipment[]>(
        companyResourceUrl(companyId, 'equipment', {
          includeFleetTenure: options?.includeFleetTenure,
        }),
      )
      .pipe(
        map((rows) => (Array.isArray(rows) ? rows : []).map(normalizeEquipmentFromApi)),
      );
  }

  getEquipmentById(equipmentId: string): Observable<Equipment> {
    return this.http
      .get<Equipment>(resourceByIdUrl('equipment', equipmentId))
      .pipe(map((row) => normalizeEquipmentFromApi(row)));
  }

  postEquipment(payload: CreateEquipmentPayload): Observable<Equipment> {
    const companyId = requireCompanyId(this.session.companyId());
    return this.http
      .post<Equipment>(companyResourceUrl(companyId, 'equipment'), payload)
      .pipe(map((row) => normalizeEquipmentFromApi(row)));
  }

  patchEquipment(equipment: Equipment, draft?: EquipmentPersistDraft): Observable<Equipment> {
    return this.http
      .patch<Equipment>(
        resourceByIdUrl('equipment', equipment.id),
        buildEquipmentWritePayload(equipment, draft),
      )
      .pipe(map((row) => normalizeEquipmentFromApi(row)));
  }
}
