import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map, Observable } from 'rxjs';
import { mapApiUnit } from '@shared/data/api-mappers';
import type { CreateUnitPayload } from '@shared/models/api/api-fleet.model';
import type { FleetMaintenanceAction } from '@shared/models/api/api-fleet-operational-status.model';
import type { Unit } from '@shared/models/logistics.models';
import {
  buildUnitWritePayload,
  type UnitPersistDraft,
} from '@shared/utils/fleet/unit-api-payload';
import type { FleetResourceLinkOptionsResponse } from '@shared/models/api/api-fleet-link-options.model';
import { mapApiFleetResourceLinkOption } from '@shared/models/api/api-fleet-link-options.model';
import { buildFleetLinkOptionsQuery } from './fleet-link-options-query';
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

  getUnitLinkOptions(params?: {
    search?: string;
    id?: string;
    limit?: number;
  }): Observable<FleetResourceLinkOptionsResponse> {
    const companyId = requireCompanyId(this.session.companyId());
    const qs = buildFleetLinkOptionsQuery(params);
    const url = `${companyResourceUrl(companyId, 'units/link-options')}${qs ? `?${qs}` : ''}`;
    return this.http.get<Record<string, unknown>>(url).pipe(
      map((raw) => ({
        items: Array.isArray(raw['items'])
          ? (raw['items'] as Record<string, unknown>[]).map(mapApiFleetResourceLinkOption)
          : [],
      })),
    );
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

  /** Soft delete (solo administrador). */
  deleteUnit(unitId: string): Observable<{ id: number; deleted: boolean }> {
    const id = unitId.trim();
    return this.http.delete<{ id: number; deleted: boolean }>(
      resourceByIdUrl('units', id),
    );
  }

  /** Cambia estado operativo a mantenimiento o disponible (A6). */
  postUnitMaintenance(
    unitId: string,
    action: FleetMaintenanceAction,
  ): Observable<Unit> {
    const id = unitId.trim();
    return this.http
      .post<Record<string, unknown>>(
        resourceByIdUrl('units', id, `maintenance/${action}`),
        {},
      )
      .pipe(map((r) => mapApiUnit(r)));
  }

  postUnitInsuranceSyncExpenses(unitId: string): Observable<Unit> {
    const id = unitId.trim();
    return this.http
      .post<Record<string, unknown>>(
        resourceByIdUrl('units', id, 'insurance/sync-expenses'),
        {},
      )
      .pipe(map((r) => mapApiUnit(r)));
  }
}
