import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map, Observable } from 'rxjs';
import type { CreateEquipmentPayload } from '@shared/models/api/api-fleet.model';
import type { FleetMaintenanceAction } from '@shared/models/api/api-fleet-operational-status.model';
import type {
  Equipment,
  FleetDocumentKind,
  FleetStoredDocument,
} from '@shared/models/logistics.models';
import {
  buildEquipmentWritePayload,
  type EquipmentPersistDraft,
} from '@shared/utils/fleet/equipment-api-payload';
import { normalizeEquipmentFromApi } from '@shared/utils/fleet/normalize-fleet-entities';
import type { FleetResourceLinkOptionsResponse } from '@shared/models/api/api-fleet-link-options.model';
import { mapApiFleetResourceLinkOption } from '@shared/models/api/api-fleet-link-options.model';
import { buildFleetLinkOptionsQuery } from './fleet-link-options-query';
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

  getEquipmentLinkOptions(params?: {
    search?: string;
    id?: string;
    limit?: number;
  }): Observable<FleetResourceLinkOptionsResponse> {
    const companyId = requireCompanyId(this.session.companyId());
    const qs = buildFleetLinkOptionsQuery(params);
    const url = `${companyResourceUrl(companyId, 'equipment/link-options')}${qs ? `?${qs}` : ''}`;
    return this.http.get<Record<string, unknown>>(url).pipe(
      map((raw) => ({
        items: Array.isArray(raw['items'])
          ? (raw['items'] as Record<string, unknown>[]).map(mapApiFleetResourceLinkOption)
          : [],
      })),
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

  /** Soft delete (solo administrador). */
  deleteEquipment(equipmentId: string): Observable<{ id: number; deleted: boolean }> {
    const id = equipmentId.trim();
    return this.http.delete<{ id: number; deleted: boolean }>(
      resourceByIdUrl('equipment', id),
    );
  }

  /** Cambia estado operativo a mantenimiento o disponible (A6). */
  postEquipmentMaintenance(
    equipmentId: string,
    action: FleetMaintenanceAction,
  ): Observable<Equipment> {
    const id = equipmentId.trim();
    return this.http
      .post<Equipment>(resourceByIdUrl('equipment', id, `maintenance/${action}`), {})
      .pipe(map((row) => normalizeEquipmentFromApi(row)));
  }

  postEquipmentInsuranceSyncExpenses(equipmentId: string): Observable<Equipment> {
    const id = equipmentId.trim();
    return this.http
      .post<Equipment>(
        resourceByIdUrl('equipment', id, 'insurance/sync-expenses'),
        {},
      )
      .pipe(map((row) => normalizeEquipmentFromApi(row)));
  }

  uploadEquipmentDocument(
    equipmentId: string,
    documentKind: FleetDocumentKind,
    file: File,
  ): Observable<FleetStoredDocument> {
    const id = equipmentId.trim();
    const form = new FormData();
    form.append('file', file, file.name);
    form.append('documentKind', documentKind);
    return this.http
      .post<Record<string, unknown>>(
        resourceByIdUrl('equipment', id, 'documents'),
        form,
      )
      .pipe(
        map((raw) => ({
          id: Number(raw['id']),
          fileName: String(raw['fileName'] ?? file.name),
          documentKind: String(raw['documentKind'] ?? documentKind),
        })),
      );
  }

  downloadEquipmentDocument(
    equipmentId: string,
    documentId: number,
  ): Observable<{ url: string }> {
    const id = equipmentId.trim();
    return this.http.get<{ url: string }>(
      resourceByIdUrl('equipment', id, `documents/${documentId}/download`),
    );
  }

  deleteEquipmentDocument(
    equipmentId: string,
    documentId: number,
  ): Observable<{ id: number; deleted: boolean }> {
    const id = equipmentId.trim();
    return this.http.delete<{ id: number; deleted: boolean }>(
      resourceByIdUrl('equipment', id, `documents/${documentId}`),
    );
  }
}
