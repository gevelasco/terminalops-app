import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map, Observable, shareReplay, tap } from 'rxjs';
import type { Client, CreateClientPayload } from '@shared/models/client.models';
import { buildClientApiWriteBody } from '@features/clients/utils/client-payload';
import { mapApiClient } from '@shared/data/api-mappers';
import { SessionService } from '../state/session';
import { companyResourceUrl, requireCompanyId, resourceByIdUrl } from './api-url';

export type ClientPickerOption = {
  id: string;
  name: string;
};

@Injectable({ providedIn: 'root' })
export class ClientsService {
  private readonly http = inject(HttpClient);
  private readonly session = inject(SessionService);
  private pickerOptionsCache: Observable<ClientPickerOption[]> | null = null;

  getClientsList(): Observable<Client[]> {
    const companyId = requireCompanyId(this.session.companyId());
    return this.http
      .get<Record<string, unknown>[]>(companyResourceUrl(companyId, 'clients'))
      .pipe(map((rows) => rows.map((r) => mapApiClient(r))));
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
          shareReplay(1),
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
}
