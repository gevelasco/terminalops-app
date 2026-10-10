import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map, Observable } from 'rxjs';
import type {
  Operator,
  OperatorAttachedDocument,
  OperatorDocumentSlot,
} from '@shared/models/logistics.models';
import { mapApiOperator } from '@shared/data/api-mappers';
import {
  mapApiOperatorOperationSummary,
  type OperatorOperationSummary,
} from '@features/operators/utils/operator-operation-summary';
import {
  buildOperatorCreatePayload,
  buildOperatorPatchPayload,
} from '@shared/utils/operator-api-payload';
import type { OperatorLinkOptionsResponse } from '@shared/models/api/api-fleet-link-options.model';
import { mapApiOperatorLinkOption } from '@shared/models/api/api-fleet-link-options.model';
import { buildFleetLinkOptionsQuery } from './fleet-link-options-query';
import {
  fetchAllResourcePages,
  mapResourceListPage,
  type ResourceListPage,
} from './resource-list';
import { SessionService } from '../state/session';
import { companyResourceUrl, requireCompanyId, resourceByIdUrl } from './api-url';

function mapOperatorStoredDocument(
  raw: Record<string, unknown>,
  fallback: { fileName: string; slot: OperatorDocumentSlot },
): OperatorAttachedDocument {
  return {
    id: String(raw['id'] ?? ''),
    fileName: String(raw['fileName'] ?? fallback.fileName),
    slot: (String(raw['slot'] ?? fallback.slot) as OperatorDocumentSlot),
    addedAt: String(raw['addedAt'] ?? new Date().toISOString().slice(0, 10)),
    hasStoredFile: raw['hasStoredFile'] !== false,
  };
}

@Injectable({ providedIn: 'root' })
export class OperatorsService {
  private readonly http = inject(HttpClient);
  private readonly session = inject(SessionService);

  getOperatorsPage(options?: {
    available?: boolean;
    page?: number;
    limit?: number;
  }): Observable<ResourceListPage<Operator>> {
    const companyId = requireCompanyId(this.session.companyId());
    return mapResourceListPage(
      this.http.get<ResourceListPage<Operator> | Record<string, unknown>[]>(
        companyResourceUrl(companyId, 'operators', {
          available: options?.available,
          page: options?.page,
          limit: options?.limit,
        }),
      ),
      mapApiOperator,
    );
  }

  /** Catálogo vía páginas de 100 (sin endpoint ilimitado). */
  getOperatorsList(options?: { available?: boolean }): Observable<Operator[]> {
    return fetchAllResourcePages((page) =>
      this.getOperatorsPage({ ...options, page, limit: 100 }),
    );
  }

  getOperatorLinkOptions(params?: {
    search?: string;
    id?: string;
    limit?: number;
  }): Observable<OperatorLinkOptionsResponse> {
    const companyId = requireCompanyId(this.session.companyId());
    const qs = buildFleetLinkOptionsQuery(params);
    const url = `${companyResourceUrl(companyId, 'operators/link-options')}${qs ? `?${qs}` : ''}`;
    return this.http.get<Record<string, unknown>>(url).pipe(
      map((raw) => ({
        items: Array.isArray(raw['items'])
          ? (raw['items'] as Record<string, unknown>[]).map(mapApiOperatorLinkOption)
          : [],
      })),
    );
  }

  getOperatorById(id: string): Observable<Operator | null> {
    return this.http
      .get<Record<string, unknown>>(resourceByIdUrl('operators', id))
      .pipe(map((r) => mapApiOperator(r)));
  }

  getOperatorOperationSummary(
    id: string,
    periodFrom?: string,
    periodTo?: string,
  ): Observable<OperatorOperationSummary> {
    const params: Record<string, string> = {};
    if (periodFrom) params['from'] = periodFrom;
    if (periodTo) params['to'] = periodTo;
    return this.http
      .get<Record<string, unknown>>(resourceByIdUrl('operators', id, 'operation-summary'), { params })
      .pipe(map((r) => mapApiOperatorOperationSummary(r)));
  }

