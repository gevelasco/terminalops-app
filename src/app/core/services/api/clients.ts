import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { catchError, map, Observable, shareReplay, tap, throwError } from 'rxjs';
import { API_SHARE_REPLAY_CACHE } from '@shared/utils/share-replay-api-cache';
import type { ClientBalanceSummary } from '@features/clients/utils/client-balance-summary';
import type {
  Client,
  ClientAttachedDocument,
  ClientCommercialHealth,
  ClientDocumentSlot,
  CreateClientPayload,
} from '@shared/models/client.models';
import { buildClientApiWriteBody } from '@features/clients/utils/client-payload';
import { mapApiClient } from '@shared/data/api-mappers';
import { SessionService } from '../state/session';
import {
  fetchAllResourcePages,
  mapResourceListPage,
  type ResourceListPage,
} from './resource-list';
import { companyResourceUrl, requireCompanyId, resourceByIdUrl } from './api-url';

export type ClientPickerOption = {
  id: string;
  name: string;
};

export type ClientBalanceOverviewCardSummary = Pick<
  ClientBalanceSummary,
  'hasTrips' | 'completedCount' | 'receivable' | 'nextDueYmd' | 'upcomingPayments'
>;

export type ClientBalanceOverviewItem = {
  clientId: string;
  name: string;
  summary: ClientBalanceOverviewCardSummary;
  commercialHealth: ClientCommercialHealth;
};

export type ClientBalanceOverviewResponse = {
  asOf: string;
  items: ClientBalanceOverviewItem[];
};

function mapClientStoredDocument(
  raw: Record<string, unknown>,
  fallback: { fileName: string; slot: ClientDocumentSlot },
): ClientAttachedDocument {
  return {
    id: String(raw['id'] ?? ''),
    fileName: String(raw['fileName'] ?? fallback.fileName),
    slot: (String(raw['slot'] ?? fallback.slot) as ClientDocumentSlot),
    addedAt: String(raw['addedAt'] ?? new Date().toISOString().slice(0, 10)),
    hasStoredFile: raw['hasStoredFile'] !== false,
  };
}

@Injectable({ providedIn: 'root' })
export class ClientsService {
  private readonly http = inject(HttpClient);
  private readonly session = inject(SessionService);
  private pickerOptionsCache: Observable<ClientPickerOption[]> | null = null;

  getClientsPage(options?: {
    page?: number;
    limit?: number;
  }): Observable<ResourceListPage<Client>> {
    const companyId = requireCompanyId(this.session.companyId());
    return mapResourceListPage(
      this.http.get<ResourceListPage<Client> | Record<string, unknown>[]>(
        companyResourceUrl(companyId, 'clients', {
          page: options?.page,
          limit: options?.limit,
        }),
      ),
      mapApiClient,
    );
  }

  getClientsList(): Observable<Client[]> {
    return fetchAllResourcePages((page) =>
      this.getClientsPage({ page, limit: 100 }),
    );
  }

  /** Solo id + nombre desde GET /companies/:id/clients/picker */
  getClientPickerOptions(): Observable<ClientPickerOption[]> {
    if (!this.pickerOptionsCache) {
      const companyId = requireCompanyId(this.session.companyId());
      this.pickerOptionsCache = this.http
        .get<Array<{ id: number | string; name: string }>>(
          companyResourceUrl(companyId, 'clients/picker'),
        )
        .pipe(
          map((rows) =>
            rows.map((row) => ({
              id: String(row.id ?? ''),
              name: String(row.name ?? '').trim() || 'Sin nombre',
            })),
          ),
          catchError((err) => {
            this.pickerOptionsCache = null;
            return throwError(() => err);
          }),
          shareReplay(API_SHARE_REPLAY_CACHE),
        );
    }
    return this.pickerOptionsCache;
  }

  invalidateClientPickerCache(): void {
    this.pickerOptionsCache = null;
  }

  getClientById(id: string): Observable<Client | null> {
    return this.http
      .get<Record<string, unknown>>(resourceByIdUrl('clients', id))
      .pipe(map((r) => mapApiClient(r)));
  }

  postClient(payload: CreateClientPayload): Observable<Client> {
    const companyId = requireCompanyId(this.session.companyId());
    return this.http
      .post<Record<string, unknown>>(
        companyResourceUrl(companyId, 'clients'),
        buildClientApiWriteBody(payload),
      )
      .pipe(
        map((r) => mapApiClient(r)),
        tap(() => this.invalidateClientPickerCache()),
      );
  }

  patchClientById(client: Client): Observable<Client> {
    return this.http
      .patch<Record<string, unknown>>(
        resourceByIdUrl('clients', client.id),
        buildClientApiWriteBody(client),
      )
      .pipe(
        map((r) => mapApiClient(r)),
        tap(() => this.invalidateClientPickerCache()),
      );
  }

  /** Soft delete (admin en UI). Oculto en Comercial; maniobras conservan referencia. */
  deleteClient(clientId: string): Observable<{ id: number; deleted: boolean }> {
    const id = clientId.trim();
    return this.http
      .delete<{ id: number; deleted: boolean }>(resourceByIdUrl('clients', id))
      .pipe(tap(() => this.invalidateClientPickerCache()));
  }

  uploadClientDocument(
    clientId: string,
    slot: ClientDocumentSlot,
    file: File,
  ): Observable<ClientAttachedDocument> {
    const id = clientId.trim();
    const form = new FormData();
    form.append('file', file, file.name);
    form.append('slot', slot);
    return this.http
      .post<Record<string, unknown>>(
        resourceByIdUrl('clients', id, 'documents'),
        form,
      )
      .pipe(map((raw) => mapClientStoredDocument(raw, { fileName: file.name, slot })));
  }

  downloadClientDocument(
    clientId: string,
    documentId: number,
  ): Observable<{ url: string }> {
    const id = clientId.trim();
    return this.http.get<{ url: string }>(
      resourceByIdUrl('clients', id, `documents/${documentId}/download`),
    );
  }

  deleteClientDocument(
    clientId: string,
    documentId: number,
  ): Observable<{ id: number; deleted: boolean }> {
    const id = clientId.trim();
    return this.http.delete<{ id: number; deleted: boolean }>(
      resourceByIdUrl('clients', id, `documents/${documentId}`),
    );
  }

  getClientsBalanceOverview(): Observable<ClientBalanceOverviewResponse> {
    const companyId = requireCompanyId(this.session.companyId());
    return this.http.get<ClientBalanceOverviewResponse>(
      companyResourceUrl(companyId, 'clients/balance-overview'),
    );
  }

  getClientBalance(
    clientId: string,
    periodFrom?: string,
    periodTo?: string,
  ): Observable<ClientBalanceSummary> {
    const companyId = requireCompanyId(this.session.companyId());
    const id = clientId.trim();
    const params: Record<string, string> = {};
    if (periodFrom) params['from'] = periodFrom;
    if (periodTo) params['to'] = periodTo;
    return this.http.get<ClientBalanceSummary>(
      companyResourceUrl(companyId, `clients/${id}/balance`),
      { params },
    );
  }
}