  confirmOperatorTripPayment(
    operatorId: string,
    tripId: string,
    periodFrom?: string,
    periodTo?: string,
  ): Observable<OperatorOperationSummary> {
    const params: Record<string, string> = {};
    if (periodFrom?.trim()) {
      params['from'] = periodFrom.trim();
    }
    if (periodTo?.trim()) {
      params['to'] = periodTo.trim();
    }
    return this.http
      .post<Record<string, unknown>>(
        resourceByIdUrl('operators', operatorId, `trips/${tripId}/confirm-payment`),
        {},
        { params },
      )
      .pipe(map((r) => mapApiOperatorOperationSummary(r)));
  }

  revertOperatorTripPayment(
    operatorId: string,
    tripId: string,
    periodFrom?: string,
    periodTo?: string,
  ): Observable<OperatorOperationSummary> {
    const params: Record<string, string> = {};
    if (periodFrom?.trim()) {
      params['from'] = periodFrom.trim();
    }
    if (periodTo?.trim()) {
      params['to'] = periodTo.trim();
    }
    return this.http
      .post<Record<string, unknown>>(
        resourceByIdUrl('operators', operatorId, `trips/${tripId}/revert-payment`),
        {},
        { params },
      )
      .pipe(map((r) => mapApiOperatorOperationSummary(r)));
  }

  postOperator(payload: Omit<Operator, 'id'>): Observable<Operator> {
    const companyId = requireCompanyId(this.session.companyId());
    return this.http
      .post<Record<string, unknown>>(
        companyResourceUrl(companyId, 'operators'),
        buildOperatorCreatePayload(payload),
      )
      .pipe(map((r) => mapApiOperator(r)));
  }

  patchOperatorById(operator: Operator): Observable<Operator> {
    return this.http
      .patch<Record<string, unknown>>(
        resourceByIdUrl('operators', operator.id),
        buildOperatorPatchPayload(operator),
      )
      .pipe(map((r) => mapApiOperator(r)));
  }

  /** Marca al operador en vacaciones / descanso (RRHH). */
  startOperatorLeave(operatorId: string): Observable<Operator> {
    const id = operatorId.trim();
    return this.http
      .post<Record<string, unknown>>(
        resourceByIdUrl('operators', id, 'hr-hold/leave'),
        {},
      )
      .pipe(map((r) => mapApiOperator(r)));
  }

  /** Marca al operador incapacitado (RRHH). */
  startOperatorIncapacitated(operatorId: string): Observable<Operator> {
    const id = operatorId.trim();
    return this.http
      .post<Record<string, unknown>>(
        resourceByIdUrl('operators', id, 'hr-hold/incapacitated'),
        {},
      )
      .pipe(map((r) => mapApiOperator(r)));
  }

  /** Finaliza vacaciones o incapacidad; vuelve a `available`. */
  endOperatorHrHold(operatorId: string): Observable<Operator> {
    const id = operatorId.trim();
    return this.http
      .post<Record<string, unknown>>(
        resourceByIdUrl('operators', id, 'hr-hold/end'),
        {},
      )
      .pipe(map((r) => mapApiOperator(r)));
  }

  uploadOperatorDocument(
    operatorId: string,
    slot: OperatorDocumentSlot,
    file: File,
  ): Observable<OperatorAttachedDocument> {
    const id = operatorId.trim();
    const form = new FormData();
    form.append('file', file, file.name);
    form.append('slot', slot);
    return this.http
      .post<Record<string, unknown>>(
        resourceByIdUrl('operators', id, 'documents'),
        form,
      )
      .pipe(map((raw) => mapOperatorStoredDocument(raw, { fileName: file.name, slot })));
  }

  downloadOperatorDocument(
    operatorId: string,
    documentId: number,
  ): Observable<{ url: string }> {
    const id = operatorId.trim();
    return this.http.get<{ url: string }>(
      resourceByIdUrl('operators', id, `documents/${documentId}/download`),
    );
  }

  deleteOperatorDocument(
    operatorId: string,
    documentId: number,
  ): Observable<{ id: number; deleted: boolean }> {
    const id = operatorId.trim();
    return this.http.delete<{ id: number; deleted: boolean }>(
      resourceByIdUrl('operators', id, `documents/${documentId}`),
    );
  }
}
